-- Which provider placed each venue: source | census | nominatim | mapbox.
ALTER TABLE venues ADD COLUMN geocode_source TEXT;
-- Mapbox permanent geocoding is billed per lookup, so each venue is tried there
-- at most once; weekly retries of failed venues only use the free providers.
ALTER TABLE venues ADD COLUMN mapbox_attempted INTEGER NOT NULL DEFAULT 0;

-- Everything geocoded before this migration went through Mapbox.
UPDATE venues SET geocode_source = 'mapbox', mapbox_attempted = 1 WHERE geocode_status = 'ok';
UPDATE venues SET mapbox_attempted = 1 WHERE geocode_status = 'failed';
