// F-12, F-13: the agent chat, docked on the right. Closed, it's a ✦ circle in
// the corner. Open, it answers questions about decisions (cited answers link to
// the decision on the map), talks through the decision or option in scope, and
// starts a new decision. Every answer is editable (F-08) and reportable (F-28).
// When Claude can't answer, the reply says why and offers to ask again (0016).
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { suggestedPrompts } from '../../agent/chat';
import { isRetryable, type AiErrorCode } from '../../agent/client';
import { CloseIcon, SparkIcon } from '../../components/icons';
import { ReportWrongAnswer } from '../../components/ReportWrongAnswer';
import { localToday } from '../../store/dashboard';
import { useStore } from '../../store/store';
import type { ChatMessage } from '../../types';
import { threadId, useAgent } from './AgentContext';
import './agent.css';

export function AgentLauncher() {
  const { open, openAgent } = useAgent();
  if (open) return null;
  return (
    <button type="button" className="agent-launcher" aria-label="Ask Rooted" onClick={() => openAgent()}>
      <SparkIcon size={24} />
    </button>
  );
}

export function AgentPanel() {
  const { state } = useStore();
  const { open, scope, pending, focusRequest, close, ask, openAgent } = useAgent();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const titleId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const thread = threadId(scope);
  const messages = state.messages.filter((m) => m.threadId === thread);
  const decision = state.decisions.find((d) => d.id === scope.decisionId);
  const option = state.options.find((o) => o.id === scope.optionId);

  useEffect(() => {
    if (open && focusRequest > 0) inputRef.current?.focus();
  }, [focusRequest, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('dialog[open]') && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight });
  }, [messages.length, pending]);

  if (!open) return null;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!draft.trim() || pending) return;
    ask(draft);
    setDraft('');
  }

  const prompts = suggestedPrompts(scope, state, localToday());

  return (
    <aside className="agent-panel" aria-labelledby={titleId}>
      <header className="agent-head">
        <div className="agent-head-text">
          <h2 id={titleId} className="agent-title">
            <span className="ai-mark" aria-hidden="true">
              ✦
            </span>{' '}
            Rooted
          </h2>
          <p className="muted agent-scope">
            {option
              ? `Talking through “${option.label}”`
              : decision
                ? `About “${decision.question}”`
                : 'Ask about any decision, yours or your team’s.'}
          </p>
        </div>
        <button type="button" className="icon-btn" aria-label="Close Rooted" onClick={close}>
          <CloseIcon />
        </button>
      </header>

      {(decision || option) && (
        <div className="agent-scope-bar row">
          {option && decision && (
            <button type="button" className="btn btn-ghost" onClick={() => openAgent({ decisionId: decision.id })}>
              ← Whole decision
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => openAgent({})}>
            All decisions
          </button>
        </div>
      )}

      <div className="agent-log" ref={listRef} role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && (
          <p className="muted agent-empty">
            {option
              ? 'Ask what could make this option wrong, or what evidence backs it.'
              : decision
                ? 'I can compare the options, point out gaps and find related past decisions. You make the call.'
                : 'Ask why something was decided, who decided it, or what’s due. I’ll cite the decisions I used.'}
          </p>
        )}
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {pending && (
          <p className="row muted agent-thinking">
            <span className="spinner" aria-hidden="true" /> Thinking…
          </p>
        )}
      </div>

      <div className="agent-foot">
        {messages.length === 0 && (
          <ul className="agent-prompts" aria-label="Suggested questions">
            {prompts.map((p) => (
              <li key={p}>
                <button type="button" className="chip agent-prompt" onClick={() => ask(p)} disabled={pending}>
                  {p}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="agent-form" onSubmit={submit}>
          <label htmlFor={inputId} className="visually-hidden">
            Ask Rooted
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            className="textarea agent-input"
            rows={2}
            value={draft}
            placeholder={option ? 'Ask about this option…' : 'Ask about your decisions…'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button type="submit" className="btn" disabled={!draft.trim() || pending}>
            Send
          </button>
        </form>
        {!decision && (
          <button type="button" className="btn btn-secondary agent-new" onClick={() => navigate('/decisions/new')}>
            Start a new decision
          </button>
        )}
      </div>
    </aside>
  );
}

function Message({ message }: { message: ChatMessage }) {
  const { dispatch } = useStore();
  const { ask, pending } = useAgent();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(message.text);
  const editId = useId();

  if (message.failed) {
    return (
      <div className="agent-msg agent-msg-agent agent-msg-failed" role="alert">
        <p className="agent-msg-text">{message.text}</p>
        {message.retry && isRetryable((message.failedCode ?? 'unknown') as AiErrorCode) && (
          <div className="row agent-msg-actions">
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => ask(message.retry!)}>
              Ask again
            </button>
          </div>
        )}
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="agent-msg agent-msg-user">
        <p>{message.text}</p>
      </div>
    );
  }

  return (
    <div className="agent-msg agent-msg-agent">
      {editing ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: 'updateMessage', messageId: message.id, patch: { text: text.trim(), edited: true } });
            setEditing(false);
          }}
        >
          <label htmlFor={editId} className="visually-hidden">
            Edit Rooted’s answer
          </label>
          <textarea id={editId} className="textarea" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row">
            <button type="submit" className="btn" disabled={!text.trim()}>
              Save
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="agent-msg-text">{message.text}</p>
      )}
      {message.citations && message.citations.length > 0 && (
        <ul className="agent-citations" aria-label="Decisions this answer used">
          {message.citations.map((c) => (
            <li key={c.decisionId}>
              <Link to={`/?focus=${c.decisionId}`} className="chip agent-citation">
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="row agent-msg-actions">
        {message.edited && <span className="muted agent-edited">Edited</span>}
        {!editing && (
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        <ReportWrongAnswer surface="chat" targetId={message.id} excerpt={message.text} />
      </div>
    </div>
  );
}
