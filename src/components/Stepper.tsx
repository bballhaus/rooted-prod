import { Link } from 'react-router-dom';
import type { Decision } from '../types';
import './stepper.css';

// The four MVP steps for one decision, as a row of dots. The first three are
// sections of the workspace; Log is the record. A filled sage dot is a step
// you've passed, a ringed dot is where you are, a hollow dot is still ahead.
// Steps after the decision's current status aren't links yet. Wine is kept for
// the chosen option, never spent on chrome.
const STEPS = [
  { key: 'framing', label: 'Frame', path: 'work#frame' },
  { key: 'brief', label: 'Evidence brief', path: 'work#evidence' },
  { key: 'options', label: 'Options', path: 'work#options' },
  { key: 'decided', label: 'Log', path: '' },
] as const;

export function Stepper({ decision, current }: { decision: Decision; current: (typeof STEPS)[number]['key'] }) {
  const reached = STEPS.findIndex((s) => s.key === decision.status);
  return (
    <ol className="stepper" aria-label="Decision steps">
      {STEPS.map((step, i) => {
        const isCurrent = step.key === current;
        const isDone = i < reached || (i <= reached && !isCurrent);
        const state = isCurrent ? 'current' : isDone ? 'done' : 'ahead';
        const href = step.path ? `/decisions/${decision.id}/${step.path}` : `/decisions/${decision.id}`;
        const inner = (
          <>
            <span className={`stepper-dot stepper-dot-${state}`} aria-hidden="true" />
            <span className="stepper-label">{step.label}</span>
          </>
        );
        return (
          <li key={step.key} className={`stepper-step stepper-step-${state}`}>
            {i <= reached && !isCurrent ? (
              <Link to={href} className="stepper-link">
                {inner}
              </Link>
            ) : (
              <span className="stepper-link" aria-current={isCurrent ? 'step' : undefined}>
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
