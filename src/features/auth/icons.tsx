// Generic glyphs for the mocked sign-in and source buttons. Deliberately not
// the real Google or Slack logos; they are decorative and hidden from screen readers.

export function SproutMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 21V12" />
      <path d="M12 12C12 9 9.5 7.5 7 7" />
      <path d="M12 12C12 9 14.5 6.5 17 6" />
      <circle cx="7" cy="7" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="17" cy="6" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

// A plain open "G"-like arc, not a brand mark.
export function GlyphG() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M19 8.5A8 8 0 1 0 20 12h-7.5" />
    </svg>
  );
}

// A plain hash, standing in for a chat workspace.
export function GlyphHash() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 4 7 20M17 4l-2 16M4.5 9h16M3.5 15h16" />
    </svg>
  );
}

// A folder outline for document sources.
export function GlyphFolder() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
    </svg>
  );
}
