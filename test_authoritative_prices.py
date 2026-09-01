import os
import sys
import types
import unittest
from unittest.mock import patch

# The production dependency is already pinned in Requirements.txt. Keep these
# unit tests runnable in minimal static-analysis containers where it is absent.
if "requests" not in sys.modules:
    try:
        import requests  # noqa: F401
    except ModuleNotFoundError:
        requests_stub = types.ModuleType("requests")
        requests_stub.Session = object
        sys.modules["requests"] = requests_stub

from authoritative_prices import AuthoritativePricePublisher, _valid_price_rows


class FakeResponse:
    def raise_for_status(self):
        return None


class FakeSession:
    def __init__(self):
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return FakeResponse()


class FakeNepse:
    def __init__(self, status="OPEN"):
        self.status = status
        self.price_calls = 0

    def isNepseOpen(self):
        return {"isOpen": self.status}

    def getPriceVolume(self):
        self.price_calls += 1
        return [{"symbol": " nabil ", "lastTradedPrice": "1,234.50"}]


class PublisherTests(unittest.TestCase):
    @patch.dict(os.environ, {}, clear=True)
    def test_missing_credentials_fails_safe(self):
        publisher = AuthoritativePricePublisher(FakeNepse(), FakeSession())
        self.assertFalse(publisher.configured)
        self.assertFalse(publisher.start())

    def test_invalid_prices_are_skipped(self):
        stocks = [
            {"symbol": "ok", "lastTradedPrice": "12.5"},
            {"symbol": "zero", "lastTradedPrice": 0},
            {"symbol": "neg", "lastTradedPrice": -1},
            {"symbol": "nan", "lastTradedPrice": float("nan")},
            {"symbol": "inf", "lastTradedPrice": float("inf")},
            {"symbol": "bad", "lastTradedPrice": "nope"},
            {"symbol": "", "lastTradedPrice": 10},
        ]
        rows = _valid_price_rows(stocks, "timestamp")
        self.assertEqual([row["security_symbol"] for row in rows], ["OK"])

    @patch.dict(os.environ, {"SUPABASE_URL": "https://project.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "test-key"})
    def test_open_market_publishes_server_feed(self):
        session = FakeSession()
        publisher = AuthoritativePricePublisher(FakeNepse(), session)
        self.assertEqual(publisher.publish_authoritative_prices(), 1)
        payload = session.calls[0][1]["json"]
        self.assertEqual(payload[0]["security_symbol"], "NABIL")
        self.assertEqual(payload[0]["source"], "render-nepse-feed")

    @patch.dict(os.environ, {"SUPABASE_URL": "https://project.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "test-key"})
    def test_closed_market_does_not_fetch_or_refresh_prices(self):
        nepse = FakeNepse("CLOSE")
        session = FakeSession()
        publisher = AuthoritativePricePublisher(nepse, session)
        self.assertEqual(publisher.publish_authoritative_prices(), 0)
        self.assertEqual(nepse.price_calls, 0)
        self.assertEqual(session.calls, [])


if __name__ == "__main__":
    unittest.main()
