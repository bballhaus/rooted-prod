// F-18, F-19: the panel that opens when a decision on the map is picked. It
// shows what was decided, why, what it was based on, who decided and who was
// consulted, the options not taken, the outcome, and how it connects to other
// decisions. AI tags and AI links can be accepted, dismissed or reported here.
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { CloseIcon } from '../../components/icons';
import { ReportWrongAnswer } from '../../components/ReportWrongAnswer';
import {
  decisionDate,
  linksOf,
  MAP_STATUS_LABEL,
  mapStatus,
  ownerOf,
} from '../../store/dashboard';
import { useStore } from '../../store/store';
import type { Decision, DecisionLink } from '../../types';
import { useAgent } from '../agent/AgentContext';
import { continuePath, formatDate } from '../log/format';
import { RESULT_LABEL } from '../log/outcome';
import { useInboxActions } from './useInboxActions';

export function DecisionDetail({ decision, today, onClose }: { decision: Decision; today: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { openAgent } = useAgent();
  const navigate = useNavigate();
  const status = mapStatus(decision, state, today);
  const owner = ownerOf(decision, state);
  const stakeholders = (decision.stakeholderIds ?? [])
    .map((id) => state.teammates.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => !!t);
  const chosen = state.options.find((o) => o.id === decision.chosenOptionId);
  const notTaken = state.options.filter((o) => o.decisionId === decision.id && o.state === 'pruned');
  const evidence = state.contextItems.filter((c) => c.decisionId === decision.id && !c.removed && !c.flaggedInaccurate);
  const outcome = state.outcomes.find((o) => o.decisionId === decision.id);
  const { buildsOn, ledTo } = linksOf(decision.id, state);
  const titleId = `detail-${decision.id}`;

  function setTags(tags: Decision['tags']) {
    dispatch({ type: 'updateDecision', decisionId: decision.id, patch: { tags } });
  }

  return (
    <aside className="detail card" aria-labelledby={titleId}>
      <div className="detail-head">
        <p className={status === 'outcome-due' ? 'kicker due-label' : 'kicker'}>{MAP_STATUS_LABEL[status]}</p>
        <button type="button" className="icon-btn" aria-label="Close details" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <h2 id={titleId} className="detail-title">
        {decision.question}
      </h2>

      <section className="detail-section" aria-label="People">
        <p className="row detail-people">
          <Avatar person={owner} teammates={state.teammates} />
          <span>
            <strong>{decision.status === 'decided' ? 'Decided by' : 'Owned by'}</strong> {owner?.name ?? 'Unknown'}
            {owner ? `, ${owner.role}` : ''} · {formatDate(decisionDate(decision))}
          </span>
        </p>
        {stakeholders.length > 0 && (
          <p className="muted detail-small">Consulted: {stakeholders.map((s) => s.name).join(', ')}</p>
        )}
      </section>

      {(decision.tags ?? []).length > 0 && (
        <section className="detail-section" aria-label="Tags">
          <ul className="row detail-tags">
            {(decision.tags ?? []).map((t) => (
              <li key={t.label} className={t.origin === 'ai' ? 'tag tag-ai' : 'tag'}>
                {t.origin === 'ai' && <span aria-hidden="true">✦</span>}
                {t.origin === 'ai' && <span className="visually-hidden">Suggested by Rooted: </span>}#{t.label}
                {t.origin === 'ai' && (
                  <>
                    <button
                      type="button"
                      className="tag-btn"
                      aria-label={`Keep tag ${t.label}`}
                      onClick={() =>
                        setTags((decision.tags ?? []).map((x) => (x.label === t.label ? { ...x, origin: 'user' } : x)))
                      }
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="tag-btn"
                      aria-label={`Remove tag ${t.label}`}
                      onClick={() => setTags((decision.tags ?? []).filter((x) => x.label !== t.label))}
                    >
                      ×
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {(decision.tags ?? []).some((t) => t.origin === 'ai') && (
            <div>
              <ReportWrongAnswer
                surface="tag"
                targetId={decision.id}
                decisionId={decision.id}
                excerpt={`Suggested tags: ${(decision.tags ?? [])
                  .filter((t) => t.origin === 'ai')
                  .map((t) => `#${t.label}`)
                  .join(', ')}`}
              />
            </div>
          )}
        </section>
      )}

      {chosen ? (
        <section className="detail-section" aria-label="What was decided">
          <p className="detail-chosen">
            <span className="dot dot-chosen" aria-hidden="true" /> Chose “{chosen.label}”
          </p>
          {decision.summary && <p className="detail-small">{decision.summary}</p>}
          {decision.rationale && (
            <>
              <h3 className="detail-sub">Why</h3>
              <p className="detail-small">{decision.rationale}</p>
            </>
          )}
        </section>
      ) : (
        <section className="detail-section">
          <p className="muted detail-small">Not decided yet.{decision.deadline ? ` Deadline ${formatDate(decision.deadline)}.` : ''}</p>
        </section>
      )}

      <section className="detail-section" aria-label="Based on">
        <h3 className="detail-sub">Based on</h3>
        {decision.notes && <p className="detail-small">{decision.notes}</p>}
        {evidence.slice(0, 3).map((c) => (
          <blockquote key={c.id} className="detail-quote">
            “{c.snippet}” <span className="muted">— {c.author ? `${c.author}, ` : ''}{c.sourceLabel}</span>
          </blockquote>
        ))}
        {evidence.length > 3 && <p className="muted detail-small">+{evidence.length - 3} more context items</p>}
        {buildsOn.length > 0 && (
          <LinkList title="Builds on" links={buildsOn} side="from" />
        )}
        {!decision.notes && evidence.length === 0 && buildsOn.length === 0 && (
          <p className="muted detail-small">No context recorded.</p>
        )}
      </section>

      {notTaken.length > 0 && (
        <section className="detail-section" aria-label="Options not taken">
          <h3 className="detail-sub">Options not taken</h3>
          <ul className="detail-list">
            {notTaken.map((o) => (
              <li key={o.id}>
                <span className="pruned-label">{o.label}</span>
                <span className="detail-small"> — {o.pruneReason ?? 'no reason recorded'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {decision.status === 'decided' && (
        <section className="detail-section" aria-label="Outcome">
          <h3 className="detail-sub">Outcome</h3>
          {outcome ? (
            <p className="detail-small">
              <strong>{RESULT_LABEL[outcome.result]}.</strong> {outcome.summary}
              {outcome.metrics && <span className="muted"> ({outcome.metrics})</span>}
            </p>
          ) : status === 'outcome-due' ? (
            <p className="row detail-small">
              <span className="due-label">Review date {formatDate(decision.reviewDate)} has passed.</span>
              <Link to={`/decisions/${decision.id}#outcome`} className="btn btn-secondary">
                Log outcome
              </Link>
            </p>
          ) : (
            <p className="muted detail-small">Review on {formatDate(decision.reviewDate)}.</p>
          )}
        </section>
      )}

      {ledTo.length > 0 && (
        <section className="detail-section">
          <LinkList title="Led to" links={ledTo} side="to" />
        </section>
      )}

      <div className="detail-actions">
        <Link to={continuePath(decision)} className="btn">
          {decision.status === 'decided' ? 'Open the full record' : 'Continue this decision'}
        </Link>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(`/decisions/new?from=${decision.id}`)}
        >
          Add a follow-up decision
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => openAgent({ decisionId: decision.id })}>
          <span className="ai-mark" aria-hidden="true">
            ✦
          </span>{' '}
          Ask Rooted about this
        </button>
      </div>
    </aside>
  );
}

function LinkList({ title, links, side }: { title: string; links: DecisionLink[]; side: 'from' | 'to' }) {
  const { state } = useStore();
  const actions = useInboxActions();
  return (
    <>
      <h3 className="detail-sub">{title}</h3>
      <ul className="detail-list">
        {links.map((l) => {
          const other = state.decisions.find((d) => d.id === (side === 'from' ? l.fromId : l.toId));
          if (!other) return null;
          const suggested = l.origin === 'ai' && l.status === 'suggested';
          return (
            <li key={l.id} className={l.origin === 'ai' ? 'detail-link detail-link-ai' : 'detail-link'}>
              <Link to={`/?focus=${other.id}`}>{other.question}</Link>
              {l.origin === 'ai' && (
                <p className="detail-small ai-mark">
                  ✦ {suggested ? 'Rooted thinks these are connected' : 'Found by Rooted'}
                  {l.reason ? `: ${l.reason}` : ''}
                </p>
              )}
              {suggested && (
                <div className="row detail-link-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => actions.acceptLink(l.id)}>
                    Connect
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => actions.dismissLink(l.id)}>
                    Dismiss
                  </button>
                  <ReportWrongAnswer surface="link" targetId={l.id} excerpt={l.reason} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
