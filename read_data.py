from datetime import datetime, timedelta

import pandas as pd
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


def _safe_float(value, default=0.0):
    try:
        if value in (None, ""):
            return float(default)
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return float(default)


def _safe_int(value, default=0):
    try:
        if value in (None, ""):
            return int(default)
        return int(float(str(value).replace(",", "")))
    except (TypeError, ValueError):
        return int(default)

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
        turnover = _safe_float(price_info.get("turnover"))
        trades = _safe_int(price_info.get("totalTrades"))
        trade_quantity = price_info.get("totalTradedQuantity")
        if trade_quantity is None:
            trade_quantity = price_info.get("totalTradeQuantity")
        trade_quantity_value = _safe_float(trade_quantity)

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

            stock_info = {
                "symbol": symbol,
                "price": price,
                "changePercent": change
            }
            all_stocks.append(stock_info)

        except Exception as e:
            print(f"Error fetching data for {company['symbol']}: {str(e)}")
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
    """Simulate a trade with credits."""
    data = request.json
    symbol = data.get("symbol")
    credits = data.get("credits")

    if not symbol or not credits:
        return jsonify({"error": "Symbol and credits are required"}), 400

    try:
        # Get current stock price
        price_data = nepse.getPriceVolume()
        df = pd.DataFrame(price_data)
        row = df[df["symbol"].str.upper() == symbol.upper()]

        if row.empty:
            return jsonify({"error": "Stock not found"}), 404

        price = float(row["lastTradedPrice"].values[0])

        # Calculate the number of shares the user can buy
        shares = credits / price

        # Store the simulated trade
        simulated_trades[symbol.upper()] = {
            "symbol": symbol.upper(),
            "credits": credits,
            "shares": shares,
            "price": price,
            "timestamp": datetime.now()
        }

        return jsonify({
            "symbol": symbol.upper(),
            "creditsUsed": credits,
            "sharesBought": shares,
            "priceAtPurchase": price
        })

    except Exception as e:
        print(f"Error simulating trade for {symbol}: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route(routes["CheckProfitLoss"], methods=["GET"])
def checkProfitLoss():
    """Check profit or loss for the simulated trade."""
    symbol = request.args.get("symbol")
    if not symbol:
        return jsonify({"error": "Symbol is required"}), 400

    trade = simulated_trades.get(symbol.upper())
    if not trade:
        return jsonify({"error": "No simulated trade found for this symbol"}), 404

    try:
        # Ensure at least one day has passed
        time_elapsed = datetime.now() - trade["timestamp"]
        if time_elapsed < timedelta(days=1):
            return jsonify({"error": "You can only check profit/loss after one day"}), 400

        # Get the current stock price
        price_data = nepse.getPriceVolume()
        df = pd.DataFrame(price_data)
        row = df[df["symbol"].str.upper() == symbol.upper()]

        if row.empty:
            return jsonify({"error": "Stock not found"}), 404

        current_price = float(row["lastTradedPrice"].values[0])

        # Calculate profit or loss
        profit_loss = (current_price - trade["price"]) * trade["shares"]
        profit_loss_percentage = ((current_price - trade["price"]) / trade["price"]) * 100

        return jsonify({
            "symbol": symbol.upper(),
            "priceAtPurchase": trade["price"],
            "currentPrice": current_price,
            "profitLoss": profit_loss,
            "profitLossPercentage": profit_loss_percentage
        })

    except Exception as e:
        print(f"Error checking profit/loss for {symbol}: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/get_user")
def get_user():
    username = request.args.get("username")
    if not username:
        return jsonify({"error": "Username not provided"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query the users table
        cursor.execute("SELECT id, username, credits FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        conn.close()
        
        if user:
            return jsonify({
                "id": user[0],
                "username": user[1],
                "credits": user[2]
            })
        else:
            return jsonify({"error": "User not found"}), 404
            
    except Exception as e:
        print(f"Error fetching user data: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)

    import sqlite3

def get_db_connection():
    conn = sqlite3.connect('nss_data.db')
    conn.row_factory = sqlite3.Row  # Optional: lets you access columns by name
    return conn
