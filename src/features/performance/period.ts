export type PeriodPreset = 'academic-year' | 'last-30' | 'last-90';

export const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: 'academic-year', label: 'Academic year' },
  { id: 'last-30', label: 'Last 30 days' },
  { id: 'last-90', label: 'Last 90 days' },
];

// Matches the backend limit for user-supplied periods.
export const MAX_PERIOD_DAYS = 372;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toDateOnly(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `academic-year` sends no dates so the backend applies its own default. */
export function presetRange(preset: PeriodPreset, now = new Date()): { from?: string; to?: string } {
  if (preset === 'academic-year') return {};
  const days = preset === 'last-30' ? 30 : 90;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return { from: toDateOnly(start), to: toDateOnly(now) };
}

function parseDateOnly(value: string) {
  if (!DATE_ONLY.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

/** Returns an error message for an invalid range, or null when valid. */
export function validateRange(from?: string, to?: string): string | null {
  const start = from ? parseDateOnly(from) : null;
  const end = to ? parseDateOnly(to) : null;
  if ((from && !start) || (to && !end)) return 'Dates must be real calendar dates in YYYY-MM-DD format.';
  if (start && end) {
    if (end.getTime() < start.getTime()) return 'The end date must not be before the start date.';
    if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_PERIOD_DAYS) return `The period must not be longer than ${MAX_PERIOD_DAYS} days.`;
  }
  return null;
}
