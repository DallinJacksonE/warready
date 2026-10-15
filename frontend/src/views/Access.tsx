import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTraining } from '../state.js';
import { JournalForm, JournalList } from '../components/Journal.js';
export function Login() {
  const { session, presenter, busy } = useTraining();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  if (session?.user)
    return (
      <section className="panel login-panel">
        <p className="eyebrow">IDENTITY VERIFIED</p>
        <h1>
          Welcome back,
          <br />
          {session.user.displayName}.
        </h1>
        <p>Your training desk is ready.</p>
        <Link className="button" to="/journal">
          Open my journal ↗
        </Link>
      </section>
    );
  return (
    <section className="login-layout">
      <div>
        <p className="eyebrow">ATHLETE ACCESS / RESTRICTED</p>
        <h1>
          SHOW UP.
          <br />
          <span>PUT IN WORK.</span>
        </h1>
        <p className="lead">
          The journal is open to everyone.
          <br />
          The training desk belongs to the two athletes.
        </p>
        <p className="muted">No registration. Use your assigned account.</p>
      </div>
      <form
        className="panel login-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await presenter.login(username, password)) {
            setPassword('');
            navigate('/journal');
          }
        }}
      >
        <p className="eyebrow">SECURE SIGN IN</p>
        <h2>Back to the mission.</h2>
        <fieldset disabled={busy}>
          <label>
            Username
            <input
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={100}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="full-width">
            {busy ? 'Signing in…' : 'Sign in'} <span>↗</span>
          </button>
        </fieldset>
        <p className="disclaimer">
          Saved journals and calendar events are public. Credentials stay private.
        </p>
      </form>
    </section>
  );
}
export function MyJournal() {
  const { session } = useTraining();
  const [creating, setCreating] = useState(false);
  if (!session?.user)
    return (
      <section className="panel access-panel">
        <p className="eyebrow">ATHLETE ACCESS REQUIRED</p>
        <h1>
          Your work.
          <br />
          Your record.
        </h1>
        <p>Sign in to write and manage your journal.</p>
        <Link className="button" to="/login">
          Sign in ↗
        </Link>
      </section>
    );
  return (
    <section className="section">
      <p className="eyebrow">PERSONAL TRAINING DESK / {session.user.displayName}</p>
      <div className="section-heading">
        <div>
          <h1>
            FIELD JOURNAL<span className="accent">.</span>
          </h1>
          <p className="lead">Make the work count. Put it on the record.</p>
        </div>
        <button onClick={() => setCreating(!creating)} aria-expanded={creating}>
          {creating ? 'Close new entry' : '+ New entry'}
        </button>
      </div>
      {creating && (
        <div className="panel">
          <JournalForm onClose={() => setCreating(false)} />
        </div>
      )}
      <JournalList userId={session.user.id} editable />
    </section>
  );
}
