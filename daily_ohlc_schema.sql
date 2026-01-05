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
