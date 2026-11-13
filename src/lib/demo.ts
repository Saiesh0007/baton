import type { Project } from '../types';
import { parseChat, parseGithub, parseNotes, parseTasks, type GithubExport } from './ingest';

/**
 * Fully synthetic demo: a fictional college tech team ("Spark Fest" tech team).
 * All people, phone numbers and tokens are made up. Planted on purpose:
 *  - a reversed payment decision (chat vs PR)            -> Conflicting
 *  - a task marked Done that chat says is half-done       -> Conflicting
 *  - a workstream with no owner (Sponsorship portal)      -> Inferred / Missing
 *  - a recurring iOS scanner bug in 3 sources             -> Corroborated
 *  - a token and phone number in raw data                 -> Redacted at ingest
 *  - a leads-only channel                                 -> Knowledge shadows for the successor
 */

export const DEMO_NOTES = `# Spark Fest Tech Team — Meeting notes

## 02 Sep 2026
- Attendees: Aarav, Diya, Kabir, Meera
- Aarav owns the registration app until he graduates in December.
- Meera is handling the fest website content and design.
- We decided to host the fest website on Netlify instead of the college server, because the college server went down twice last year.
- The SMS gateway API key expires on 31 Mar 2027 and must be renewed from the college accounts office.
- Contact for SMS gateway billing: Mr. Patil, accounts office, phone 98765 43210.

## 16 Sep 2026
- Registration app is live for early-bird passes.
- The QR scanner fails on iOS Safari again; the workaround is to open the scanner page in Chrome.
- Print vendor (Shree Prints) needs 2 weeks notice for ID cards.
- Next step: Diya to shadow Aarav on the registration admin panel.

## 30 Sep 2026
- Kabir is responsible for the certificate generator.
- We agreed that certificates will be emailed as PDFs, not printed, to cut cost.
- TODO: move the registration database backups from Aarav's personal Google Drive to the team drive.
`;

export const DEMO_CHAT_CORE = {
  guild: { name: 'Spark Fest Tech' },
  channel: { name: 'core' },
  messages: [
    { timestamp: '2026-09-12T15:04:00+05:30', author: { name: 'Aarav' }, content: "we're dropping razorpay for now, UPI QR is enough for this fest" },
    { timestamp: '2026-09-12T15:06:00+05:30', author: { name: 'Kabir' }, content: 'ok makes sense' },
    { timestamp: '2026-09-14T21:30:00+05:30', author: { name: 'Aarav' }, content: "heads up: the admin panel password reset flow is fragile, don't touch auth.ts without testing on staging" },
    { timestamp: '2026-09-18T11:12:00+05:30', author: { name: 'Meera' }, content: 'website is deployed on Netlify now, the fest domain points there' },
    { timestamp: '2026-09-21T09:40:00+05:30', author: { name: 'Aarav' }, content: 'QR scanner broke on iPhones again after the Safari update, same bug as last year' },
    { timestamp: '2026-09-22T18:02:00+05:30', author: { name: 'Aarav' }, content: "here's the staging token for testing ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8 — don't share it outside this channel" },
    { timestamp: '2026-10-03T16:20:00+05:30', author: { name: 'Kabir' }, content: 'certificate generator is only half done, bulk export is still broken' },
    { timestamp: '2026-10-05T10:05:00+05:30', author: { name: 'Aarav' }, content: 'the registration app depends on the Firebase free tier and we hit the read quota during the early-bird rush' },
    { timestamp: '2026-10-06T12:30:00+05:30', author: { name: 'Diya' }, content: 'who looks after the sponsorship portal now that Rohan left?' },
    { timestamp: '2026-10-06T12:41:00+05:30', author: { name: 'Aarav' }, content: 'not sure honestly, maybe ask Prof. Joshi' },
    { timestamp: '2026-10-08T19:15:00+05:30', author: { name: 'Meera' }, content: 'need to update the schedule page before the fest, waiting on final timings from the cultural committee' },
    { timestamp: '2026-10-10T22:01:00+05:30', author: { name: 'Aarav' }, content: "Rohan's sponsorship portal code is in the sponsor-portal branch, it was never merged" },
    { timestamp: '2026-10-11T10:00:00+05:30', author: { name: 'Aarav' }, content: 'sponsor portal login also uses the old Firebase config, so the sponsor portal breaks if we rotate keys' },
  ],
};

export const DEMO_CHAT_LEADS = {
  guild: { name: 'Spark Fest Tech' },
  channel: { name: 'leads-only' },
  messages: [
    { timestamp: '2026-10-15T17:00:00+05:30', author: { name: 'Aarav' }, content: 'Decision: sponsor payments for Fest 2026 will be invoiced through the college account, not collected in the sponsorship portal.' },
    { timestamp: '2026-10-15T17:20:00+05:30', author: { name: 'Prof. Joshi' }, content: 'Agreed. Keep the sponsor contract amounts out of the main channel.' },
    { timestamp: '2026-10-20T20:45:00+05:30', author: { name: 'Aarav' }, content: 'Risk: the Firebase project for registration is billed to my personal card, it must be moved to the college account before I leave.' },
  ],
};

export const DEMO_GITHUB: GithubExport = {
  repo: 'spark-fest/registration-app',
  synthetic: true,
  commits: [
    { sha: '7b1c2d3e4f5a6b7c8d9e', author: 'Aarav', date: '2026-09-08T12:00:00Z', message: 'feat: admin panel export registrations to CSV' },
    { sha: '9f2c1ab4de56f7890abc', author: 'Aarav', date: '2026-09-21T13:00:00Z', message: 'fix: QR scanner camera permission on iOS Safari (again)' },
    { sha: '3d7e9a0b1c2d3e4f5a6b', author: 'Meera', date: '2026-09-17T09:00:00Z', message: 'chore: move fest website deploy to Netlify' },
    { sha: 'c4d5e6f7a8b9c0d1e2f3', author: 'Kabir', date: '2026-09-29T15:30:00Z', message: 'feat: certificate generator single PDF export' },
    { sha: 'e1f2a3b4c5d6e7f8a9b0', author: 'Aarav', date: '2026-10-12T08:10:00Z', message: 'docs: registration README, firebase setup steps' },
  ],
  pulls: [
    { number: 48, title: 'feat: re-enable razorpay webhook for workshop payments', body: 'Workshops need card payments, so razorpay comes back for workshop tickets only.', state: 'closed', merged: true, author: 'Aarav', date: '2026-09-20T10:00:00Z' },
    { number: 57, title: 'WIP: certificate generator bulk export with a job queue', body: 'Bulk export times out above 200 participants. Moving it to a background queue.', state: 'open', merged: false, author: 'Kabir', date: '2026-10-12T10:00:00Z' },
  ],
  issues: [
    { number: 52, title: 'Bulk certificate export times out for more than 200 participants', state: 'open', author: 'Kabir', date: '2026-10-03T10:00:00Z' },
    { number: 55, title: 'Sponsor portal: login page returns 500', state: 'open', author: 'Diya', date: '2026-10-09T10:00:00Z' },
  ],
};

export const DEMO_TASKS = `title,status,assignee,due
Registration admin panel,Done,Aarav,2026-09-20
Certificate generator,Done,Kabir,2026-10-05
Schedule page update,In progress,Meera,2026-11-20
Sponsor portal login fix,Not started,,2026-11-25
Move registration DB backups to team drive,Not started,Aarav,2026-11-15
`;

export function buildDemoProject(): Project {
  const notes = parseNotes('Core meeting notes (Markdown)', DEMO_NOTES, 'team');
  const core = parseChat('Discord #core', DEMO_CHAT_CORE, 'team');
  const leads = parseChat('Discord #leads-only', DEMO_CHAT_LEADS, 'leads');
  const gh = parseGithub(DEMO_GITHUB, 'team');
  const tasks = parseTasks('Task board export (CSV)', DEMO_TASKS, 'team');
  const all = [notes, core, leads, gh, tasks];
  const now = new Date().toISOString();
  return {
    id: 'demo',
    isDemo: true,
    name: 'Spark Fest tech team — Aarav → Diya',
    description: 'Fictional college tech team. Aarav (final year) is graduating and hands the registration app, website and certificates over to Diya (second year). Prof. Joshi reviews.',
    people: { leaver: 'Aarav', successor: 'Diya', reviewer: 'Prof. Joshi' },
    workstreams: [
      { id: 'registration', name: 'Registration app', keywords: ['registration', 'upi', 'payment', 'qr', 'scanner', 'admin panel', 'firebase', 'auth', 'early-bird', 'backups', 'database'] },
      { id: 'website', name: 'Fest website', keywords: ['website', 'netlify', 'domain', 'schedule page', 'content'] },
      { id: 'certificates', name: 'Certificates', keywords: ['certificate', 'id cards', 'print vendor', 'shree prints'] },
      { id: 'sponsorship', name: 'Sponsorship portal', keywords: ['sponsor', 'sponsorship', 'sponsor portal'] },
      { id: 'infra', name: 'Accounts & infrastructure', keywords: ['sms gateway', 'api key', 'accounts office', 'billing', 'staging token', 'personal card'] },
    ],
    sources: all.map((x) => x.source),
    chunks: all.flatMap((x) => x.chunks),
    answers: {},
    reviews: {},
    manualClaims: [],
    acks: {},
    successorQuestions: [],
    audit: [{ ts: now, actor: 'System', action: 'Demo project created from 5 synthetic sources' }],
    createdAt: now,
  };
}

/** Sample files a judge can download and re-upload to test the import path. */
export const SAMPLE_FILES: { name: string; content: string }[] = [
  { name: 'meeting-notes.md', content: DEMO_NOTES },
  { name: 'discord-core.json', content: JSON.stringify(DEMO_CHAT_CORE, null, 2) },
  { name: 'tasks.csv', content: DEMO_TASKS },
  { name: 'github-export.json', content: JSON.stringify(DEMO_GITHUB, null, 2) },
];
