// Small shared formatting helpers.

export function formatPrice(value) {
  if (value == null) return "";
  return `$${Number(value).toFixed(Number.isInteger(value) ? 0 : 2)}`;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export function formatEventDate(iso) {
  if (!iso) return "";
  return dateFmt.format(new Date(iso));
}

export function formatEventTime(startIso, endIso) {
  if (!startIso) return "";
  const start = timeFmt.format(new Date(startIso));
  if (!endIso) return start;
  return `${start} – ${timeFmt.format(new Date(endIso))}`;
}

// e.g. "Sun, Jun 8"
const shortFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
export function formatShortDate(iso) {
  if (!iso) return "";
  return shortFmt.format(new Date(iso));
}
