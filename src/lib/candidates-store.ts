import type { Candidate, Estamento } from '@/types';
import { supabaseAdmin } from '@/lib/supabase-client';

async function revalidateCandidatesCache() {
  if (typeof window === 'undefined') {
    try {
      const { revalidateTag } = await import('next/cache');
      revalidateTag('candidates');
    } catch (err) {
      // Se ignora silenciosamente fuera del contexto HTTP de Next.js (ej. Vitest)
    }
  }
}

export interface CandidateFormData {
  id?: string;
  nombreCompleto: string;
  estamento: Estamento;
  biografia?: string;
  propuestaPrincipal: string;
  escuelaEstablecimiento: string;
  rbd?: string;
  fotoPerfil?: string;
  numero?: number | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __candidatesStore: Candidate[] | undefined;
}

const candidatesStore: Candidate[] =
  globalThis.__candidatesStore ?? (globalThis.__candidatesStore = []);

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (fullName.substring(0, 2) || 'CA').toUpperCase();
}

export function getRandomAccentColor(estamento: Estamento): string {
  const palette: Record<Estamento, string[]> = {
    directivos: ['#1a4a7a', '#4a1a5a', '#1a5a3a', '#1e3a8a'],
    docentes: ['#8c4f2f', '#2b5f7e', '#b45309', '#047857'],
    asistentes: ['#6f3b89', '#366d48', '#6b21a8', '#0f766e'],
    apoderados: ['#b05d25', '#20635b', '#c2410c', '#15803d'],
    estudiantes: ['#0284c7', '#2563eb', '#7c3aed', '#0d9488'],
  };
  const colors = palette[estamento] || palette.docentes;
  return colors[Math.floor(Math.random() * colors.length)];
}

export function getEstamentoVariants(estamento: string): string[] {
  const clean = (estamento || '').toLowerCase().trim();
  if (clean === 'apoderados' || clean === 'padres_apoderados' || clean === 'padres y apoderados') {
    return ['apoderados', 'PADRES_APODERADOS', 'padres_apoderados', 'PADRES Y APODERADOS'];
  }
  if (clean === 'docentes' || clean === 'docente') {
    return ['docentes', 'DOCENTES', 'docente'];
  }
  if (clean === 'asistentes' || clean === 'asistente') {
    return ['asistentes', 'ASISTENTES', 'asistente'];
  }
  if (clean === 'directivos' || clean === 'directivo') {
    return ['directivos', 'DIRECTIVOS', 'directivo'];
  }
  if (clean === 'estudiantes' || clean === 'estudiante') {
    return ['estudiantes', 'ESTUDIANTES', 'estudiante'];
  }
  return [estamento, estamento.toLowerCase(), estamento.toUpperCase()];
}

export function sortCandidates(list: Candidate[]): Candidate[] {
  return [...list].sort((a, b) => {
    const numA = a.numero ?? Number.MAX_SAFE_INTEGER;
    const numB = b.numero ?? Number.MAX_SAFE_INTEGER;
    if (numA !== numB) return numA - numB;
    return (a.nombreCompleto || a.name || '').localeCompare(b.nombreCompleto || b.name || '');
  });
}

/**
 * Obtener todos los candidatos con filtros opcionales
 */
export function getCandidatos({
  estamento = '',
  search = '',
}: {
  estamento?: string;
  search?: string;
} = {}): Candidate[] {
  let filtered = [...candidatesStore];

  if (estamento && estamento !== 'ALL') {
    const variants = getEstamentoVariants(estamento).map((v) => v.toLowerCase());
    filtered = filtered.filter((c) => variants.includes(c.estamento.toLowerCase()));
  }

  if (search) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (c) =>
        (c.nombreCompleto || c.name).toLowerCase().includes(q) ||
        (c.escuelaEstablecimiento || c.role).toLowerCase().includes(q) ||
        (c.rbd || '').toLowerCase().includes(q) ||
        (c.slogan || '').toLowerCase().includes(q) ||
        (c.propuestaPrincipal || '').toLowerCase().includes(q),
    );
  }

  return sortCandidates(filtered);
}

/**
 * Obtener un candidato por ID
 */
export function getCandidatoById(id: string): Candidate | undefined {
  return candidatesStore.find((c) => c.id === id);
}

/**
 * Obtener un candidato por ID (asíncrono desde Supabase con fallback en memoria)
 */
export async function getCandidatoByIdAsync(id: string): Promise<Candidate | undefined> {
  if (!id) return undefined;

  try {
    const { data, error } = await supabaseAdmin
      .from('candidatos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      return mapRowToCandidate(data as Record<string, unknown>);
    }
  } catch (err) {
    console.error('[SUPABASE] Excepción al buscar candidato por ID:', err);
  }

  // Sin datos en Supabase → undefined
  return undefined;
}

/**
 * Crear un nuevo candidato
 */
export function addCandidato(data: CandidateFormData): Candidate {
  if (!data.nombreCompleto || !data.estamento || !data.propuestaPrincipal || !data.escuelaEstablecimiento) {
    throw new Error('Todos los campos principales del candidato son obligatorios.');
  }

  const id = data.id || `cand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const initials = getInitials(data.nombreCompleto);
  const accentColor = getRandomAccentColor(data.estamento);

  const newCandidate: Candidate = {
    id,
    name: data.nombreCompleto.trim(),
    nombreCompleto: data.nombreCompleto.trim(),
    role: data.escuelaEstablecimiento.trim(),
    slogan: data.propuestaPrincipal.trim(),
    initials,
    accentColor,
    estamento: data.estamento,
    numero: data.numero != null && !Number.isNaN(Number(data.numero)) ? Number(data.numero) : undefined,
    biografia: data.biografia ? data.biografia.trim() : '',
    propuestaPrincipal: data.propuestaPrincipal.trim(),
    escuelaEstablecimiento: data.escuelaEstablecimiento.trim(),
    rbd: data.rbd?.trim() || undefined,
    fotoPerfil: data.fotoPerfil?.trim() || undefined,
  };

  const existingIndex = candidatesStore.findIndex((c) => c.id === id);
  if (existingIndex >= 0) {
    candidatesStore[existingIndex] = newCandidate;
  } else {
    candidatesStore.unshift(newCandidate);
  }

  return newCandidate;
}

/**
 * Actualizar un candidato existente
 */
export function updateCandidato(id: string, data: Partial<CandidateFormData>): Candidate {
  const index = candidatesStore.findIndex((c) => c.id === id);
  if (index === -1) {
    throw new Error('Candidato no encontrado.');
  }

  const existing = candidatesStore[index];
  const updatedName = data.nombreCompleto ? data.nombreCompleto.trim() : existing.nombreCompleto || existing.name;
  const updatedSchool = data.escuelaEstablecimiento ? data.escuelaEstablecimiento.trim() : existing.escuelaEstablecimiento || existing.role;
  const updatedPropuesta = data.propuestaPrincipal ? data.propuestaPrincipal.trim() : existing.propuestaPrincipal || existing.slogan;
  const updatedEstamento = data.estamento || existing.estamento;
  const updatedRbd = data.rbd !== undefined ? (data.rbd?.trim() || undefined) : existing.rbd;
  const updatedNumero = data.numero !== undefined
    ? (data.numero != null && !Number.isNaN(Number(data.numero)) ? Number(data.numero) : undefined)
    : existing.numero;

  const updatedCandidate: Candidate = {
    ...existing,
    name: updatedName,
    nombreCompleto: updatedName,
    role: updatedSchool,
    slogan: updatedPropuesta,
    initials: getInitials(updatedName),
    estamento: updatedEstamento,
    numero: updatedNumero,
    rbd: updatedRbd,
    biografia: data.biografia !== undefined ? data.biografia.trim() : existing.biografia,
    propuestaPrincipal: updatedPropuesta,
    escuelaEstablecimiento: updatedSchool,
    fotoPerfil: data.fotoPerfil !== undefined ? data.fotoPerfil.trim() || undefined : existing.fotoPerfil,
  };

  candidatesStore[index] = updatedCandidate;
  return updatedCandidate;
}

/**
 * Eliminar un candidato
 */
export function deleteCandidato(id: string): boolean {
  const index = candidatesStore.findIndex((c) => c.id === id);
  if (index === -1) {
    return false;
  }

  candidatesStore.splice(index, 1);
  return true;
}

// ===========================================================================
// FUNCIONES ASÍNCRONAS CON PERSISTENCIA EN SUPABASE (candidatos)
// ===========================================================================

function mapRowToCandidate(item: Record<string, unknown>): Candidate {
  const rawNum = item.numero ?? item.numero_sorteo;
  const parsedNum = rawNum !== undefined && rawNum !== null && rawNum !== '' ? Number(rawNum) : undefined;
  return {
    id: String(item.id ?? ''),
    name: String(item.nombre_completo ?? ''),
    nombreCompleto: String(item.nombre_completo ?? ''),
    role: String(item.cargo_role ?? ''),
    slogan: String(item.slogan_propuesta ?? ''),
    initials: String(item.iniciales ?? ''),
    accentColor: String(item.color_acento ?? '#0b5294'),
    estamento: String(item.estamento ?? '') as Estamento,
    numero: parsedNum !== undefined && !Number.isNaN(parsedNum) ? parsedNum : undefined,
    biografia: String(item.biografia ?? ''),
    propuestaPrincipal: String(item.slogan_propuesta ?? ''),
    escuelaEstablecimiento: String(item.cargo_role ?? ''),
    rbd: item.rbd ? String(item.rbd) : undefined,
    fotoPerfil: item.foto_perfil ? String(item.foto_perfil) : undefined,
  };
}

/**
 * Consulta cacheada con Next.js unstable_cache (ISR de baja latencia)
 */
async function fetchCandidatesFromSupabase() {
  const { data, error } = await supabaseAdmin
    .from('candidatos')
    .select('*')
    .order('created_at', { ascending: true });

  if (error || !data) {
    return null;
  }
  return data;
}

/**
 * Obtener candidatos desde Supabase con caché ISR de Next.js y fallback en memoria
 */
export async function getCandidatosAsync({
  estamento = '',
  search = '',
}: {
  estamento?: string;
  search?: string;
} = {}): Promise<Candidate[]> {
  try {
    let rawData: Record<string, unknown>[] | null = null;

    if (typeof window === 'undefined') {
      try {
        const { unstable_cache } = await import('next/cache');
        const cachedFn = unstable_cache(
          fetchCandidatesFromSupabase,
          ['candidates-store-list-v1'],
          { revalidate: 300, tags: ['candidates'] },
        );
        rawData = await cachedFn();
      } catch {
        rawData = await fetchCandidatesFromSupabase();
      }
    } else {
      rawData = await fetchCandidatesFromSupabase();
    }

    if (!rawData || rawData.length === 0) {
      // Sin datos en Supabase → retornar lista local
      return getCandidatos({ estamento, search });
    }

    let results = rawData.map((item) => mapRowToCandidate(item as Record<string, unknown>));

    if (estamento && estamento !== 'ALL') {
      const variants = getEstamentoVariants(estamento).map((v) => v.toLowerCase());
      results = results.filter((c) => variants.includes(c.estamento.toLowerCase()));
    }

    if (search) {
      const q = search.toLowerCase().trim();
      results = results.filter(
        (c) =>
          (c.nombreCompleto || c.name).toLowerCase().includes(q) ||
          (c.escuelaEstablecimiento || c.role).toLowerCase().includes(q) ||
          (c.rbd || '').toLowerCase().includes(q) ||
          (c.slogan || '').toLowerCase().includes(q),
      );
    }

    return sortCandidates(results);
  } catch (err) {
    console.error('[SUPABASE] Excepción al consultar candidatos:', err);
    return getCandidatos({ estamento, search });
  }
}

/**
 * Crear candidato en Supabase y en memoria
 */
export async function addCandidatoAsync(data: CandidateFormData): Promise<Candidate> {
  const local = addCandidato(data);

  if (supabaseAdmin) {
    try {
      const insertPayload: Record<string, unknown> = {
        id: local.id,
        nombre_completo: local.nombreCompleto || local.name,
        cargo_role: local.escuelaEstablecimiento || local.role,
        slogan_propuesta: local.propuestaPrincipal || local.slogan,
        iniciales: local.initials,
        color_acento: local.accentColor,
        estamento: local.estamento,
        numero: local.numero ?? null,
        biografia: local.biografia || '',
        foto_perfil: local.fotoPerfil || null,
        votos_acumulados: 0,
        created_at: new Date().toISOString(),
      };

      if (local.rbd) {
        insertPayload.rbd = local.rbd;
      }

      let { error } = await supabaseAdmin.from('candidatos').insert(insertPayload);

      // Si falló porque la columna rbd no existe en el schema actual de supabase, reintentar sin rbd
      if (error && (error.message.includes('column "rbd"') || error.code === 'PGRST204')) {
        delete insertPayload.rbd;
        const retry = await supabaseAdmin.from('candidatos').insert(insertPayload);
        error = retry.error;
      }

      if (error) {
        console.error('[SUPABASE] Error insertando candidato:', error.message);
        deleteCandidato(local.id);
        throw new Error(`Error guardando candidato en Supabase: ${error.message}`);
      }

      console.log('[SUPABASE] Candidato insertado en Supabase:', local.id);
      revalidateCandidatesCache();
    } catch (err) {
      deleteCandidato(local.id);
      throw err;
    }
  }

  return local;
}

/**
 * Actualizar candidato en Supabase y en memoria
 */
export async function updateCandidatoAsync(id: string, data: Partial<CandidateFormData>): Promise<Candidate> {
  if (supabaseAdmin) {
    const updatePayload: Record<string, unknown> = {};
    if (data.nombreCompleto) updatePayload.nombre_completo = data.nombreCompleto.trim();
    if (data.escuelaEstablecimiento) updatePayload.cargo_role = data.escuelaEstablecimiento.trim();
    if (data.propuestaPrincipal) updatePayload.slogan_propuesta = data.propuestaPrincipal.trim();
    if (data.estamento) updatePayload.estamento = data.estamento;
    if (data.numero !== undefined) {
      updatePayload.numero = data.numero != null && !Number.isNaN(Number(data.numero)) ? Number(data.numero) : null;
    }
    if (data.biografia !== undefined) updatePayload.biografia = data.biografia.trim();
    if (data.fotoPerfil !== undefined) updatePayload.foto_perfil = data.fotoPerfil.trim() || null;
    if (data.rbd !== undefined) updatePayload.rbd = data.rbd?.trim() || null;

    let { error } = await supabaseAdmin
      .from('candidatos')
      .update(updatePayload)
      .eq('id', id);

    if (error && (error.message.includes('column "rbd"') || error.code === 'PGRST204')) {
      delete updatePayload.rbd;
      const retry = await supabaseAdmin.from('candidatos').update(updatePayload).eq('id', id);
      error = retry.error;
    }

    if (error) {
      console.error('[SUPABASE] Error actualizando candidato:', error.message);
      throw new Error(`Error actualizando candidato en Supabase: ${error.message}`);
    }

    console.log('[SUPABASE] Candidato actualizado en Supabase:', id);
    revalidateCandidatesCache();
  }

  return updateCandidato(id, data);
}

/**
 * Eliminar candidato en Supabase y en memoria con manejo estricto de FK constraints
 */
export async function deleteCandidatoAsync(id: string): Promise<boolean> {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('candidatos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SUPABASE] Error eliminando candidato:', error.message);
      if (
        error.code === '23503' ||
        error.message.toLowerCase().includes('foreign key') ||
        error.message.toLowerCase().includes('violates') ||
        error.message.toLowerCase().includes('constraint')
      ) {
        throw new Error(
          'No se puede eliminar el candidato porque ya cuenta con votos o registros asociados en la base de datos. Debes reiniciar el proceso electoral si deseas remover candidaturas.',
        );
      }
      throw new Error(`Error al eliminar candidato en Supabase: ${error.message}`);
    }
    console.log('[SUPABASE] Candidato procesado para eliminación en Supabase:', id);
  }

  // Eliminar de la memoria local si estaba presente
  deleteCandidato(id);

  // Revalidar caché de candidaturas
  revalidateCandidatesCache();

  return true;
}

/**
 * Vaciar la totalidad de los candidatos de Supabase y memoria
 */
export async function clearAllCandidatosAsync(): Promise<boolean> {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('candidatos')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('[SUPABASE] Error al vaciar candidatos:', error.message);
      if (
        error.code === '23503' ||
        error.message.toLowerCase().includes('foreign key') ||
        error.message.toLowerCase().includes('violates') ||
        error.message.toLowerCase().includes('constraint')
      ) {
        throw new Error(
          'No se pueden eliminar las candidaturas porque existen votos o registros de sufragio asociados en la base de datos. Realiza un reinicio de la elección primero.',
        );
      }
      throw new Error(`Error al vaciar candidatos en Supabase: ${error.message}`);
    }
  }

  candidatesStore.length = 0;
  revalidateCandidatesCache();
  return true;
}

export interface BulkImportResult {
  success: boolean;
  insertedCount: number;
  totalProvided: number;
  records: Candidate[];
  errors: string[];
}

/**
 * Ingesta o actualización masiva de candidaturas respetando todos sus campos (número, RBD, propuesta, biografía, foto, etc.)
 */
export async function bulkImportCandidatosAsync(
  candidatesData: CandidateFormData[],
  replaceMode = false,
): Promise<BulkImportResult> {
  if (!Array.isArray(candidatesData) || candidatesData.length === 0) {
    return {
      success: true,
      insertedCount: 0,
      totalProvided: 0,
      records: [],
      errors: ['No se proporcionaron registros de candidatos para importar.'],
    };
  }

  const errors: string[] = [];

  if (replaceMode) {
    try {
      await clearAllCandidatosAsync();
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? err.message
          : 'No fue posible vaciar las candidaturas previas para la importación.',
      );
    }
  }

  const processedCandidates: Candidate[] = [];
  const dbRowsToUpsert: Record<string, unknown>[] = [];

  for (const item of candidatesData) {
    try {
      const local = addCandidato({
        id: item.id,
        nombreCompleto: item.nombreCompleto,
        estamento: item.estamento,
        numero: item.numero,
        rbd: item.rbd,
        escuelaEstablecimiento: item.escuelaEstablecimiento,
        propuestaPrincipal: item.propuestaPrincipal,
        biografia: item.biografia || '',
        fotoPerfil: item.fotoPerfil,
      });

      processedCandidates.push(local);

      const dbRow: Record<string, unknown> = {
        id: local.id,
        nombre_completo: local.nombreCompleto || local.name,
        cargo_role: local.escuelaEstablecimiento || local.role,
        slogan_propuesta: local.propuestaPrincipal || local.slogan,
        iniciales: local.initials,
        color_acento: local.accentColor,
        estamento: local.estamento,
        numero: local.numero ?? null,
        biografia: local.biografia || '',
        foto_perfil: local.fotoPerfil || null,
        votos_acumulados: 0,
        created_at: new Date().toISOString(),
      };

      if (local.rbd) {
        dbRow.rbd = local.rbd;
      }

      dbRowsToUpsert.push(dbRow);
    } catch (err) {
      errors.push(`Error al procesar candidato "${item.nombreCompleto}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (supabaseAdmin && dbRowsToUpsert.length > 0) {
    try {
      let { error } = await supabaseAdmin.from('candidatos').upsert(dbRowsToUpsert, { onConflict: 'id' });

      if (error && (error.message.includes('column "rbd"') || error.code === 'PGRST204')) {
        const rowsWithoutRbd = dbRowsToUpsert.map((r) => {
          const clone = { ...r };
          delete clone.rbd;
          return clone;
        });
        const retry = await supabaseAdmin.from('candidatos').upsert(rowsWithoutRbd, { onConflict: 'id' });
        error = retry.error;
      }

      if (error) {
        console.error('[SUPABASE] Error en bulk upsert de candidatos:', error.message);
        errors.push(`Error en Supabase: ${error.message}`);
      }
    } catch (err) {
      console.error('[SUPABASE] Excepción en bulk import de candidatos:', err);
      errors.push(`Excepción en base de datos: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  revalidateCandidatesCache();

  return {
    success: errors.length === 0 || processedCandidates.length > 0,
    insertedCount: processedCandidates.length,
    totalProvided: candidatesData.length,
    records: processedCandidates,
    errors,
  };
}
