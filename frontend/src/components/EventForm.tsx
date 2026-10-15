import { useState } from 'react';
import type { EventInput, TrainingEvent } from '../../../shared/contracts.js';
import { useTraining } from '../state.js';
export function EventForm({
  event,
  date,
  onClose,
}: {
  event?: TrainingEvent;
  date: string;
  onClose: () => void;
}) {
  const { presenter, busy } = useTraining();
  const [draft, setDraft] = useState<EventInput>(() =>
    event
      ? {
          title: event.title,
          notes: event.notes,
          date: event.date,
          kind: event.kind,
          completed: event.completed,
        }
      : { title: '', notes: '', date, kind: 'workout', completed: false },
  );
  return (
    <form
      className="editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await presenter.saveEvent(draft, event?.id)) onClose();
      }}
    >
      <h3>{event ? 'Edit event' : 'Plan the next move'}</h3>
      <p className="muted">This event is public and belongs to your profile.</p>
      <fieldset disabled={busy}>
        <label>
          Event title
          <input
            autoFocus
            required
            maxLength={160}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <div className="form-row">
          <label>
            Date
            <input
              required
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </label>
          <label>
            Type
            <select
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as EventInput['kind'] })}
            >
              <option value="workout">Workout</option>
              <option value="milestone">Milestone</option>
            </select>
          </label>
        </div>
        <label>
          Notes
          <textarea
            rows={4}
            maxLength={10000}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.completed}
            onChange={(e) => setDraft({ ...draft, completed: e.target.checked })}
          />{' '}
          Mark completed
        </label>
        <div className="actions">
          <button type="submit">{busy ? 'Saving…' : 'Save event'}</button>
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
