// Actions shared by the inbox and the "Needs you" rail: start or dismiss a
// decision the agent spotted, and accept or dismiss a link it suggested.
import { useNavigate } from 'react-router-dom';
import { newId, useStore } from '../../store/store';
import type { SuggestedDecision } from '../../types';
import { continuePath } from '../log/format';

export function useInboxActions() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();

  function startSuggestion(s: SuggestedDecision) {
    const id = newId('d');
    const evidence = s.evidence.map((e) => `${e.author ? `${e.author} in ` : ''}${e.sourceLabel}: “${e.snippet}”`);
    const decision = {
      id,
      question: s.question,
      notes: [s.why, ...evidence].join('\n'),
      links: [],
      constraints: [],
      status: 'framing' as const,
      createdAt: new Date().toISOString(),
      ownerId: state.user?.id,
      stakeholderIds: [],
      tags: [],
    };
    dispatch({ type: 'createDecision', decision });
    dispatch({ type: 'updateSuggestion', suggestionId: s.id, patch: { status: 'started', decisionId: id } });
    navigate(continuePath(decision));
  }

  return {
    startSuggestion,
    dismissSuggestion: (id: string) =>
      dispatch({ type: 'updateSuggestion', suggestionId: id, patch: { status: 'dismissed' } }),
    acceptLink: (id: string) => dispatch({ type: 'updateLink', linkId: id, patch: { status: 'accepted' } }),
    dismissLink: (id: string) => dispatch({ type: 'updateLink', linkId: id, patch: { status: 'dismissed' } }),
  };
}
