import type { LlmState } from './lib/llm';

export type SourceKind = 'notes' | 'chat' | 'github' | 'tasks' | 'interview';
export type Visibility = 'team' | 'leads';

export interface Redaction { type: string; count: number }

export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  visibility: Visibility;
  url?: string;
  importedAt: string;
  redactions: Redaction[];
  synthetic?: boolean;
  /** Round 3 re-sync: when the source was last re-imported, and what changed */
  syncs?: SyncRecord[];
}

export interface SyncRecord { ts: string; by: string; added: number; changed: number; removed: number; unchanged: number; flagged: number }

export interface TaskMeta { title: string; status: string; assignee?: string; due?: string }

/** One normalised event / chunk of source text (already redacted). */
export interface Chunk {
  id: string;
  sourceId: string;
  author?: string;
  ts?: string; // ISO date
  text: string;
  ref: string; // human locator: "line 12", "msg #4", "PR #48"
  /** stable identity across re-imports (commit sha, PR number, message id, task title); absent for plain text lines */
  key?: string;
  url?: string;
  task?: TaskMeta;
}

export type ClaimType = 'decision' | 'owner' | 'status' | 'risk' | 'dependency' | 'task' | 'issue' | 'contact';
export type ClaimStatus = 'corroborated' | 'cited' | 'attested' | 'inferred' | 'conflicting';
export type ReviewState = 'pending' | 'approved' | 'rejected';

export interface Evidence { chunkId: string; quote: string; verified: boolean }

export interface Claim {
  id: string;
  workstream: string; // workstream id
  type: ClaimType;
  statement: string;
  originalStatement: string;
  people: string[];
  evidence: Evidence[];
  origin: 'extracted' | 'inferred' | 'interview' | 'manual';
  /** which proposer suggested an extracted claim */
  proposer?: 'llm' | 'rules';
  /** which LLM proposed it (the fallback model is used only when the main one's daily quota is out) */
  llmModel?: string;
  status: ClaimStatus;
  conflictWith: string[];
  superseded?: string; // id of attested claim that replaced it
  basedOn?: string[];
  date?: string;
  review: ReviewState;
  edited: boolean;
  versions: Version[];
  note?: string;
  /** Round 3: set when an approval's source text changed since it was approved */
  stale?: { reason: string; before?: string; after?: string; ref?: string };
}

export interface Version { statement: string; by: string; ts: string; action: string }

export interface Workstream { id: string; name: string; keywords: string[] }

export type FieldKey = 'owner' | 'status' | 'decision' | 'risks' | 'next';
export const FIELDS: { key: FieldKey; label: string; types: ClaimType[] }[] = [
  { key: 'owner', label: 'Owner', types: ['owner'] },
  { key: 'status', label: 'Status', types: ['status'] },
  { key: 'decision', label: 'Last decision', types: ['decision'] },
  { key: 'risks', label: 'Risks & blockers', types: ['risk', 'issue', 'dependency'] },
  { key: 'next', label: 'Next action', types: ['task'] },
];

export type FieldState = 'filled' | 'inferred' | 'conflicting' | 'missing' | 'dontknow';
export interface FieldCell { workstream: string; field: FieldKey; state: FieldState; claimIds: string[] }

export type QuestionKind = 'conflict' | 'missing' | 'inferred';
export interface Question {
  id: string;
  kind: QuestionKind;
  workstream: string;
  field?: FieldKey;
  claimIds: string[];
  prompt: string;
  priority: number;
}

export interface Answer {
  choice: 'pick' | 'confirm' | 'correct' | 'answer' | 'dontknow';
  pickedClaimId?: string;
  text?: string;
  ts: string;
}

export interface ReviewRecord {
  state: ReviewState; statement?: string; versions: Version[];
  /** Round 3: the exact source text an approval was based on, to detect later edits/deletions */
  basis?: ApprovalBasis[];
  snapshot?: { statement: string; type: ClaimType; workstream: string };
}

export interface ApprovalBasis { chunkId: string; textKey: string; text: string; quote: string; ref: string }

export interface ManualClaim {
  id: string; workstream: string; type: ClaimType; statement: string; quote?: string; ts: string;
}

export interface Ack { state: 'read' | 'unclear'; note?: string; ts: string }

export interface PublishedSnapshot {
  version: number;
  ts: string;
  by: string;
  claims: Claim[];
  chunks: Chunk[];
  sources: Source[];
  workstreams: Workstream[];
  fields: FieldCell[];
  readiness: number;
}

export interface AuditEntry { ts: string; actor: string; action: string }

export interface SuccessorQuestion { id: string; text: string; ts: string }

export interface Project {
  id: string;
  name: string;
  description: string;
  people: { leaver: string; successor: string; reviewer: string };
  workstreams: Workstream[];
  sources: Source[];
  chunks: Chunk[];
  answers: Record<string, Answer>;
  reviews: Record<string, ReviewRecord>;
  manualClaims: ManualClaim[];
  published?: PublishedSnapshot;
  /** Round 3: earlier published versions, oldest first (the latest is also `published`) */
  history?: PublishedSnapshot[];
  acks: Record<string, Ack>;
  successorQuestions: SuccessorQuestion[];
  audit: AuditEntry[];
  /** Round 3: LLM proposer settings and cached proposals */
  llm?: LlmState;
  isDemo?: boolean;
  createdAt: string;
}

export type Role = 'reviewer' | 'leaver' | 'successor';
