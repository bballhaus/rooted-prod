// F-16: labels for what happened after a decision.
import type { Outcome } from '../../types';

export const RESULT_LABEL: Record<Outcome['result'], string> = {
  worked: 'Worked',
  mixed: 'Mixed',
  'did-not-work': 'Didn’t work',
  'too-early': 'Too early to tell',
};
