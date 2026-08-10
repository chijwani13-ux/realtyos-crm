export function currentTimeIST(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

// Returns true if `now` (HH:MM) falls within [start, end). Supports overnight
// windows where start > end (e.g. 22:00–06:00).
export function isWithinAccessWindow(
  start: string | null | undefined,
  end: string | null | undefined,
  now: string = currentTimeIST()
): boolean {
  if (!start || !end) return true; // no restriction configured
  if (start <= end) return now >= start && now < end;
  return now >= start || now < end;
}
