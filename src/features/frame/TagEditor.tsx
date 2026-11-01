// Tags on a decision. The PM types their own (filled chips); Rooted suggests
// some (sage outlined chips with a ✦) that the PM keeps or removes. A kept
// suggestion becomes the PM's tag.
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { suggestTags } from '../../agent';
import { ReportWrongAnswer } from '../../components/ReportWrongAnswer';
import { workspaceTags } from '../../store/dashboard';
import { useStore } from '../../store/store';
import type { Tag } from '../../types';

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, 24);
}

export function TagEditor({
  tags,
  onChange,
  question,
  notes,
}: {
  tags: Tag[];
  onChange: (tags: Tag[]) => void;
  question: string;
  notes: string;
}) {
  const { state } = useStore();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState(false);
  const [none, setNone] = useState(false);
  const id = useId();
  const listId = useId();
  const known = workspaceTags(state);
  // Suggestions can take a while; merge them into the tags as they are when they arrive.
  const latest = useRef(tags);
  latest.current = tags;

  function add() {
    const label = normalizeTag(draft);
    setDraft('');
    if (!label) return;
    const rest = tags.filter((t) => t.label !== label);
    onChange([...rest, { label, origin: 'user' }]);
  }

  async function suggest() {
    setBusy(true);
    setNone(false);
    const result = await suggestTags(
      question,
      notes,
      tags.map((t) => t.label),
      known,
    );
    setBusy(false);
    setSample(result.sample);
    const current = latest.current;
    const fresh = result.tags.filter((label) => !current.some((t) => t.label === label));
    if (fresh.length === 0) setNone(true);
    onChange([...current, ...fresh.map((label) => ({ label, origin: 'ai' as const }))]);
  }

  return (
    <div className="field">
      <label htmlFor={id}>Tags</label>
      {tags.length > 0 && (
        <ul className="row tag-list" aria-label="Tags on this decision">
          {tags.map((t) => (
            <li key={t.label} className={t.origin === 'ai' ? 'tag tag-ai' : 'tag'}>
              {t.origin === 'ai' && <span aria-hidden="true">✦</span>}
              {t.origin === 'ai' && <span className="visually-hidden">Suggested by Rooted: </span>}#{t.label}
              {t.origin === 'ai' && (
                <button
                  type="button"
                  className="tag-btn"
                  aria-label={`Keep tag ${t.label}`}
                  onClick={() => onChange(tags.map((x) => (x.label === t.label ? { ...x, origin: 'user' } : x)))}
                >
                  ✓
                </button>
              )}
              <button
                type="button"
                className="tag-btn"
                aria-label={`Remove tag ${t.label}`}
                onClick={() => onChange(tags.filter((x) => x.label !== t.label))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {tags.some((t) => t.origin === 'ai') && (
        <div>
          <ReportWrongAnswer
            surface="tag"
            excerpt={`Suggested tags: ${tags
              .filter((t) => t.origin === 'ai')
              .map((t) => `#${t.label}`)
              .join(', ')}`}
          />
        </div>
      )}
      <div className="frame-add">
        <input
          id={id}
          className="input"
          list={listId}
          value={draft}
          placeholder="pricing, onboarding…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
        />
        <datalist id={listId}>
          {known.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button type="button" className="btn btn-secondary" onClick={add} disabled={!normalizeTag(draft)}>
          Add tag
        </button>
        <button type="button" className="btn btn-ghost" onClick={suggest} disabled={busy || !question.trim()}>
          <span className="ai-mark" aria-hidden="true">
            ✦
          </span>{' '}
          {busy ? 'Suggesting…' : 'Suggest tags'}
        </button>
      </div>
      <span className="hint row">
        Your tags are filled; Rooted’s suggestions are outlined until you keep them.
        {sample && <span className="sample-badge">Sample answer</span>}
        {none && <span>No new tags to suggest.</span>}
      </span>
    </div>
  );
}
