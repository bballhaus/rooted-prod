// One item in the inbox or the "Needs you" rail, with the action it needs.
import { Link } from 'react-router-dom';
import { ReportWrongAnswer } from '../../components/ReportWrongAnswer';
import type { InboxItem } from '../../store/dashboard';
import { useStore } from '../../store/store';
import { useInboxActions } from './useInboxActions';

const KIND_LABEL: Record<InboxItem['kind'], string> = {
  'outcome-due': 'Outcome due',
  deadline: 'Deadline',
  suggestion: 'Rooted suggests',
  link: 'Suggested link',
  gap: 'Missing information',
};

export function InboxRow({ item, onDone }: { item: InboxItem; onDone?: () => void }) {
  const { state } = useStore();
  const actions = useInboxActions();
  const suggestion = state.suggestions.find((s) => s.id === item.suggestionId);
  return (
    <li className="inbox-item">
      <p className={item.due ? 'inbox-kind due-label' : item.kind === 'suggestion' || item.kind === 'link' ? 'inbox-kind ai-mark' : 'inbox-kind muted'}>
        {item.kind === 'suggestion' || item.kind === 'link' ? '✦ ' : ''}
        {KIND_LABEL[item.kind]}
        {item.kind === 'suggestion' && <span className="sample-badge inbox-sample">Sample</span>}
      </p>
      <p className="inbox-item-title">{item.title}</p>
      <p className="muted inbox-item-detail">{item.detail}</p>
      <div className="row inbox-actions">
        {item.kind === 'outcome-due' && (
          <Link to={`/decisions/${item.decisionId}#outcome`} className="btn btn-secondary" onClick={onDone}>
            Log outcome
          </Link>
        )}
        {(item.kind === 'deadline' || item.kind === 'gap') && (
          <Link to={`/?focus=${item.decisionId}`} className="btn btn-secondary" onClick={onDone}>
            Open
          </Link>
        )}
        {suggestion && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => actions.startSuggestion(suggestion)}>
              Start this decision
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => actions.dismissSuggestion(suggestion.id)}>
              Dismiss
            </button>
            <ReportWrongAnswer surface="suggestion" targetId={suggestion.id} excerpt={suggestion.question} />
          </>
        )}
        {item.linkId && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => actions.acceptLink(item.linkId!)}>
              Connect
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => actions.dismissLink(item.linkId!)}>
              Dismiss
            </button>
            <ReportWrongAnswer surface="link" targetId={item.linkId} excerpt={item.detail} />
          </>
        )}
      </div>
    </li>
  );
}
