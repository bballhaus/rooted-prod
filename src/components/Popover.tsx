// A button that opens a small panel (the avatar menu, the inbox). Closes on
// Escape, on a click outside, and when the route changes.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

export function Popover({
  label,
  button,
  className,
  children,
}: {
  label: string; // accessible name of the button
  button: ReactNode;
  className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div className="popover" ref={ref}>
      <button
        type="button"
        className={className ?? 'icon-btn'}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {button}
      </button>
      {open && (
        <div id={panelId} className="popover-panel card">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
