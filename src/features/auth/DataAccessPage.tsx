// F-02, F-03: choose what Rooted can see. Used for onboarding and reused as
// the source-management page from Settings. Slack connects for real (0017);
// the demo's sample sources stand in for connections, labelled as samples.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AI_ERROR_MESSAGE } from '../../agent/client';
import { Dialog } from '../../components/Dialog';
import { useStore } from '../../store/store';
import type { Provider, Source } from '../../types';
import { GlyphFolder, GlyphHash } from './icons';
import { SLACK_RETURN_MESSAGE, useLiveSlack } from './useSlack';
import './auth.css';

const providerLabel: Record<Provider, string> = { google: 'Google', slack: 'Slack', email: 'email link' };

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
  if (source.unavailable) return `Rooted can’t read ${source.name} yet.`;
  if (!source.connected) return `${source.name} is not connected. Rooted reads nothing from it.`;
  if (source.channels.length === 0) return `Rooted found no public ${n.many} to read yet.`;
  const allowed = source.channels.filter((c) => c.allowed).length;
  const total = source.channels.length;
  return `Rooted can read ${allowed} of ${total} ${n.label} ${total === 1 ? n.one : n.many}.`;
}

function SourceCard({
  source,
  onConnect,
  onDisconnect,
  busy = false,
}: {
  source: Source;
  onConnect: () => void;
  onDisconnect: () => void;
  busy?: boolean;
}) {
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
            {source.unavailable ? (
              <>
                <span className="dot auth-dot-off" aria-hidden="true" /> Not available yet
              </>
            ) : source.connected ? (
              <>
                <span className="dot dot-alive" aria-hidden="true" /> Connected
                {source.connectedAt && <> on {formatDate(source.connectedAt)}</>}
                {source.sample && <> · sample data</>}
              </>
            ) : (
              <>
                <span className="dot auth-dot-off" aria-hidden="true" /> Not connected
              </>
            )}
          </p>
        </div>
        {source.unavailable ? null : source.connected ? (
          <button type="button" className="btn btn-ghost" onClick={onDisconnect} disabled={busy}>
            Disconnect<span className="visually-hidden"> {source.name}</span>
          </button>
        ) : (
          <button type="button" className="btn" onClick={onConnect} disabled={busy} aria-busy={busy}>
            {busy ? 'Opening Slack…' : 'Connect'}
            <span className="visually-hidden"> {source.name}</span>
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
  const location = useLocation();
  const slack = useLiveSlack();
  const [connecting, setConnecting] = useState<Source | null>(null);
  const user = state.user;
  // What Slack's permission page sent back. Read once, then cleared from the
  // address so a refresh doesn't repeat it.
  const [returned, setReturned] = useState(() => new URLSearchParams(location.search).get('slack'));
  const returnMessage = returned ? SLACK_RETURN_MESSAGE[returned] : undefined;
  const finishing = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('slack_code');
    const state = params.get('slack_state');
    if (!params.has('slack') && !code) return;
    navigate('/onboarding', { replace: true });
    if (code && state && !finishing.current) {
      finishing.current = true;
      void slack.complete(code, state).then((ok) => ok && setReturned('connected'));
    }
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A live Slack goes through Slack's own permission page; a sample source (the demo) is switched on here.
  function connect(source: Source) {
    if (source.id === slack.source?.id) void slack.connect();
    else setConnecting(source);
  }
  function disconnect(source: Source) {
    if (source.id === slack.source?.id) void slack.disconnect();
    else dispatch({ type: 'updateSource', sourceId: source.id, patch: { connected: false } });
  }

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
      <ol className="auth-steps" aria-label="Setup">
        <li className="auth-step-done">
          <span className="auth-step-n" aria-hidden="true">
            ✓
          </span>
          Sign in
        </li>
        <li className="auth-step-now" aria-current="step">
          <span className="auth-step-n" aria-hidden="true">
            2
          </span>
          Choose sources
        </li>
        <li>
          <span className="auth-step-n" aria-hidden="true">
            3
          </span>
          Your decisions
        </li>
      </ol>
      <div className="stack">
        {user && (
          <p className="pill auth-whoami">
            Signed in as {[user.role, user.team].filter(Boolean).join(', ') || user.email}
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

      {returnMessage && (
        <p role={returned === 'connected' ? 'status' : 'alert'} className="banner">
          {returnMessage}
        </p>
      )}
      {slack.revoked && (
        <p role="alert" className="banner">
          {AI_ERROR_MESSAGE.slack_token_revoked}
        </p>
      )}
      {slack.error && (
        <p role="alert" className="error">
          {AI_ERROR_MESSAGE[slack.error]}
        </p>
      )}

      <div className="grid-2 auth-sources">
        {state.sources.map((s) => (
          <SourceCard
            key={s.id}
            source={s}
            onConnect={() => connect(s)}
            onDisconnect={() => disconnect(s)}
            busy={s.id === slack.source?.id && slack.busy}
          />
        ))}
      </div>

      <div className="row">
        <button type="button" className="btn btn-lg" onClick={() => navigate('/')}>
          Continue to Rooted
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-lg"
          onClick={() => {
            dispatch({ type: 'loadDemo' });
            navigate('/');
          }}
        >
          Explore the demo instead
        </button>
      </div>
      <p className="muted auth-small">
        Not sure yet? Load a worked example, six months of connected decisions on sample data, and connect your own
        sources any time.
      </p>

      <Dialog
        open={connecting !== null}
        onClose={() => setConnecting(null)}
        title={connecting ? `Connect ${connecting.name}` : 'Connect a source'}
      >
        {connecting && (
          <>
            <p className="banner auth-mock-note">
              <strong>Demo workspace: sample data.</strong> This switches on the demo’s sample{' '}
              {connecting.type === 'slack' ? 'Slack channels' : 'Drive folders'}. Nothing is connected for real.
            </p>
            <p>A real connection asks to:</p>
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
