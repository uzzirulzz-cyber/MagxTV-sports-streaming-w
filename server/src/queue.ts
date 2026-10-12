/* Minimal in-process worker queue. Concurrency 1 by default, so a large playlist
   parse cannot starve the API event loop. No external dependency. */
import crypto from 'node:crypto';

export type JobState = 'queued' | 'running' | 'done' | 'error';
export interface Job<T = unknown> {
  id: string; type: string; label: string; state: JobState; progress: number;
  message: string; createdAt: string; startedAt: string | null; finishedAt: string | null;
  result: T | null; error: string | null;
}
type Report = (pct: number, message: string) => void;
type Runner<T> = (report: Report) => Promise<T>;

class Queue {
  private jobs = new Map<string, Job>();
  private pending: { id: string; run: Runner<unknown> }[] = [];
  private active = 0;
  constructor(private concurrency = 1, private keep = 50) {}

  enqueue<T>(type: string, label: string, run: Runner<T>): Job<T> {
    const id = crypto.randomBytes(6).toString('hex');
    const job: Job<unknown> = {
      id, type, label, state: 'queued', progress: 0, message: 'Queued…',
      createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, result: null, error: null
    };
    this.jobs.set(id, job);
    this.pending.push({ id, run: run as Runner<unknown> });
    this.trim();
    void this.pump();
    return job as Job<T>;
  }
  get(id: string): Job | null { return this.jobs.get(id) ?? null; }
  list(limit = 20): Job[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  get queueDepth(): number { return this.pending.length; }
  private trim() {
    const all = [...this.jobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    while (all.length > this.keep) { const old = all.shift(); if (old) this.jobs.delete(old.id); }
  }
  private async pump(): Promise<void> {
    if (this.active >= this.concurrency) return;
    const next = this.pending.shift();
    if (!next) return;
    this.active += 1;
    const job = this.jobs.get(next.id);
    if (job) { job.state = 'running'; job.startedAt = new Date().toISOString(); job.message = 'Running…'; }
    const report: Report = (pct, message) => {
      const j = this.jobs.get(next.id);
      if (j) { j.progress = Math.max(0, Math.min(100, Math.round(pct))); j.message = message; }
    };
    try {
      const result = await next.run(report);
      const j = this.jobs.get(next.id);
      if (j) { j.state = 'done'; j.progress = 100; j.message = 'Completed.'; j.result = result; j.finishedAt = new Date().toISOString(); }
    } catch (e) {
      const j = this.jobs.get(next.id);
      if (j) { j.state = 'error'; j.error = e instanceof Error ? e.message : 'Job failed.'; j.message = j.error; j.finishedAt = new Date().toISOString(); }
    } finally {
      this.active -= 1;
      void this.pump();
    }
  }
}
export const queue = new Queue(1, 50);
