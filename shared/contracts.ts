/** Cross-boundary contracts. Dates are YYYY-MM-DD; timestamps are ISO UTC. */
export interface Metrics {
  squat: number | null;
  bench: number | null;
  deadlift: number | null;
  pullups: number | null;
  plankSeconds: number | null;
  runSeconds: number | null;
}
export type MetricKey = keyof Metrics;
export interface FitnessTargets { pullups: number; plankSeconds: number; runSeconds: number }
export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  targets: FitnessTargets;
}
export interface ProfileInput { displayName: string; bio: string; targets: FitnessTargets }
export interface JournalInput { title: string; body: string; date: string; metrics: Metrics }
export interface Journal extends JournalInput { id: string; userId: string; createdAt: string; updatedAt: string }
export type EventKind = 'workout' | 'milestone';
export interface EventInput { title: string; notes: string; date: string; kind: EventKind; completed: boolean }
export interface TrainingEvent extends EventInput { id: string; userId: string; createdAt: string; updatedAt: string }
export interface BootstrapData { users: User[]; journals: Journal[]; events: TrainingEvent[] }
export interface SessionData { user: User | null; csrfToken: string }
export interface ApiError { error: string }
export const MAX_JOURNAL_LENGTH = 50_000;
export const DEADLINE = '2027-10-16';
export const STRENGTH_TARGET = 1000;
export const DEFAULT_TARGETS: FitnessTargets = { pullups: 23, plankSeconds: 225, runSeconds: 1080 };
export const EMPTY_METRICS: Metrics = { squat: null, bench: null, deadlift: null, pullups: null, plankSeconds: null, runSeconds: null };
