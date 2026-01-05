from datetime import date, datetime, timedelta
import os
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import pandas as pd
import psycopg2
from psycopg2 import extras
from flask import Flask, jsonify, request
from flask_cors import CORS

from nepse import Nepse

app = Flask(__name__)
CORS(app)

nepse = Nepse()
nepse.setTLSVerification(False)

routes = {
    "PriceVolume": "/PriceVolume",
    "Summary": "/Summary",
    "TopGainers": "/TopGainers",
    "TopLosers": "/TopLosers",
    "LiveMarket": "/LiveMarket",
    "IsNepseOpen": "/IsNepseOpen",
    "CompanyList": "/CompanyList",
    "SecurityList": "/SecurityList",
    "AllStocks": "/AllStocks",
    "StockPrice": "/StockPrice",
    "SimulateTrade": "/simulateTrade",
    "CheckProfitLoss": "/checkProfitLoss",
    "SectorOverview": "/SectorOverview",
}

# In-memory storage for simulated trades
simulated_trades = {}


def _safe_float(value, default=None):
    try:
        if value in (None, ""):
            return default
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return default


def _safe_int(value, default=None):
    try:
        if value in (None, ""):
            return default
        return int(float(str(value).replace(",", "")))
    except (TypeError, ValueError):
        return default


def _normalize_database_url():
    raw_url = os.environ.get("DATABASE_URL")
    if not raw_url:
        raise RuntimeError("DATABASE_URL is not set")

    # Some platforms still provide postgres:// but psycopg2 prefers postgresql://
    if raw_url.startswith("postgres://"):
        raw_url = "postgresql://" + raw_url[len("postgres://"):]

    parsed = urlparse(raw_url)
    query = parse_qs(parsed.query)
    if "sslmode" not in query:
        query["sslmode"] = ["require"]

    return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))


def get_db_connection():
    return psycopg2.connect(_normalize_database_url())


DAILY_OHLC_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS daily_ohlc (
    id BIGSERIAL PRIMARY KEY,
    trading_date DATE NOT NULL,
    security_id BIGINT NULL,
    symbol TEXT NOT NULL,
    security_name TEXT NULL,
    sector TEXT NULL,
    open_price DOUBLE PRECISION NULL,
    high_price DOUBLE PRECISION NULL,
    low_price DOUBLE PRECISION NULL,
    close_price DOUBLE PRECISION NULL,
    prev_close DOUBLE PRECISION NULL,
    volume DOUBLE PRECISION NULL,
    trade_qty DOUBLE PRECISION NULL,
    trade_value DOUBLE PRECISION NULL,
    pct_change DOUBLE PRECISION NULL,
    last_updated TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (symbol, trading_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_ohlc_symbol
    ON daily_ohlc (symbol);

CREATE INDEX IF NOT EXISTS idx_daily_ohlc_trading_date
    ON daily_ohlc (trading_date);
"""

UPSERT_DAILY_OHLC_SQL = """
INSERT INTO daily_ohlc (
    trading_date,
    security_id,
    symbol,
    security_name,
    sector,
    open_price,
    high_price,
    low_price,
    close_price,
    prev_close,
    volume,
    trade_qty,
    trade_value,
    pct_change,
    last_updated
)
VALUES (
    COALESCE(%(last_updated)s::timestamptz::date, CURRENT_DATE),
    %(security_id)s,
    %(symbol)s,
    %(security_name)s,
    %(sector)s,
    %(open_price)s,
    %(high_price)s,
    %(low_price)s,
    %(close_price)s,
    %(prev_close)s,
    %(volume)s,
    %(trade_qty)s,
    %(trade_value)s,
    %(pct_change)s,
    %(last_updated)s
)
ON CONFLICT (symbol, trading_date)
DO UPDATE SET
    security_id = EXCLUDED.security_id,
    security_name = EXCLUDED.security_name,
    sector = EXCLUDED.sector,
    open_price = EXCLUDED.open_price,
    high_price = EXCLUDED.high_price,
    low_price = EXCLUDED.low_price,
    close_price = EXCLUDED.close_price,
    prev_close = EXCLUDED.prev_close,
    volume = EXCLUDED.volume,
    trade_qty = EXCLUDED.trade_qty,
    trade_value = EXCLUDED.trade_value,
    pct_change = EXCLUDED.pct_change,
    last_updated = EXCLUDED.last_updated;
"""


def init_db():
    """
    Creates daily_ohlc table + indexes.
    psycopg2 does best with one statement at a time, so we split by ';'.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            statements = [s.strip() for s in DAILY_OHLC_SCHEMA_SQL.split(";") if s.strip()]
            for stmt in statements:
                cur.execute(stmt)
        conn.commit()
    finally:
        conn.close()


_ohlc_ready = False


def ensure_ohlc_table():
    global _ohlc_ready
    if _ohlc_ready:
        return
    init_db()
    _ohlc_ready = True


def _parse_last_updated(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def refresh_daily_ohlc():
    """
    Pulls the latest daily snapshot from NEPSE and upserts into daily_ohlc.
    Safe to run multiple times per day due to UNIQUE(symbol, trading_date).
    """
    companies = nepse.getCompanyList()
    company_by_symbol = {c.get("symbol", "").upper(): c for c in companies if c.get("symbol")}

    rows = nepse.getPriceVolume()
    payloads = []

    for r in rows:
        symbol = str(r.get("symbol", "")).upper()
        if not symbol:
            continue

        comp = company_by_symbol.get(symbol, {})
        sector = comp.get("sectorName") or comp.get("marketSector") or None

        last_updated_dt = _parse_last_updated(r.get("lastUpdatedDateTime"))
        last_updated_str = last_updated_dt.isoformat() if last_updated_dt else None

        # volume fallback: prefer lastTradedVolume, then totalTradeQuantity
        volume_value = r.get("lastTradedVolume")
        if volume_value is None:
            volume_value = r.get("totalTradeQuantity")

        payloads.append(
            {
                "security_id": _safe_int(r.get("securityId")),
                "symbol": symbol,
                "security_name": r.get("securityName") or comp.get("securityName") or comp.get("companyName"),
                "sector": sector,
                "open_price": _safe_float(r.get("openPrice")),
                "high_price": _safe_float(r.get("highPrice")),
                "low_price": _safe_float(r.get("lowPrice")),
                "close_price": _safe_float(r.get("lastTradedPrice")),
                "prev_close": _safe_float(r.get("previousClose")),
                "volume": _safe_float(volume_value),
                "trade_qty": _safe_float(r.get("totalTradeQuantity")),
                "trade_value": _safe_float(r.get("totalTradeValue")),
                "pct_change": _safe_float(r.get("percentageChange")),
                "last_updated": last_updated_str,
            }
        )

    if not payloads:
        return {"upserted": 0, "message": "No rows from NEPSE"}

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            extras.execute_batch(cur, UPSERT_DAILY_OHLC_SQL, payloads, page_size=200)
        conn.commit()
        return {"upserted": len(payloads)}
    finally:
        conn.close()


def _fetch_all(query, params=None):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute(query, params or ())
            return cur.fetchall()
    finally:
        conn.close()


def _fetch_one(query, params=None):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute(query, params or ())
            return cur.fetchone()
    finally:
        conn.close()


@app.route("/")
def getIndex():
    content = "<BR>".join([f"<a href={value}> {key} </a>" for key, value in routes.items()])
    return f"Serving hot stock data <BR>{content}"


@app.route(routes["Summary"])
def getSummary():
    return jsonify(_getSummary())


def _getSummary():
    response = {}
    for obj in nepse.getSummary():
        response[obj["detail"]] = obj["value"]
    return response


@app.route(routes["IsNepseOpen"])
def isNepseOpen():
    return jsonify(nepse.isNepseOpen())


@app.route(routes["TopGainers"])
def getTopGainers():
    return jsonify(nepse.getTopGainers())


@app.route(routes["TopLosers"])
def getTopLosers():
    return jsonify(nepse.getTopLosers())


@app.route(routes["LiveMarket"])
def getLiveMarket():
    return jsonify(nepse.getLiveMarket())


@app.route(routes["CompanyList"])
def getCompanyList():
    return jsonify(nepse.getCompanyList())


@app.route(routes["SecurityList"])
def getSecurityList():
    return jsonify(nepse.getSecurityList())


@app.route(routes["PriceVolume"])
def getPriceVolume():
    return jsonify(nepse.getPriceVolume())


@app.route(routes["SectorOverview"])
def getSectorOverview():
    companies = nepse.getCompanyList()
    price_volume = {obj["symbol"]: obj for obj in nepse.getPriceVolume()}
    sub_indices = {obj["index"]: obj for obj in nepse.getNepseSubIndices()}

    sector_mapper = {
        "Commercial Banks": "Banking SubIndex",
        "Development Banks": "Development Bank Index",
        "Finance": "Finance Index",
        "Hotels And Tourism": "Hotels And Tourism Index",
        "Hydro Power": "HydroPower Index",
        "Investment": "Investment Index",
        "Life Insurance": "Life Insurance",
        "Manufacturing And Processing": "Manufacturing And Processing",
        "Microfinance": "Microfinance Index",
        "Mutual Fund": "Mutual Fund",
        "Non Life Insurance": "Non Life Insurance",
        "Others": "Others Index",
        "Tradings": "Trading Index",
    }

    sectors = {}
    for company in companies:
        symbol = company.get("symbol")
        sector_name = company.get("sectorName", "Others")
        if not symbol:
            continue

        sector_info = sectors.setdefault(
            sector_name,
            {
                "sectorName": sector_name,
                "subIndex": sector_mapper.get(sector_name),
                "subIndexData": {},
                "totalTurnover": 0.0,
                "totalTrades": 0,
                "totalTradeQuantity": 0.0,
                "companies": [],
            },
        )

        price_info = price_volume.get(symbol, {})
        turnover = _safe_float(price_info.get("turnover"), default=0.0) or 0.0
        trades = _safe_int(price_info.get("totalTrades"), default=0) or 0
        trade_quantity = price_info.get("totalTradedQuantity")
        if trade_quantity is None:
            trade_quantity = price_info.get("totalTradeQuantity")
        trade_quantity_value = _safe_float(trade_quantity, default=0.0) or 0.0

        sector_info["totalTurnover"] += turnover
        sector_info["totalTrades"] += trades
        sector_info["totalTradeQuantity"] += trade_quantity_value

        sector_info["companies"].append(
            {
                "symbol": symbol,
                "companyName": company.get("companyName"),
                "sectorName": sector_name,
                "lastTradedPrice": _safe_float(price_info.get("lastTradedPrice")),
                "pointChange": _safe_float(price_info.get("pointChange")),
                "percentageChange": _safe_float(price_info.get("percentageChange")),
            }
        )

    for sector_name, info in sectors.items():
        index_name = info["subIndex"]
        if index_name:
            index_data = sub_indices.get(index_name, {})
            if index_data:
                info["subIndexData"] = {
                    "currentValue": _safe_float(index_data.get("currentValue")),
                    "pointChange": _safe_float(index_data.get("pointChange")),
                    "percentageChange": _safe_float(index_data.get("percentageChange")),
                }
        info["companies"].sort(key=lambda company: company["symbol"])

    response = {
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        "sectors": sorted(sectors.values(), key=lambda item: item["sectorName"]),
    }

    return jsonify(response)


@app.route(routes["AllStocks"])
def getAllStocks():
    company_list = nepse.getCompanyList()
    all_stocks = []

    price_data = nepse.getPriceVolume()
    price_df = pd.DataFrame(price_data)

    for company in company_list:
        try:
            symbol = company["symbol"]
            row = price_df[price_df["symbol"].str.upper() == symbol.upper()]
            if row.empty:
                continue

            price = float(row["lastTradedPrice"].values[0])
            change = float(row["percentageChange"].values[0])

            stock_info = {"symbol": symbol, "price": price, "changePercent": change}
            all_stocks.append(stock_info)

        except Exception as e:
            print(f"Error fetching data for {company.get('symbol')}: {str(e)}")
            continue

    return jsonify(all_stocks)


@app.route(routes["StockPrice"])
def getStockPrice():
    symbol = request.args.get("symbol")
    if not symbol:
        return jsonify({"error": "Symbol not provided"}), 400

    try:
        price_data = nepse.getPriceVolume()
        df = pd.DataFrame(price_data)
        row = df[df["symbol"].str.upper() == symbol.upper()]

        if row.empty:
            return jsonify({"error": "Stock not found"}), 404

        price = float(row["lastTradedPrice"].values[0])
        return jsonify({"symbol": symbol.upper(), "price": price})

    except Exception as e:
        print(f"Error fetching stock price for {symbol}: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@app.route(routes["SimulateTrade"], methods=["POST"])
def simulateTrade():
    data = request.json or {}
    symbol = data.get("symbol")
    credits = data.get("credits")

    if not symbol or credits is None:
        return jsonify({"error": "Symbol and credits are required"}), 400

    try:
        price_data = nepse.getPriceVolume()
        df = pd.DataFrame(price_data)
        row = df[df["symbol"].str.upper() == symbol.upper()]

        if row.empty:
            return jsonify({"error": "Stock not found"}), 404

        price = float(row["lastTradedPrice"].values[0])
        shares = float(credits) / price

        simulated_trades[symbol.upper()] = {
            "symbol": symbol.upper(),
            "credits": credits,
            "shares": shares,
            "price": price,
            "timestamp": datetime.now(),
        }

        return jsonify(
            {
                "symbol": symbol.upper(),
                "creditsUsed": credits,
                "sharesBought": shares,
                "priceAtPurchase": price,
            }
        )

    except Exception as e:
        print(f"Error simulating trade for {symbol}: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


@app.route(routes["CheckProfitLoss"], methods=["GET"])
def checkProfitLoss():
    symbol = request.args.get("symbol")
    if not symbol:
        return jsonify({"error": "Symbol is required"}), 400

    trade = simulated_trades.get(symbol.upper())
    if not trade:
        return jsonify({"error": "No simulated trade found for this symbol"}), 404

    try:
        time_elapsed = datetime.now() - trade["timestamp"]
        if time_elapsed < timedelta(days=1):
            return jsonify({"error": "You can only check profit/loss after one day"}), 400

        price_data = nepse.getPriceVolume()
        df = pd.DataFrame(price_data)
        row = df[df["symbol"].str.upper() == symbol.upper()]

        if row.empty:
            return jsonify({"error": "Stock not found"}), 404

        current_price = float(row["lastTradedPrice"].values[0])
        profit_loss = (current_price - trade["price"]) * trade["shares"]
        profit_loss_percentage = ((current_price - trade["price"]) / trade["price"]) * 100

        return jsonify(
            {
                "symbol": symbol.upper(),
                "priceAtPurchase": trade["price"],
                "currentPrice": current_price,
                "profitLoss": profit_loss,
                "profitLossPercentage": profit_loss_percentage,
            }
        )

    except Exception as e:
        print(f"Error checking profit/loss for {symbol}: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


def _parse_date(value):
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


@app.route("/api/ohlc/refresh", methods=["GET", "POST"])
def ohlc_refresh_now():
    ensure_ohlc_table()
    result = refresh_daily_ohlc()
    return jsonify(result)


@app.route("/api/ohlc/<symbol>")
def get_ohlc_history(symbol):
    ensure_ohlc_table()

    from_param = request.args.get("from")
    to_param = request.args.get("to")
    limit_param = request.args.get("limit", "90")

    try:
        limit = int(limit_param)
    except ValueError:
        return jsonify({"error": "limit must be an integer"}), 400

    from_date = _parse_date(from_param)
    to_date = _parse_date(to_param)

    if not to_date:
        to_date = date.today()
    if not from_date:
        from_date = to_date - timedelta(days=90)

    rows = _fetch_all(
        """
        SELECT trading_date,
               open_price,
               high_price,
               low_price,
               close_price,
               prev_close,
               volume,
               trade_qty,
               trade_value,
               pct_change
          FROM daily_ohlc
         WHERE symbol = %s
           AND trading_date BETWEEN %s AND %s
         ORDER BY trading_date ASC
         LIMIT %s
        """,
        (symbol.upper(), from_date, to_date, limit),
    )

    response = [
        {
            "date": row["trading_date"].isoformat(),
            "open": row["open_price"],
            "high": row["high_price"],
            "low": row["low_price"],
            "close": row["close_price"],
            "prev_close": row["prev_close"],
            "volume": row["volume"],
            "trade_qty": row["trade_qty"],
            "trade_value": row["trade_value"],
            "pct_change": row["pct_change"],
        }
        for row in rows
    ]

    return jsonify(response)


@app.route("/api/ohlc/latest/<symbol>")
def get_latest_ohlc(symbol):
    ensure_ohlc_table()

    row = _fetch_one(
        """
        SELECT trading_date,
               open_price,
               high_price,
               low_price,
               close_price,
               prev_close,
               volume,
               trade_qty,
               trade_value,
               pct_change
          FROM daily_ohlc
         WHERE symbol = %s
         ORDER BY trading_date DESC
         LIMIT 1
        """,
        (symbol.upper(),),
    )

    if not row:
        return jsonify({"error": "No data found"}), 404

    return jsonify(
        {
            "date": row["trading_date"].isoformat(),
            "open": row["open_price"],
            "high": row["high_price"],
            "low": row["low_price"],
            "close": row["close_price"],
            "prev_close": row["prev_close"],
            "volume": row["volume"],
            "trade_qty": row["trade_qty"],
            "trade_value": row["trade_value"],
            "pct_change": row["pct_change"],
        }
    )


@app.route("/api/ohlc/symbols")
def get_ohlc_symbols():
    ensure_ohlc_table()
    rows = _fetch_all(
        """
        SELECT DISTINCT symbol
          FROM daily_ohlc
         ORDER BY symbol ASC
        """
    )
    return jsonify([row["symbol"] for row in rows])


@app.route("/get_user")
def get_user():
    username = request.args.get("username")
    if not username:
        return jsonify({"error": "Username not provided"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
        cursor.execute(
            "SELECT id, username, credits FROM users WHERE username = %s",
            (username,),
        )
        user = cursor.fetchone()
        conn.close()

        if user:
            return jsonify(
                {"id": user["id"], "username": user["username"], "credits": user["credits"]}
            )
        return jsonify({"error": "User not found"}), 404

    except psycopg2.errors.UndefinedTable:
        # Users table not migrated to Postgres yet
        return jsonify({"error": "users table not found in Postgres yet"}), 501

    except Exception as e:
        print(f"Error fetching user data: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500


# Ensure table on startup too (safe, but ensure_ohlc_table is the real safety net)
try:
    init_db()
except Exception as e:
    print("init_db failed at startup:", str(e))


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)
