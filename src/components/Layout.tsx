// The app shell: header (search and ask, new decision, inbox, profile menu),
// footer (help, support, privacy) and the agent dock in the corner. The
// profile menu also holds the light/dark toggle and the demo switch (0009, 0010).
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AgentProvider, useAgent } from '../features/agent/AgentContext';
import { AgentLauncher, AgentPanel } from '../features/agent/AgentPanel';
import { InboxRow } from '../features/dashboard/InboxRow';
import { inboxItems, localToday } from '../store/dashboard';
import { initialsOf, useStore } from '../store/store';
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
              <span className="pill demo-badge" title="Sample data">
                Demo<span className="visually-hidden"> · sample data</span>
              </span>
            )}
            {!setup && (
              <nav aria-label="Main" className="header-nav">
                <NavLink to="/" end>
                  Decisions
                </NavLink>
                <NavLink to="/patterns">Patterns</NavLink>
              </nav>
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
                  {/* One inline label, so the space before "decision" survives the flex layout. */}
                  <span>
                    New<span className="header-new-more"> decision</span>
                  </span>
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
          <Link to="/help/contact">Contact support</Link>
          <Link to="/help/report">Report a problem</Link>
          <Link to="/privacy">Privacy and your data</Link>
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
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" or Ctrl/⌘+K jumps to search from anywhere, unless the PM is typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest('input, textarea, select, [contenteditable="true"]');
      const shortcut = (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) ||
        (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey));
      if (!shortcut || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

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
        ref={inputRef}
        type="search"
        className="input header-search-input"
        placeholder="Search or ask about decisions"
        aria-keyshortcuts="/ Control+K Meta+K"
        value={text}
        onChange={(e) => change(e.target.value)}
      />
      <kbd className="header-search-key" aria-hidden="true">
        /
      </kbd>
      <button type="submit" className="btn btn-ghost header-search-ask" disabled={!text.trim()} title="Ask Rooted">
        <SparkIcon size={16} /> <span className="visually-hidden">Ask</span>
      </button>
    </form>
  );
}

function InboxMenu() {
  const { state } = useStore();
  const items = inboxItems(state, localToday());
  const due = items.filter((i) => i.due).length;
  // The badge counts everything in the inbox, so it matches what opens; due items make it red.
  const label = items.length
    ? `Inbox, ${items.length} item${items.length === 1 ? '' : 's'}${due ? `, ${due} due` : ''}`
    : 'Inbox';
  return (
    <Popover
      label={label}
      button={
        <>
          <BellIcon />
          {items.length > 0 && (
            <span className={due ? 'badge badge-due' : 'badge'} aria-hidden="true">
              {items.length}
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
  const auth = useAuth();
  const { theme, toggle } = useTheme();
  if (!state.user) return null;
  // The account is always the signed-in person, even inside the demo, where the
  // sample company's PM (their teammate entry on the map) has another name.
  const initials = initialsOf(state.user.name);
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
              <li>
                <Link to="/help">Help and FAQ</Link>
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
            onClick={async () => {
              // End the real session first, so a refresh can't sign back in.
              await auth.client?.signOut();
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
