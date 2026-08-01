/**
 * Registro Oficial de Votantes con Folio Único (Decreto N° 102)
 *
 * Mantiene el registro de firmas/asistencia de sufragio con folio único,
 * RUN, correo, fecha/hora, estamento y colegio, garantizando el secreto del voto
 * (no almacena la candidatura seleccionada).
 */

import { formatRut } from '@/lib/rut-validator';
import { supabase } from '@/lib/supabase';
import { formatChileDateTime } from '@/lib/chile-time';

export interface VotingRecordEntry {
  folio: string;
  rutVotante: string;
  formattedRutVotante: string;
  emailRegistrado: string;
  fechaHora: string;
  fechaHoraFormateada: string;
  estamento: string;
  rbdEstablecimiento: string;
  nombreEstablecimiento: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __votingRecordStore: VotingRecordEntry[] | undefined;
}

const votingRecords: VotingRecordEntry[] =
  globalThis.__votingRecordStore ?? (globalThis.__votingRecordStore = []);

// Registros de demostración iniciales
if (votingRecords.length === 0) {
  votingRecords.push(
    {
      folio: 'FOL-2026-00001-A9B2',
      rutVotante: '16940271K',
      formattedRutVotante: '16.940.271-K',
      emailRegistrado: 'maria.gonzalez@eduvallediguillin.gob.cl',
      fechaHora: new Date(Date.now() - 3600000).toISOString(),
      fechaHoraFormateada: formatChileDateTime(Date.now() - 3600000),
      estamento: 'DOCENTES',
      rbdEstablecimiento: '10202',
      nombreEstablecimiento: 'Escuela Martín Prado',
    },
    {
      folio: 'FOL-2026-00002-C4D8',
      rutVotante: '145678901',
      formattedRutVotante: '14.567.890-1',
      emailRegistrado: 'apoderado.prueba@gmail.com',
      fechaHora: new Date(Date.now() - 1800000).toISOString(),
      fechaHoraFormateada: formatChileDateTime(Date.now() - 1800000),
      estamento: 'PADRES_APODERADOS',
      rbdEstablecimiento: '10202',
      nombreEstablecimiento: 'Escuela Martín Prado',
    },
  );
}

/**
 * Registrar el sufragio emitido en el acta de votación con folio único
 */
export function recordOfficialVote(params: {
  rutVotante: string;
  emailRegistrado: string;
  estamento: string;
  rbdEstablecimiento?: string;
  nombreEstablecimiento?: string;
  skipSupabaseInsert?: boolean;
}): VotingRecordEntry {
  const count = votingRecords.length + 1;
  const folioNum = String(count).padStart(5, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const folio = `FOL-2026-${folioNum}-${randomSuffix}`;

  const now = new Date();
  const formattedRut = formatRut(params.rutVotante);

  const entry: VotingRecordEntry = {
    folio,
    rutVotante: params.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase(),
    formattedRutVotante: formattedRut,
    emailRegistrado: params.emailRegistrado.trim().toLowerCase(),
    fechaHora: now.toISOString(),
    fechaHoraFormateada: formatChileDateTime(now),
    estamento: params.estamento.toUpperCase(),
    rbdEstablecimiento: params.rbdEstablecimiento || '10201',
    nombreEstablecimiento: params.nombreEstablecimiento || 'Establecimiento SLEP',
  };

  votingRecords.unshift(entry); // Nuevos registros primero

  // Persistir en Supabase solo si no se insertó previamente vía RPC
  if (supabase && !params.skipSupabaseInsert) {
    void supabase
      .from('acta_sufragio')
      .insert({
        folio: entry.folio,
        rut_votante: entry.rutVotante,
        formatted_rut_votante: entry.formattedRutVotante,
        email_registrado: entry.emailRegistrado,
        estamento: entry.estamento,
        rbd_establecimiento: entry.rbdEstablecimiento,
        nombre_establecimiento: entry.nombreEstablecimiento,
        fecha_hora: entry.fechaHora,
      })
      .then(({ error }) => {
        if (error) {
          console.error('[SUPABASE] Error al registrar acta de sufragio:', error.message);
        } else {
          console.log('[SUPABASE] Voto registrado correctamente en acta_sufragio.');
        }
      });
  }

  return entry;
}

/**
 * Obtener registros de votación filtrados
 */
export function getVotingRecords({
  search = '',
  estamento = '',
  rbd = '',
}: {
  search?: string;
  estamento?: string;
  rbd?: string;
} = {}): {
  records: VotingRecordEntry[];
  total: number;
} {
  let filtered = [...votingRecords];

  if (search) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (r) =>
        r.folio.toLowerCase().includes(q) ||
        r.rutVotante.toLowerCase().includes(q) ||
        r.formattedRutVotante.toLowerCase().includes(q) ||
        r.emailRegistrado.toLowerCase().includes(q) ||
        r.nombreEstablecimiento.toLowerCase().includes(q),
    );
  }

  if (estamento && estamento !== 'ALL') {
    filtered = filtered.filter((r) => r.estamento === estamento.toUpperCase());
  }

  if (rbd && rbd !== 'ALL') {
    filtered = filtered.filter((r) => r.rbdEstablecimiento === rbd);
  }

  return {
    records: filtered,
    total: filtered.length,
  };
}

/**
 * Obtener registros de votación filtrados desde Supabase (o fallback en memoria)
 */
export async function getVotingRecordsAsync({
  search = '',
  estamento = '',
  rbd = '',
}: {
  search?: string;
  estamento?: string;
  rbd?: string;
} = {}): Promise<{ records: VotingRecordEntry[]; total: number }> {
  if (!supabase) {
    return getVotingRecords({ search, estamento, rbd });
  }

  try {
    const PAGE_SIZE = 1000;
    let allRows: Record<string, any>[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase.from('acta_sufragio').select('*').order('fecha_hora', { ascending: false });

      if (estamento && estamento !== 'ALL') {
        query = query.eq('estamento', estamento.toUpperCase());
      }

      if (rbd && rbd !== 'ALL') {
        query = query.eq('rbd_establecimiento', rbd);
      }

      if (search) {
        const q = search.trim();
        query = query.or(
          `folio.ilike.%${q}%,rut_votante.ilike.%${q}%,email_registrado.ilike.%${q}%,nombre_establecimiento.ilike.%${q}%`,
        );
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error } = await query;

      if (error) {
        console.error('[SUPABASE] Error al leer acta_sufragio:', error.message);
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

    if (allRows.length === 0) {
      return { records: [], total: 0 };
    }

    const seen = new Set<string>();
    const records: VotingRecordEntry[] = [];

    for (const item of allRows) {
      const cleanRutStr = String(item.rut_votante ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
      const estStr = String(item.estamento ?? '').toUpperCase().trim();
      const key = `${cleanRutStr}_${estStr}`;

      if (!seen.has(key)) {
        seen.add(key);
        records.push({
          folio: item.folio,
          rutVotante: item.rut_votante,
          formattedRutVotante: item.formatted_rut_votante || item.rut_votante,
          emailRegistrado: item.email_registrado,
          fechaHora: item.fecha_hora,
          fechaHoraFormateada: formatChileDateTime(item.fecha_hora),
          estamento: item.estamento,
          rbdEstablecimiento: item.rbd_establecimiento,
          nombreEstablecimiento: item.nombre_establecimiento,
        });
      }
    }

    return { records, total: records.length };
  } catch (err) {
    console.error('[SUPABASE] Excepción al consultar acta_sufragio:', err);
    return getVotingRecords({ search, estamento, rbd });
  }
}

/**
 * Resetear todos los registros de votación (Reinicio Electoral)
 */
export function resetVotingRecords(): void {
  votingRecords.length = 0;
  if (supabase) {
    void supabase.from('acta_sufragio').delete().neq('folio', 'RESET_ALL');
  }
}

/**
 * Generar contenido CSV con codificación UTF-8 + BOM para compatibilidad directa con Microsoft Excel (Síncrono)
 */
export function generateVotingRecordsCsv(filters: { search?: string; estamento?: string; rbd?: string } = {}): string {
  const { records } = getVotingRecords(filters);

  const headers = [
    'Folio Único',
    'RUN Votante',
    'RUN Formateado',
    'Correo Electrónico Registrado',
    'Estamento',
    'RBD Colegio',
    'Establecimiento Educacional',
    'Fecha y Hora de Sufragio',
  ];

  const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;

  const rows = records.map((r) => [
    escapeCsv(r.folio),
    escapeCsv(r.rutVotante),
    escapeCsv(r.formattedRutVotante),
    escapeCsv(r.emailRegistrado),
    escapeCsv(r.estamento),
    escapeCsv(r.rbdEstablecimiento),
    escapeCsv(r.nombreEstablecimiento),
    escapeCsv(r.fechaHoraFormateada),
  ]);

  const csvBody = [headers.map(escapeCsv).join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');

  return `\uFEFF${csvBody}`;
}

/**
 * Generar contenido CSV con codificación UTF-8 + BOM desde Supabase (Asíncrono)
 */
export async function generateVotingRecordsCsvAsync(filters: { search?: string; estamento?: string; rbd?: string } = {}): Promise<string> {
  const { records } = await getVotingRecordsAsync(filters);

  const headers = [
    'Folio Único',
    'RUN Votante',
    'RUN Formateado',
    'Correo Electrónico Registrado',
    'Estamento',
    'RBD Colegio',
    'Establecimiento Educacional',
    'Fecha y Hora de Sufragio',
  ];

  const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;

  const rows = records.map((r) => [
    escapeCsv(r.folio),
    escapeCsv(r.rutVotante),
    escapeCsv(r.formattedRutVotante),
    escapeCsv(r.emailRegistrado),
    escapeCsv(r.estamento),
    escapeCsv(r.rbdEstablecimiento),
    escapeCsv(r.nombreEstablecimiento),
    escapeCsv(r.fechaHoraFormateada),
  ]);

  const csvBody = [headers.map(escapeCsv).join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');

  return `\uFEFF${csvBody}`;
}
