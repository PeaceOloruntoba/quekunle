/** Normalize Postgres DATE values, which drivers may return as strings or Date objects. */
export function dateOnly(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.valueOf()))
    return value.toISOString().slice(0, 10);
  const raw = String(value ?? "");
  const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf())
    ? ""
    : parsed.toISOString().slice(0, 10);
}

export function displayDate(
  value: unknown,
  options: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  },
): string {
  const normalized = dateOnly(value);
  if (!normalized) return "Date to be remembered";
  return new Intl.DateTimeFormat("en", options).format(
    new Date(`${normalized}T12:00:00`),
  );
}

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
