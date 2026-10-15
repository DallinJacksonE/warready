export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12);
}
export function displayDate(date: string) {
  return parseDate(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
export function moveMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1, 12);
}
export function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from(
    { length: Math.ceil((offset + count) / 7) * 7 },
    (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - offset + i, 12),
  );
}
