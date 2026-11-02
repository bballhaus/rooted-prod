// F-01, F-21: sign in with Google or Slack. Both flows are mocked in the
// prototype: the consent dialog says so, and Allow signs in as the demo PM.
// F-20: request beta access with a work email (mocked; nothing is stored or sent).
import { useId, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Dialog } from '../../components/Dialog';
import { demoUser } from '../../data/fixtures';
import { useStore } from '../../store/store';
import type { Provider } from '../../types';
import { GlyphG, GlyphHash, SproutMark } from './icons';
import './auth.css';

const providerCopy: Record<Provider, { label: string; requests: string[] }> = {
  google: {
    label: 'Google',
    requests: [
      'Your name and email address',
      'Your profile picture',
      'Nothing from Gmail, Calendar or Drive. You choose Drive folders later, one by one.',
    ],
  },
  slack: {
    label: 'Slack',
    requests: [
      'Your name, email address and workspace',
      'A list of public channels, so you can choose which ones Rooted reads',
      'Never private channels or direct messages',
    ],
  },
};

export function SignInPage() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [tab, setTab] = useState<'signin' | 'request'>('signin');

  if (state.user) return <Navigate to="/" replace />;

  const allow = () => {
    if (!provider) return;
    dispatch({ type: 'signIn', provider });
    setProvider(null);
    navigate('/onboarding');
  };

  const copy = provider ? providerCopy[provider] : null;

  return (
    <div className="auth-split">
      <aside className="auth-brand" aria-label="About Rooted">
        <span className="auth-wordmark">
          <SproutMark />
          Rooted
        </span>
        <div className="auth-brand-body">
          <p className="auth-brand-kicker">Decision partner for startup PMs</p>
          <h1 className="auth-brand-title">Every call leaves a record.</h1>
          <p className="auth-brand-lead">
            Rooted gathers context from where your team already works, helps you weigh the options and keeps a history
            of what you decided and why. You make the call.
          </p>
          <BrandTree />
        </div>
        <ul className="auth-points">
          <li>
            <span className="auth-point-dot auth-point-sage" aria-hidden="true" />
            Reads only the Slack channels you choose
          </li>
          <li>
            <span className="auth-point-dot auth-point-ochre" aria-hidden="true" />
            Lays out the options as a tree; you prune and choose
          </li>
          <li>
            <span className="auth-point-dot auth-point-cream" aria-hidden="true" />
            Remembers why, and asks later what happened
          </li>
        </ul>
      </aside>

      <main id="main" className="auth-panel">
        <div className="auth-panel-inner">
          <span className="pill auth-proto">Prototype · sample data</span>
          <div className="auth-tabs" role="tablist" aria-label="Sign in or request access">
            <button
              type="button"
              role="tab"
              id="auth-tab-signin"
              aria-selected={tab === 'signin'}
              aria-controls="auth-panel-signin"
              onClick={() => setTab('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              id="auth-tab-request"
              aria-selected={tab === 'request'}
              aria-controls="auth-panel-request"
              onClick={() => setTab('request')}
            >
              Request access
            </button>
          </div>

          {tab === 'signin' ? (
            <section id="auth-panel-signin" role="tabpanel" aria-labelledby="signin-title" className="stack">
              <div className="stack auth-tight">
                <h2 id="signin-title" className="auth-title">
                  Sign in
                </h2>
                <p className="muted">Welcome back. Use the account your team already works in.</p>
              </div>
              <div className="auth-providers">
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => setProvider('google')}>
                  <GlyphG />
                  Continue with Google
                </button>
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => setProvider('slack')}>
                  <GlyphHash />
                  Continue with Slack
                </button>
              </div>
              <p className="muted auth-small">
                New to Rooted?{' '}
                <button type="button" className="auth-link" onClick={() => setTab('request')}>
                  Request beta access
                </button>
              </p>
            </section>
          ) : (
            <RequestAccess onSignIn={() => setTab('signin')} />
          )}

          <p className="muted auth-small auth-fineprint">
            This is a prototype with sample data. No real sign-in happens, and nothing leaves your browser.
          </p>
        </div>
      </main>

      <Dialog
        open={provider !== null}
        onClose={() => setProvider(null)}
        title={copy ? `Sign in with ${copy.label}` : 'Sign in'}
      >
        {copy && (
          <>
            <p className="banner auth-mock-note">
              <strong>Prototype: no real sign-in happens.</strong> This screen stands in for the{' '}
              {copy.label} consent page.
            </p>
            <p>
              Rooted would sign you in as{' '}
              <strong>
                {demoUser.name} ({demoUser.email})
              </strong>{' '}
              and request:
            </p>
            <ul className="auth-list">
              {copy.requests.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="row">
              <button type="button" className="btn" onClick={allow}>
                Allow
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setProvider(null)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}

// A small decision tree in brand colors: one chosen branch (cream), pruned
// branches (dashed rose) and living ones (sage). Decorative.
function BrandTree() {
  return (
    <svg className="auth-tree" viewBox="0 0 360 200" aria-hidden="true" focusable="false">
      <g fill="none" strokeLinecap="round" strokeWidth="2.2">
        <path d="M20 170 C 80 170, 90 110, 150 110" stroke="var(--brand-line)" />
        <path d="M150 110 C 200 110, 210 50, 270 50" stroke="var(--brand-chosen)" strokeWidth="3" />
        <path d="M150 110 C 205 110, 215 110, 270 110" stroke="var(--brand-pruned)" strokeDasharray="5 6" />
        <path d="M150 110 C 200 110, 210 170, 270 170" stroke="var(--brand-alive)" />
        <path d="M270 50 C 300 50, 305 30, 335 30" stroke="var(--brand-chosen)" strokeWidth="3" />
        <path d="M270 50 C 300 50, 305 72, 335 72" stroke="var(--brand-pruned)" strokeDasharray="5 6" />
      </g>
      <circle cx="20" cy="170" r="7" fill="var(--brand-line)" />
      <circle cx="150" cy="110" r="8" fill="var(--brand-line)" />
      <circle cx="270" cy="50" r="9" fill="var(--brand-chosen)" />
      <circle cx="270" cy="50" r="14" fill="none" stroke="var(--brand-chosen)" strokeOpacity="0.4" strokeWidth="2" />
      <circle cx="270" cy="110" r="6" fill="none" stroke="var(--brand-pruned)" strokeWidth="2" />
      <circle cx="270" cy="170" r="7" fill="var(--brand-alive)" />
      <circle cx="335" cy="30" r="7" fill="var(--brand-chosen)" />
      <circle cx="335" cy="72" r="5" fill="none" stroke="var(--brand-pruned)" strokeWidth="2" />
    </svg>
  );
}

// F-20: beta request. A prototype stand-in: it checks the address and says
// thanks, and nothing is stored or sent anywhere.
function RequestAccess({ onSignIn }: { onSignIn: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const id = useId();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter your work email, like jordan@yourcompany.com.');
      return;
    }
    setError('');
    setDone(true);
  }

  return (
    <section id="auth-panel-request" role="tabpanel" aria-labelledby="request-title" className="stack">
      <div className="stack auth-tight">
        <h2 id="request-title" className="auth-title">
          Request beta access
        </h2>
        <p className="muted">Rooted is in a small beta with product teams at early-stage startups.</p>
      </div>
      {done ? (
        <div className="banner stack auth-tight" role="status">
          <p>
            <strong>Thanks, you’re on the list.</strong> In the real product we’d email you when a spot opens. This
            prototype didn’t store or send your address.
          </p>
          <p>
            <button type="button" className="auth-link" onClick={onSignIn}>
              Back to sign in
            </button>
          </p>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor={id}>Work email</label>
            <input
              id={id}
              type="email"
              className="input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            {error && (
              <p id={`${id}-error`} role="alert" className="error">
                {error}
              </p>
            )}
          </div>
          <button type="submit" className="btn btn-lg">
            Request access
          </button>
        </form>
      )}
    </section>
  );
}
