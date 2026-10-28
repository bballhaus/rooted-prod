import { Link } from 'react-router-dom';
import type { Decision } from '../types';

// The four MVP steps for one decision. Steps after the decision's current
// status aren't links yet.
const STEPS = [
  { key: 'framing', label: 'Frame', path: 'frame' },
  { key: 'brief', label: 'Evidence brief', path: 'brief' },
  { key: 'options', label: 'Options', path: 'options' },
  { key: 'decided', label: 'Log', path: '' },
] as const;

export function Stepper({ decision, current }: { decision: Decision; current: (typeof STEPS)[number]['key'] }) {
  const reached = STEPS.findIndex((s) => s.key === decision.status);
  return (
    <ol className="row" aria-label="Decision steps" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {STEPS.map((step, i) => {
        const isCurrent = step.key === current;
        const label = `${i + 1}. ${step.label}`;
        const href = step.path ? `/decisions/${decision.id}/${step.path}` : `/decisions/${decision.id}`;
        return (
          <li key={step.key}>
            {i <= reached && !isCurrent ? (
              <Link to={href} className="pill">
                {label}
              </Link>
            ) : (
              <span className={isCurrent ? 'pill pill-rec' : 'pill'} aria-current={isCurrent ? 'step' : undefined}>
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
