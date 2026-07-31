/**
 * In-memory metrics store for the admin dashboard.
 *
 * Persisted on `globalThis` so Hot Module Replacement in development does not
 * reset tallies between code changes.
 *
 * NOTE: uses process memory — not suitable for multi-instance production.
 * Migrate to Vercel KV / Redis before going live.
 */

import type { Estamento } from '@/types';

declare global {
  // eslint-disable-next-line no-var
  var __metricsVoteTallies: Map<string, number> | undefined;
  // eslint-disable-next-line no-var
  var __metricsSchoolsVoted: Map<string, Set<Estamento>> | undefined;
}

/** candidateId → number of votes */
const voteTallies: Map<string, number> =
  globalThis.__metricsVoteTallies ??
  (globalThis.__metricsVoteTallies = new Map());

/** schoolId → Set of estamentos that have at least one vote from this school */
const schoolsVoted: Map<string, Set<Estamento>> =
  globalThis.__metricsSchoolsVoted ??
  (globalThis.__metricsSchoolsVoted = new Map());

/**
 * Records a successfully cast vote.
 * Called by POST /api/votes immediately after submitVote() succeeds.
 */
export function recordVote(
  candidateId: string,
  estamento: Estamento,
  schoolId: string,
) {
  voteTallies.set(candidateId, (voteTallies.get(candidateId) ?? 0) + 1);

  if (!schoolsVoted.has(schoolId)) {
    schoolsVoted.set(schoolId, new Set());
  }
  schoolsVoted.get(schoolId)!.add(estamento);
}

export function getVoteTallies(): ReadonlyMap<string, number> {
  return voteTallies;
}

export function getSchoolsVoted(): ReadonlyMap<string, ReadonlySet<Estamento>> {
  return schoolsVoted;
}

export function resetMetrics() {
  voteTallies.clear();
  schoolsVoted.clear();
}
