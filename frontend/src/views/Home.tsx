import { Link } from 'react-router-dom';
import { useTraining } from '../state.js';
import { AthleteCard } from '../components/Progress.js';
import { JournalList } from '../components/Journal.js';
export function Home() {
  const { data, session } = useTraining();
  return (
    <>
      <section className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow">
            <span className="signal" /> TWO BROTHERS. ONE DEADLINE.
          </p>
          <h1>
            NOT GIVEN.
            <br />
            <span>EARNED.</span>
          </h1>
          <p className="hero-description">
            The road to peak fitness and the 1,000 lb club.
            <br />
            Every rep. Every mile. Everything on the record.
          </p>
          <div className="actions">
            <Link className="button" to={session?.user ? '/journal' : '/calendar'}>
              {session?.user ? 'Log the work' : 'Explore the mission'} <span>↗</span>
            </Link>
            <a className="text-link" href="#field-notes">
              Read the field notes ↓
            </a>
          </div>
        </div>
        <aside className="mission-stamp">
          <span className="eyebrow">MISSION DEADLINE</span>
          <strong>
            16<span>OCT / 2027</span>
          </strong>
          <div className="stamp-line" />
          <p>
            1,000 LB TOTAL
            <br />
            PEAK FITNESS
            <br />
            ZERO EXCUSES.
          </p>
          <span className="stamp-number">WR—001 / EST. 2026</span>
        </aside>
        <div className="hero-bottom">
          <span>TRAIN WITH INTENT. TRACK WITH HONESTY.</span>
          <span>THE STANDARD IS THE STANDARD. ↗</span>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / THE TEAM</p>
            <h2>Two paths. Same standard.</h2>
          </div>
          <span className="section-note">PROGRESS, NOT PROMISES</span>
        </div>
        <div className="athlete-grid">
          {data!.users.map((user, index) => (
            <AthleteCard user={user} journals={data!.journals} index={index} key={user.id} />
          ))}
        </div>
        <p className="disclaimer">
          Fitness readiness is unofficial personal training progress, not an official Marine PFT
          score. Strength totals use best recorded one-rep maxes.
        </p>
      </section>
      <section className="section" id="field-notes">
        <div className="section-heading">
          <div>
            <p className="eyebrow">02 / THE FIELD NOTES</p>
            <h2>The work behind the numbers.</h2>
          </div>
          <span className="tag">PUBLIC JOURNAL</span>
        </div>
        <JournalList editable />
      </section>
    </>
  );
}
