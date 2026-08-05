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
import { supabaseAdmin } from '@/lib/supabase-client';

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
  _slepId: string = 'slep-principal',
) {
  voteTallies.set(candidateId, (voteTallies.get(candidateId) ?? 0) + 1);

  if (!schoolsVoted.has(schoolId)) {
    schoolsVoted.set(schoolId, new Set());
  }
  schoolsVoted.get(schoolId)!.add(estamento);
}

export function getVoteTallies(_slepId?: string, _schoolId?: string): ReadonlyMap<string, number> {
  return voteTallies;
}

/**
 * Obtiene el escrutinio actualizado de votos por candidato consultando la tabla `votos_anonimos` en Supabase
 */
export async function getVoteTalliesAsync(_slepId?: string, _schoolId?: string): Promise<Map<string, number>> {
  const map = new Map<string, number>(voteTallies);

  if (!supabaseAdmin) {
    return map;
  }

  try {
    // Paginación por lotes de 1.000 filas para evitar truncamiento de PostgREST
    const BATCH_SIZE = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * BATCH_SIZE;
      const to = from + BATCH_SIZE - 1;

      const { data, error } = await supabaseAdmin
        .from('votos_anonimos')
        .select('candidate_id')
        .range(from, to);

      if (error) {
        console.error('[SUPABASE] Error obteniendo escrutinio de votos:', error?.message);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      data.forEach((row: { candidate_id: string }) => {
        const cid = String(row.candidate_id ?? '').trim();
        if (cid) {
          map.set(cid, (map.get(cid) ?? 0) + 1);
        }
      });

      if (data.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return map;
  } catch (err) {
    console.error('[SUPABASE] Excepción obteniendo escrutinio de votos:', err);
    return map;
  }
}

export function getSchoolsVoted(_slepId?: string): ReadonlyMap<string, ReadonlySet<Estamento>> {
  return schoolsVoted;
}

export function resetMetrics() {
  voteTallies.clear();
  schoolsVoted.clear();
}
