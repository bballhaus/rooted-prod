import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog } from '../../components/Dialog';
import { useStore } from '../../store/store';
import type { Source, User } from '../../types';
import './settings.css';

// Settings: profile (F-22), plan (F-24), notifications (F-25, F-26),
// sources and your data (F-23). Everything is stored in the client store.

const SECTIONS = [
  { id: 'settings-profile', label: 'Profile' },
  { id: 'settings-plan', label: 'Plan' },
  { id: 'settings-notifications', label: 'Notifications' },
  { id: 'settings-sources', label: 'Sources' },
  { id: 'settings-data', label: 'Your data' },
] as const;

export function SettingsPage() {
  const { state } = useStore();
  const user = state.user;
  if (!user) return null;

  return (
    <div className="page settings-page">
      <header className="stack">
        <h1 className="page-title">Settings</h1>
        <p className="lead">Your profile, plan, nudges, connected sources and data.</p>
      </header>
      <nav aria-label="Settings sections" className="settings-nav">
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="settings-sections">
        <ProfileSection user={user} />
        <PlanSection />
        <NotificationsSection user={user} />
        <SourcesSection sources={state.sources} />
        <DataSection />
      </div>
    </div>
  );
}

function ProfileSection({ user }: { user: User }) {
  const { dispatch } = useStore();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [team, setTeam] = useState(user.team);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setSaved(false);
      setError('Add your name so teammates know whose decisions these are.');
      return;
    }
    dispatch({ type: 'updateUser', patch: { name: name.trim(), role: role.trim(), team: team.trim() } });
    setError('');
    setSaved(true);
  }

  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setSaved(false);
    };
  }

  return (
    <section id="settings-profile" className="card settings-section" aria-labelledby="settings-profile-title">
      <div className="card-section">
        <h2 id="settings-profile-title" className="section-title">
          Profile
        </h2>
      </div>
      <form className="card-section stack" onSubmit={save} noValidate>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="settings-name">Name</label>
            <input
              id="settings-name"
              className="input"
              value={name}
              onChange={(e) => edit(setName)(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="settings-email">Email</label>
            <input id="settings-email" className="input" value={user.email} readOnly aria-describedby="settings-email-hint" />
            <span id="settings-email-hint" className="hint">
              Comes from your {user.signInProvider === 'google' ? 'Google' : 'Slack'} sign-in and can’t be changed here.
            </span>
          </div>
          <div className="field">
            <label htmlFor="settings-role">Role</label>
            <input
              id="settings-role"
              className="input"
              value={role}
              onChange={(e) => edit(setRole)(e.target.value)}
              autoComplete="organization-title"
            />
          </div>
          <div className="field">
            <label htmlFor="settings-team">Team</label>
            <input id="settings-team" className="input" value={team} onChange={(e) => edit(setTeam)(e.target.value)} />
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="row">
          <button type="submit" className="btn">
            Save profile
          </button>
          <span role="status" className="settings-status">
            {saved ? 'Saved' : ''}
          </span>
        </div>
      </form>
    </section>
  );
}

function PlanSection() {
  return (
    <section id="settings-plan" className="card settings-section" aria-labelledby="settings-plan-title">
      <div className="card-section row settings-plan-head">
        <h2 id="settings-plan-title" className="section-title">
          Plan
        </h2>
        <span className="pill">Beta</span>
      </div>
      <div className="card-section stack">
        <p>
          <strong>Free during the beta.</strong> You’re using an early prototype of Rooted. There’s nothing to pay and
          no card on file.
        </p>
        <p className="muted">
          Paid plans and billing aren’t decided yet. We’ll tell you before anything changes, and nothing will be
          charged without your say.
        </p>
      </div>
    </section>
  );
}

function NotificationsSection({ user }: { user: User }) {
  const { dispatch } = useStore();
  const [status, setStatus] = useState('');

  function setChannel(channel: User['notificationChannel']) {
    dispatch({ type: 'updateUser', patch: { notificationChannel: channel } });
    setStatus(`Saved: nudges will go to ${channel === 'slack' ? 'Slack' : 'email'}.`);
  }

  function setDays(days: User['defaultReviewDays']) {
    dispatch({ type: 'updateUser', patch: { defaultReviewDays: days } });
    setStatus(`Saved: new decisions get a review date ${days} days after you log them.`);
  }

  return (
    <section
      id="settings-notifications"
      className="card settings-section"
      aria-labelledby="settings-notifications-title"
    >
      <div className="card-section">
        <h2 id="settings-notifications-title" className="section-title">
          Notifications
        </h2>
      </div>
      <div className="card-section stack">
        <fieldset className="settings-fieldset">
          <legend className="settings-legend">Where nudges arrive</legend>
          <p className="hint muted">
            When a decision reaches its review date, Rooted asks what happened. In this prototype nudges are mocked:
            nothing is sent yet.
          </p>
          <div className="row">
            {(
              [
                ['slack', 'Slack'],
                ['email', 'Email'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="settings-choice">
                <input
                  type="radio"
                  name="settings-channel"
                  value={value}
                  checked={user.notificationChannel === value}
                  onChange={() => setChannel(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="settings-fieldset">
          <legend className="settings-legend">Default review date</legend>
          <p className="hint muted">
            How long after you log a decision Rooted sets its review date. Applies to new decisions; ones you’ve already
            logged keep their date.
          </p>
          <div className="row">
            {([30, 60, 90] as const).map((days) => (
              <label key={days} className="settings-choice">
                <input
                  type="radio"
                  name="settings-review-days"
                  value={days}
                  checked={user.defaultReviewDays === days}
                  onChange={() => setDays(days)}
                />
                <span className="tabular">{days} days</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p role="status" className="settings-status">
          {status}
        </p>
      </div>
    </section>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SourcesSection({ sources }: { sources: Source[] }) {
  const { dispatch } = useStore();
  const [confirming, setConfirming] = useState<Source | null>(null);
  const [status, setStatus] = useState('');

  function disconnect() {
    if (!confirming) return;
    dispatch({ type: 'updateSource', sourceId: confirming.id, patch: { connected: false, connectedAt: undefined } });
    setStatus(`${confirming.name} is disconnected. Context Rooted gathered from it was removed, and it won’t be read again unless you reconnect.`);
    setConfirming(null);
  }

  return (
    <section id="settings-sources" className="card settings-section" aria-labelledby="settings-sources-title">
      <div className="card-section stack">
        <h2 id="settings-sources-title" className="section-title">
          Sources
        </h2>
        <p className="muted">
          Rooted only reads the channels and folders you allow. It never reads private channels or DMs. In this
          prototype, connections use sample data.
        </p>
      </div>
      <ul className="settings-source-list">
        {sources.map((s) => {
          const unit = s.type === 'slack' ? 'channels' : 'folders';
          const allowed = s.channels.filter((c) => c.allowed).length;
          return (
            <li key={s.id} className="card-section settings-source">
              <div className="stack settings-source-info">
                <h3 className="settings-source-name">{s.name}</h3>
                <p className="row settings-source-meta">
                  <span className={s.connected ? 'dot dot-alive' : 'dot settings-dot-off'} aria-hidden="true" />
                  <span>
                    {s.connected
                      ? `Connected${s.connectedAt ? ` ${formatDate(s.connectedAt)}` : ''}`
                      : 'Not connected'}
                  </span>
                  <span className="muted tabular">
                    {allowed} of {s.channels.length} {unit} allowed
                  </span>
                </p>
              </div>
              <div className="row">
                <Link to="/onboarding" className="btn btn-secondary">
                  {s.connected ? `Manage ${unit}` : 'Connect'}
                  <span className="visually-hidden"> for {s.name}</span>
                </Link>
                {s.connected && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setConfirming(s)}
                    aria-label={`Disconnect ${s.name}`}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="card-section">
        <p role="status" className="settings-status">
          {status}
        </p>
      </div>
      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={`Disconnect ${confirming?.name ?? 'source'}?`}
      >
        <p>
          Rooted will stop reading {confirming?.name}. Evidence already in your decision records stays there, so you can
          still trace past calls. You can reconnect from onboarding.
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={disconnect}>
            Disconnect
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(null)}>
            Cancel
          </button>
        </div>
      </Dialog>
    </section>
  );
}

function DataSection() {
  const { dispatch } = useStore();
  const [dialog, setDialog] = useState<'delete' | 'reset' | null>(null);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState('');

  function close() {
    setDialog(null);
    setTyped('');
  }

  function deleteAll(e: React.FormEvent) {
    e.preventDefault();
    if (typed !== 'DELETE') return;
    dispatch({ type: 'deleteAllData' });
    setStatus('All your data was deleted: decisions, evidence, options and reports. Every source is disconnected.');
    close();
  }

  function reset() {
    dispatch({ type: 'resetDemo' });
    setStatus('Sample data restored. Your profile and settings are unchanged.');
    close();
  }

  return (
    <section id="settings-data" className="card settings-section" aria-labelledby="settings-data-title">
      <div className="card-section">
        <h2 id="settings-data-title" className="section-title">
          Your data
        </h2>
      </div>
      <div className="card-section settings-data-row">
        <div className="stack settings-data-text">
          <h3 className="settings-source-name">Delete all data</h3>
          <p className="muted">
            Permanently removes every decision, its evidence, options, pruned branches and your reports, and disconnects
            every source. Your account stays.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setDialog('delete')}>
          Delete all data
        </button>
      </div>
      <div className="card-section settings-data-row">
        <div className="stack settings-data-text">
          <h3 className="settings-source-name">Reset sample data</h3>
          <p className="muted">Puts back the prototype’s sample decisions and sources. Your profile stays as it is.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setDialog('reset')}>
          Reset sample data
        </button>
      </div>
      <div className="card-section">
        <p role="status" className="settings-status">
          {status}
        </p>
      </div>
      <Dialog open={dialog === 'delete'} onClose={close} title="Delete all your data?">
        <form className="stack" onSubmit={deleteAll}>
          <p>This can’t be undone. Every decision record, rejected option and reason, and report goes away.</p>
          <div className="field">
            <label htmlFor="settings-delete-confirm">Type DELETE to confirm</label>
            <input
              id="settings-delete-confirm"
              className="input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="row">
            <button type="submit" className="btn" disabled={typed !== 'DELETE'}>
              Delete everything
            </button>
            <button type="button" className="btn btn-secondary" onClick={close}>
              Cancel
            </button>
          </div>
        </form>
      </Dialog>
      <Dialog open={dialog === 'reset'} onClose={close} title="Reset sample data?">
        <p>This replaces your current decisions, evidence and sources with the prototype’s sample data.</p>
        <div className="row">
          <button type="button" className="btn" onClick={reset}>
            Reset sample data
          </button>
          <button type="button" className="btn btn-secondary" onClick={close}>
            Cancel
          </button>
        </div>
      </Dialog>
    </section>
  );
}
