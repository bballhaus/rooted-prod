// F-01, F-21: sign in with Google or Slack. Both flows are mocked in the
// prototype: the consent dialog says so, and Allow signs in as the demo PM.
import { useState } from 'react';
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

  if (state.user) return <Navigate to="/" replace />;

  const allow = () => {
    if (!provider) return;
    dispatch({ type: 'signIn', provider });
    setProvider(null);
    navigate('/onboarding');
  };

  const copy = provider ? providerCopy[provider] : null;

  return (
    <div className="auth-shell">
      <header className="auth-header">
        <div className="container auth-header-inner">
          <span className="auth-wordmark">
            <SproutMark />
            Rooted
          </span>
          <span className="pill">Prototype</span>
        </div>
      </header>
      <main id="main" className="container">
        <div className="page auth-signin">
          <div className="stack">
            <p className="kicker">Decision partner for startup PMs</p>
            <h1 className="page-title">Every call leaves a record.</h1>
            <p className="lead">
              Rooted gathers context from where your team already works, helps you weigh the options and
              keeps a history of what you decided and why. You make the call.
            </p>
          </div>

          <section className="card auth-card" aria-labelledby="signin-title">
            <div className="card-section stack">
              <h2 id="signin-title" className="section-title">
                Sign in
              </h2>
              <p className="muted auth-small">Use the account your team already works in.</p>
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
            </div>
            <div className="card-section">
              <p className="muted auth-small">
                This is a prototype with sample data. No real sign-in happens, and nothing leaves your
                browser.
              </p>
            </div>
          </section>
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
