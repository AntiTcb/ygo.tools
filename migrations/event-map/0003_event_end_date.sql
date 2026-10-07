-- Last day of multi-day events (YYYY-MM-DD, inclusive), e.g. a Friday–Sunday YCS.
-- NULL for single-day events.
ALTER TABLE events ADD COLUMN end_date TEXT;
