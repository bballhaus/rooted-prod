// The decision workspace: one page to think a decision through, with Rooted
// docked beside it. Frame → Evidence → Options build up as sections; logging
// happens from the options. The old step URLs redirect here.
import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Stepper } from '../../components/Stepper';
import { ownerOf } from '../../store/dashboard';
import { useDecision, useStore } from '../../store/store';
import type { Decision } from '../../types';
import { useAgent } from '../agent/AgentContext';
import { BriefSection } from '../brief/BriefPage';
import { FrameForm } from '../frame/FramePage';
import { formatDate } from '../log/format';
import { OptionsSection } from '../options/OptionsPage';
import './workspace.css';

export function WorkspacePage() {
  const { id } = useParams();
  const decision = useDecision(id);
  if (!decision) {
    return (
      <div className="page">
        <h1 className="page-title">Decision not found</h1>
        <p className="lead">There’s no decision with that link. It may have been deleted with your data.</p>
        <div className="row">
          <Link to="/" className="btn btn-secondary">
            Back to your decisions
          </Link>
          <Link to="/decisions/new" className="btn btn-ghost">
            Start a new decision
          </Link>
        </div>
      </div>
    );
  }
  return <Workspace key={decision.id} decision={decision} />;
}

function Workspace({ decision }: { decision: Decision }) {
  const { state } = useStore();
  const { openAgent } = useAgent();
  const location = useLocation();
  const navigate = useNavigate();
  // A logged decision's framing is part of its record and stays read-only.
  const editing = decision.status === 'framing' || (location.hash === '#frame' && decision.status !== 'decided');
  const owner = ownerOf(decision, state);
  const consulted = (decision.stakeholderIds ?? [])
    .map((sid) => state.teammates.find((t) => t.id === sid)?.name)
    .filter(Boolean);
  const opened = useRef(false);

  // Thinking a decision through happens with Rooted beside you, on screens wide enough for both.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 881px)').matches) {
      // Opened beside the page without taking focus, so keyboard users stay at the heading.
      openAgent({ decisionId: decision.id }, { focus: false });
    }
  }, [decision.id, openAgent]);

  const showEvidence = decision.status !== 'framing';
  // A link straight to the options (the old /options URL) opens them even before the brief is confirmed.
  const showOptions =
    decision.status === 'options' || decision.status === 'decided' || location.hash === '#options';

  return (
    <div className="page workspace">
      <Stepper decision={decision} current={decision.status} />
      <header className="stack workspace-head">
        <p className="kicker">{decision.status === 'decided' ? 'Logged decision' : 'Decision in progress'}</p>
        <h1 className="page-title workspace-title">{decision.question || 'Untitled decision'}</h1>
        <p className="row muted workspace-meta">
          <span>
            {owner?.id === state.user?.id ? 'Your call' : `${owner?.name ?? 'Unknown'}’s call`}
            {consulted.length > 0 && ` · consulting ${consulted.join(', ')}`}
          </span>
          {decision.deadline && <span className="tabular">Deadline {formatDate(decision.deadline)}</span>}
        </p>
        {(decision.tags ?? []).length > 0 && (
          <ul className="row workspace-tags" aria-label="Tags">
            {(decision.tags ?? []).map((t) => (
              <li key={t.label} className={t.origin === 'ai' ? 'tag tag-ai' : 'tag'}>
                {t.origin === 'ai' && <span aria-hidden="true">✦ </span>}#{t.label}
              </li>
            ))}
          </ul>
        )}
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={() => openAgent({ decisionId: decision.id })}>
            <span className="ai-mark" aria-hidden="true">
              ✦
            </span>{' '}
            Think it through with Rooted
          </button>
        </div>
      </header>

      <section id="frame" className="workspace-section" aria-label="Frame">
        {editing ? (
          <FrameForm
            existing={decision}
            embedded
            onDone={() => navigate(`/decisions/${decision.id}/work${decision.status === 'framing' ? '#evidence' : ''}`, { replace: true })}
          />
        ) : (
          <FrameSummary decision={decision} onEdit={() => navigate('#frame', { replace: true })} />
        )}
      </section>

      {showEvidence && (
        <section id="evidence" className="workspace-section" aria-label="Evidence">
          <BriefSection decision={decision} />
        </section>
      )}

      {showOptions && (
        <section id="options" className="workspace-section" aria-label="Options">
          <OptionsSection decision={decision} />
        </section>
      )}
    </div>
  );
}

function FrameSummary({ decision, onEdit }: { decision: Decision; onEdit: () => void }) {
  const hasContext = decision.notes || decision.links.length > 0 || decision.constraints.length > 0;
  return (
    <div className="card">
      <div className="card-section stack workspace-frame">
        <div className="row workspace-frame-head">
          <h2 className="section-title">The decision</h2>
          {decision.status !== 'decided' && (
            <button type="button" className="btn btn-ghost" onClick={onEdit}>
              Edit the framing
            </button>
          )}
        </div>
        {hasContext ? (
          <>
            {decision.notes && <p className="workspace-notes">{decision.notes}</p>}
            {decision.constraints.length > 0 && (
              <ul className="row workspace-constraints" aria-label="Constraints">
                {decision.constraints.map((c) => (
                  <li key={c} className="chip">
                    {c}
                  </li>
                ))}
              </ul>
            )}
            {decision.links.length > 0 && (
              <ul className="workspace-links" aria-label="Links">
                {decision.links.map((l) => (
                  <li key={l}>
                    <a href={l} target="_blank" rel="noreferrer">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="muted">No notes, links or constraints added.</p>
        )}
        <p className="muted tabular workspace-dates">
          {decision.reviewDate ? `Outcome review ${formatDate(decision.reviewDate)}` : 'No review date set'}
        </p>
      </div>
    </div>
  );
}
