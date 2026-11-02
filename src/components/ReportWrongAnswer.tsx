import { useState } from 'react';
import { newId, useStore } from '../store/store';
import type { WrongAnswerReport } from '../types';
import { Dialog } from './Dialog';

// F-28: every agent output gets this action. Reports land in the store and
// show up on the Help page.
export function ReportWrongAnswer({
  surface,
  targetId,
  decisionId,
  excerpt,
}: {
  surface: WrongAnswerReport['surface'];
  targetId?: string;
  decisionId?: string;
  excerpt?: string;
}) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    dispatch({
      type: 'addReport',
      report: {
        id: newId('r'),
        surface,
        targetId,
        decisionId,
        excerpt,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      },
    });
    setSent(true);
    setOpen(false);
    setNote('');
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        {sent ? 'Reported, thanks' : 'Report wrong answer'}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Report a wrong answer">
        <form className="stack" onSubmit={submit}>
          {excerpt && (
            <blockquote className="banner" style={{ margin: 0 }}>
              {excerpt}
            </blockquote>
          )}
          <div className="field">
            <label htmlFor={`report-${targetId ?? surface}`}>What did Rooted get wrong?</label>
            <textarea
              id={`report-${targetId ?? surface}`}
              className="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
            />
          </div>
          <div className="row">
            <button type="submit" className="btn" disabled={!note.trim()}>
              Send report
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
