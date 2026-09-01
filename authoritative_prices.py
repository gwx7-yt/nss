"""Publish server-authoritative NEPSE prices to Supabase.

This module deliberately accepts prices only from the server-side NEPSE client.  It
does not expose a function that accepts caller-supplied price rows.
"""

from datetime import datetime, timezone
import fcntl
import logging
import math
import os
import threading
import time

import requests


LOGGER = logging.getLogger(__name__)
PUBLISH_INTERVAL_SECONDS = 120
SOURCE = "render-nepse-feed"
DEFAULT_LOCK_PATH = "/tmp/arthyq-authoritative-price-publisher.lock"


def _market_is_open(status):
    """Return True/False for a recognized NEPSE status, or None if ambiguous."""
    if isinstance(status, bool):
        return status
    if isinstance(status, dict):
        for key in ("isOpen", "is_open", "open", "status"):
            if key in status:
                return _market_is_open(status[key])
        return None
    if isinstance(status, str):
        normalized = status.strip().upper()
        if normalized in {"OPEN", "TRUE", "1"}:
            return True
        if "CLOSE" in normalized or normalized in {"FALSE", "0"}:
            return False
    return None


def _valid_price_rows(stocks, observed_at):
    rows = []
    for stock in stocks or []:
        if not isinstance(stock, dict):
            continue
        symbol = str(stock.get("symbol") or "").strip().upper()
        if not symbol:
            continue
        try:
            price = float(str(stock.get("lastTradedPrice")).replace(",", ""))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(price) or price <= 0:
            continue
        rows.append(
            {
                "security_symbol": symbol,
                "price": price,
                "source": SOURCE,
                "observed_at": observed_at,
                "updated_at": observed_at,
            }
        )
    return rows


class AuthoritativePricePublisher:
    def __init__(self, nepse_client, session=None):
        self.nepse = nepse_client
        self.session = session or requests.Session()
        self.supabase_url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
        self.service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        self.configured = bool(self.supabase_url and self.service_role_key)
        self.last_success_at = None
        self.last_count = 0
        self.last_error = None
        self.last_result = "not_started"
        self.last_market_open = None
        self.last_market_state_observed_at = None
        self._start_lock = threading.Lock()
        self._started = False
        self._leader_lock_file = None

    def _claim_process_leadership(self):
        """Claim a host-wide non-blocking lock shared by Gunicorn workers."""
        lock_path = os.environ.get(
            "AUTHORITATIVE_PRICE_LOCK_PATH", DEFAULT_LOCK_PATH
        )
        lock_file = open(lock_path, "a+", encoding="utf-8")
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            lock_file.close()
            return False
        # Keeping the descriptor open retains the exclusive lock for this
        # process. The OS releases it automatically if the process exits.
        self._leader_lock_file = lock_file
        return True

    def publish_authoritative_prices(self):
        """Publish trusted market state, and prices only while NEPSE is open."""
        market_open = _market_is_open(self.nepse.isNepseOpen())
        if market_open is None:
            # An ambiguous or malformed response must never become a guessed
            # authoritative state.
            self.last_result = "market_status_unknown"
            return 0

        if not self.configured:
            raise RuntimeError("Supabase publisher is not configured")

        observed_at = datetime.now(timezone.utc).isoformat()
        response = self.session.post(
            f"{self.supabase_url}/rest/v1/authoritative_market_state"
            "?on_conflict=singleton",
            headers=self._supabase_headers(),
            json={
                "singleton": True,
                "is_open": market_open,
                "source": SOURCE,
                "observed_at": observed_at,
                "updated_at": observed_at,
            },
            timeout=30,
        )
        response.raise_for_status()
        self.last_market_open = market_open
        self.last_market_state_observed_at = observed_at

        if not market_open:
            # Do not give unchanged closing prices a fresh observed_at value.
            self.last_error = None
            self.last_result = "market_closed"
            return 0

        rows = _valid_price_rows(self.nepse.getPriceVolume(), observed_at)
        if not rows:
            self.last_result = "no_valid_prices"
            return 0

        response = self.session.post(
            f"{self.supabase_url}/rest/v1/authoritative_market_prices"
            "?on_conflict=security_symbol",
            headers=self._supabase_headers(),
            json=rows,
            timeout=30,
        )
        response.raise_for_status()
        self.last_success_at = datetime.now(timezone.utc).isoformat()
        self.last_count = len(rows)
        self.last_error = None
        self.last_result = "published"
        LOGGER.info("Published %d authoritative NEPSE prices", len(rows))
        return len(rows)

    def _supabase_headers(self):
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }

    def _loop(self):
        while True:
            try:
                self.publish_authoritative_prices()
            except Exception as exc:  # keep the daemon alive after upstream failures
                self.last_error = f"{type(exc).__name__}: {exc}"
                if self.service_role_key:
                    self.last_error = self.last_error.replace(
                        self.service_role_key, "[REDACTED]"
                    )
                self.last_result = "error"
                LOGGER.error("Authoritative price refresh failed: %s", self.last_error)
            time.sleep(PUBLISH_INTERVAL_SECONDS)

    def start(self):
        """Start at most one publisher daemon in this Python process."""
        with self._start_lock:
            if self._started or not self.configured:
                if not self.configured:
                    LOGGER.warning("Authoritative price publisher is not configured")
                return False
            if not self._claim_process_leadership():
                self.last_result = "standby_worker"
                LOGGER.info(
                    "Authoritative price publisher is running in another worker"
                )
                return False
            self._started = True
            threading.Thread(
                target=self._loop,
                name="authoritative-price-publisher",
                daemon=True,
            ).start()
            return True

    def status(self):
        return {
            "configured": self.configured,
            "running": self._started,
            "interval_seconds": PUBLISH_INTERVAL_SECONDS,
            "last_result": self.last_result,
            "last_success_at": self.last_success_at,
            "last_count": self.last_count,
            "last_error": self.last_error,
            "last_market_open": self.last_market_open,
            "last_market_state_observed_at": self.last_market_state_observed_at,
        }
