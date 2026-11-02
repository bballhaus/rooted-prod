// Scripted tag suggestions for a decision. AI tags show in sage with a ✦ until
// the PM accepts them (then they become the PM's own tags) or removes them.
import { tokenize } from './brief';

const HINTS: Record<string, string[]> = {
  pricing: ['price', 'pricing', 'plan', 'seat', 'seats', 'discount', 'billing', 'annual', 'charge'],
  onboarding: ['onboarding', 'checklist', 'setup', 'tour', 'admin', 'admins'],
  trials: ['trial', 'trials'],
  notifications: ['notification', 'notifications', 'email', 'digest', 'push', 'mention'],
  enterprise: ['sso', 'enterprise', 'saml', 'audit'],
  retention: ['retention', 'churn', 'cancel', 'cancellation'],
  growth: ['referral', 'referrals', 'invite', 'invites', 'growth'],
  design: ['design', 'copy', 'dashboard', 'layout', 'redesign'],
  infra: ['database', 'api', 'service', 'migration', 'infra', 'limits'],
  support: ['support', 'ticket', 'tickets', 'help'],
  roadmap: ['quarter', 'roadmap', 'bet', 'q1', 'q4'],
  metrics: ['metric', 'metrics', 'activation', 'measure'],
};

export function suggestTagsNow(question: string, notes: string, current: string[], existing: string[]): string[] {
  const words = new Set(tokenize(`${question} ${notes}`));
  const have = new Set(current.map((t) => t.toLowerCase()));
  const scored = Object.entries(HINTS)
    .map(([tag, hints]) => ({ tag, hits: hints.filter((h) => words.has(h)).length }))
    .filter((x) => x.hits > 0 && !have.has(x.tag))
    // Tags the workspace already uses win ties, so the map stays consistent.
    .sort((a, b) => b.hits - a.hits || Number(existing.includes(b.tag)) - Number(existing.includes(a.tag)));
  return scored.slice(0, 3).map((x) => x.tag);
}
