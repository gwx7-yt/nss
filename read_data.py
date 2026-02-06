from datetime import date, datetime, timedelta
import json
import os
import math
import threading
import time
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse



import httpx
import pandas as pd
import psycopg2
from psycopg2 import extras
from flask import Flask, jsonify, request
from flask_cors import CORS
import requests, certifi



from nepse import Nepse

app = Flask(__name__)
CORS(app)

nepse = Nepse()
nepse.setTLSVerification(False)

NEPSE_BASE = os.environ.get("NEPSE_BASE", "https://www.nepalstock.com").rstrip("/")
NEPSE_DEFAULT_HEADERS = {
    "User-Agent": os.environ.get(
        "NEPSE_USER_AGENT",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ),
    "Referer": os.environ.get("NEPSE_REFERER", "https://www.nepalstock.com/"),
    "Accept": "application/json, text/plain, */*",
}
CACHE_TTL_SECONDS = 15 * 60
RATE_LIMIT_MAX_REQUESTS = 30
RATE_LIMIT_WINDOW_SECONDS = 60
_cache_lock = threading.Lock()
_cache_store = {}
_rate_limit_lock = threading.Lock()
_rate_limit_bucket = {}

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
    "NepseIndex": "/api/nepse-index",
}

# In-memory storage for simulated trades
simulated_trades = {}

OHLC_HISTORY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "ohlc_history.json")
  
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


def _cache_get(key):
    now = time.time()
    with _cache_lock:
        entry = _cache_store.get(key)
        if not entry:
            return None
        if now - entry["ts"] >= CACHE_TTL_SECONDS:
            _cache_store.pop(key, None)
            return None
        return entry["value"]


def _cache_set(key, value):
    with _cache_lock:
        _cache_store[key] = {"ts": time.time(), "value": value}


def _safe_json_number(value):
    if value is None:
        return None
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return float(value)


def _parse_time_to_unix_seconds(value):
    if value in (None, ""):
        return None

    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric > 1_000_000_000_000:
            return int(numeric / 1000)
        if numeric > 1_000_000_000:
            return int(numeric)
        return None

    value_str = str(value).strip()
    if not value_str:
        return None

    try:
        numeric = float(value_str)
        if numeric > 1_000_000_000_000:
            return int(numeric / 1000)
        if numeric > 1_000_000_000:
            return int(numeric)
    except ValueError:
        pass

    date_value = value_str.replace("Z", "+00:00")
    formats = [
        "%Y-%m-%d",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
    ]

    try:
        parsed = datetime.fromisoformat(date_value)
        return int(parsed.timestamp())
    except ValueError:
        pass

    for fmt in formats:
        try:
            parsed = datetime.strptime(value_str, fmt)
            return int(parsed.timestamp())
        except ValueError:
            continue

    return None


def _ensure_ohlc_history_store():
    directory = os.path.dirname(OHLC_HISTORY_PATH)
    if directory and not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)

    if not os.path.exists(OHLC_HISTORY_PATH):
        empty_payload = {"updatedAt": None, "symbols": {}}
        with open(OHLC_HISTORY_PATH, "w", encoding="utf-8") as handle:
            json.dump(empty_payload, handle, ensure_ascii=False, indent=2, sort_keys=True)


def _load_ohlc_history():
    if not os.path.exists(OHLC_HISTORY_PATH):
        return {"updatedAt": None, "symbols": {}}, "OHLC history store not found"

    try:
        with open(OHLC_HISTORY_PATH, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        return {"updatedAt": None, "symbols": {}}, f"Unable to read OHLC history store: {exc}"

    if not isinstance(payload, dict):
        return {"updatedAt": None, "symbols": {}}, "OHLC history store has invalid format"

    symbols = payload.get("symbols")
    if not isinstance(symbols, dict):
        payload["symbols"] = {}

    return payload, None


def _save_ohlc_history(payload):
    _ensure_ohlc_history_store()
    directory = os.path.dirname(OHLC_HISTORY_PATH)
    temp_path = os.path.join(directory, "ohlc_history.json.tmp")
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
    os.replace(temp_path, OHLC_HISTORY_PATH)


def _get_ohlc_candles_for_symbol(symbol):
    payload, message = _load_ohlc_history()
    candles = payload.get("symbols", {}).get(symbol.upper(), [])
    if not isinstance(candles, list):
        candles = []
    return candles, message


def _enforce_rate_limit(route_name):
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",", 1)[0].strip()

    key = f"{route_name}:{client_ip}"
    now = time.time()

    with _rate_limit_lock:
        bucket = _rate_limit_bucket.get(key)
        if not bucket or now - bucket["window_start"] >= RATE_LIMIT_WINDOW_SECONDS:
            _rate_limit_bucket[key] = {"window_start": now, "count": 1}
            return None

        bucket["count"] += 1
        if bucket["count"] > RATE_LIMIT_MAX_REQUESTS:
            retry_after = max(1, int(RATE_LIMIT_WINDOW_SECONDS - (now - bucket["window_start"])))
            return jsonify({"error": "Rate limit exceeded", "retryAfter": retry_after}), 429

    return None


def _extract_candles_from_history_payload(payload):
    if isinstance(payload, list):
        return payload

    if not isinstance(payload, dict):
        return []

    for key in ["content", "data", "history", "ohlc", "candles", "rows", "items"]:
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            for nested_key in ["content", "data", "rows", "items"]:
                nested_val = value.get(nested_key)
                if isinstance(nested_val, list):
                    return nested_val

    return []


def _normalize_candle_row(raw):
    if not isinstance(raw, dict):
        return None

    time_value = (
        raw.get("time")
        or raw.get("timestamp")
        or raw.get("date")
        or raw.get("businessDate")
        or raw.get("tradeDate")
    )
    unix_time = _parse_time_to_unix_seconds(time_value)

    open_price = _safe_float(raw.get("open") if raw.get("open") is not None else raw.get("openPrice"))
    high_price = _safe_float(raw.get("high") if raw.get("high") is not None else raw.get("highPrice"))
    low_price = _safe_float(raw.get("low") if raw.get("low") is not None else raw.get("lowPrice"))
    close_price = _safe_float(
        raw.get("close")
        if raw.get("close") is not None
        else raw.get("closePrice", raw.get("lastTradedPrice"))
    )
    volume = _safe_float(
        raw.get("volume")
        if raw.get("volume") is not None
        else raw.get("totalTradeQuantity", raw.get("lastTradedVolume"))
    )

    if (
        unix_time is None
        or open_price is None
        or high_price is None
        or low_price is None
        or close_price is None
    ):
        return None

    return {
        "time": int(unix_time),
        "open": _safe_json_number(open_price),
        "high": _safe_json_number(high_price),
        "low": _safe_json_number(low_price),
        "close": _safe_json_number(close_price),
        "volume": _safe_json_number(volume) or 0.0,
    }

from requests.exceptions import SSLError, RequestException

from requests.exceptions import SSLError, RequestException

def _fetch_nepse_json(path):
    # Render can't resolve newweb.nepalstock.com.np in your case, so we skip it on purpose.
    bases = [
        "https://www.nepalstock.com",
        "https://nepalstock.com",
    ]

    # Only include NEPSE_BASE if it's NOT the broken newweb host
    base_env = (NEPSE_BASE or "").strip().rstrip("/")
    if base_env and "newweb.nepalstock.com.np" not in base_env:
        bases.insert(0, base_env)

    last_err = None

    for base in bases:
        base = (base or "").strip().rstrip("/")
        if not base:
            continue

        url = f"{base}{path}"

        # Try verified first
        try:
            r = requests.get(
                url,
                headers=NEPSE_DEFAULT_HEADERS,
                timeout=20,
                verify=certifi.where(),
            )
            r.raise_for_status()
            return r.json()
        except SSLError:
            # Fallback: match your nepse.setTLSVerification(False) behavior
            try:
                r = requests.get(
                    url,
                    headers=NEPSE_DEFAULT_HEADERS,
                    timeout=20,
                    verify=False,
                )
                r.raise_for_status()
                return r.json()
            except Exception as e:
                last_err = e
                continue
        except RequestException as e:
            last_err = e
            continue

    raise last_err

def _get_nepse_session():
    # Try common attribute names used by different versions/implementations
    candidates = [
        "session",
        "_session",
        "_Nepse__session",
        "client",
        "_client",
        "_Nepse__client",
        "s",
        "_s",
    ]

    for name in candidates:
        obj = getattr(nepse, name, None)
        if obj is None:
            continue

        # Direct requests.Session-like
        if hasattr(obj, "get") and hasattr(obj, "cookies"):
            return obj

        # Wrapped client that contains a session
        inner = getattr(obj, "session", None)
        if inner is not None and hasattr(inner, "get") and hasattr(inner, "cookies"):
            return inner

    # Last resort: scan attributes for something session-ish
    for name in dir(nepse):
        if "session" not in name.lower():
            continue
        obj = getattr(nepse, name, None)
        if obj is not None and hasattr(obj, "get") and hasattr(obj, "cookies"):
            return obj

    return None


def _fetch_history_via_nepse(security_id):
    sess = _get_nepse_session()
    if sess is None:
        raise AttributeError("Could not locate an authenticated session inside Nepse() instance")

    url = f"{NEPSE_BASE}/api/nots/market/history/security/{security_id}"

    # Works for httpx.Client (no verify kw) and requests.Session
    try:
        resp = sess.get(
            url,
            headers=NEPSE_DEFAULT_HEADERS,
            timeout=20,
        )
    except TypeError:
        # fallback for other client signatures
        resp = sess.get(url)

    # httpx response has raise_for_status(), requests response too
    resp.raise_for_status()
    return resp.json()




def _fetch_symbol_for_security(security_id):
    try:
        payload = _fetch_nepse_json(f"/api/nots/security/{security_id}")
    except Exception:
        return str(security_id)

    if isinstance(payload, dict):
        for key in ["symbol", "stockSymbol", "ticker"]:
            value = payload.get(key)
            if value:
                return str(value)
        for key in ["data", "content"]:
            nested = payload.get(key)
            if isinstance(nested, dict):
                for nested_key in ["symbol", "stockSymbol", "ticker"]:
                    value = nested.get(nested_key)
                    if value:
                        return str(value)

    return str(security_id)


def _get_or_fetch_ta_history(security_id):
    cache_key = f"ta_history:{security_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    symbol = _fetch_symbol_for_security(security_id)
    raw_candles, _ = _get_ohlc_candles_for_symbol(symbol)
    candles = []
    for row in raw_candles:
        normalized = _normalize_candle_row(
            {
                "date": row.get("date"),
                "open": row.get("open"),
                "high": row.get("high"),
                "low": row.get("low"),
                "close": row.get("close"),
                "volume": row.get("volume"),
            }
        )
        if normalized is not None:
            candles.append(normalized)

    candles.sort(key=lambda item: item["time"])

    history_payload = {
        "symbol": symbol,
        "securityId": security_id,
        "candles": candles,
    }

    _cache_set(cache_key, history_payload)
    return history_payload


def _sma(values, period, times):
    if len(values) < period:
        return []
    output = []
    window_sum = sum(values[:period])
    output.append({"time": times[period - 1], "value": _safe_json_number(window_sum / period)})
    for idx in range(period, len(values)):
        window_sum += values[idx] - values[idx - period]
        output.append({"time": times[idx], "value": _safe_json_number(window_sum / period)})
    return output


def _ema(values, period, times):
    if len(values) < period:
        return []
    output = []
    initial = sum(values[:period]) / period
    multiplier = 2 / (period + 1)
    ema_prev = initial
    output.append({"time": times[period - 1], "value": _safe_json_number(ema_prev)})
    for idx in range(period, len(values)):
        ema_prev = ((values[idx] - ema_prev) * multiplier) + ema_prev
        output.append({"time": times[idx], "value": _safe_json_number(ema_prev)})
    return output


def _rsi_wilder(values, period, times):
    if len(values) <= period:
        return []

    gains = []
    losses = []
    for idx in range(1, len(values)):
        change = values[idx] - values[idx - 1]
        gains.append(max(change, 0))
        losses.append(abs(min(change, 0)))

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    output = []
    rs = float("inf") if avg_loss == 0 else avg_gain / avg_loss
    first_rsi = 100 - (100 / (1 + rs))
    output.append({"time": times[period], "value": _safe_json_number(first_rsi)})

    for idx in range(period, len(gains)):
        avg_gain = ((avg_gain * (period - 1)) + gains[idx]) / period
        avg_loss = ((avg_loss * (period - 1)) + losses[idx]) / period
        rs = float("inf") if avg_loss == 0 else avg_gain / avg_loss
        rsi_value = 100 - (100 / (1 + rs))
        output.append({"time": times[idx + 1], "value": _safe_json_number(rsi_value)})

    return output


def _ema_values_only(values, period):
    if len(values) < period:
        return [], period - 1
    multiplier = 2 / (period + 1)
    ema_list = [sum(values[:period]) / period]
    for idx in range(period, len(values)):
        ema_list.append(((values[idx] - ema_list[-1]) * multiplier) + ema_list[-1])
    return ema_list, period - 1


def _macd(values, times):
    ema12, start12 = _ema_values_only(values, 12)
    ema26, start26 = _ema_values_only(values, 26)
    if not ema12 or not ema26:
        return {"macd": [], "signal": [], "hist": []}

    start_idx = max(start12, start26)
    offset12 = start_idx - start12
    offset26 = start_idx - start26
    common_length = min(len(ema12) - offset12, len(ema26) - offset26)
    if common_length <= 0:
        return {"macd": [], "signal": [], "hist": []}

    macd_line_vals = []
    macd_times = []
    for i in range(common_length):
        idx_time = start_idx + i
        macd_line_vals.append(ema12[offset12 + i] - ema26[offset26 + i])
        macd_times.append(times[idx_time])

    signal_vals, signal_offset = _ema_values_only(macd_line_vals, 9)
    if not signal_vals:
        return {"macd": [], "signal": [], "hist": []}

    macd_series = []
    signal_series = []
    hist_series = []
    for i, signal_val in enumerate(signal_vals):
        idx = i + signal_offset
        time_val = macd_times[idx]
        macd_val = macd_line_vals[idx]
        hist_val = macd_val - signal_val
        macd_series.append({"time": time_val, "value": _safe_json_number(macd_val)})
        signal_series.append({"time": time_val, "value": _safe_json_number(signal_val)})
        hist_series.append({"time": time_val, "value": _safe_json_number(hist_val)})

    return {"macd": macd_series, "signal": signal_series, "hist": hist_series}


def _bollinger(values, period, std_multiplier, times):
    if len(values) < period:
        return {"upper": [], "middle": [], "lower": []}

    upper = []
    middle = []
    lower = []

    for idx in range(period - 1, len(values)):
        window = values[idx - period + 1 : idx + 1]
        mean = sum(window) / period
        variance = sum((x - mean) ** 2 for x in window) / period
        std_dev = math.sqrt(variance)

        middle_val = _safe_json_number(mean)
        upper_val = _safe_json_number(mean + (std_multiplier * std_dev))
        lower_val = _safe_json_number(mean - (std_multiplier * std_dev))

        time_val = times[idx]
        middle.append({"time": time_val, "value": middle_val})
        upper.append({"time": time_val, "value": upper_val})
        lower.append({"time": time_val, "value": lower_val})

    return {"upper": upper, "middle": middle, "lower": lower}


def _compute_indicator_series(candles, indicator_names):
    closes = [c["close"] for c in candles]
    times = [c["time"] for c in candles]
    series = {}

    for indicator in indicator_names:
        if indicator == "sma20":
            series[indicator] = _sma(closes, 20, times)
        elif indicator == "ema50":
            series[indicator] = _ema(closes, 50, times)
        elif indicator == "rsi14":
            series[indicator] = _rsi_wilder(closes, 14, times)
        elif indicator == "macd":
            series[indicator] = _macd(closes, times)
        elif indicator == "bb20":
            series[indicator] = _bollinger(closes, 20, 2, times)

    return series


def _get_cached_indicators(security_id, indicators):
    normalized = sorted(set(indicators))
    cache_key = f"ta_indicators:{security_id}:{','.join(normalized)}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    history_payload = _get_or_fetch_ta_history(security_id)
    candles = history_payload.get("candles", [])
    series = _compute_indicator_series(candles, normalized)

    result = {"securityId": security_id, "series": series}
    _cache_set(cache_key, result)
    return result


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


@app.route(routes["NepseIndex"])
def getNepseIndexProxy():
    rate_limited = _enforce_rate_limit("nepse_index")
    if rate_limited:
        return rate_limited

    cache_key = "nepse_index"
    cached = _cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    try:
        payload = nepse.getNepseIndex()
        _cache_set(cache_key, payload)
        return jsonify(payload)
    except Exception as exc:
        return jsonify({"error": "Unable to fetch NEPSE index", "details": str(exc)}), 502



@app.route("/api/ta/history")
def get_ta_history():
    rate_limited = _enforce_rate_limit("ta_history")
    if rate_limited:
        return rate_limited

    security_id_raw = request.args.get("securityId")
    security_id = _safe_int(security_id_raw)
    if security_id is None:
        return jsonify({"error": "securityId must be an integer"}), 400

    try:
        payload = _get_or_fetch_ta_history(security_id)
        return jsonify(payload)
    except httpx.HTTPStatusError as exc:
        return jsonify({"error": "Upstream NEPSE request failed", "status": exc.response.status_code}), 502
    except Exception as exc:
        return jsonify({"error": "Unable to fetch TA history", "details": str(exc)}), 502


@app.route("/api/ta/indicators")
def get_ta_indicators():
    rate_limited = _enforce_rate_limit("ta_indicators")
    if rate_limited:
        return rate_limited

    security_id_raw = request.args.get("securityId")
    security_id = _safe_int(security_id_raw)
    if security_id is None:
        return jsonify({"error": "securityId must be an integer"}), 400

    indicators_csv = (request.args.get("indicators") or "").strip().lower()
    requested = [item.strip() for item in indicators_csv.split(",") if item.strip()]
    allowed = {"sma20", "ema50", "rsi14", "macd", "bb20"}

    invalid = [name for name in requested if name not in allowed]
    if invalid:
        return jsonify({"error": "Unsupported indicators requested", "invalid": invalid}), 400

    if not requested:
        requested = ["sma20", "ema50", "rsi14", "macd", "bb20"]

    try:
        payload = _get_cached_indicators(security_id, requested)
        return jsonify(payload)
    except httpx.HTTPStatusError as exc:
        return jsonify({"error": "Upstream NEPSE request failed", "status": exc.response.status_code}), 502
    except Exception as exc:
        return jsonify({"error": "Unable to fetch TA indicators", "details": str(exc)}), 502


@app.route(routes["AllStocks"])
def getAllStocks():
    company_list = nepse.getCompanyList()
    all_stocks = []

    price_data = nepse.getPriceVolume()
    price_df = pd.DataFrame(price_data)
    if price_df.empty or "symbol" not in price_df.columns:
        return jsonify(all_stocks)

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
        if price <= 0:
            return jsonify({"error": "Invalid stock price"}), 422
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
        price_data = nepse.getPriceVolume()
        df = pd.DataFrame(price_data)
        row = df[df["symbol"].str.upper() == symbol.upper()]

        if row.empty:
            return jsonify({"error": "Stock not found"}), 404

        current_price = float(row["lastTradedPrice"].values[0])
        profit_loss = (current_price - trade["price"]) * trade["shares"]
        if trade["price"]:
            profit_loss_percentage = ((current_price - trade["price"]) / trade["price"]) * 100
        else:
            profit_loss_percentage = None

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
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


@app.route("/api/ohlc/refresh", methods=["GET", "POST"])
def ohlc_refresh_now():
    ensure_ohlc_table()
    result = refresh_daily_ohlc()
    return jsonify(result)


@app.route("/api/ohlc/snapshot", methods=["POST"])
def ohlc_snapshot():
    today_str = date.today().isoformat()
    _ensure_ohlc_history_store()
    payload, _ = _load_ohlc_history()
    symbols = payload.get("symbols", {})
    if not isinstance(symbols, dict):
        symbols = {}
        payload["symbols"] = symbols

    updated_symbols = set()
    for row in nepse.getPriceVolume():
        symbol = str(row.get("symbol", "")).upper()
        if not symbol:
            continue

        open_price = _safe_float(row.get("openPrice"))
        high_price = _safe_float(row.get("highPrice"))
        low_price = _safe_float(row.get("lowPrice"))
        close_price = _safe_float(row.get("lastTradedPrice"))

        volume_value = row.get("lastTradedVolume")
        if volume_value is None:
            volume_value = row.get("totalTradeQuantity")
        volume = _safe_float(volume_value)

        if None in (open_price, high_price, low_price, close_price):
            continue

        new_entry = {
            "date": today_str,
            "open": open_price,
            "high": high_price,
            "low": low_price,
            "close": close_price,
            "volume": volume or 0.0,
        }

        candles = symbols.setdefault(symbol, [])
        if not isinstance(candles, list):
            candles = []
            symbols[symbol] = candles

        replaced = False
        for idx, candle in enumerate(candles):
            if candle.get("date") == today_str:
                candles[idx] = new_entry
                replaced = True
                break
        if not replaced:
            candles.append(new_entry)

        candles.sort(key=lambda item: item.get("date") or "")
        updated_symbols.add(symbol)

    payload["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    _save_ohlc_history(payload)

    return jsonify({"symbolsUpdated": len(updated_symbols), "date": today_str})


@app.route("/api/ohlc/history")
def ohlc_history():
    symbol = (request.args.get("symbol") or "").upper()
    if not symbol:
        return jsonify({"error": "symbol is required"}), 400

    limit_param = request.args.get("limit", "90")
    try:
        limit = int(limit_param)
    except ValueError:
        return jsonify({"error": "limit must be an integer"}), 400

    candles, message = _get_ohlc_candles_for_symbol(symbol)
    candles_sorted = sorted(candles, key=lambda item: item.get("date") or "")
    if limit > 0:
        candles_sorted = candles_sorted[-limit:]

    response = {"symbol": symbol, "candles": candles_sorted}
    if message and not candles_sorted:
        response["message"] = message

    return jsonify(response)


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

import socket
from urllib.parse import urlparse

@app.route("/debug/dns")
def debug_dns():
    host = urlparse(NEPSE_BASE).netloc or NEPSE_BASE.replace("https://", "").replace("http://", "")
    host = host.strip().rstrip("/")
    try:
        infos = socket.getaddrinfo(host, 443)
        ips = sorted({info[4][0] for info in infos})
        return jsonify({"host": host, "resolved": True, "ips": ips, "nepse_base_repr": repr(NEPSE_BASE)})
    except Exception as e:
        return jsonify({"host": host, "resolved": False, "error": str(e), "nepse_base_repr": repr(NEPSE_BASE)}), 500

# Ensure table on startup too (safe, but ensure_ohlc_table is the real safety net)
try:
    init_db()
except Exception as e:
    print("init_db failed at startup:", str(e))


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)
    import socket
