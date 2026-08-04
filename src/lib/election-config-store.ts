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
      const { error } = await supabaseAdmin
        .from('bd_configuracion_eleccion')
        .upsert({
          id: 'config_principal',
          titulo_proceso: updated.tituloProceso,
          estamentos_habilitados: updated.estamentosHabilitados,
          fecha_inicio: updated.fechaInicio,
          fecha_fin: updated.fechaFin,
          estado_eleccion: updated.estadoEleccion,
          updated_at: updated.updatedAt,
        }, { onConflict: 'id' });

      if (error) {
        console.error('[SUPABASE] Error al guardar bd_configuracion_eleccion:', error.message);
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
