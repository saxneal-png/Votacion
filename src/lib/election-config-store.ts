/**
 * Módulo de Configuración del Proceso Electoral y Programación Horaria
 * 
 * Permite seleccionar qué estamentos participan en el sufragio (Decreto N° 102)
 * y definir la ventana horaria oficial (Inicio y Fin) en horario de Chile Continental.
 */

import { supabaseAdmin } from '@/lib/supabase-client';
import { formatChileDateTime } from '@/lib/chile-time';

export type EstamentoCodigo =
  | 'ESTUDIANTES'
  | 'PADRES_APODERADOS'
  | 'DOCENTES'
  | 'ASISTENTES'
  | 'DIRECTIVOS';

export type EstadoEleccion = 'PROGRAMADA' | 'ABIERTA' | 'PAUSADA' | 'FINALIZADA';

export interface ElectionConfig {
  id?: string;
  tituloProceso: string;
  nombreInstitucion?: string;
  logoUrl?: string;
  bgImageUrl?: string;
  estamentosHabilitados: EstamentoCodigo[];
  fechaInicio: string; // ISO string
  fechaFin: string;    // ISO string
  estadoEleccion: EstadoEleccion;
  updatedAt?: string;
}

export interface ElectionStatusCheck {
  canVote: boolean;
  reason?: string;
  status: 'UPCOMING' | 'OPEN' | 'ENDED' | 'PAUSED' | 'ESTAMENTO_DISABLED';
  fechaInicioFormatted: string;
  fechaFinFormatted: string;
  estamentosHabilitados: EstamentoCodigo[];
}

const DEFAULT_CONFIG: ElectionConfig = {
  id: 'config_principal',
  tituloProceso: 'Elección de Representantes del Consejo Local SLEP',
  nombreInstitucion: 'Servicio Local de Educación Pública Valle Diguillín',
  logoUrl: '',
  bgImageUrl: '',
  estamentosHabilitados: [
    'ESTUDIANTES',
    'PADRES_APODERADOS',
    'DOCENTES',
    'ASISTENTES',
    'DIRECTIVOS',
  ],
  fechaInicio: '2026-08-01T00:00:00.000Z',
  fechaFin: '2026-12-31T23:59:59.000Z',
  estadoEleccion: 'ABIERTA',
  updatedAt: new Date().toISOString(),
};

declare global {
  // eslint-disable-next-line no-var
  var __electionConfigStore: ElectionConfig | undefined;
}

let electionConfigStore: ElectionConfig =
  globalThis.__electionConfigStore ?? (globalThis.__electionConfigStore = { ...DEFAULT_CONFIG });

/**
 * Obtiene la configuración electoral actual desde Supabase o memoria
 */
export async function getElectionConfigAsync(): Promise<ElectionConfig> {
  if (!supabaseAdmin) {
    return { ...electionConfigStore };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('bd_configuracion_eleccion')
      .select('*')
      .eq('id', 'config_principal')
      .maybeSingle();

    if (error || !data) {
      return { ...electionConfigStore };
    }

    let parsedEstamentos: EstamentoCodigo[] = DEFAULT_CONFIG.estamentosHabilitados;
    if (Array.isArray(data.estamentos_habilitados)) {
      parsedEstamentos = data.estamentos_habilitados as EstamentoCodigo[];
    } else if (typeof data.estamentos_habilitados === 'string') {
      try {
        parsedEstamentos = JSON.parse(data.estamentos_habilitados);
      } catch {
        parsedEstamentos = DEFAULT_CONFIG.estamentosHabilitados;
      }
    }

    const fetched: ElectionConfig = {
      id: 'config_principal',
      tituloProceso: String(data.titulo_proceso ?? DEFAULT_CONFIG.tituloProceso),
      nombreInstitucion:
        data.nombre_institucion !== undefined && data.nombre_institucion !== null
          ? String(data.nombre_institucion)
          : (electionConfigStore.nombreInstitucion ?? DEFAULT_CONFIG.nombreInstitucion ?? ''),
      logoUrl:
        data.logo_url !== undefined && data.logo_url !== null
          ? String(data.logo_url)
          : (electionConfigStore.logoUrl ?? DEFAULT_CONFIG.logoUrl ?? ''),
      bgImageUrl:
        data.bg_image_url !== undefined && data.bg_image_url !== null
          ? String(data.bg_image_url)
          : (electionConfigStore.bgImageUrl ?? DEFAULT_CONFIG.bgImageUrl ?? ''),
      estamentosHabilitados: parsedEstamentos,
      fechaInicio: String(data.fecha_inicio ?? DEFAULT_CONFIG.fechaInicio),
      fechaFin: String(data.fecha_fin ?? DEFAULT_CONFIG.fechaFin),
      estadoEleccion: (data.estado_eleccion as EstadoEleccion) || DEFAULT_CONFIG.estadoEleccion,
      updatedAt: String(data.updated_at ?? new Date().toISOString()),
    };

    electionConfigStore = fetched;
    globalThis.__electionConfigStore = fetched;
    return fetched;
  } catch (err) {
    console.error('[SUPABASE] Excepción al obtener bd_configuracion_eleccion:', err);
    return { ...electionConfigStore };
  }
}

export async function saveElectionConfigAsync(config: Partial<ElectionConfig>): Promise<ElectionConfig> {
  const current = { ...electionConfigStore };

  const updated: ElectionConfig = {
    ...current,
    ...config,
    id: 'config_principal',
    updatedAt: new Date().toISOString(),
  };

  electionConfigStore = updated;
  globalThis.__electionConfigStore = updated;

  if (supabaseAdmin) {
    try {
      const payload: Record<string, any> = {
        id: 'config_principal',
        titulo_proceso: updated.tituloProceso,
        estamentos_habilitados: updated.estamentosHabilitados,
        fecha_inicio: updated.fechaInicio,
        fecha_fin: updated.fechaFin,
        estado_eleccion: updated.estadoEleccion,
        updated_at: updated.updatedAt,
      };

      if (updated.nombreInstitucion !== undefined) payload.nombre_institucion = updated.nombreInstitucion;
      if (updated.logoUrl !== undefined) payload.logo_url = updated.logoUrl;
      if (updated.bgImageUrl !== undefined) payload.bg_image_url = updated.bgImageUrl;

      const { error } = await supabaseAdmin
        .from('bd_configuracion_eleccion')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('[SUPABASE] Error al guardar bd_configuracion_eleccion:', error.message);
        if (
          error.message.includes('nombre_institucion') ||
          error.message.includes('logo_url') ||
          error.message.includes('bg_image_url') ||
          error.message.includes('column') ||
          error.message.includes('schema cache') ||
          error.message.includes('Could not find')
        ) {
          delete payload.nombre_institucion;
          delete payload.logo_url;
          delete payload.bg_image_url;
          const { error: fallbackErr } = await supabaseAdmin
            .from('bd_configuracion_eleccion')
            .upsert(payload, { onConflict: 'id' });
          if (!fallbackErr) {
            console.log('[SUPABASE] Configuración electoral guardada en modo de compatibilidad legada.');
          }
        }
      } else {
        console.log('[SUPABASE] Configuración electoral guardada en Supabase.');
      }
    } catch (err) {
      console.error('[SUPABASE] Excepción al guardar bd_configuracion_eleccion:', err);
    }
  }

  return updated;
}

/**
 * Valida la ventana de votación y la participación del estamento del votante
 */
export async function checkVotingWindowStatusAsync(
  voterEstamento?: string
): Promise<ElectionStatusCheck> {
  const config = await getElectionConfigAsync();
  const now = new Date();
  const start = new Date(config.fechaInicio);
  const end = new Date(config.fechaFin);

  const fechaInicioFormatted = formatChileDateTime(config.fechaInicio);
  const fechaFinFormatted = formatChileDateTime(config.fechaFin);

  if (config.estadoEleccion === 'PAUSADA') {
    return {
      canVote: false,
      reason: 'El proceso electoral se encuentra pausado temporalmente por la comisión electoral.',
      status: 'PAUSED',
      fechaInicioFormatted,
      fechaFinFormatted,
      estamentosHabilitados: config.estamentosHabilitados,
    };
  }

  if (config.estadoEleccion === 'FINALIZADA' || now > end) {
    return {
      canVote: false,
      reason: `El período de votación ha finalizado oficialmente (${fechaFinFormatted}).`,
      status: 'ENDED',
      fechaInicioFormatted,
      fechaFinFormatted,
      estamentosHabilitados: config.estamentosHabilitados,
    };
  }

  if (now < start) {
    return {
      canVote: false,
      reason: `La votación aún no ha comenzado. Período de votación programado: del ${fechaInicioFormatted} al ${fechaFinFormatted}.`,
      status: 'UPCOMING',
      fechaInicioFormatted,
      fechaFinFormatted,
      estamentosHabilitados: config.estamentosHabilitados,
    };
  }

  // Si se pasa el estamento del votante, verificar que esté habilitado en este proceso
  if (voterEstamento) {
    const estUpper = voterEstamento.toUpperCase().trim();

    let matchesEstamento = false;
    for (const enabledEst of config.estamentosHabilitados) {
      const enabledStr = String(enabledEst);
      if (estUpper.includes(enabledStr) || enabledStr.includes(estUpper)) {
        matchesEstamento = true;
        break;
      }
      if (estUpper.includes('APODERADO') && enabledStr.includes('APODERADO')) {
        matchesEstamento = true;
        break;
      }
    }

    if (!matchesEstamento) {
      return {
        canVote: false,
        reason: `El estamento "${voterEstamento}" no fue seleccionado para votar en este proceso electoral específico.`,
        status: 'ESTAMENTO_DISABLED',
        fechaInicioFormatted,
        fechaFinFormatted,
        estamentosHabilitados: config.estamentosHabilitados,
      };
    }
  }

  return {
    canVote: true,
    status: 'OPEN',
    fechaInicioFormatted,
    fechaFinFormatted,
    estamentosHabilitados: config.estamentosHabilitados,
  };
}
