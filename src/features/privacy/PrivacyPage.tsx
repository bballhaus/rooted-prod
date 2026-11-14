// Privacy and your data: what Rooted reads, what it sends to Claude, where
// everything lives, and what the PM controls. Public, so it can be read
// before signing in. It describes what this version actually does (0015–0018);
// keep it in step with the code.
import { Link } from 'react-router-dom';
import { useStore } from '../../store/store';
import './privacy.css';

const SECTIONS = [
  { id: 'privacy-reads', label: 'What Rooted reads' },
  { id: 'privacy-claude', label: 'What goes to Claude' },
  { id: 'privacy-where', label: 'Where your data lives' },
  { id: 'privacy-controls', label: 'What you control' },
] as const;

export function PrivacyPage() {
  const { state } = useStore();
  const signedIn = !!state.user;

  return (
    <div className="privacy">
      <header className="privacy-bar">
        <div className="container privacy-bar-inner">
          <Link to={signedIn ? '/' : '/signin'} className="privacy-wordmark" aria-label="Rooted home">
            Rooted
          </Link>
          <Link to={signedIn ? '/settings' : '/signin'} className="btn btn-secondary">
            {signedIn ? 'Back to settings' : 'Sign in'}
          </Link>
        </div>
      </header>

      <main id="main" className="container page privacy-page">
        <header className="stack privacy-head">
          <p className="kicker">Beta</p>
          <h1 className="page-title">Privacy and your data</h1>
          <p className="lead">
            What Rooted reads, what it sends to Claude, where it all lives, and how to turn any of it off. This page
            describes what this version of Rooted does today.
          </p>
        </header>

        <section className="card privacy-summary" aria-labelledby="privacy-summary-title">
          <div className="card-section stack">
            <h2 id="privacy-summary-title" className="privacy-h2">
              In short
            </h2>
            <ul className="privacy-list">
              <li>Rooted reads only the public Slack channels you allow, and only when you ask it to.</li>
              <li>It never reads private channels or direct messages.</li>
              <li>To answer, it sends the relevant decision and context to Claude, Anthropic’s AI model.</li>
              <li>Your decisions are kept in this browser, not on a Rooted server.</li>
              <li>You can turn off a channel, disconnect Slack or delete everything at any time.</li>
            </ul>
          </div>
        </section>

        <nav aria-label="On this page" className="privacy-nav">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <section id="privacy-reads" className="card privacy-section" aria-labelledby="privacy-reads-title">
          <div className="card-section stack">
            <h2 id="privacy-reads-title" className="privacy-h2">
              What Rooted reads
            </h2>
            <dl className="privacy-facts">
              <div>
                <dt>Slack</dt>
                <dd>
                  When you connect Slack, a Slack admin may need to approve Rooted. Rooted can then list your workspace’s
                  public channels. It reads messages only from the channels you check, and only when you gather evidence
                  for a decision or ask it to look for decisions to make. Each time it looks at the last 30 days, up to
                  400 messages, and it doesn’t keep them afterwards.
                </dd>
              </div>
              <div>
                <dt>Never read</dt>
                <dd>Private channels, direct messages and group messages. Rooted doesn’t ask Slack for access to them.</dd>
              </div>
              <div>
                <dt>Your colleagues</dt>
                <dd>
                  Messages in a channel you allow include your colleagues’ messages. Rooted doesn’t ask them or tell them
                  yet. Only allow channels your team expects to be read.
                </dd>
              </div>
              <div>
                <dt>Google Drive</dt>
                <dd>Not available yet. Rooted reads nothing from Drive.</dd>
              </div>
              <div>
                <dt>Signing in</dt>
                <dd>
                  Signing in with Google or Slack shares only your name and email address with Rooted, not your mail,
                  files or messages.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="privacy-claude" className="card privacy-section" aria-labelledby="privacy-claude-title">
          <div className="card-section stack">
            <h2 id="privacy-claude-title" className="privacy-h2">
              What goes to Claude
            </h2>
            <p className="privacy-text">
              Rooted’s suggestions, drafts and answers come from Claude, an AI model made by Anthropic. When you use one,
              Rooted sends only what that task needs:
            </p>
            <ul className="privacy-list">
              <li>The decision’s question, notes and constraints.</li>
              <li>The evidence for that decision, minus anything you removed or marked wrong.</li>
              <li>Messages from the Slack channels you allowed, when gathering evidence or looking for decisions.</li>
              <li>Short summaries of your past decisions, so it can connect them.</li>
              <li>For chat, your question and the recent conversation in that chat.</li>
            </ul>
            <p className="privacy-text muted">
              Anthropic handles that data under its API terms, including how long it keeps requests. Everything Claude
              writes is marked ✦ in Rooted, and you can edit it or report it as wrong.
            </p>
          </div>
        </section>

        <section id="privacy-where" className="card privacy-section" aria-labelledby="privacy-where-title">
          <div className="card-section stack">
            <h2 id="privacy-where-title" className="privacy-h2">
              Where your data lives
            </h2>
            <dl className="privacy-facts">
              <div>
                <dt>Your decisions</dt>
                <dd>
                  Decisions, evidence, options, outcomes and chats are saved in this browser’s storage. They don’t sync
                  to other devices, and someone else signing in on this browser starts with an empty workspace.
                </dd>
              </div>
              <div>
                <dt>Your account</dt>
                <dd>Your name, email address and how you sign in are kept by Supabase, Rooted’s sign-in service.</dd>
              </div>
              <div>
                <dt>Slack access</dt>
                <dd>
                  The key that lets Rooted read Slack is kept on Rooted’s AI service (hosted on Modal), never in your
                  browser.
                </dd>
              </div>
              <div>
                <dt>Logs</dt>
                <dd>
                  The AI service records which task ran, whether it worked and what it cost. It never records your
                  messages, decisions or email address.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="privacy-controls" className="card privacy-section" aria-labelledby="privacy-controls-title">
          <div className="card-section stack">
            <h2 id="privacy-controls-title" className="privacy-h2">
              What you control
            </h2>
            <dl className="privacy-facts">
              <div>
                <dt>Choose channels</dt>
                <dd>
                  Check or uncheck channels any time. Turning one off also removes what Rooted gathered from it,
                  including chat answers that quoted it.
                </dd>
              </div>
              <div>
                <dt>Disconnect Slack</dt>
                <dd>Rooted gives up its access to your workspace and removes the evidence it gathered from Slack.</dd>
              </div>
              <div>
                <dt>Delete all data</dt>
                <dd>
                  Removes every decision and everything attached to it from this browser, and disconnects Slack. It
                  can’t be undone.
                </dd>
              </div>
              <div>
                <dt>Delete your account</dt>
                <dd>
                  There’s no button for this yet. Ask the Rooted team (Stanford CS 177, Team 10) to remove your sign-in
                  account.
                </dd>
              </div>
            </dl>
            {signedIn && (
              <p className="row">
                <Link to="/settings#settings-sources" className="btn btn-secondary">
                  Manage sources
                </Link>
                <Link to="/settings#settings-data" className="btn btn-secondary">
                  Delete your data
                </Link>
              </p>
            )}
          </div>
        </section>

        <p className="muted privacy-fineprint">
          Rooted is a student project in beta. This page explains how this version handles data. It isn’t a legal
          privacy policy.
        </p>
      </main>
    </div>
  );
}
