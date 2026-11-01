// Hairline, single-colour line icons for the app chrome. Same construction as
// the brand mark (stroke=currentColor, round caps/joins, fill:none) so the whole
// shell reads as one icon family. All are decorative and hidden from screen
// readers; the control they sit in carries the accessible name.
import type { SVGProps } from 'react';

function Icon({ children, size = 18, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

// The brand sprout: a stem forking into two filled buds — growth and a branching
// decision in one glyph (design-language.md §2).
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

// A small branching map: the causal-forest / home view.
export function IconMap(props: { size?: number }) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M7 11l9-4M7 13l9 4" />
    </Icon>
  );
}

export function IconHistory(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 1 0 2.3-5.6" />
      <path d="M4 4v3h3" />
      <path d="M12 8v4l3 2" />
    </Icon>
  );
}

export function IconSettings(props: { size?: number }) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </Icon>
  );
}

export function IconHelp(props: { size?: number }) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
      <path d="M12 16.5h.01" />
    </Icon>
  );
}

export function IconPlus(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function IconPlay(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M7 5l12 7-12 7V5z" />
    </Icon>
  );
}

export function IconArrowRight(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function IconSignOut(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 12h10M17 9l3 3-3 3" />
    </Icon>
  );
}

export function IconSidebar(props: { size?: number }) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Icon>
  );
}

export function IconSun(props: { size?: number }) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </Icon>
  );
}

export function IconMoon(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </Icon>
  );
}

export function IconTrace(props: { size?: number }) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h6a2 2 0 0 1 2 2v8" />
    </Icon>
  );
}

export function IconTimeline(props: { size?: number }) {
  return (
    <Icon {...props}>
      <path d="M4 12h16" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="16" cy="12" r="2" />
    </Icon>
  );
}

export function IconGraph(props: { size?: number }) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="7" r="2" />
      <circle cx="18" cy="9" r="2" />
      <circle cx="11" cy="17" r="2" />
      <path d="M7.7 8.2 9.3 15.4M12.8 15.9 16.3 10.6M8 7.2 16 8.6" />
    </Icon>
  );
}

