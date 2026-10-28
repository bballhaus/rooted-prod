// F-02, F-03: choose what Rooted can see. Used for onboarding and reused as
// the source-management page from Settings. Connecting a source is mocked.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '../../components/Dialog';
import { useStore } from '../../store/store';
import type { Provider, Source } from '../../types';
import { GlyphFolder, GlyphHash } from './icons';
import './auth.css';

const providerLabel: Record<Provider, string> = { google: 'Google', slack: 'Slack' };

function sourceNouns(source: Source) {
  return source.type === 'slack'
    ? { label: 'Slack', one: 'channel', many: 'channels', group: 'Channels' }
    : { label: 'Drive', one: 'folder', many: 'folders', group: 'Folders' };
}

const connectRequests: Record<Source['type'], string[]> = {
  slack: [
    'Read messages in the public channels you check',
    'See channel names and member counts',
    'Never private channels or direct messages',
  ],
  'google-drive': [
    'Read documents in the folders you check',
    'See folder names',
    'Never edit, share or delete anything',
  ],
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function summaryText(source: Source) {
  const n = sourceNouns(source);
  if (!source.connected) return `${source.name} is not connected. Rooted reads nothing from it.`;
  const allowed = source.channels.filter((c) => c.allowed).length;
  const total = source.channels.length;
  return `Rooted can read ${allowed} of ${total} ${n.label} ${total === 1 ? n.one : n.many}.`;
}

function SourceCard({ source, onConnect }: { source: Source; onConnect: () => void }) {
  const { dispatch } = useStore();
  const n = sourceNouns(source);
  const headingId = `source-${source.id}-title`;
  const noteId = `source-${source.id}-note`;
  const setAll = (allowed: boolean) =>
    source.channels.forEach((c) =>
      dispatch({ type: 'setChannelAllowed', sourceId: source.id, channelId: c.id, allowed }),
    );

  return (
    <section className="card auth-source" aria-labelledby={headingId}>
      <div className="card-section auth-source-head">
        <span className="auth-source-icon">{source.type === 'slack' ? <GlyphHash /> : <GlyphFolder />}</span>
        <div className="auth-source-title">
          <h2 id={headingId} className="section-title">
            {source.name}
          </h2>
          <p className="muted auth-small">
            {source.connected ? (
              <>
                <span className="dot dot-alive" aria-hidden="true" /> Connected
                {source.connectedAt && <> on {formatDate(source.connectedAt)}</>}
              </>
            ) : (
              <>
                <span className="dot auth-dot-off" aria-hidden="true" /> Not connected
              </>
            )}
          </p>
        </div>
        {source.connected ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => dispatch({ type: 'updateSource', sourceId: source.id, patch: { connected: false } })}
          >
            Disconnect<span className="visually-hidden"> {source.name}</span>
          </button>
        ) : (
          <button type="button" className="btn" onClick={onConnect}>
            Connect<span className="visually-hidden"> {source.name}</span>
          </button>
        )}
      </div>

      <div className="card-section stack">
        <fieldset className="auth-fieldset" disabled={!source.connected} aria-describedby={noteId}>
          <legend className="auth-legend">
            {n.group} Rooted can read
          </legend>
          <p id={noteId} className="muted auth-small">
            {source.connected
              ? `Rooted only reads the ${n.many} you check.${
                  source.type === 'slack' ? ' Private channels and direct messages are never read.' : ''
                }`
              : `Connect ${source.name} to choose ${n.many}.`}
          </p>
          <ul className="auth-channels">
            {source.channels.map((c) => (
              <li key={c.id}>
                <label className="checkbox auth-channel">
                  <input
                    type="checkbox"
                    checked={c.allowed}
                    onChange={(e) =>
                      dispatch({
                        type: 'setChannelAllowed',
                        sourceId: source.id,
                        channelId: c.id,
                        allowed: e.target.checked,
                      })
                    }
                  />
                  <span className="auth-channel-name">{c.name}</span>
                  {c.memberCount > 0 && (
                    <span className="muted auth-small tabular">
                      {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="btn btn-secondary" onClick={() => setAll(true)}>
              Allow all<span className="visually-hidden"> {n.label} {n.many}</span>
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setAll(false)}>
              Allow none<span className="visually-hidden"> {n.label} {n.many}</span>
            </button>
          </div>
        </fieldset>
        <p role="status" className="auth-summary">
          {summaryText(source)}
        </p>
      </div>
    </section>
  );
}

export function DataAccessPage() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState<Source | null>(null);
  const user = state.user;

  const confirmConnect = () => {
    if (!connecting) return;
    dispatch({
      type: 'updateSource',
      sourceId: connecting.id,
      patch: { connected: true, connectedAt: new Date().toISOString() },
    });
    setConnecting(null);
  };

  return (
    <div className="page">
      <div className="stack">
        {user && (
          <p className="pill auth-whoami">
            Signed in as {user.role}, {user.team}
            <span className="visually-hidden">
              {' '}
              ({user.name}, {user.email}, via {providerLabel[user.signInProvider]})
            </span>
          </p>
        )}
        <h1 className="page-title">Choose what Rooted can see</h1>
        <p className="lead">
          Rooted gathers context for your decisions only from the sources and channels you check here. You can
          change this any time in Settings.
        </p>
      </div>

      <div className="grid-2 auth-sources">
        {state.sources.map((s) => (
          <SourceCard key={s.id} source={s} onConnect={() => setConnecting(s)} />
        ))}
      </div>

      <div className="row">
        <button type="button" className="btn btn-lg" onClick={() => navigate('/')}>
          Continue to Rooted
        </button>
      </div>

      <Dialog
        open={connecting !== null}
        onClose={() => setConnecting(null)}
        title={connecting ? `Connect ${connecting.name}` : 'Connect a source'}
      >
        {connecting && (
          <>
            <p className="banner auth-mock-note">
              <strong>Prototype: no real connection happens.</strong> This screen stands in for the{' '}
              {connecting.type === 'slack' ? 'Slack' : 'Google'} permission page, and Rooted uses sample data.
            </p>
            <p>Rooted would ask to:</p>
            <ul className="auth-list">
              {connectRequests[connecting.type].map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="row">
              <button type="button" className="btn" onClick={confirmConnect}>
                Allow
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConnecting(null)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
