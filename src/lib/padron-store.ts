import * as XLSX from 'xlsx';
import { cleanAndValidateRUT, formatRut } from '@/lib/rut-validator';
import { supabaseAdmin } from '@/lib/supabase-client';
import { getSchoolsMasterAsync, getSchoolsMasterMapAsync, SchoolMasterRecord } from '@/lib/schools-master-store';
import { parsePadronWorkbook, type ParsedPadronItem } from '@/lib/padron-parser';

export type EstamentoDecreto102 =
  | 'ESTUDIANTES'
  | 'PADRES_APODERADOS'
  | 'DOCENTES'
  | 'ASISTENTES'
  | 'DIRECTIVOS';

export interface PadronRecord {
  id: string;
  rutVotante: string;
  formattedRutVotante: string;
  rutEstudianteAsociado: string | null;
  formattedRutEstudiante: string | null;
  nombreCompleto: string;
  estamento: EstamentoDecreto102;
  rbdEstablecimiento: string;
  nombreEstablecimiento: string;
  slepId?: string;
  schoolId?: string;
  habilitado: boolean;
  haVotado: boolean;
  fechaVoto: string | null;
  createdAt: string;
}

export interface QuorumEstamentoStatus {
  estamento: EstamentoDecreto102;
  label: string;
  padronTotal: number;
  quorum30Requerido: number;
  votosEmitidos: number;
  porcentajeParticipacion: number;
  quorumAlcanzado: boolean;
}

export interface SchoolFilterOption {
  rbd: string;
  nombre: string;
}

export interface ExcelProcessingResult {
  success: boolean;
  totalFilas: number;
  registrosInsertados: number;
  registrosRechazados: number;
  quorums: QuorumEstamentoStatus[];
  erroresDetalle: Array<{ fila: number; rut?: string; motivo: string }>;
}

declare global {
  // eslint-disable-next-line no-var
  var __padronStore: PadronRecord[] | undefined;
}

// Registros iniciales vacíos (únicamente registros reales cargados de Supabase o Excel)
const INITIAL_MOCK_PADRON: PadronRecord[] = [];

const padronStore: PadronRecord[] =
  globalThis.__padronStore ?? (globalThis.__padronStore = INITIAL_MOCK_PADRON);


/**
 * Normaliza cualquier texto de estamento a los 5 Enums estrictos del Decreto N° 102
 */
export function normalizeEstamentoDecreto102(rawEstamento: string): EstamentoDecreto102 | null {
  if (!rawEstamento) return null;
  const sanitized = String(rawEstamento).trim().toUpperCase();

  if (
    sanitized.includes('ESTUDIANTE') ||
    sanitized.includes('ALUMNO') ||
    sanitized.includes('PUPILO') ||
    sanitized === 'EST'
  ) {
    return 'ESTUDIANTES';
  }
  if (
    sanitized.includes('PADRE') ||
    sanitized.includes('APODERADO') ||
    sanitized.includes('FAMILIAR') ||
    sanitized.includes('TUTOR') ||
    sanitized.includes('PADRES_APODERADOS') ||
    sanitized === 'APO'
  ) {
    return 'PADRES_APODERADOS';
  }
  if (
    sanitized.includes('DOCENTE') ||
    sanitized.includes('PROFESOR') ||
    sanitized.includes('MAESTRO') ||
    sanitized.includes('EDUCADOR') ||
    sanitized === 'DOC'
  ) {
    return 'DOCENTES';
  }
  if (
    sanitized.includes('ASISTENTE') ||
    sanitized.includes('PARADOCENTE') ||
    sanitized.includes('ADMINISTRATIVO') ||
    sanitized === 'ASI'
  ) {
    return 'ASISTENTES';
  }
  if (
    sanitized.includes('DIRECTIV') ||
    sanitized.includes('DIRECTOR') ||
    sanitized.includes('JEFE UTP') ||
    sanitized.includes('EQUIPO DIRECTIVO') ||
    sanitized === 'DIR'
  ) {
    return 'DIRECTIVOS';
  }

  return null;
}

/**
 * Calcula el Quórum inicial del 30% por estamento
 */
export function calculateEstamentoQuorums(records: PadronRecord[] = padronStore): QuorumEstamentoStatus[] {
  const estamentoMeta: Array<{ estamento: EstamentoDecreto102; label: string }> = [
    { estamento: 'ESTUDIANTES', label: 'Estudiantes' },
    { estamento: 'PADRES_APODERADOS', label: 'Padres y Apoderados' },
    { estamento: 'DOCENTES', label: 'Docentes' },
    { estamento: 'ASISTENTES', label: 'Asistentes de la Educación' },
    { estamento: 'DIRECTIVOS', label: 'Directivos' },
  ];

  return estamentoMeta.map(({ estamento, label }) => {
    const recordsByEstamento = records.filter((r) => r.estamento === estamento && r.habilitado);
    const padronTotal = recordsByEstamento.length;
    const quorum30Requerido = Math.ceil(padronTotal * 0.3);
    const votosEmitidos = recordsByEstamento.filter((r) => r.haVotado).length;
    const porcentajeParticipacion = padronTotal > 0 ? Number(((votosEmitidos / padronTotal) * 100).toFixed(1)) : 0;

    return {
      estamento,
      label,
      padronTotal,
      quorum30Requerido,
      votosEmitidos,
      porcentajeParticipacion,
      quorumAlcanzado: votosEmitidos >= quorum30Requerido && quorum30Requerido > 0,
    };
  });
}

/**
 * Extrae de forma dinámica todos los establecimientos reales presentes en el padrón
 */
export function getAvailableSchools(records: PadronRecord[] = padronStore): SchoolFilterOption[] {
  const map = new Map<string, string>();
  records.forEach((r) => {
    if (r.rbdEstablecimiento && r.nombreEstablecimiento) {
      map.set(r.rbdEstablecimiento, r.nombreEstablecimiento);
    }
  });

  return Array.from(map.entries()).map(([rbd, nombre]) => ({ rbd, nombre }));
}



/**
 * Obtiene el padrón completo con opciones de filtrado y búsqueda
 */
export function getPadronRecords({
  search = '',
  estamento = '',
  rbd = '',
  page = 1,
  pageSize = 50,
}: {
  search?: string;
  estamento?: string;
  rbd?: string;
  page?: number;
  pageSize?: number;
} = {}): {
  records: PadronRecord[];
  total: number;
  quorums: QuorumEstamentoStatus[];
  schools: SchoolFilterOption[];
} {
  let filtered = [...padronStore];

  if (search) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (r) =>
        r.nombreCompleto.toLowerCase().includes(q) ||
        r.rutVotante.toLowerCase().includes(q) ||
        r.formattedRutVotante.toLowerCase().includes(q) ||
        (r.rutEstudianteAsociado && r.rutEstudianteAsociado.toLowerCase().includes(q)),
    );
  }

  if (estamento && estamento !== 'ALL') {
    filtered = filtered.filter((r) => r.estamento === estamento);
  }

  if (rbd && rbd !== 'ALL') {
    filtered = filtered.filter((r) => r.rbdEstablecimiento === rbd);
  }

  return {
    records: filtered,
    total: filtered.length,
    quorums: calculateEstamentoQuorums(padronStore),
    schools: getAvailableSchools(padronStore),
  };
}

/**
 * Agrega un nuevo votante al padrón con validación Módulo 11 y Decreto 102
 */
export function addSingleVoter(data: {
  rutVotante: string;
  rutEstudianteAsociado?: string;
  nombreCompleto: string;
  estamento: EstamentoDecreto102;
  rbdEstablecimiento: string;
  nombreEstablecimiento: string;
}): PadronRecord {
  const rutValidation = cleanAndValidateRUT(data.rutVotante);
  if (!rutValidation.valid) {
    throw new Error(`RUN de votante inválido: ${rutValidation.errorReason}`);
  }

  let studentRutClean: string | null = null;
  let studentRutFormatted: string | null = null;

  if (data.estamento === 'PADRES_APODERADOS') {
    if (!data.rutEstudianteAsociado) {
      throw new Error(
        'Regla Decreto 102: Para el estamento Padres y Apoderados es obligatorio proporcionar el RUN del Estudiante asociado.',
      );
    }
    const studentValidation = cleanAndValidateRUT(data.rutEstudianteAsociado);
    if (!studentValidation.valid) {
      throw new Error(`RUN del estudiante asociado inválido: ${studentValidation.errorReason}`);
    }
    studentRutClean = studentValidation.cleanRut;
    studentRutFormatted = studentValidation.formattedRut;
  }

  // Comprobar duplicidad
  const duplicate = padronStore.find((r) => {
    if (r.estamento !== data.estamento) return false;
    if (data.estamento === 'PADRES_APODERADOS') {
      return r.rutVotante === rutValidation.cleanRut && r.rutEstudianteAsociado === studentRutClean;
    }
    return r.rutVotante === rutValidation.cleanRut;
  });

  if (duplicate) {
    throw new Error('Ya existe un registro con las mismas claves de identificación en este estamento.');
  }

  const newRecord: PadronRecord = {
    id: `padron-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    rutVotante: rutValidation.cleanRut,
    formattedRutVotante: rutValidation.formattedRut,
    rutEstudianteAsociado: studentRutClean,
    formattedRutEstudiante: studentRutFormatted,
    nombreCompleto: data.nombreCompleto.trim(),
    estamento: data.estamento,
    rbdEstablecimiento: data.rbdEstablecimiento.trim(),
    nombreEstablecimiento: data.nombreEstablecimiento.trim(),
    habilitado: true,
    haVotado: false,
    fechaVoto: null,
    createdAt: new Date().toISOString(),
  };

  padronStore.unshift(newRecord);
  return newRecord;
}

/**
 * Habilita o inhabilita un votante en el padrón
 */
export function toggleVoterHabilitado(id: string): PadronRecord {
  const index = padronStore.findIndex((r) => r.id === id);
  if (index === -1) {
    throw new Error('Registro del padrón no encontrado.');
  }

  padronStore[index].habilitado = !padronStore[index].habilitado;
  return padronStore[index];
}

/**
 * Elimina un registro del padrón
 */
export function deleteVoterRecord(id: string): boolean {
  const index = padronStore.findIndex((r) => r.id === id);
  if (index === -1) {
    return false;
  }

  padronStore.splice(index, 1);
  return true;
}

// ---------------------------------------------------------------------------
// MOTOR DE INGESTA EXCEL ROBUSTO MULTI-HOJA CON DETECCIÓN DE TABLA Y POSICIONES
// ---------------------------------------------------------------------------

/**
 * Ingesta Masiva desde Buffer de Excel (.xlsx / .xlsm)
 */
export function processPadronExcelBuffer(
  buffer: Buffer,
  masterMap?: Map<string, SchoolMasterRecord>,
): ExcelProcessingResult {
  const parsed = parsePadronWorkbook(buffer, masterMap);

  let registrosInsertados = 0;

  for (let i = 0; i < parsed.records.length; i++) {
    const item = parsed.records[i];

    const isDuplicate = padronStore.some((r) => {
      if (r.estamento !== item.estamento) return false;
      if (item.estamento === 'PADRES_APODERADOS') {
        return r.rutVotante === item.rutVotante && r.rutEstudianteAsociado === item.rutEstudianteAsociado;
      }
      return r.rutVotante === item.rutVotante;
    });

    if (isDuplicate) {
      parsed.erroresDetalle.push({
        fila: i + 1,
        rut: item.formattedRutVotante,
        motivo: 'Registro duplicado ya existente en el padrón para este estamento',
      });
      continue;
    }

    padronStore.push({
      id: `padron-excel-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
      rutVotante: item.rutVotante,
      formattedRutVotante: item.formattedRutVotante,
      rutEstudianteAsociado: item.rutEstudianteAsociado,
      formattedRutEstudiante: item.formattedRutEstudiante,
      nombreCompleto: item.nombreCompleto,
      estamento: item.estamento,
      rbdEstablecimiento: item.rbdEstablecimiento,
      nombreEstablecimiento: item.nombreEstablecimiento,
      habilitado: true,
      haVotado: false,
      fechaVoto: null,
      createdAt: new Date().toISOString(),
    });

    registrosInsertados++;
  }

  return {
    success: true,
    totalFilas: parsed.totalFilasLeidas,
    registrosInsertados,
    registrosRechazados: parsed.erroresDetalle.length,
    quorums: calculateEstamentoQuorums(padronStore),
    erroresDetalle: parsed.erroresDetalle,
  };
}

/**
 * Ingesta y almacenamiento en Lotes (Chunking) para archivos de alto volumen
 */
export async function processPadronChunkAsync(
  records: ParsedPadronItem[],
): Promise<{ success: boolean; registrosInsertados: number; erroresDetalle: Array<{ fila: number; rut?: string; motivo: string }> }> {
  let registrosInsertados = 0;
  const erroresDetalle: Array<{ fila: number; rut?: string; motivo: string }> = [];
  const newRecords: PadronRecord[] = [];

  for (let i = 0; i < records.length; i++) {
    const item = records[i];

    const isDuplicate = padronStore.some((r) => {
      if (r.estamento !== item.estamento) return false;
      if (item.estamento === 'PADRES_APODERADOS') {
        return r.rutVotante === item.rutVotante && r.rutEstudianteAsociado === item.rutEstudianteAsociado;
      }
      return r.rutVotante === item.rutVotante;
    });

    if (isDuplicate) {
      erroresDetalle.push({
        fila: i + 1,
        rut: item.formattedRutVotante,
        motivo: 'Registro duplicado ya existente en el padrón',
      });
      continue;
    }

    const record: PadronRecord = {
      id: `padron-excel-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
      rutVotante: item.rutVotante,
      formattedRutVotante: item.formattedRutVotante,
      rutEstudianteAsociado: item.rutEstudianteAsociado,
      formattedRutEstudiante: item.formattedRutEstudiante,
      nombreCompleto: item.nombreCompleto,
      estamento: item.estamento,
      rbdEstablecimiento: item.rbdEstablecimiento,
      nombreEstablecimiento: item.nombreEstablecimiento,
      slepId: 'slep-principal',
      schoolId: item.rbdEstablecimiento,
      habilitado: true,
      haVotado: false,
      fechaVoto: null,
      createdAt: new Date().toISOString(),
    };

    padronStore.push(record);
    newRecords.push(record);
    registrosInsertados++;
  }

  // Persistir en Supabase bd_padron en lotes de 500
  if (supabaseAdmin && newRecords.length > 0) {
    const rows = newRecords.map((r) => ({
      rut_votante: r.rutVotante,
      formatted_rut_votante: r.formattedRutVotante,
      rut_estudiante_asociado: r.rutEstudianteAsociado,
      formatted_rut_estudiante: r.formattedRutEstudiante,
      nombre_completo: r.nombreCompleto,
      estamento: r.estamento,
      rbd_establecimiento: r.rbdEstablecimiento,
      nombre_establecimiento: r.nombreEstablecimiento,
      habilitado: r.habilitado,
      ha_votado: r.haVotado,
      fecha_voto: r.fechaVoto,
      created_at: r.createdAt,
    }));

    try {
      const BATCH_SIZE = 500;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabaseAdmin
          .from('bd_padron')
          .insert(batch);

        if (error) {
          console.error('[SUPABASE] Error insertando lote en bd_padron:', error.message);
        }
      }
    } catch (err) {
      console.error('[SUPABASE] Excepción en processPadronChunkAsync:', err);
    }
  }

  return {
    success: true,
    registrosInsertados,
    erroresDetalle,
  };
}


export function resetPadronVotes() {
  padronStore.forEach((record) => {
    record.haVotado = false;
    record.fechaVoto = null;
  });
}

export async function resetPadronVotesAsync(): Promise<void> {
  resetPadronVotes();
  try {
    const { error } = await supabaseAdmin
      .from('bd_padron')
      .update({ ha_votado: false, fecha_voto: null })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('[SUPABASE] Error al resetear ha_votado en bd_padron:', error.message);
    } else {
      console.log('[SUPABASE] Estado de votos en bd_padron reseteado a cero.');
    }
  } catch (err) {
    console.error('[SUPABASE] Excepción en resetPadronVotesAsync:', err);
  }
}

export function clearPadronStore(): void {
  padronStore.length = 0;
}

export async function clearPadronStoreAsync(): Promise<void> {
  clearPadronStore();
  try {
    const { error } = await supabaseAdmin
      .from('bd_padron')
      .delete()
      .neq('rut_votante', '');

    if (error) {
      console.error('[SUPABASE] Error al vaciar bd_padron:', error.message);
    } else {
      console.log('[SUPABASE] Padrón electoral eliminado masivamente.');
    }
  } catch (err) {
    console.error('[SUPABASE] Excepción en clearPadronStoreAsync:', err);
  }
}


// ===========================================================================
// FUNCIONES ASÍNCRONAS CON PERSISTENCIA EN SUPABASE (bd_padron)
// ===========================================================================

function mapRowToPadronRecord(item: Record<string, unknown>): PadronRecord {
  return {
    id: String(item.id ?? ''),
    rutVotante: String(item.rut_votante ?? ''),
    formattedRutVotante: String(item.formatted_rut_votante ?? item.rut_votante ?? ''),
    rutEstudianteAsociado: item.rut_estudiante_asociado ? String(item.rut_estudiante_asociado) : null,
    formattedRutEstudiante: item.formatted_rut_estudiante ? String(item.formatted_rut_estudiante) : null,
    nombreCompleto: String(item.nombre_completo ?? ''),
    estamento: String(item.estamento ?? '') as EstamentoDecreto102,
    rbdEstablecimiento: String(item.rbd_establecimiento ?? ''),
    nombreEstablecimiento: String(item.nombre_establecimiento ?? ''),
    slepId: item.slep_id ? String(item.slep_id) : 'slep-principal',
    schoolId: item.school_id ? String(item.school_id) : String(item.rbd_establecimiento ?? ''),
    habilitado: Boolean(item.habilitado ?? true),
    haVotado: Boolean(item.ha_votado ?? false),
    fechaVoto: item.fecha_voto ? String(item.fecha_voto) : null,
    createdAt: String(item.created_at ?? new Date().toISOString()),
  };
}

/**
 * Obtiene la lista completa de todos los establecimientos únicos desde:
 * 1. bd_establecimientos_maestro (131 colegios oficiales - fuente de verdad)
 * 2. bd_padron via DISTINCT rbd_establecimiento (complementa colegios no en maestro)
 */
export async function getAllSchoolsAsync(): Promise<SchoolFilterOption[]> {
  const map = new Map<string, string>();

  if (!supabaseAdmin) {
    // Fallback solo en memoria local
    const localSchools = getAvailableSchools(padronStore);
    localSchools.forEach((s) => { if (s.rbd && s.nombre) map.set(s.rbd, s.nombre); });
    return Array.from(map.entries()).map(([rbd, nombre]) => ({ rbd, nombre }));
  }

  // 1. Catálogo Maestro / Vista Dashboard (fuente de verdad: 131 RBDs oficiales)
  try {
    const { data: viewData, error: viewErr } = await supabaseAdmin
      .from('vista_dashboard_escuelas')
      .select('rbd, nombre_oficial')
      .order('rbd', { ascending: true });

    if (!viewErr && viewData && viewData.length > 0) {
      viewData.forEach((s: Record<string, unknown>) => {
        const rbd = String(s.rbd || '').trim();
        const nombre = String(s.nombre_oficial || '').trim();
        if (rbd && nombre) map.set(rbd, nombre);
      });
    }
  } catch {
    // Continuar a catálogo maestro
  }

  if (map.size === 0) {
    try {
      const masterSchools = await getSchoolsMasterAsync();
      masterSchools.forEach((s) => {
        const rbd = String(s.rbd || '').trim();
        const nombre = String(s.nombreOficial || '').trim();
        if (rbd && nombre) map.set(rbd, nombre);
      });
    } catch (err) {
      console.error('[SUPABASE] Error obteniendo catálogo maestro en getAllSchoolsAsync:', err);
    }
  }

  // 2. Consulta DISTINCT a bd_padron para capturar RBDs no presentes en el maestro
  try {
    // Paginación por lotes de 1.000 (respetando el límite por defecto de PostgREST)
    const BATCH = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('bd_padron')
        .select('rbd_establecimiento, nombre_establecimiento')
        .not('rbd_establecimiento', 'is', null)
        .order('rbd_establecimiento', { ascending: true })
        .range(page * BATCH, (page + 1) * BATCH - 1);

      if (error || !data || data.length === 0) { hasMore = false; break; }

      data.forEach((item: Record<string, unknown>) => {
        const rbd = String(item.rbd_establecimiento || '').trim();
        const nombre = String(item.nombre_establecimiento || '').trim();
        // Solo agregar si no está ya en el mapa (el maestro tiene prioridad)
        if (rbd && nombre && !map.has(rbd)) map.set(rbd, nombre);
      });

      if (data.length < BATCH) { hasMore = false; } else { page++; }
    }
  } catch (err) {
    console.error('[SUPABASE] Error obteniendo establecimientos de bd_padron:', err);
  }

  // 3. Fallback en memoria local si todo falló
  if (map.size === 0) {
    const localSchools = getAvailableSchools(padronStore);
    localSchools.forEach((s) => { if (s.rbd && s.nombre) map.set(s.rbd, s.nombre); });
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([rbd, nombre]) => ({ rbd, nombre }));
}

/**
 * Obtiene la TOTALIDAD de los registros del padrón desde Supabase realizando paginación interna en lotes de 1.000 filas.
 * Esto evita la pérdida o truncamiento de registros por el límite max_rows por defecto de PostgREST / Supabase.
 */
export async function getAllPadronRecordsAsync({
  search = '',
  estamento = '',
  rbd = '',
  slepId = '',
}: {
  search?: string;
  estamento?: string;
  rbd?: string;
  slepId?: string;
} = {}): Promise<{
  records: PadronRecord[];
  total: number;
}> {
  if (!supabaseAdmin) {
    const local = getPadronRecords({ search, estamento, rbd });
    return { records: local.records, total: local.records.length };
  }

  try {
    const allRecords: PadronRecord[] = [];
    let page = 0;
    const BATCH_SIZE = 1000;
    let totalCount = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabaseAdmin
        .from('bd_padron')
        .select('*', { count: 'exact' })
        .order('nombre_completo', { ascending: true });

      if (slepId && slepId !== 'ALL') {
        query = query.eq('slep_id', slepId);
      }
      if (estamento && estamento !== 'ALL') {
        query = query.eq('estamento', estamento.toUpperCase());
      }
      if (rbd && rbd !== 'ALL') {
        query = query.eq('rbd_establecimiento', rbd);
      }
      if (search) {
        const q = search.trim();
        query = query.or(
          `rut_votante.ilike.%${q}%,nombre_completo.ilike.%${q}%,nombre_establecimiento.ilike.%${q}%`,
        );
      }

      const from = page * BATCH_SIZE;
      const to = from + BATCH_SIZE - 1;

      const { data, count, error } = await query.range(from, to);

      if (error || !data || data.length === 0) {
        if (page === 0) {
          if (error) console.error('[SUPABASE] Error en getAllPadronRecordsAsync:', error.message);
          const local = getPadronRecords({ search, estamento, rbd });
          return { records: local.records, total: local.records.length };
        }
        hasMore = false;
        break;
      }

      if (count !== null && count !== undefined) {
        totalCount = count;
      }

      const mapped = data.map((item) => mapRowToPadronRecord(item as Record<string, unknown>));
      allRecords.push(...mapped);

      if (data.length < BATCH_SIZE || (totalCount > 0 && allRecords.length >= totalCount)) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return {
      records: allRecords,
      total: totalCount || allRecords.length,
    };
  } catch (err) {
    console.error('[SUPABASE] Excepción en getAllPadronRecordsAsync:', err);
    const local = getPadronRecords({ search, estamento, rbd });
    return { records: local.records, total: local.records.length };
  }
}

/**
 * Obtener el padrón filtrado desde Supabase (o fallback en memoria)
 */
export async function getPadronRecordsAsync({
  search = '',
  estamento = '',
  rbd = '',
  slepId = '',
  page = 1,
  pageSize = 50,
}: {
  search?: string;
  estamento?: string;
  rbd?: string;
  slepId?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{
  records: PadronRecord[];
  total: number;
  totalPages: number;
  currentPage: number;
  quorums: QuorumEstamentoStatus[];
  schools: SchoolFilterOption[];
}> {
  try {
    let query = supabaseAdmin
      .from('bd_padron')
      .select('*', { count: 'exact' })
      .order('nombre_completo', { ascending: true });

    if (slepId && slepId !== 'ALL') {
      query = query.eq('slep_id', slepId);
    }
    if (estamento && estamento !== 'ALL') {
      query = query.eq('estamento', estamento.toUpperCase());
    }
    if (rbd && rbd !== 'ALL') {
      query = query.eq('rbd_establecimiento', rbd);
    }
    if (search) {
      const q = search.trim();
      query = query.or(
        `rut_votante.ilike.%${q}%,nombre_completo.ilike.%${q}%,nombre_establecimiento.ilike.%${q}%`,
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error('[SUPABASE] Error leyendo bd_padron:', error.message);
      const localData = getPadronRecords({ search, estamento, rbd });
      const totalLocal = localData.records.length;
      const slicedLocal = localData.records.slice(from, from + pageSize);
      return {
        records: slicedLocal,
        total: totalLocal,
        totalPages: Math.ceil(totalLocal / pageSize) || 1,
        currentPage: page,
        quorums: localData.quorums,
        schools: localData.schools,
      };
    }

    const records = (data || []).map((item) => mapRowToPadronRecord(item as Record<string, unknown>));
    const total = count ?? records.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const allSchools = await getAllSchoolsAsync();

    // Obtener los registros necesarios para el cálculo exacto de quórums a nivel de padrón
    const { records: quorumRecords } = await getAllPadronRecordsAsync({ search, estamento, rbd, slepId });

    return {
      records,
      total,
      totalPages,
      currentPage: page,
      quorums: calculateEstamentoQuorums(quorumRecords.length > 0 ? quorumRecords : records),
      schools: allSchools,
    };
  } catch (err) {
    console.error('[SUPABASE] Excepción al consultar bd_padron:', err);
    const localData = getPadronRecords({ search, estamento, rbd });
    return {
      records: localData.records.slice(0, pageSize),
      total: localData.records.length,
      totalPages: Math.ceil(localData.records.length / pageSize) || 1,
      currentPage: page,
      quorums: localData.quorums,
      schools: localData.schools,
    };
  }
}

/**
 * Busca específicamente en Supabase bd_padron todos los registros asociados a un RUN Apoderado
 */
export async function findApoderadoRecordsAsync(rutApoderado: string): Promise<PadronRecord[]> {
  const clean = rutApoderado.replace(/[^0-9kK]/g, '').toUpperCase();
  const digits = clean.replace(/[^0-9]/g, '');

  if (!supabaseAdmin || !digits) {
    return getPadronRecords().records.filter(
      (r) => r.estamento === 'PADRES_APODERADOS' && r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('bd_padron')
      .select('*')
      .eq('estamento', 'PADRES_APODERADOS')
      .or(`rut_votante.ilike.%${digits}%,formatted_rut_votante.ilike.%${digits}%`);

    if (error || !data || data.length === 0) {
      return getPadronRecords().records.filter(
        (r) => r.estamento === 'PADRES_APODERADOS' && r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
      );
    }

    const records = data.map((item) => mapRowToPadronRecord(item as Record<string, unknown>));
    return records.filter((r) => r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean);
  } catch (err) {
    console.error('[SUPABASE] Excepción al buscar registros de apoderado:', err);
    return getPadronRecords().records.filter(
      (r) => r.estamento === 'PADRES_APODERADOS' && r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
    );
  }
}

/**
 * Busca específicamente en Supabase bd_padron el registro de un funcionario (Docente/Asistente/Directivo) por su RUN
 */
export async function findFuncionarioRecordAsync(rutFuncionario: string): Promise<PadronRecord | null> {
  const clean = rutFuncionario.replace(/[^0-9kK]/g, '').toUpperCase();
  const digits = clean.replace(/[^0-9]/g, '');

  if (!supabaseAdmin || !digits) {
    return (
      getPadronRecords().records.find(
        (r) =>
          ['DOCENTES', 'ASISTENTES', 'DIRECTIVOS'].includes(r.estamento) &&
          r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
      ) ?? null
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('bd_padron')
      .select('*')
      .in('estamento', ['DOCENTES', 'ASISTENTES', 'DIRECTIVOS'])
      .or(`rut_votante.ilike.%${digits}%,formatted_rut_votante.ilike.%${digits}%`);

    if (error || !data || data.length === 0) {
      return (
        getPadronRecords().records.find(
          (r) =>
            ['DOCENTES', 'ASISTENTES', 'DIRECTIVOS'].includes(r.estamento) &&
            r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
        ) ?? null
      );
    }

    const records = data.map((item) => mapRowToPadronRecord(item as Record<string, unknown>));
    return records.find((r) => r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean) ?? null;
  } catch (err) {
    console.error('[SUPABASE] Excepción al buscar registro de funcionario:', err);
    return (
      getPadronRecords().records.find(
        (r) =>
          ['DOCENTES', 'ASISTENTES', 'DIRECTIVOS'].includes(r.estamento) &&
          r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
      ) ?? null
    );
  }
}

/**
 * Agregar un votante al padrón en Supabase y en memoria
 */
export async function addSingleVoterAsync(data: {
  rutVotante: string;
  rutEstudianteAsociado?: string;
  nombreCompleto: string;
  estamento: EstamentoDecreto102;
  rbdEstablecimiento: string;
  nombreEstablecimiento: string;
}): Promise<PadronRecord> {
  // Primero validar con la función síncrona (que maneja validación RUT, duplicados, etc.)
  const localRecord = addSingleVoter(data);

  // Luego persistir en Supabase
  try {
    const { error } = await supabaseAdmin.from('bd_padron').insert({
      rut_votante: localRecord.rutVotante,
      formatted_rut_votante: localRecord.formattedRutVotante,
      rut_estudiante_asociado: localRecord.rutEstudianteAsociado,
      formatted_rut_estudiante: localRecord.formattedRutEstudiante,
      nombre_completo: localRecord.nombreCompleto,
      estamento: localRecord.estamento,
      rbd_establecimiento: localRecord.rbdEstablecimiento,
      nombre_establecimiento: localRecord.nombreEstablecimiento,
      habilitado: true,
      ha_votado: false,
      fecha_voto: null,
      created_at: localRecord.createdAt,
    });

    if (error) {
      console.error('[SUPABASE] Error insertando en bd_padron:', error.message);
    } else {
      console.log('[SUPABASE] Votante insertado en bd_padron:', localRecord.rutVotante);
    }
  } catch (err) {
    console.error('[SUPABASE] Excepción al insertar votante:', err);
  }

  return localRecord;
}

/**
 * Habilitar/inhabilitar votante en Supabase y en memoria
 */
export async function toggleVoterHabilitadoAsync(id: string): Promise<PadronRecord> {
  const local = toggleVoterHabilitado(id);

  try {
    const { error } = await supabaseAdmin
      .from('bd_padron')
      .update({ habilitado: local.habilitado })
      .eq('rut_votante', local.rutVotante);

    if (error) {
      console.error('[SUPABASE] Error actualizando habilitado en bd_padron:', error.message);
    }
  } catch (err) {
    console.error('[SUPABASE] Excepción al actualizar habilitado:', err);
  }

  return local;
}

/**
 * Eliminar votante en Supabase y en memoria
 */
export async function deleteVoterRecordAsync(id: string): Promise<boolean> {
  const cleanId = (id || '').trim();
  if (!cleanId) return false;

  // 1. Eliminar directamente en Supabase si está disponible
  if (supabaseAdmin) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

      let deleteError = null;
      if (isUuid) {
        // Si el id es UUID, intentar borrar por id primero
        const { error } = await supabaseAdmin
          .from('bd_padron')
          .delete()
          .eq('id', cleanId);
        deleteError = error;
      } else {
        // Si no es UUID (ej. es un RUT), borrar por rut_votante o formatted_rut_votante
        const { error } = await supabaseAdmin
          .from('bd_padron')
          .delete()
          .or(`rut_votante.eq.${cleanId},formatted_rut_votante.eq.${cleanId}`);
        deleteError = error;
      }

      if (deleteError) {
        console.warn('[SUPABASE] Intento principal falló, probando eliminación or(id,rut_votante):', deleteError.message);
        const { error: fallbackError } = await supabaseAdmin
          .from('bd_padron')
          .delete()
          .or(`id.eq.${cleanId},rut_votante.eq.${cleanId}`);

        if (fallbackError) {
          console.error('[SUPABASE] Error eliminando de bd_padron:', fallbackError.message);
          throw new Error(`Error al eliminar registro en Supabase: ${fallbackError.message}`);
        }
      }

      console.log('[SUPABASE] Registro de votante procesado para eliminación en bd_padron:', cleanId);
    } catch (err) {
      console.error('[SUPABASE] Excepción al eliminar votante:', err);
      if (err instanceof Error && err.message.includes('Supabase')) {
        throw err;
      }
    }
  }

  // 2. Eliminar de la memoria local si existía en la instancia actual
  deleteVoterRecord(cleanId);

  return true;
}

/**
 * Carga masiva de Excel con persistencia en Supabase
 */
export async function processPadronExcelBufferAsync(buffer: Buffer): Promise<ExcelProcessingResult> {
  const masterMap = await getSchoolsMasterMapAsync();
  const result = processPadronExcelBuffer(buffer, masterMap);

  // Sincronizar los registros nuevos a Supabase en lotes
  if (result.registrosInsertados > 0) {
    const newRecords = padronStore.slice(padronStore.length - result.registrosInsertados);
    const rows = newRecords.map((r) => ({
      rut_votante: r.rutVotante,
      formatted_rut_votante: r.formattedRutVotante,
      rut_estudiante_asociado: r.rutEstudianteAsociado,
      formatted_rut_estudiante: r.formattedRutEstudiante,
      nombre_completo: r.nombreCompleto,
      estamento: r.estamento,
      rbd_establecimiento: r.rbdEstablecimiento,
      nombre_establecimiento: r.nombreEstablecimiento,
      habilitado: r.habilitado,
      ha_votado: r.haVotado,
      fecha_voto: r.fechaVoto,
      created_at: r.createdAt,
    }));

    try {
      const BATCH_SIZE = 500;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabaseAdmin
          .from('bd_padron')
          .insert(batch);

        if (error) {
          console.error(`[SUPABASE] Error en carga masiva Excel a bd_padron (Lote ${Math.floor(i / BATCH_SIZE) + 1}):`, error.message);
        } else {
          console.log(`[SUPABASE] Lote de ${batch.length} registros cargados en bd_padron (${i + batch.length}/${result.registrosInsertados}).`);
        }
      }
    } catch (err) {
      console.error('[SUPABASE] Excepción en carga masiva:', err);
    }
  }

  return result;
}
