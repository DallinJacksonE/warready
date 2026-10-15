import { EMPTY_METRICS, STRENGTH_TARGET, type FitnessTargets, type Journal, type Metrics } from './contracts.js';

/** Merge detached observations, preserving absent values and run-time direction. */
function mergeRecords(previousRecords: Metrics, observations: Metrics): Metrics {
  const records = { ...previousRecords };
  for (const key of Object.keys(records) as (keyof Metrics)[]) {
    const value = observations[key];
    if (value === null || !Number.isFinite(value) || value < 0 || (key === 'runSeconds' && value === 0)) continue;
    const previous = records[key];
    records[key] = previous === null ? value : key === 'runSeconds' ? Math.min(previous, value) : Math.max(previous, value);
  }
  return records;
}

/** Merge optional observations into all-time records; a faster run is better. */
export function bestMetrics(journals: readonly Journal[]): Metrics {
  return journals.reduce((records, journal) => mergeRecords(records, journal.metrics), { ...EMPTY_METRICS });
}

/** Sum independent one-rep personal bests in pounds. Missing lifts count zero. */
export function strengthTotal(metrics: Metrics): number {
  return (metrics.squat ?? 0) + (metrics.bench ?? 0) + (metrics.deadlift ?? 0);
}

/** Visual percentage toward the 1,000 lb club, capped at completion. */
export function strengthProgress(metrics: Metrics): number {
  return Math.min(100, Math.max(0, strengthTotal(metrics) / STRENGTH_TARGET * 100));
}

/** Unofficial training indicator: equal-weight fractions of three personal goals. */
export function fitnessProgress(metrics: Metrics, targets: FitnessTargets): number {
  const fraction = (value: number | null, target: number) => value === null || target <= 0 ? 0 : Math.min(1, Math.max(0, value / target));
  const run = metrics.runSeconds !== null && metrics.runSeconds > 0 && targets.runSeconds > 0
    ? Math.min(1, targets.runSeconds / metrics.runSeconds) : 0;
  return (fraction(metrics.pullups, targets.pullups) + fraction(metrics.plankSeconds, targets.plankSeconds) + run) * 100 / 3;
}

export interface ProgressPoint { date: string; metrics: Metrics; strength: number; fitness: number }

/** Recompute cumulative personal bests by date, so edits and deletes correct history. */
export function progressTimeline(journals: readonly Journal[], targets: FitnessTargets): ProgressPoint[] {
  const sorted = [...journals].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const points: ProgressPoint[] = [];
  let cumulative: Metrics = { ...EMPTY_METRICS };
  for (const journal of sorted) {
    cumulative = mergeRecords(cumulative, journal.metrics);
    const point = { date: journal.date, metrics: { ...cumulative }, strength: strengthTotal(cumulative), fitness: fitnessProgress(cumulative, targets) };
    if (points.at(-1)?.date === journal.date) points[points.length - 1] = point;
    else points.push(point);
  }
  return points;
}

/** Format a measured duration without interpreting absent observations as zero. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
