// A teammate's initials in their muted person color (tokens --person-1…7), so
// who decided reads at a glance on the map, in lists and in details.
import type { CSSProperties } from 'react';
import type { Teammate } from '../types';

const PERSON_COLORS = 7;

export function personColor(id: string | undefined, teammates: Teammate[]): string {
  const i = teammates.findIndex((t) => t.id === id);
  return `var(--person-${(i < 0 ? PERSON_COLORS - 1 : i % PERSON_COLORS) + 1})`;
}

export function Avatar({
  person,
  teammates,
  className,
}: {
  person: Teammate | undefined;
  teammates: Teammate[];
  className?: string;
}) {
  return (
    <span
      className={className ? `avatar ${className}` : 'avatar'}
      style={{ '--person': personColor(person?.id, teammates) } as CSSProperties}
      title={person?.name}
      aria-hidden="true"
    >
      {person?.initials ?? '?'}
    </span>
  );
}
