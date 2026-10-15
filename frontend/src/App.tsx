import { useEffect } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { TrainingProvider, useTraining } from './state.js';
import { Home } from './views/Home.js';
import { Login, MyJournal } from './views/Access.js';
import { Profile } from './views/Profile.js';
import { Calendar } from './views/Calendar.js';
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${pathname === '/' ? 'The mission' : pathname === '/calendar' ? 'Training calendar' : pathname === '/login' ? 'Athlete access' : pathname === '/journal' ? 'Field journal' : 'Athlete dossier'} — WAR READY`;
  }, [pathname]);
  return null;
}
function Shell() {
  const { data, session, loading, busy, error, notice, presenter } = useTraining();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <ScrollReset />
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/" aria-label="War Ready home">
            <span className="brand-mark" aria-hidden="true">
              W<span>R</span>
            </span>
            <span>
              WAR<span className="accent">READY</span>
              <small>THE WORK IS THE WAY.</small>
            </span>
          </Link>
          <nav aria-label="Main navigation">
            <NavLink to="/" end>
              Mission
            </NavLink>
            <NavLink to="/calendar">Calendar</NavLink>
            {data?.users.map((user) => (
              <NavLink key={user.id} to={`/profiles/${user.id}`}>
                {user.displayName}
              </NavLink>
            ))}
            {session?.user && <NavLink to="/journal">My journal</NavLink>}
          </nav>
          <div className="header-auth">
            {session?.user ? (
              <button
                className="button-secondary compact"
                disabled={busy}
                onClick={() => void presenter.logout()}
              >
                Sign out
              </button>
            ) : (
              <NavLink className="button compact" to="/login">
                Athlete login <span>↗</span>
              </NavLink>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="site-main" tabIndex={-1}>
        {error && (
          <div className="message error" role="alert">
            <strong>Unable to complete request.</strong> {error}
            {!data && (
              <button
                className="button-secondary"
                disabled={loading}
                onClick={() => void presenter.load()}
              >
                Try again
              </button>
            )}
          </div>
        )}
        {notice && (
          <div className="message notice" role="status">
            {notice}
          </div>
        )}
        {loading ? (
          <section className="loading" role="status">
            <span className="loading-cross" aria-hidden="true">
              ＋
            </span>
            <p className="eyebrow">ASSEMBLING THE TRAINING RECORD…</p>
          </section>
        ) : data ? (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/login" element={<Login />} />
            <Route path="/journal" element={<MyJournal />} />
            <Route path="/profiles/:id" element={<Profile />} />
            <Route
              path="*"
              element={
                <section className="empty-state">
                  <p className="eyebrow">404 / OFF THE MAP</p>
                  <h1>Wrong coordinates.</h1>
                  <p>This page doesn't exist. Get back to the mission.</p>
                  <Link className="button" to="/">
                    Return to base ↗
                  </Link>
                </section>
              }
            />
          </Routes>
        ) : (
          <section className="empty-state">
            <h1>The training record is unavailable.</h1>
            <p>Please retry when the connection is restored.</p>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <div>
          <Link className="footer-brand" to="/">
            WAR<span className="accent">READY</span>
          </Link>
          <p>Earn it every day.</p>
        </div>
        <p className="footer-goal">
          1,000 LB CLUB + PEAK FITNESS<span>MISSION DEADLINE / 16 OCTOBER 2027</span>
        </p>
        <p className="footer-fine">
          Two brothers. One standard.
          <br />
          Unofficial training progress. No shortcuts.
        </p>
      </footer>
    </>
  );
}
export function App() {
  return (
    <BrowserRouter>
      <TrainingProvider>
        <Shell />
      </TrainingProvider>
    </BrowserRouter>
  );
}
