import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { User, ProfileInput } from '../../../shared/contracts.js';
import {
  bestMetrics,
  fitnessProgress,
  strengthProgress,
  strengthTotal,
  progressTimeline,
  formatDuration,
} from '../../../shared/progress.js';
import { useTraining } from '../state.js';
import { MetricReadout, ProgressBar, EmptyState } from '../components/Progress.js';
import { JournalList } from '../components/Journal.js';
import { displayDate, dateKey } from '../presenter/calendar.js';
function ProfileEditor({ user, onClose }: { user: User; onClose: () => void }) {
  const { presenter, busy } = useTraining();
  const [draft, setDraft] = useState<ProfileInput>({
    displayName: user.displayName,
    bio: user.bio,
    targets: { ...user.targets },
  });
  return (
    <form
      className="panel editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await presenter.saveProfile(draft)) onClose();
      }}
    >
      <h2>Edit profile & targets</h2>
      <fieldset disabled={busy}>
        <label>
          Display name
          <input
            required
            maxLength={80}
            value={draft.displayName}
            onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
          />
        </label>
        <label>
          Bio
          <textarea
            rows={3}
            maxLength={2000}
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
          />
        </label>
        <p className="muted">
          Personal fitness targets, not official scoring. Enter durations in seconds.
        </p>
        <div className="metric-inputs">
          {(['pullups', 'plankSeconds', 'runSeconds'] as const).map((key) => (
            <label key={key}>
              {key === 'pullups'
                ? 'Pull-ups (reps)'
                : key === 'plankSeconds'
                  ? 'Plank (seconds)'
                  : '3-mile run (seconds)'}
              <input
                type="number"
                required
                min={1}
                max={key === 'pullups' ? 200 : 86400}
                step="1"
                value={draft.targets[key]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    targets: { ...draft.targets, [key]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="actions">
          <button type="submit">{busy ? 'Saving…' : 'Save profile'}</button>
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export function Profile() {
  const { id } = useParams();
  return <AthleteProfile key={id} id={id} />;
}

/** Route-keyed state prevents drafts/lookback from carrying into another athlete's dossier. */
function AthleteProfile({ id }: { id: string | undefined }) {
  const { data, session } = useTraining();
  const user = data?.users.find((u) => u.id === id);
  const [editing, setEditing] = useState(false);
  const [lookback, setLookback] = useState('');
  if (!user)
    return (
      <section className="empty-state">
        <h1>Athlete not found.</h1>
        <Link className="button" to="/">
          Back to the team
        </Link>
      </section>
    );
  const own = data!.journals.filter((j) => j.userId === user.id);
  const selected = lookback ? own.filter((j) => j.date <= lookback) : own;
  const metrics = bestMetrics(selected);
  const timeline = progressTimeline(own, user.targets);
  return (
    <>
      <section className="section profile-hero">
        <p className="eyebrow">ATHLETE DOSSIER / @{user.username}</p>
        <div className="section-heading">
          <div>
            <h1>
              {user.displayName}
              <span className="accent">.</span>
            </h1>
            <p className="lead profile-bio">
              {user.bio || 'Building the standard. One session at a time.'}
            </p>
          </div>
          {session?.user?.id === user.id && (
            <button
              className="button-secondary"
              aria-expanded={editing}
              onClick={() => setEditing(!editing)}
            >
              {editing ? 'Close profile editor' : 'Edit profile & targets'}
            </button>
          )}
        </div>
        {editing && session?.user?.id === user.id && <ProfileEditor user={user} onClose={() => setEditing(false)} />}
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / READINESS REPORT</p>
            <h2>{lookback ? `As of ${displayDate(lookback)}` : 'The current standard.'}</h2>
          </div>
          <label className="lookback">
            Look back through date
            <input
              type="date"
              value={lookback}
              max={dateKey(new Date())}
              onChange={(e) => setLookback(e.target.value)}
            />
            {lookback && (
              <button className="button-quiet" onClick={() => setLookback('')}>
                Return to all records
              </button>
            )}
          </label>
        </div>
        <div className="readiness-grid">
          <div className="panel">
            <ProgressBar
              label="Fitness readiness"
              value={fitnessProgress(metrics, user.targets)}
              tone="fitness"
              detail={`Targets: ${user.targets.pullups} pull-ups · ${formatDuration(user.targets.plankSeconds)} plank · ${formatDuration(user.targets.runSeconds)} 3-mile run`}
            />
            <ProgressBar
              label="1,000 lb club"
              value={strengthProgress(metrics)}
              tone="strength"
              detail={`${strengthTotal(metrics)} / 1,000 lb · sum of best recorded squat, bench & deadlift`}
            />
          </div>
          <div className="panel">
            <p className="eyebrow">BEST RECORDED METRICS</p>
            <MetricReadout metrics={metrics} />
          </div>
        </div>
        <p className="disclaimer">
          Unofficial training progress — not a Marine PFT score. Best single-repetition lifts,
          highest reps and plank, fastest run. Missing metrics count as zero progress; a dash means
          not recorded.
        </p>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">02 / THE LOOKBACK</p>
            <h2>Proof of the process.</h2>
          </div>
          <span className="tag">CUMULATIVE RECORDS</span>
        </div>
        {timeline.length ? (
          <div className="table-scroll panel">
            <table>
              <caption className="sr-only">
                Cumulative best metrics and training progress by journal date
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Squat</th>
                  <th scope="col">Bench</th>
                  <th scope="col">Deadlift</th>
                  <th scope="col">Pull-ups</th>
                  <th scope="col">Plank</th>
                  <th scope="col">3-mile run</th>
                  <th scope="col">Fitness</th>
                  <th scope="col">Strength</th>
                </tr>
              </thead>
              <tbody>
                {[...timeline].reverse().map((row) => (
                  <tr key={row.date}>
                    <th scope="row">
                      <button className="button-quiet" onClick={() => setLookback(row.date)}>
                        {displayDate(row.date)}
                      </button>
                    </th>
                    <td>{row.metrics.squat ?? '—'}</td>
                    <td>{row.metrics.bench ?? '—'}</td>
                    <td>{row.metrics.deadlift ?? '—'}</td>
                    <td>{row.metrics.pullups ?? '—'}</td>
                    <td>{formatDuration(row.metrics.plankSeconds)}</td>
                    <td>{formatDuration(row.metrics.runSeconds)}</td>
                    <td className="fitness-text">{Math.round(row.fitness)}%</td>
                    <td className="strength-text">{Math.round(row.strength)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="History is built, not invented.">
            Add a journal entry with metrics to start a real progress timeline.
          </EmptyState>
        )}
      </section>
      <section className="section">
        <p className="eyebrow">03 / FIELD NOTES</p>
        <h2>{user.displayName}'s journal.</h2>
        <JournalList userId={user.id} editable />
      </section>
    </>
  );
}
