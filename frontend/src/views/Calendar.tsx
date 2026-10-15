import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTraining } from '../state.js';
import { calendarDays, dateKey, moveMonth, displayDate } from '../presenter/calendar.js';
import { EventForm } from '../components/EventForm.js';
import { EmptyState } from '../components/Progress.js';
export function Calendar() {
  const { data, session, presenter, busy } = useTraining();
  const [month, setMonth] = useState(() => moveMonth(new Date(), 0));
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [owner, setOwner] = useState('');
  const [editor, setEditor] = useState<string | null>(null);
  const filtered = data!.events.filter((e) => !owner || e.userId === owner);
  const dayEvents = filtered.filter((e) => e.date === selected);
  const activeEvent = data!.events.find((e) => e.id === editor);
  const today = dateKey(new Date());
  return (
    <section className="section">
      <p className="eyebrow">THE TRAINING PLAN / SHARED CALENDAR</p>
      <div className="section-heading">
        <div>
          <h1>
            PLAN. EXECUTE.
            <br />
            <span className="outline-text">REPEAT.</span>
          </h1>
          <p className="lead">Two athletes. One calendar. Keep the mission in sight.</p>
        </div>
        {session?.user ? (
          <button
            aria-expanded={editor === 'new'}
            onClick={() => setEditor(editor === 'new' ? null : 'new')}
          >
            + Plan an event
          </button>
        ) : (
          <Link className="button button-secondary" to="/login">
            Sign in to plan ↗
          </Link>
        )}
      </div>
      <div className="calendar-toolbar">
        <div className="month-nav">
          <button
            className="button-secondary"
            aria-label="Previous month"
            onClick={() => setMonth(moveMonth(month, -1))}
          >
            ←
          </button>
          <h2 aria-live="polite">
            {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <button
            className="button-secondary"
            aria-label="Next month"
            onClick={() => setMonth(moveMonth(month, 1))}
          >
            →
          </button>
          <button
            className="button-quiet"
            onClick={() => {
              setMonth(moveMonth(new Date(), 0));
              setSelected(today);
              setEditor(null);
            }}
          >
            Today
          </button>
        </div>
        <label className="filter-label">
          Athlete
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Both athletes</option>
            {data!.users.map((u) => (
              <option value={u.id} key={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="calendar-legend">
        <span>
          <i className="workout-dot" />
          Workout
        </span>
        <span>
          <i className="milestone-dot" />
          Milestone
        </span>
        <span>✓ Completed</span>
        <span className="muted">Select a day for full details</span>
      </div>
      <div className="calendar-layout">
        <div className="calendar panel">
          <div className="weekdays" aria-hidden="true">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDays(month).map((date) => {
              const key = dateKey(date);
              const events = filtered.filter((e) => e.date === key);
              return (
                <button
                  type="button"
                  key={key}
                  aria-label={`${displayDate(key)}${key === today ? ', today' : ''}, ${events.length} events`}
                  aria-pressed={selected === key}
                  className={`calendar-day ${date.getMonth() !== month.getMonth() ? 'outside' : ''} ${selected === key ? 'selected' : ''} ${key === today ? 'today' : ''}`}
                  onClick={() => {
                    setSelected(key);
                    setEditor(null);
                  }}
                >
                  <span className="day-number">
                    {date.getDate()}
                    {key === today && <span className="sr-only"> today</span>}
                  </span>
                  <span className="day-events">
                    {events.slice(0, 2).map((e) => (
                      <span key={e.id} className={`calendar-event ${e.kind}`}>
                        <span className="event-dot" />
                        {e.completed ? '✓ ' : ''}
                        <span className="event-title">{e.title}</span>
                      </span>
                    ))}
                    {events.length > 2 && (
                      <span className="more-events">+{events.length - 2} more</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <aside className="panel agenda">
          <p className="eyebrow">DAY BRIEFING</p>
          <h2>{displayDate(selected)}</h2>
          {editor &&
          session?.user &&
          (editor === 'new' || activeEvent?.userId === session.user.id) ? (
            <EventForm
              key={`${editor}-${selected}`}
              event={activeEvent}
              date={selected}
              onClose={() => setEditor(null)}
            />
          ) : (
            <>
              {dayEvents.length ? (
                dayEvents.map((event) => (
                  <article className="agenda-event" key={event.id}>
                    <div className="journal-meta">
                      <span className={`tag ${event.kind}`}>{event.kind}</span>
                      <span>{event.completed ? '✓ Completed' : 'Planned'}</span>
                    </div>
                    <h3>{event.title}</h3>
                    <Link className="event-owner" to={`/profiles/${event.userId}`}>
                      {data!.users.find((u) => u.id === event.userId)?.displayName ?? 'Athlete'}
                    </Link>
                    <p className="journal-body">{event.notes}</p>
                    {event.userId === session?.user?.id && (
                      <div className="actions">
                        <button
                          className="button-secondary"
                          disabled={busy}
                          onClick={() => setEditor(event.id)}
                        >
                          Edit
                        </button>
                        <button
                          className="button-danger"
                          disabled={busy}
                          onClick={() =>
                            void presenter.deleteEvent(event.id, () =>
                              window.confirm(`Permanently delete “${event.title}”?`),
                            )
                          }
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <EmptyState title="Open ground.">
                  No events planned for this day{owner ? ' for this athlete' : ''}.
                </EmptyState>
              )}
              {session?.user && (
                <button className="button-secondary full-width" onClick={() => setEditor('new')}>
                  + Add event on this day
                </button>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
