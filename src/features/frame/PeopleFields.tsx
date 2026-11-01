// Who makes the call and who's consulted, from the (fake) team. Decision
// record 0005 covers bringing teammates into the prototype.
import { useId } from 'react';
import { useStore } from '../../store/store';

export function PeopleFields({
  ownerId,
  stakeholderIds,
  onOwner,
  onStakeholders,
}: {
  ownerId: string;
  stakeholderIds: string[];
  onOwner: (id: string) => void;
  onStakeholders: (ids: string[]) => void;
}) {
  const { state } = useStore();
  const ownerField = useId();
  const others = state.teammates.filter((t) => t.id !== ownerId);
  return (
    <div className="grid-2">
      <div className="field">
        <label htmlFor={ownerField}>Who makes the call</label>
        <select id={ownerField} className="select" value={ownerId} onChange={(e) => onOwner(e.target.value)}>
          {state.teammates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id === state.user?.id ? `${t.name} (you)` : `${t.name}, ${t.role}`}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="field frame-people">
        <legend className="label">Who to consult (optional)</legend>
        <div className="frame-people-list">
          {others.map((t) => (
            <label key={t.id} className="checkbox">
              <input
                type="checkbox"
                checked={stakeholderIds.includes(t.id)}
                onChange={(e) =>
                  onStakeholders(
                    e.target.checked ? [...stakeholderIds, t.id] : stakeholderIds.filter((x) => x !== t.id),
                  )
                }
              />
              {t.name}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
