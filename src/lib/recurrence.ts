export function advanceDate(base: Date, freq: string, interval: number): Date {
  const d = new Date(base);
  if (freq === "daily") d.setDate(d.getDate() + interval);
  else if (freq === "weekly") d.setDate(d.getDate() + interval * 7);
  else if (freq === "monthly") d.setMonth(d.getMonth() + interval);
  return d;
}
