import { normalizeApiError } from '@/api/client/error';
import type { InsightEvidenceValue, OverdueHomeworkEvidence, ScoreAggregate } from '@/api/contracts/performance';

export const NOT_ENOUGH_DATA = 'Not enough data yet';

/** `null`/`undefined` is "no data", never 0%. */
export function percentText(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(value) ? NOT_ENOUGH_DATA : `${trimNumber(value)}%`;
}

/** Large-value form: an em dash for missing data. */
export function percentValue(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(value) ? '—' : `${trimNumber(value)}%`;
}

export function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

export function marksText(aggregate: Pick<ScoreAggregate, 'scoredItems' | 'totalScore' | 'totalMax'>) {
  if (!aggregate.scoredItems) return null;
  return `${trimNumber(aggregate.totalScore)} of ${trimNumber(aggregate.totalMax)} marks across ${aggregate.scoredItems} ${aggregate.scoredItems === 1 ? 'item' : 'items'}`;
}

export function monthLabel(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

export function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function periodLabel(period: { from: string; to: string }) {
  return `${dateLabel(period.from)} – ${dateLabel(period.to)}`;
}

export interface ErrorPresentation {
  message: string;
  status?: number;
  /** The session cannot continue; the app should send the user to sign in. */
  sessionExpired: boolean;
  forbidden: boolean;
  notFound: boolean;
}

/** Turns any thrown value into a student-safe message (never raw JSON). */
export function describeError(error: unknown): ErrorPresentation {
  const normalized = normalizeApiError(error);
  const status = normalized.status;
  const base = { status, sessionExpired: status === 401, forbidden: status === 403, notFound: status === 404 };
  if (status === 401) return { ...base, message: 'Your session has expired. Please sign in again.' };
  if (status === 403) return { ...base, message: 'You do not have access to this information.' };
  if (status === 404) return { ...base, message: 'This information is no longer available.' };
  if (status === undefined) return { ...base, message: 'Could not reach EduSetu. Check your connection and try again.' };
  const text = normalized.message.trim();
  return { ...base, message: !text || /^[{[]/.test(text) ? 'Something went wrong. Please try again.' : text };
}

const EVIDENCE_LABELS: Record<string, string> = {
  scoredItems: 'Graded items',
  totalScore: 'Marks awarded',
  totalMax: 'Marks available',
  weightedPercentage: 'Score',
  thresholdPercent: 'Review threshold',
  minimumItems: 'Items needed',
  earlierPercentage: 'Earlier average',
  recentPercentage: 'Recent average',
  deltaPoints: 'Change (points)',
  thresholdPoints: 'Change threshold (points)',
  overdueCount: 'Homework past due',
  sessions: 'Sessions recorded',
  present: 'Present',
  percentage: 'Attendance',
  minimumSessions: 'Sessions needed',
};

const PERCENT_KEYS = new Set(['weightedPercentage', 'thresholdPercent', 'earlierPercentage', 'recentPercentage', 'percentage']);

export interface EvidenceLine {
  label: string;
  value: string;
}

export function evidenceLines(evidence: Record<string, InsightEvidenceValue> | undefined): EvidenceLine[] {
  if (!evidence) return [];
  const lines: EvidenceLine[] = [];
  for (const [key, value] of Object.entries(evidence)) {
    if (Array.isArray(value) || value === null || value === undefined) continue;
    const label = EVIDENCE_LABELS[key];
    if (!label) continue;
    lines.push({ label, value: typeof value === 'number' ? (PERCENT_KEYS.has(key) ? `${trimNumber(value)}%` : trimNumber(value)) : String(value) });
  }
  return lines;
}

export function overdueItems(evidence: Record<string, InsightEvidenceValue> | undefined): OverdueHomeworkEvidence[] {
  const items = evidence?.items;
  return Array.isArray(items) ? items : [];
}

export function trendText(direction: string) {
  if (direction === 'improving') return 'Recent results are higher than earlier ones.';
  if (direction === 'declining') return 'Recent results are lower than earlier ones.';
  if (direction === 'stable') return 'Results have been steady.';
  return NOT_ENOUGH_DATA;
}

/** True when the server may or may not have applied a change (no response, timeout, conflict, 5xx). */
export function isUncertainOutcome(error: { status?: number }) {
  return error.status === undefined || error.status === 408 || error.status === 409 || error.status >= 500;
}
