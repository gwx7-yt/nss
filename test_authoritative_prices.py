import os
import sys
import tempfile
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
    def __init__(self, error=None):
        self.error = error

    def raise_for_status(self):
        if self.error:
            raise self.error


class FakeSession:
    def __init__(self, errors=None):
        self.calls = []
        self.errors = list(errors or [])

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return FakeResponse(self.errors.pop(0) if self.errors else None)


class FakeNepse:
    def __init__(self, status="OPEN"):
        self.status = status
        self.price_calls = 0

    def isNepseOpen(self):
        return {"isOpen": self.status}

    def getPriceVolume(self):
        self.price_calls += 1
        return [{"symbol": " nabil ", "lastTradedPrice": "1,234.50"}]


class FailingNepse(FakeNepse):
    def isNepseOpen(self):
        raise RuntimeError("NEPSE status unavailable")


class PublisherTests(unittest.TestCase):
    @patch.dict(os.environ, {}, clear=True)
    def test_missing_credentials_fails_safe(self):
        publisher = AuthoritativePricePublisher(FakeNepse(), FakeSession())
        self.assertFalse(publisher.configured)
        self.assertFalse(publisher.start())

    @patch("authoritative_prices.threading.Thread")
    def test_only_one_worker_can_become_publisher(self, thread_class):
        with tempfile.TemporaryDirectory() as directory:
            environment = {
                "SUPABASE_URL": "https://project.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "test-key",
                "AUTHORITATIVE_PRICE_LOCK_PATH": os.path.join(directory, "publisher.lock"),
            }
            with patch.dict(os.environ, environment, clear=True):
                leader = AuthoritativePricePublisher(FakeNepse(), FakeSession())
                standby = AuthoritativePricePublisher(FakeNepse(), FakeSession())
                self.assertTrue(leader.start())
                self.assertFalse(standby.start())
                self.assertEqual(standby.last_result, "standby_worker")
                self.assertEqual(thread_class.call_count, 1)

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
        self.assertEqual(len(session.calls), 2)
        state_payload = session.calls[0][1]["json"]
        self.assertTrue(state_payload["singleton"])
        self.assertTrue(state_payload["is_open"])
        self.assertEqual(state_payload["source"], "render-nepse-feed")
        self.assertEqual(state_payload["observed_at"], state_payload["updated_at"])
        payload = session.calls[1][1]["json"]
        self.assertEqual(payload[0]["security_symbol"], "NABIL")
        self.assertEqual(payload[0]["source"], "render-nepse-feed")
        self.assertTrue(publisher.status()["last_market_open"])

    @patch.dict(os.environ, {"SUPABASE_URL": "https://project.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "test-key"})
    def test_closed_market_does_not_fetch_or_refresh_prices(self):
        nepse = FakeNepse("CLOSE")
        session = FakeSession()
        publisher = AuthoritativePricePublisher(nepse, session)
        self.assertEqual(publisher.publish_authoritative_prices(), 0)
        self.assertEqual(nepse.price_calls, 0)
        self.assertEqual(len(session.calls), 1)
        self.assertIn("authoritative_market_state", session.calls[0][0])
        self.assertFalse(session.calls[0][1]["json"]["is_open"])
        self.assertFalse(publisher.status()["last_market_open"])

    @patch.dict(os.environ, {"SUPABASE_URL": "https://project.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "test-key"})
    def test_unknown_market_state_publishes_nothing(self):
        nepse = FakeNepse("MAYBE")
        session = FakeSession()
        publisher = AuthoritativePricePublisher(nepse, session)
        self.assertEqual(publisher.publish_authoritative_prices(), 0)
        self.assertEqual(nepse.price_calls, 0)
        self.assertEqual(session.calls, [])
        self.assertEqual(publisher.last_result, "market_status_unknown")

    @patch.dict(os.environ, {"SUPABASE_URL": "https://project.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "test-key"})
    def test_market_state_lookup_failure_publishes_nothing(self):
        nepse = FailingNepse()
        session = FakeSession()
        publisher = AuthoritativePricePublisher(nepse, session)
        with self.assertRaisesRegex(RuntimeError, "NEPSE status unavailable"):
            publisher.publish_authoritative_prices()
        self.assertEqual(nepse.price_calls, 0)
        self.assertEqual(session.calls, [])

    @patch.dict(os.environ, {"SUPABASE_URL": "https://project.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "test-key"})
    def test_market_state_supabase_failure_does_not_publish_prices(self):
        nepse = FakeNepse()
        session = FakeSession([RuntimeError("Supabase unavailable")])
        publisher = AuthoritativePricePublisher(nepse, session)
        with self.assertRaisesRegex(RuntimeError, "Supabase unavailable"):
            publisher.publish_authoritative_prices()
        self.assertEqual(nepse.price_calls, 0)
        self.assertEqual(len(session.calls), 1)

    @patch.dict(os.environ, {"SUPABASE_URL": "https://project.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "secret-value"})
    @patch("authoritative_prices.time.sleep", side_effect=RuntimeError("stop loop"))
    def test_loop_redacts_service_key_from_errors(self, _sleep):
        publisher = AuthoritativePricePublisher(
            FakeNepse(), FakeSession([RuntimeError("failed secret-value")])
        )
        with self.assertRaisesRegex(RuntimeError, "stop loop"):
            publisher._loop()
        self.assertNotIn("secret-value", publisher.last_error)


if __name__ == "__main__":
    unittest.main()
