import { Link } from 'react-router-dom';
import type { Metrics, User, Journal } from '../../../shared/contracts.js';
import {
  bestMetrics,
  fitnessProgress,
  strengthProgress,
  strengthTotal,
  formatDuration,
} from '../../../shared/progress.js';
export const metricFields: [keyof Metrics, string, string][] = [
  ['squat', 'Squat', 'lb · 1RM'],
  ['bench', 'Bench press', 'lb · 1RM'],
  ['deadlift', 'Deadlift', 'lb · 1RM'],
  ['pullups', 'Pull-ups', 'reps'],
  ['plankSeconds', 'Plank', 'seconds'],
  ['runSeconds', '3-mile run', 'seconds'],
];
export function MetricReadout({ metrics }: { metrics: Metrics }) {
  return (
    <dl className="metrics">
      {metricFields.map(([key, label, unit]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>
            {metrics[key] === null
              ? '—'
              : key.endsWith('Seconds')
                ? formatDuration(metrics[key])
                : metrics[key]}{' '}
            <small>{key.endsWith('Seconds') ? 'min:sec' : unit}</small>
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function ProgressBar({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: number;
  tone: 'fitness' | 'strength';
  detail: string;
}) {
  return (
    <div className={`progress ${tone}`}>
      <div className="progress-label">
        <span>{label}</span>
        <strong>
          {Math.round(value)}
          <small>%</small>
        </strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
      >
        <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <p>{detail}</p>
    </div>
  );
}
export function AthleteCard({
  user,
  journals,
  index = 0,
}: {
  user: User;
  journals: Journal[];
  index?: number;
}) {
  const own = journals.filter((j) => j.userId === user.id);
  const metrics = bestMetrics(own);
  return (
    <article className="panel athlete-card">
      <div className="eyebrow">
        ATHLETE / 0{index + 1}
        <span className="status-dot">ACTIVE MISSION</span>
      </div>
      <div className="athlete-heading">
        <span className="monogram" aria-hidden="true">
          {user.displayName.slice(0, 1)}
        </span>
        <div>
          <h3>
            <Link to={`/profiles/${user.id}`}>{user.displayName}</Link>
          </h3>
          <p>
            {own.length} field {own.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <Link
          className="arrow-link"
          to={`/profiles/${user.id}`}
          aria-label={`View ${user.displayName}'s profile`}
        >
          ↗
        </Link>
      </div>
      <ProgressBar
        label="Fitness readiness"
        value={fitnessProgress(metrics, user.targets)}
        tone="fitness"
        detail="Personal training targets · unofficial"
      />
      <ProgressBar
        label="1,000 lb club"
        value={strengthProgress(metrics)}
        tone="strength"
        detail={`${strengthTotal(metrics).toLocaleString()} / 1,000 lb · best recorded 1RMs`}
      />
    </article>
  );
}
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="crosshair" aria-hidden="true">
        ＋
      </span>
      <h3>{title}</h3>
      <p>{children ?? 'The work starts here. No training records have been added yet.'}</p>
    </div>
  );
}
