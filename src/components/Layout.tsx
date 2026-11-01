import { useState } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { useTheme } from '../theme';
import {
  IconHelp,
  IconMap,
  IconMoon,
  IconPlus,
  IconSettings,
  IconSidebar,
  IconSignOut,
  IconSun,
  SproutMark,
} from './icons';
import './layout.css';

// The app shell: a collapsible rail plus the content column. The rail can be
// hidden entirely, so the map can run full-screen; every signed-in surface lives
// in the same shell, so the workflow reads as one place.
export function Layout() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const [railOpen, setRailOpen] = useState(true);
  const user = state.user;
  const isMap = location.pathname === '/';

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

      {railOpen && (
        <aside className="shell-rail">
          <div className="shell-rail-top">
            <div className="shell-rail-head">
              <Link to="/" className="shell-brand" aria-label="Rooted home">
                <span className="shell-brand-mark" aria-hidden="true">
                  <SproutMark size={22} />
                </span>
                <span className="shell-brand-word">Rooted</span>
              </Link>
              <button
                type="button"
                className="shell-icon-btn"
                aria-label="Hide sidebar"
                title="Hide sidebar"
                onClick={() => setRailOpen(false)}
              >
                <IconSidebar />
              </button>
            </div>

            <nav aria-label="Main" className="shell-nav">
              <NavLink to="/" end className="shell-nav-link">
                <IconMap />
                <span>Map</span>
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
                  Explore the demo
                </button>
              )}
            </div>
          </div>

          <div className="shell-rail-foot">
            <button
              type="button"
              className="shell-theme"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'dark'}
              onClick={toggle}
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
            </button>
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
                  className="shell-icon-btn"
                  aria-label="Sign out"
                  title="Sign out"
                  onClick={() => {
                    dispatch({ type: 'signOut' });
                    navigate('/signin', { state: { from: location.pathname } });
                  }}
                >
                  <IconSignOut />
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      <div className={`shell-content${isMap ? ' shell-content-map' : ''}`}>
        {!railOpen && (
          <button
            type="button"
            className="shell-reopen"
            aria-label="Show sidebar"
            title="Show sidebar"
            onClick={() => setRailOpen(true)}
          >
            <IconSidebar />
          </button>
        )}
        <main id="main" className={isMap ? 'shell-main-map' : 'container shell-main-doc'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
