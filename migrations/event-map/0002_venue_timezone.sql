-- IANA time zone of each geocoded venue (e.g. America/Chicago), derived from its
-- coordinates by the scraper. Used to show event times in the viewer's time zone.
ALTER TABLE venues ADD COLUMN timezone TEXT;
