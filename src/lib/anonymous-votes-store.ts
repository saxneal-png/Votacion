/**
 * Almacén y Generador de Evidencias de Votos Anónimos (Urna Digital)
 *
 * Mantiene la urna digital de sufragios desvinculada de datos de identidad (RUN/correo)
 * para garantizar el Secreto del Voto conforme al Decreto N° 102 y estándares electorales,
 * permitiendo auditar y exportar la totalidad de votos emitidos como evidencia oficial.
 */

import { supabaseAdmin } from '@/lib/supabase-client';
import { formatChileDateTime } from '@/lib/chile-time';
import { getCandidatosAsync, getCandidatos, getEstamentoVariants } from '@/lib/candidates-store';

export interface AnonymousVoteEntry {
  id: string;
  estamento: string;
  candidateId: string;
  candidateName?: string;
  candidateNumero?: number | null;
  createdAt: string;
  createdAtFormateada?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __anonymousVotesStore: AnonymousVoteEntry[] | undefined;
}

const anonymousVotes: AnonymousVoteEntry[] =
  globalThis.__anonymousVotesStore ?? (globalThis.__anonymousVotesStore = []);

/**
 * Registra un voto emitido en la urna anónima en memoria
 */
export function recordAnonymousVote(params: {
  id?: string;
  estamento: string;
  candidateId: string;
  createdAt?: string;
}): AnonymousVoteEntry {
  const id = params.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `VOTO-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const now = params.createdAt ? new Date(params.createdAt) : new Date();

  // Buscar nombre del candidato si existe en memoria
  const allCandidates = getCandidatos();
  const cand = allCandidates.find((c) => c.id === params.candidateId);

  const entry: AnonymousVoteEntry = {
    id,
    estamento: params.estamento.toLowerCase(),
    candidateId: params.candidateId,
    candidateName: cand ? (cand.nombreCompleto || cand.name) : params.candidateId,
    candidateNumero: cand ? cand.numero : null,
    createdAt: now.toISOString(),
    createdAtFormateada: formatChileDateTime(now),
  };

  anonymousVotes.unshift(entry);
  return entry;
}

/**
 * Obtiene votos anónimos desde memoria
 */
export function getAnonymousVotes(filters: { search?: string; estamento?: string } = {}): {
  records: AnonymousVoteEntry[];
  total: number;
} {
  let filtered = [...anonymousVotes];

  if (filters.estamento && filters.estamento !== 'ALL') {
    const variants = getEstamentoVariants(filters.estamento).map((v) => v.toLowerCase());
    filtered = filtered.filter((r) => variants.includes(r.estamento.toLowerCase()));
  }

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.candidateId.toLowerCase().includes(q) ||
        (r.candidateName && r.candidateName.toLowerCase().includes(q)) ||
        r.estamento.toLowerCase().includes(q),
    );
  }

  return {
    records: filtered,
    total: filtered.length,
  };
}

/**
 * Obtiene votos anónimos desde Supabase (con fallback a memoria)
 */
export async function getAnonymousVotesAsync(filters: { search?: string; estamento?: string } = {}): Promise<{
  records: AnonymousVoteEntry[];
  total: number;
}> {
  // Cargar lista de candidatos para enriquecer los IDs con nombres reales
  let candidateMap = new Map<string, { name: string; numero: number | null }>();
  try {
    const candidates = await getCandidatosAsync({ estamento: 'ALL' }).catch(() => getCandidatos());
    candidates.forEach((c) => {
      candidateMap.set(c.id, {
        name: c.nombreCompleto || c.name || c.id,
        numero: c.numero ?? null,
      });
    });
  } catch {
    const candidates = getCandidatos();
    candidates.forEach((c) => {
      candidateMap.set(c.id, {
        name: c.nombreCompleto || c.name || c.id,
        numero: c.numero ?? null,
      });
    });
  }

  if (!supabaseAdmin) {
    const local = getAnonymousVotes(filters);
    const enriched = local.records.map((r) => {
      const cInfo = candidateMap.get(r.candidateId);
      return {
        ...r,
        candidateName: cInfo?.name || r.candidateName || r.candidateId,
        candidateNumero: cInfo?.numero ?? r.candidateNumero ?? null,
        createdAtFormateada: r.createdAtFormateada || formatChileDateTime(new Date(r.createdAt)),
      };
    });
    return { records: enriched, total: enriched.length };
  }

  try {
    const PAGE_SIZE = 1000;
    let allRows: Array<{ id: string; estamento: string; candidate_id: string; created_at: string }> = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabaseAdmin
        .from('votos_anonimos')
        .select('id, estamento, candidate_id, created_at')
        .order('created_at', { ascending: false });

      if (filters.estamento && filters.estamento !== 'ALL') {
        const variants = getEstamentoVariants(filters.estamento).map((v) => v.toLowerCase());
        query = query.in('estamento', variants);
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error } = await query;

      if (error) {
        console.error('[SUPABASE] Error al leer votos_anonimos:', error.message);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRows = allRows.concat(data);
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    if (allRows.length === 0 && anonymousVotes.length > 0) {
      return getAnonymousVotes(filters);
    }

    let records: AnonymousVoteEntry[] = allRows.map((item) => {
      const cInfo = candidateMap.get(item.candidate_id);
      const createdDate = item.created_at ? new Date(item.created_at) : new Date();
      return {
        id: item.id || `VOTO-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        estamento: item.estamento,
        candidateId: item.candidate_id,
        candidateName: cInfo?.name || item.candidate_id,
        candidateNumero: cInfo?.numero ?? null,
        createdAt: item.created_at,
        createdAtFormateada: formatChileDateTime(createdDate),
      };
    });

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      records = records.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.candidateId.toLowerCase().includes(q) ||
          (r.candidateName && r.candidateName.toLowerCase().includes(q)) ||
          r.estamento.toLowerCase().includes(q),
      );
    }

    return { records, total: records.length };
  } catch (err) {
    console.error('[SUPABASE] Excepción al consultar votos_anonimos:', err);
    return getAnonymousVotes(filters);
  }
}

/**
 * Formatea el nombre legible del estamento
 */
function formatEstamentoLabel(est: string): string {
  const clean = (est || '').toLowerCase().trim();
  if (clean.includes('padre') || clean.includes('apoderado')) return 'Padres y Apoderados';
  if (clean.includes('docente')) return 'Docentes';
  if (clean.includes('asistente')) return 'Asistentes de la Educación';
  if (clean.includes('directiv')) return 'Equipo Directivo';
  if (clean.includes('estudiant')) return 'Estudiantes';
  return est.toUpperCase();
}

/**
 * Genera el contenido CSV con codificación UTF-8 + BOM y delimitador ';'
 * optimizado para abrir directamente en Microsoft Excel y auditoría legal.
 */
export async function generateAnonymousVotesCsvAsync(filters: { search?: string; estamento?: string } = {}): Promise<string> {
  const { records } = await getAnonymousVotesAsync(filters);

  const headers = [
    'N° Correlativo',
    'ID Voto en Urna (UUID / Folio)',
    'Estamento Electoral',
    'ID Candidatura Votada',
    'Candidato / Opción Votada',
    'N° de Lista / Candidato',
    'Fecha y Hora de Sufragio (Chile)',
    'Timestamp ISO Oficial',
  ];

  const escapeCsv = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '""';
    return `"${String(val).replace(/"/g, '""')}"`;
  };

  const rows = records.map((r, index) => [
    escapeCsv(index + 1),
    escapeCsv(r.id),
    escapeCsv(formatEstamentoLabel(r.estamento)),
    escapeCsv(r.candidateId),
    escapeCsv(r.candidateName || r.candidateId),
    escapeCsv(r.candidateNumero !== null && r.candidateNumero !== undefined ? r.candidateNumero : 'S/N'),
    escapeCsv(r.createdAtFormateada || formatChileDateTime(new Date(r.createdAt))),
    escapeCsv(r.createdAt),
  ]);

  const csvBody = [headers.map(escapeCsv).join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');

  return `\uFEFF${csvBody}`;
}

/**
 * Resetea los votos anónimos en memoria
 */
export function resetAnonymousVotes(): void {
  anonymousVotes.length = 0;
}
