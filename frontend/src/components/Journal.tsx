import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Journal, JournalInput, Metrics } from '../../../shared/contracts.js';
import { EMPTY_METRICS, MAX_JOURNAL_LENGTH } from '../../../shared/contracts.js';
import { useTraining } from '../state.js';
import { importJournalText } from '../presenter/TrainingPresenter.js';
import { dateKey, displayDate } from '../presenter/calendar.js';
import { metricFields, MetricReadout, EmptyState } from './Progress.js';
export function JournalForm({ entry, onClose }: { entry?: Journal; onClose: () => void }) {
  const { presenter, busy } = useTraining();
  const [draft, setDraft] = useState<JournalInput>(() =>
    entry
      ? { title: entry.title, body: entry.body, date: entry.date, metrics: { ...entry.metrics } }
      : { title: '', body: '', date: dateKey(new Date()), metrics: { ...EMPTY_METRICS } },
  );
  const [fileError, setFileError] = useState('');
  const set = (key: 'title' | 'body' | 'date', value: string) =>
    setDraft({ ...draft, [key]: value });
  return (
    <form
      className="editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await presenter.saveJournal(draft, entry?.id)) onClose();
      }}
    >
      <div className="section-heading">
        <h3>{entry ? 'Edit field entry' : 'New field entry'}</h3>
        <span className="tag warning">PUBLIC ENTRY</span>
      </div>
      <p className="muted">Every saved entry is visible to everyone. Keep personal details out.</p>
      <fieldset disabled={busy}>
        <div className="form-row">
          <label>
            Title
            <input
              required
              maxLength={160}
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="What did you put in today?"
            />
          </label>
          <label>
            Date
            <input
              required
              type="date"
              value={draft.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </label>
        </div>
        <label>
          Journal text
          <textarea
            required
            maxLength={MAX_JOURNAL_LENGTH}
            rows={9}
            value={draft.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder="The session, the setbacks, the next move."
          />
        </label>
        <label className="file-input">
          Import plain text (.txt or .md · maximum 100 KB / 50,000 characters)
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setFileError('');
              try {
                set('body', await importJournalText(file));
              } catch (error) {
                setFileError((error as Error).message);
              }
              e.target.value = '';
            }}
          />
        </label>
        {fileError && (
          <p role="alert" className="form-error">
            {fileError}
          </p>
        )}
        <details
          className="metric-editor"
          open={!!entry && Object.values(entry.metrics).some((v) => v !== null)}
        >
          <summary>
            Record metrics <span>optional · leave unmeasured values blank</span>
          </summary>
          <p className="muted">
            Strength: best single repetition in pounds. Plank and 3-mile run: total seconds (3:45 =
            225, 18:00 = 1080). Never enter a zero for an unmeasured result.
          </p>
          <div className="metric-inputs">
            {metricFields.map(([key, label, unit]) => (
              <label key={key}>
                {label} <small>{unit}</small>
                <input
                  type="number"
                  min={key === 'runSeconds' ? 1 : 0}
                  max={key.endsWith('Seconds') ? 86400 : 2000}
                  step={key === 'squat' || key === 'bench' || key === 'deadlift' ? '0.5' : '1'}
                  value={draft.metrics[key] ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      metrics: {
                        ...draft.metrics,
                        [key]: e.target.value === '' ? null : Number(e.target.value),
                      } as Metrics,
                    })
                  }
                />
              </label>
            ))}
          </div>
        </details>
        <div className="actions">
          <button type="submit">
            {busy ? 'Saving…' : 'Save public entry'} <span>↗</span>
          </button>
          <button className="button-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export function JournalCard({ entry, editable = false }: { entry: Journal; editable?: boolean }) {
  const { data, presenter, busy } = useTraining();
  const [editing, setEditing] = useState(false);
  const owner = data?.users.find((u) => u.id === entry.userId);
  return (
    <article className="panel journal-card">
      <div className="journal-meta">
        <Link to={`/profiles/${entry.userId}`}>{owner?.displayName ?? 'Athlete'}</Link>
        <span>/</span>
        <time dateTime={entry.date}>{displayDate(entry.date)}</time>
        <span className="tag">FIELD NOTES</span>
      </div>
      <div className="section-heading">
        <h3>{entry.title}</h3>
        {editable && (
          <button
            type="button"
            disabled={busy}
            className="button-quiet"
            aria-expanded={editing}
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Close editor' : 'Edit entry'}
          </button>
        )}
      </div>
      {editing ? (
        <>
          <JournalForm entry={entry} onClose={() => setEditing(false)} />
          <button
            type="button"
            className="button-danger"
            disabled={busy}
            onClick={() =>
              void presenter.deleteJournal(entry.id, () =>
                window.confirm(
                  `Permanently delete “${entry.title}”? Its metrics will also be removed.`,
                ),
              )
            }
          >
            Delete entry
          </button>
        </>
      ) : (
        <>
          <p className="journal-body">{entry.body}</p>
          {Object.values(entry.metrics).some((v) => v !== null) && (
            <details className="recorded-metrics">
              <summary>View recorded metrics</summary>
              <MetricReadout metrics={entry.metrics} />
            </details>
          )}
        </>
      )}
    </article>
  );
}
export function JournalList({
  userId,
  editable = false,
  limit,
}: {
  userId?: string;
  editable?: boolean;
  limit?: number;
}) {
  const { data, session } = useTraining();
  const entries = [...(data?.journals ?? [])]
    .filter((j) => !userId || j.userId === userId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
  return entries.length ? (
    <div className="journal-list">
      {entries.map((entry) => (
        <JournalCard
          key={entry.id}
          entry={entry}
          editable={editable && entry.userId === session?.user?.id}
        />
      ))}
    </div>
  ) : (
    <EmptyState title="The journal is a clean slate.">
      No invented stats. No borrowed victories. Real training entries will appear here.
    </EmptyState>
  );
}
