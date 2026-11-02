// The app shell: header (search and ask, new decision, inbox, profile menu),
// footer (help, support, privacy) and the agent dock in the corner. The
// profile menu also holds the light/dark toggle and the demo switch (0009, 0010).
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AgentProvider, useAgent } from '../features/agent/AgentContext';
import { AgentLauncher, AgentPanel } from '../features/agent/AgentPanel';
import { InboxRow } from '../features/dashboard/InboxRow';
import { inboxItems, localToday } from '../store/dashboard';
import { useStore } from '../store/store';
import { useTheme } from '../theme';
import { BellIcon, IconMoon, IconSun, SearchIcon, SparkIcon } from './icons';
import { Popover } from './Popover';
import './layout.css';

export function Layout() {
  return (
    <AgentProvider>
      <Shell />
    </AgentProvider>
  );
}

function Shell() {
  const { open } = useAgent();
  const { state } = useStore();
  const location = useLocation();
  // First-run setup gets a quiet header: no search, inbox or agent until sources are chosen.
  const setup = location.pathname === '/onboarding';

  // A new page starts at the top; footer and menu links point at sections
  // (/help#...), so bring those into view instead.
  useEffect(() => {
    if (!location.hash) {
      window.scrollTo?.(0, 0);
      return;
    }
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    el?.scrollIntoView?.({ block: 'start' });
  }, [location.pathname, location.hash]);

  return (
    <div className={open ? 'shell shell-agent-open' : 'shell'}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <div className="header-lead">
            <NavLink to="/" className="wordmark" aria-label="Rooted home">
              Rooted
            </NavLink>
            {state.demo && (
              <span className="pill demo-badge">
                Demo<span className="demo-badge-more"> workspace · sample data</span>
              </span>
            )}
          </div>
          {setup ? (
            <div className="row header-actions">
              <span className="pill">Setup</span>
              <ProfileMenu />
            </div>
          ) : (
            <>
              <SearchBox />
              <div className="row header-actions">
                <Link to="/decisions/new" className="btn header-new">
                  New decision
                </Link>
                <InboxMenu />
                <ProfileMenu />
              </div>
            </>
          )}
        </div>
      </header>
      {/* The home map uses the full width; every other page keeps the 1240px column. */}
      <main id="main" className={location.pathname === '/' ? 'shell-main shell-main-wide' : 'shell-main container'}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <nav aria-label="Help and support" className="site-footer-inner">
          <Link to="/help">Help & FAQ</Link>
          <Link to="/help#help-support-title">Contact support</Link>
          <Link to="/help#help-report-title">Report a problem</Link>
          <Link to="/settings#settings-data">Privacy and your data</Link>
        </nav>
      </footer>
      {!setup && <AgentLauncher />}
      {!setup && <AgentPanel />}
    </div>
  );
}

// AI search: typing filters the decision map; Enter asks Rooted and opens the
// answer in the agent panel, where the decisions it used are cited.
function SearchBox() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { ask } = useAgent();
  const onHome = location.pathname === '/';
  const [text, setText] = useState(onHome ? (params.get('q') ?? '') : '');
  const id = useId();

  useEffect(() => {
    if (!onHome) setText('');
  }, [onHome]);

  function change(value: string) {
    setText(value);
    if (!onHome) return;
    const next = new URLSearchParams(params);
    if (value.trim()) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (!onHome) navigate(`/?q=${encodeURIComponent(text)}`);
    ask(text, {});
  }

  return (
    <form role="search" className="header-search" onSubmit={submit}>
      <label htmlFor={id} className="visually-hidden">
        Search or ask about decisions
      </label>
      <span className="header-search-icon" aria-hidden="true">
        <SearchIcon />
      </span>
      <input
        id={id}
        type="search"
        className="input header-search-input"
        placeholder="Search or ask about decisions"
        value={text}
        onChange={(e) => change(e.target.value)}
      />
      <button type="submit" className="btn btn-ghost header-search-ask" disabled={!text.trim()}>
        <SparkIcon size={16} /> Ask
      </button>
    </form>
  );
}

function InboxMenu() {
  const { state } = useStore();
  const items = inboxItems(state, localToday());
  const due = items.filter((i) => i.due).length;
  return (
    <Popover
      label={due ? `Inbox, ${due} due` : 'Inbox'}
      button={
        <>
          <BellIcon />
          {due > 0 && (
            <span className="badge" aria-hidden="true">
              {due}
            </span>
          )}
        </>
      }
    >
      {(close) => (
        <div className="inbox">
          <h2 className="inbox-title">Inbox</h2>
          {items.length === 0 ? (
            <p className="muted inbox-empty">You’re all caught up.</p>
          ) : (
            <ul className="inbox-list">
              {items.map((item) => (
                <InboxRow key={item.id} item={item} onDone={close} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}

function ProfileMenu() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const me = state.teammates.find((t) => t.id === state.user?.id);
  const initials = me?.initials ?? state.user?.name.slice(0, 2).toUpperCase() ?? '?';
  if (!state.user) return null;
  return (
    <Popover
      label="Your account"
      className="icon-btn profile-btn"
      button={<span className="avatar avatar-me">{initials}</span>}
    >
      {(close) => (
        <div className="profile-menu">
          <div className="profile-who">
            <p className="profile-name">{state.user!.name}</p>
            <p className="muted profile-email">{state.user!.email}</p>
          </div>
          <nav aria-label="Account">
            <ul className="profile-links">
              <li>
                <Link to="/settings#settings-profile">Profile</Link>
              </li>
              <li>
                <Link to="/settings#settings-sources">Sources and data access</Link>
              </li>
              <li>
                <Link to="/settings#settings-notifications">Notifications</Link>
              </li>
              <li>
                <Link to="/settings#settings-plan">Plan</Link>
              </li>
              <li>
                <Link to="/settings">All settings</Link>
              </li>
            </ul>
          </nav>
          <div className="profile-actions">
            <button
              type="button"
              className="btn btn-ghost profile-action"
              aria-pressed={theme === 'dark'}
              onClick={toggle}
            >
              {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />} Dark mode
            </button>
            <button
              type="button"
              className="btn btn-ghost profile-action"
              onClick={() => {
                dispatch({ type: state.demo ? 'exitDemo' : 'loadDemo' });
                close();
                navigate('/');
              }}
            >
              {state.demo ? 'Leave demo' : 'Explore the demo'}
            </button>
          </div>
          <button
            type="button"
            className="btn btn-secondary profile-signout"
            onClick={() => {
              dispatch({ type: 'signOut' });
              navigate('/signin');
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </Popover>
  );
}
