import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import {
  IconHelp,
  IconHistory,
  IconMap,
  IconPlay,
  IconPlus,
  IconSettings,
  IconSignOut,
  SproutMark,
} from './icons';
import './layout.css';

// The one shell every signed-in surface lives in. A persistent left rail (brand,
// primary nav, the new-decision action, the demo control and the account) holds
// the whole workflow together, so the steps read as one workspace rather than a
// row of disconnected tabs. On narrow screens the rail becomes a top bar.
export function Layout() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const user = state.user;

  function initials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="shell-rail">
        <div className="shell-rail-top">
          <Link to="/" className="shell-brand" aria-label="Rooted home">
            <span className="shell-brand-mark" aria-hidden="true">
              <SproutMark size={22} />
            </span>
            <span className="shell-brand-word">Rooted</span>
          </Link>

          <nav aria-label="Main" className="shell-nav">
            <NavLink to="/" end className="shell-nav-link">
              <IconMap />
              <span>Map</span>
            </NavLink>
            <NavLink to="/history" className="shell-nav-link">
              <IconHistory />
              <span>History</span>
            </NavLink>
            <NavLink to="/settings" className="shell-nav-link">
              <IconSettings />
              <span>Settings</span>
            </NavLink>
            <NavLink to="/help" className="shell-nav-link">
              <IconHelp />
              <span>Help</span>
            </NavLink>
          </nav>

          <Link to="/decisions/new" className="btn shell-new">
            <IconPlus />
            New decision
          </Link>

          <div className="shell-demo">
            {state.demo ? (
              <>
                <span className="shell-demo-badge">
                  <span className="dot dot-alive" aria-hidden="true" />
                  Demo workspace
                </span>
                <p className="shell-demo-note">Planted sample data — not your own decisions.</p>
                <button
                  type="button"
                  className="btn btn-secondary shell-demo-btn"
                  onClick={() => {
                    dispatch({ type: 'exitDemo' });
                    navigate('/');
                  }}
                >
                  Leave demo
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-secondary shell-demo-btn"
                onClick={() => {
                  dispatch({ type: 'loadDemo' });
                  navigate('/');
                }}
              >
                <IconPlay />
                Explore the demo
              </button>
            )}
          </div>
        </div>

        {user && (
          <div className="shell-account">
            <span className="shell-avatar" aria-hidden="true">
              {initials(user.name)}
            </span>
            <span className="shell-account-text">
              <span className="shell-account-name">{user.name}</span>
              <span className="shell-account-meta">
                {user.role} · {user.team}
              </span>
            </span>
            <button
              type="button"
              className="shell-signout"
              aria-label="Sign out"
              onClick={() => {
                dispatch({ type: 'signOut' });
                navigate('/signin', { state: { from: location.pathname } });
              }}
            >
              <IconSignOut />
            </button>
          </div>
        )}
      </aside>

      <div className="shell-content">
        <main id="main" className="container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
