import type { Decision } from '../../types';

// Date-only strings ("2026-10-15") are calendar dates; format them in UTC so
// they don't shift a day in western time zones.
export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(dateOnly ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  });
}

// The step an in-progress decision should pick up at.
export function continuePath(decision: Decision): string {
  switch (decision.status) {
    case 'framing':
      return `/decisions/${decision.id}/frame`;
    case 'brief':
      return `/decisions/${decision.id}/brief`;
    case 'options':
      return `/decisions/${decision.id}/options`;
    case 'decided':
      return `/decisions/${decision.id}`;
  }
}

export const STATUS_LABEL: Record<Decision['status'], string> = {
  framing: 'Framing the question',
  brief: 'Gathering evidence',
  options: 'Weighing options',
  decided: 'Logged',
};

// Local calendar date, matching the frame step's default review date.
export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
