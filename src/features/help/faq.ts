// F-27: FAQ content. Answers describe this prototype as it is: sources are
// mocked with sample data and some features are planned, not built.

export interface FaqItem {
  id: string;
  topic: FaqTopic;
  question: string;
  answer: string;
}

export const FAQ_TOPICS = [
  'Getting started',
  'Your data and privacy',
  'Evidence brief',
  'Options and logging',
  'Account',
] as const;

export type FaqTopic = (typeof FAQ_TOPICS)[number];

export const FAQ: FaqItem[] = [
  {
    id: 'faq-what',
    topic: 'Getting started',
    question: 'What does Rooted do?',
    answer:
      'Rooted helps you prepare for a product decision and keeps a record of it. It gathers context from where your team already works, lays out options as a decision tree, and logs the option you chose with your rationale and the options you pruned. You make the call; Rooted never decides for you.',
  },
  {
    id: 'faq-prototype',
    topic: 'Getting started',
    question: 'Is this the real product?',
    answer:
      'No. This is a clickable prototype with sample data for a made-up company, Fernwave. Slack and Google sign-in are mocked, nothing calls an AI model, and everything you enter stays in this browser.',
  },
  {
    id: 'faq-first',
    topic: 'Getting started',
    question: 'How do I start a decision?',
    answer:
      'Choose “New decision”, write the question you need to answer, and add any notes, links, constraints and a deadline. Rooted then prepares an evidence brief before you look at options.',
  },
  {
    id: 'faq-what-read',
    topic: 'Your data and privacy',
    question: 'Which Slack channels does Rooted read?',
    answer:
      'Only the channels you allow during onboarding or later under Settings → Sources. Rooted never reads private channels or direct messages. In the prototype, the Slack workspace and its messages are sample data.',
  },
  {
    id: 'faq-disconnect',
    topic: 'Your data and privacy',
    question: 'How do I disconnect a source or delete my data?',
    answer:
      'Go to Settings. Under Sources you can disconnect Slack or Google Drive. Under Your data, “Delete all data” removes every decision, its evidence, options and your reports, and disconnects every source. You have to type DELETE to confirm.',
  },
  {
    id: 'faq-visibility',
    topic: 'Your data and privacy',
    question: 'Who can see my decisions?',
    answer:
      'Only you. The first release covers your own data; sharing with teammates is planned for a later release and isn’t in the prototype.',
  },
  {
    id: 'faq-brief',
    topic: 'Evidence brief',
    question: 'What is the evidence brief?',
    answer:
      'A short summary of the messages, docs and past decisions that bear on your question, grouped by theme, with a link back to each source. It also lists gaps: things Rooted looked for and couldn’t find.',
  },
  {
    id: 'faq-wrong',
    topic: 'Evidence brief',
    question: 'What if the brief gets something wrong?',
    answer:
      'Every item is editable. You can correct it, remove it, flag it as inaccurate or add your own context. Use “Report wrong answer” on any agent output, or the form on this page, so the team can see what went wrong.',
  },
  {
    id: 'faq-past',
    topic: 'Evidence brief',
    question: 'Does Rooted use my past decisions?',
    answer:
      'Yes. Decisions you’ve logged can show up in a new brief as context, so you can trace how an earlier call relates to the one in front of you.',
  },
  {
    id: 'faq-who-decides',
    topic: 'Options and logging',
    question: 'Does Rooted pick the option for me?',
    answer:
      'No. Rooted proposes options with pros, cons and a rough fit score, and you can add, edit or prune branches. You choose; the score is a starting point, not a verdict.',
  },
  {
    id: 'faq-pruned',
    topic: 'Options and logging',
    question: 'What happens to the options I don’t choose?',
    answer:
      'They stay in the decision record as pruned branches, each with the reason you gave. Rejected options are never deleted, so you can see later why they lost.',
  },
  {
    id: 'faq-chat',
    topic: 'Options and logging',
    question: 'Can I chat with Rooted about the options?',
    answer:
      'Chatting through the rationale, overall or per option, is planned for the MVP but isn’t in this prototype yet.',
  },
  {
    id: 'faq-outcome',
    topic: 'Options and logging',
    question: 'Will Rooted remind me to record the outcome?',
    answer:
      'Each logged decision gets a review date, set from your default in Settings. Nudges that ask what happened are planned but not built in the prototype, so nothing is sent yet.',
  },
  {
    id: 'faq-cost',
    topic: 'Account',
    question: 'What does Rooted cost?',
    answer: 'It’s free during the beta. Paid plans haven’t been decided, and nothing is charged without your say.',
  },
  {
    id: 'faq-profile',
    topic: 'Account',
    question: 'How do I change my name, role or team?',
    answer:
      'Go to Settings → Profile, edit the fields and save. Your email comes from your sign-in and can’t be changed there.',
  },
  {
    id: 'faq-nudge-channel',
    topic: 'Account',
    question: 'Can I get nudges by email instead of Slack?',
    answer:
      'Yes. Pick Slack or email under Settings → Notifications. The preference is saved, but nudges themselves are mocked in the prototype.',
  },
];
