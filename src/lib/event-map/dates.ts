/**
 * Date helpers. Event dates are plain `YYYY-MM-DD` strings local to the venue,
 * so all math here is done in UTC to avoid the viewer's timezone shifting days.
 */

const DAY_MS = 86_400_000;

const toUtc = (date: string): Date => {
  return new Date(`${date}T00:00:00Z`);
};

const toIso = (d: Date): string => {
  return d.toISOString().slice(0, 10);
};

export const addDays = (date: string, days: number): string => {
  return toIso(new Date(toUtc(date).getTime() + days * DAY_MS));
};

/** Today's date in the viewer's timezone, as YYYY-MM-DD. */
export const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * The weekend (Friday–Sunday) a date falls in, keyed by that weekend's Saturday.
 * Returns null for Monday–Thursday.
 */
export const weekendOf = (date: string): string | null => {
  const dow = toUtc(date).getUTCDay(); // 0 = Sunday
  if (dow === 5) return addDays(date, 1);
  if (dow === 6) return date;
  if (dow === 0) return addDays(date, -1);
  return null;
};

/** The weekend containing or following `date`. */
export const nextWeekend = (date: string): string => {
  const dow = toUtc(date).getUTCDay();
  return weekendOf(date) ?? addDays(date, 6 - dow);
};

/** The Friday–Sunday range for a weekend key. */
export const weekendRange = (saturday: string): { start: string; end: string } => {
  return { start: addDays(saturday, -1), end: addDays(saturday, 1) };
};

const monthDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const longDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "Oct 9 – 11" */
export const formatWeekend = (saturday: string): string => {
  const { start, end } = weekendRange(saturday);
  return monthDay.formatRange(toUtc(start), toUtc(end));
};

/** "Sat, Oct 10, 2026" */
export const formatDate = (date: string): string => {
  return longDate.format(toUtc(date));
};

/** "13:30" -> "1:30 PM" */
export const formatTime = (time: string): string => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Whether an event (single- or multi-day) overlaps the [start, end) date range. */
export const overlapsRange = (e: { date: string; endDate: string | null }, start: string, end: string): boolean => {
  return e.date < end && (e.endDate ?? e.date) >= start;
};

/** "Fri, Oct 16 – Sun, Oct 18, 2026", or a single formatted date. */
export const formatDateRange = (start: string, end: string | null): string => {
  if (!end || end === start) return formatDate(start);
  return longDate.formatRange(toUtc(start), toUtc(end));
};
