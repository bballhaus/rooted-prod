import { Link } from 'react-router-dom';
import type { Decision } from '../types';
import './stepper.css';

// The workflow for one decision, as a row of dots: frame it, gather evidence,
// weigh the options, decide. A filled sage dot is a step you've passed, a ringed
// dot is where you are, a hollow dot is still ahead. The chosen-path wine is kept
// for the decision itself, never spent on chrome. Steps you've reached are links.
const STEPS = [
  { key: 'framing', label: 'Frame', path: 'frame' },
  { key: 'brief', label: 'Gather', path: 'brief' },
  { key: 'options', label: 'Weigh', path: 'options' },
  { key: 'decided', label: 'Decide', path: '' },
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
        const linkable = i <= reached && !isCurrent;
        const inner = (
          <>
            <span className={`stepper-dot stepper-dot-${state}`} aria-hidden="true" />
            <span className="stepper-label">{step.label}</span>
          </>
        );
        return (
          <li key={step.key} className={`stepper-step stepper-step-${state}`}>
            {linkable ? (
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
