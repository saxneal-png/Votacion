/**
 * Módulo de Ingesta y Catálogo Maestro de Establecimientos Educacionales Oficiales (Base Teórica por RBD)
 * 
 * Permite cargar el padrón base de colegios del territorio con sus RBDs y nombres oficiales.
 * Al cargar el Padrón Electoral, este módulo autocorregirá automáticamente nombres con errores
 * de tipeo o faltas de ortografía basándose en el RBD oficial.
 */

import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase-client';

export interface SchoolMasterRecord {
  rbd: string;
  nombreOficial: string;
  comuna: string;
  createdAt?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __schoolsMasterStore: SchoolMasterRecord[] | undefined;
}

const schoolsMasterStore: SchoolMasterRecord[] =
  globalThis.__schoolsMasterStore ?? (globalThis.__schoolsMasterStore = []);

/**
 * Parsea un buffer de Excel/CSV de establecimientos educacionales oficiales (Base Teórica por RBD)
 */
export function parseSchoolsMasterExcelBuffer(buffer: Buffer): SchoolMasterRecord[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo Excel no contiene hojas de datos.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('La hoja de datos se encuentra vacía.');
  }

  const records: SchoolMasterRecord[] = [];
  const seenRbds = new Set<string>();

  rawRows.forEach((row) => {
    const normalizedKeys: Record<string, unknown> = {};
    Object.keys(row).forEach((k) => {
      const cleanKey = k.trim().toLowerCase();
      normalizedKeys[cleanKey] = row[k];
    });

    const rawRbd =
      normalizedKeys['rbd'] ??
      normalizedKeys['r.b.d.'] ??
      normalizedKeys['r.b.d'] ??
      '';

    const rawNombre =
      normalizedKeys['establecimientos'] ??
      normalizedKeys['establecimiento'] ??
      normalizedKeys['nombre_establecimiento'] ??
      normalizedKeys['nombre'] ??
      normalizedKeys['colegio'] ??
      '';

    const rawComuna =
      normalizedKeys['comuna'] ??
      normalizedKeys['ciudad'] ??
      '';

    const rbd = String(rawRbd).replace(/[^0-9]/g, '').trim();
    const nombreOficial = String(rawNombre).trim();
    const comuna = String(rawComuna).trim();

    if (rbd && nombreOficial && !seenRbds.has(rbd)) {
      seenRbds.add(rbd);
      records.push({
        rbd,
        nombreOficial,
        comuna,
        createdAt: new Date().toISOString(),
      });
    }
  });

  return records;
}

/**
 * Guarda o actualiza (upsert) la lista maestra de establecimientos en Supabase y en memoria local
 */
export async function upsertSchoolsMasterAsync(records: SchoolMasterRecord[]): Promise<number> {
  if (records.length === 0) return 0;

  // Actualizar en memoria local
  records.forEach((rec) => {
    const idx = schoolsMasterStore.findIndex((s) => s.rbd === rec.rbd);
    if (idx >= 0) {
      schoolsMasterStore[idx] = rec;
    } else {
      schoolsMasterStore.push(rec);
    }
  });

  if (!supabaseAdmin) {
    return records.length;
  }

  try {
    const rowsToUpsert = records.map((r) => ({
      rbd: r.rbd,
      nombre_oficial: r.nombreOficial,
      comuna: r.comuna || '',
    }));

    const BATCH_SIZE = 500;
    let count = 0;

    for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
      const batch = rowsToUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseAdmin
        .from('bd_establecimientos_maestro')
        .upsert(batch, { onConflict: 'rbd' });

      if (error) {
        console.error('[SUPABASE] Error upserting bd_establecimientos_maestro:', error.message);
      } else {
        count += batch.length;
      }
    }

    return count > 0 ? count : records.length;
  } catch (err) {
    console.error('[SUPABASE] Excepción upserting bd_establecimientos_maestro:', err);
    return records.length;
  }
}

/**
 * Obtiene la lista completa de establecimientos maestros registrados
 */
export async function getSchoolsMasterAsync(): Promise<SchoolMasterRecord[]> {
  if (!supabaseAdmin) {
    return [...schoolsMasterStore];
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('bd_establecimientos_maestro')
      .select('*')
      .order('rbd', { ascending: true });

    if (error || !data || data.length === 0) {
      return [...schoolsMasterStore];
    }

    return data.map((item: Record<string, unknown>) => ({
      rbd: String(item.rbd ?? ''),
      nombreOficial: String(item.nombre_oficial ?? ''),
      comuna: String(item.comuna ?? ''),
      createdAt: String(item.created_at ?? ''),
    }));
  } catch (err) {
    console.error('[SUPABASE] Excepción al obtener bd_establecimientos_maestro:', err);
    return [...schoolsMasterStore];
  }
}

/**
 * Retorna un Map (RBD -> SchoolMasterRecord) para autocorrección ultrarrápida durante la ingesta del padrón
 */
export async function getSchoolsMasterMapAsync(): Promise<Map<string, SchoolMasterRecord>> {
  const map = new Map<string, SchoolMasterRecord>();
  const records = await getSchoolsMasterAsync();

  records.forEach((r) => {
    if (r.rbd) {
      map.set(r.rbd, r);
    }
  });

  return map;
}
