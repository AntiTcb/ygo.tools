-- Venues are geocoded once and reused across scrapes.
CREATE TABLE venues (
	id TEXT PRIMARY KEY, -- hash of the normalized address
	name TEXT,
	address TEXT NOT NULL, -- full address as listed (lines joined with ", ")
	city TEXT,
	state TEXT,
	country TEXT NOT NULL,
	lat REAL,
	lng REAL,
	geocode_status TEXT NOT NULL DEFAULT 'pending', -- pending | ok | failed
	geocoded_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE events (
	id TEXT PRIMARY KEY, -- hash of type + host + date + venue
	type TEXT NOT NULL, -- regional | ots
	region TEXT NOT NULL, -- na | latam
	host TEXT NOT NULL,
	date TEXT NOT NULL, -- YYYY-MM-DD, local to the venue
	start_time TEXT, -- HH:MM (24h), local to the venue; NULL when only a date is listed
	tz_note TEXT, -- timezone abbreviation as listed, e.g. MST
	formats TEXT NOT NULL DEFAULT '[]', -- JSON array, e.g. ["Advanced","Genesys"]
	venue_id TEXT REFERENCES venues (id),
	is_remote INTEGER NOT NULL DEFAULT 0,
	remote_url TEXT,
	state TEXT,
	country TEXT NOT NULL,
	capacity INTEGER,
	email TEXT,
	phone TEXT,
	dragon_duel INTEGER, -- regionals only
	vendor_info TEXT, -- regionals only
	source_url TEXT NOT NULL,
	first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
	last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
	removed_at TEXT -- set when an event disappears from the source page
);

CREATE INDEX events_region_date ON events (region, date);
CREATE INDEX venues_geocode_status ON venues (geocode_status);

CREATE TABLE scrape_runs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	started_at TEXT NOT NULL DEFAULT (datetime('now')),
	finished_at TEXT,
	status TEXT NOT NULL DEFAULT 'running', -- running | ok | error
	events_seen INTEGER,
	events_removed INTEGER,
	venues_geocoded INTEGER,
	error TEXT
);
