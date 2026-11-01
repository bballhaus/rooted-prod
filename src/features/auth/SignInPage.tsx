// F-01, F-20, F-21: sign in with Google or Slack, or request beta access. Every
// flow is mocked in the prototype: the consent dialog says so, Allow signs in as
// the demo PM, and the beta request sends nothing.
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

const PROOF = [
  { stat: 'Every call', label: 'kept with its reasoning and the options you pruned' },
  { stat: 'One map', label: 'from the evidence to the decision to what happened next' },
  { stat: 'Your data only', label: 'gathered from the channels and folders you choose' },
];

export function SignInPage() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [betaOpen, setBetaOpen] = useState(false);
  const [betaEmail, setBetaEmail] = useState('');
  const [betaSent, setBetaSent] = useState(false);

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
      <div className="auth-split">
        <section className="auth-brand" aria-label="About Rooted">
          <div className="auth-brand-inner">
            <span className="auth-wordmark auth-wordmark-light">
              <SproutMark />
              Rooted
            </span>
            <div className="stack auth-brand-copy">
              <p className="kicker auth-kicker-light">Decision partner for product teams</p>
              <h1 className="auth-brand-head">
                Every product decision,
                <br />
                traced to its root.
              </h1>
              <p className="auth-brand-lead">
                Rooted gathers the context from where your team already works, maps the options, and keeps a living
                record of what you decided and why. You make the call.
              </p>
            </div>
            <ul className="auth-proof">
              {PROOF.map((p) => (
                <li key={p.stat}>
                  <span className="auth-proof-dot" aria-hidden="true" />
                  <span>
                    <strong>{p.stat}</strong> — {p.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <main id="main" className="auth-pane">
          <div className="auth-pane-inner">
            <span className="pill auth-badge">Prototype</span>
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
              <div className="card-section stack">
                {betaSent ? (
                  <p className="auth-beta-ok" role="status">
                    <span className="dot dot-alive" aria-hidden="true" /> Thanks — you're on the list. (Prototype:
                    nothing was sent.)
                  </p>
                ) : betaOpen ? (
                  <form
                    className="stack auth-beta-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!betaEmail.trim()) return;
                      setBetaSent(true);
                      setBetaOpen(false);
                    }}
                  >
                    <div className="field">
                      <label htmlFor="beta-email">Work email</label>
                      <input
                        id="beta-email"
                        type="email"
                        className="input"
                        placeholder="you@company.com"
                        value={betaEmail}
                        onChange={(e) => setBetaEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="row">
                      <button type="submit" className="btn">
                        Request access
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setBetaOpen(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="muted auth-small">
                    New to Rooted?{' '}
                    <button type="button" className="auth-linkbtn" onClick={() => setBetaOpen(true)}>
                      Request beta access
                    </button>
                    .
                  </p>
                )}
              </div>
              <div className="card-section">
                <p className="muted auth-small">
                  This is a prototype with sample data. No real sign-in happens, and nothing leaves your browser.
                </p>
              </div>
            </section>
          </div>
        </main>
      </div>

      <Dialog
        open={provider !== null}
        onClose={() => setProvider(null)}
        title={copy ? `Sign in with ${copy.label}` : 'Sign in'}
      >
        {copy && (
          <>
            <p className="banner auth-mock-note">
              <strong>Prototype: no real sign-in happens.</strong> This screen stands in for the {copy.label} consent
              page.
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
