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
  // Campos de Soporte al Votante / Mesa de Ayuda
  habilitarSoporte?: boolean;
  telefonoSoporte?: string;
  whatsappSoporte?: string;
  mensajeWhatsappPlantilla?: string;
  emailSoporte?: string;
  horarioAtencionSoporte?: string;
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

export const DEFAULT_WHATSAPP_TEMPLATE =
  'Hola Mesa de Ayuda Electoral SLEP, tengo dificultades para ingresar a votar. Mi RUN es {RUT} y pertenezco al estamento {ESTAMENTO}. Solicito su asistencia.';

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
  habilitarSoporte: true,
  telefonoSoporte: '+56 42 220 0000',
  whatsappSoporte: '+56 9 1234 5678',
  mensajeWhatsappPlantilla: DEFAULT_WHATSAPP_TEMPLATE,
  emailSoporte: 'soporte.elecciones@eduvallediguillin.gob.cl',
  horarioAtencionSoporte: 'Lunes a Viernes de 08:30 a 17:30 hrs',
  updatedAt: new Date().toISOString(),
};

declare global {
  // eslint-disable-next-line no-var
  var __electionConfigStore: ElectionConfig | undefined;
}

let electionConfigStore: ElectionConfig =
  globalThis.__electionConfigStore ?? (globalThis.__electionConfigStore = { ...DEFAULT_CONFIG });

/**
 * Genera el enlace de WhatsApp con el mensaje personalizado y variables reemplazadas
 */
export function buildWhatsAppLink(
  whatsappNumber: string,
  template?: string,
  context?: { rut?: string; estamento?: string }
): string {
  const cleanNumber = String(whatsappNumber || '').replace(/[^0-9]/g, '');
  if (!cleanNumber) return '';

  let text = template || DEFAULT_WHATSAPP_TEMPLATE;
  const rutVal = context?.rut?.trim() || 'No especificado';
  const estVal = context?.estamento?.trim() || 'Votante';

  text = text.replace(/{RUT}/gi, rutVal);
  text = text.replace(/{ESTAMENTO}/gi, estVal);

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
}

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
      habilitarSoporte:
        data.habilitar_soporte !== undefined && data.habilitar_soporte !== null
          ? Boolean(data.habilitar_soporte)
          : (electionConfigStore.habilitarSoporte ?? DEFAULT_CONFIG.habilitarSoporte),
      telefonoSoporte:
        data.telefono_soporte !== undefined && data.telefono_soporte !== null
          ? String(data.telefono_soporte)
          : (electionConfigStore.telefonoSoporte ?? DEFAULT_CONFIG.telefonoSoporte),
      whatsappSoporte:
        data.whatsapp_soporte !== undefined && data.whatsapp_soporte !== null
          ? String(data.whatsapp_soporte)
          : (electionConfigStore.whatsappSoporte ?? DEFAULT_CONFIG.whatsappSoporte),
      mensajeWhatsappPlantilla:
        data.mensaje_whatsapp_plantilla !== undefined && data.mensaje_whatsapp_plantilla !== null
          ? String(data.mensaje_whatsapp_plantilla)
          : (electionConfigStore.mensajeWhatsappPlantilla ?? DEFAULT_CONFIG.mensajeWhatsappPlantilla),
      emailSoporte:
        data.email_soporte !== undefined && data.email_soporte !== null
          ? String(data.email_soporte)
          : (electionConfigStore.emailSoporte ?? DEFAULT_CONFIG.emailSoporte),
      horarioAtencionSoporte:
        data.horario_atencion_soporte !== undefined && data.horario_atencion_soporte !== null
          ? String(data.horario_atencion_soporte)
          : (electionConfigStore.horarioAtencionSoporte ?? DEFAULT_CONFIG.horarioAtencionSoporte),
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
      if (updated.habilitarSoporte !== undefined) payload.habilitar_soporte = updated.habilitarSoporte;
      if (updated.telefonoSoporte !== undefined) payload.telefono_soporte = updated.telefonoSoporte;
      if (updated.whatsappSoporte !== undefined) payload.whatsapp_soporte = updated.whatsappSoporte;
      if (updated.mensajeWhatsappPlantilla !== undefined) payload.mensaje_whatsapp_plantilla = updated.mensajeWhatsappPlantilla;
      if (updated.emailSoporte !== undefined) payload.email_soporte = updated.emailSoporte;
      if (updated.horarioAtencionSoporte !== undefined) payload.horario_atencion_soporte = updated.horarioAtencionSoporte;

      const { error } = await supabaseAdmin
        .from('bd_configuracion_eleccion')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('[SUPABASE] Error al guardar bd_configuracion_eleccion:', error.message);
        // Si fallan columnas que no existían previamente en Supabase, reintentar con las básicas
        const fallbackPayload: Record<string, any> = {
          id: 'config_principal',
          titulo_proceso: updated.tituloProceso,
          estamentos_habilitados: updated.estamentosHabilitados,
          fecha_inicio: updated.fechaInicio,
          fecha_fin: updated.fechaFin,
          estado_eleccion: updated.estadoEleccion,
          updated_at: updated.updatedAt,
        };
        const { error: fallbackErr } = await supabaseAdmin
          .from('bd_configuracion_eleccion')
          .upsert(fallbackPayload, { onConflict: 'id' });
        if (!fallbackErr) {
          console.log('[SUPABASE] Configuración electoral guardada en modo de compatibilidad legada.');
        }
      } else {
        console.log('[SUPABASE] Configuración electoral guardada en Supabase de forma permanente.');
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
