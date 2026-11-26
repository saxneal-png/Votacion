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
  // Campos de Plantilla de Correo OTP / Acreditación
  emailOtpSubject?: string;
  emailOtpHeaderTitle?: string;
  emailOtpHeaderSubtitle?: string;
  emailOtpGreeting?: string;
  emailOtpBodyText?: string;
  emailOtpShowCode?: boolean;
  emailOtpShowMagicLink?: boolean;
  emailOtpButtonText?: string;
  emailOtpFooterText?: string;
  // Campos de Personalización de Página de Ingreso
  loginTitle?: string;
  loginSubtitle?: string;
  loginShowInstructions?: boolean;
  loginInstructionsTitle?: string;
  loginStep1Title?: string;
  loginStep1Detail?: string;
  loginStep2Title?: string;
  loginStep2Detail?: string;
  loginStep3Title?: string;
  loginStep3Detail?: string;
  loginShowApoderadoMode?: boolean;
  loginShowFuncionarioMode?: boolean;
  loginApoderadoTabLabel?: string;
  loginFuncionarioTabLabel?: string;
  loginRutLabel?: string;
  loginStudentRutLabel?: string;
  loginEmailLabel?: string;
  loginEmailPlaceholder?: string;
  loginAllowedDomains?: string;
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

export const DEFAULT_OTP_EMAIL_CONFIG = {
  emailOtpSubject: 'Código de Verificación Electoral: {OTP} - {TITULO_PROCESO}',
  emailOtpHeaderTitle: '{NOMBRE_INSTITUCION}',
  emailOtpHeaderSubtitle: '{TITULO_PROCESO}',
  emailOtpGreeting: 'Estimado/a {NOMBRE_VOTANTE},',
  emailOtpBodyText:
    'Has solicitado acceder al proceso electoral "{TITULO_PROCESO}" en el estamento {ESTAMENTO}. Utiliza el código de seguridad o el enlace directo para ingresar a tu papeleta secreta.',
  emailOtpShowCode: true,
  emailOtpShowMagicLink: true,
  emailOtpButtonText: '🗳️ Ingresar a mi Papeleta de Votación',
  emailOtpFooterText:
    'Este código y enlace son personales, de uso único y tienen una validez de 10 minutos. Si no solicitaste este acceso, desestima este mensaje.',
} as const;

export const DEFAULT_LOGIN_CONFIG = {
  loginTitle: 'Identificación del Votante',
  loginSubtitle:
    'Bienvenido(a) al Portal Electoral Institucional. Por favor, selecciona tu perfil e ingresa tus credenciales acreditadas para continuar.',
  loginShowInstructions: true,
  loginInstructionsTitle: 'ℹ️ Instrucciones del Proceso de Votación',
  loginStep1Title: '1. Identificación',
  loginStep1Detail:
    'Selecciona tu perfil e ingresa tu RUN y correo electrónico acreditado en el padrón.',
  loginStep2Title: '2. Verificación OTP',
  loginStep2Detail:
    'Recibirás en tu correo un código de 6 dígitos y/o un enlace directo seguro para autenticarte.',
  loginStep3Title: '3. Emisión del Voto',
  loginStep3Detail:
    'Accede a tu papeleta, selecciona la candidatura de tu preferencia y confirma tu sufragio secreto.',
  loginShowApoderadoMode: true,
  loginShowFuncionarioMode: true,
  loginApoderadoTabLabel: '👨‍👩‍👧 Estamento Apoderados (Predeterminado)',
  loginFuncionarioTabLabel: '🏫 Funcionario / Interno',
  loginRutLabel: 'RUT / RUN del Votante',
  loginStudentRutLabel: 'RUN del Estudiante (Carga / Alumno)',
  loginEmailLabel: 'Correo Electrónico',
  loginEmailPlaceholder: 'correo@institucion.cl',
  loginAllowedDomains: '@eduvallediguillin.gob.cl, @slepvallediguillin.gob.cl, @slep.cl',
} as const;

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
  ...DEFAULT_OTP_EMAIL_CONFIG,
  ...DEFAULT_LOGIN_CONFIG,
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

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RenderOtpEmailParams {
  otp: string;
  voterName?: string;
  estamentoLabel?: string;
  magicLinkUrl?: string;
  senderEmail?: string;
}

/**
 * Renderiza el asunto y cuerpo HTML del correo OTP/Acreditación usando la configuración vigente.
 * Escapa HTML en todos los textos editables para prevenir inyección.
 */
export function renderOtpEmailTemplate(
  config: Partial<ElectionConfig>,
  params: RenderOtpEmailParams
): { subject: string; html: string } {
  const tituloProceso = config.tituloProceso?.trim() || DEFAULT_CONFIG.tituloProceso;
  const nombreInstitucion = config.nombreInstitucion?.trim() || DEFAULT_CONFIG.nombreInstitucion || '';
  const voterName = params.voterName?.trim() || 'Estimado(a) Votante';
  const estamentoLabel = params.estamentoLabel?.trim() || 'Votante';
  const otp = params.otp?.trim() || '';
  const magicLinkUrl = params.magicLinkUrl?.trim() || '';

  const replaceVars = (raw: string, htmlEscapeValues: boolean): string => {
    const val = (s: string) => (htmlEscapeValues ? escapeHtml(s) : s);
    return raw
      .replace(/{OTP}/gi, val(otp))
      .replace(/{NOMBRE_VOTANTE}/gi, val(voterName))
      .replace(/{ESTAMENTO}/gi, val(estamentoLabel))
      .replace(/{TITULO_PROCESO}/gi, val(tituloProceso))
      .replace(/{NOMBRE_INSTITUCION}/gi, val(nombreInstitucion))
      .replace(/{ENLACE_MAGICO}/gi, val(magicLinkUrl));
  };

  const subjectTpl = config.emailOtpSubject?.trim() || DEFAULT_OTP_EMAIL_CONFIG.emailOtpSubject;
  const headerTitleTpl = config.emailOtpHeaderTitle?.trim() || DEFAULT_OTP_EMAIL_CONFIG.emailOtpHeaderTitle;
  const headerSubtitleTpl = config.emailOtpHeaderSubtitle?.trim() || DEFAULT_OTP_EMAIL_CONFIG.emailOtpHeaderSubtitle;
  const greetingTpl = config.emailOtpGreeting?.trim() || DEFAULT_OTP_EMAIL_CONFIG.emailOtpGreeting;
  const bodyTextTpl = config.emailOtpBodyText?.trim() || DEFAULT_OTP_EMAIL_CONFIG.emailOtpBodyText;
  const buttonTextTpl = config.emailOtpButtonText?.trim() || DEFAULT_OTP_EMAIL_CONFIG.emailOtpButtonText;
  const footerTextTpl = config.emailOtpFooterText?.trim() || DEFAULT_OTP_EMAIL_CONFIG.emailOtpFooterText;

  const showCode = config.emailOtpShowCode ?? DEFAULT_OTP_EMAIL_CONFIG.emailOtpShowCode;
  const showMagicLink =
    (config.emailOtpShowMagicLink ?? DEFAULT_OTP_EMAIL_CONFIG.emailOtpShowMagicLink) &&
    Boolean(magicLinkUrl);

  const subject = replaceVars(subjectTpl, false);
  const headerTitle = replaceVars(escapeHtml(headerTitleTpl), true);
  const headerSubtitle = replaceVars(escapeHtml(headerSubtitleTpl), true);
  const greeting = replaceVars(escapeHtml(greetingTpl), true);
  const bodyHtml = replaceVars(escapeHtml(bodyTextTpl), true).replace(/\n/g, '<br />');
  const buttonText = replaceVars(escapeHtml(buttonTextTpl), true);
  const footerText = replaceVars(escapeHtml(footerTextTpl), true).replace(/\n/g, '<br />');

  const otpBlock = showCode && otp
    ? `
        <div style="text-align: center; margin: 24px 0;">
          <p style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: bold;">Código de Verificación (OTP)</p>
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0b5294; background-color: #f0f4f9; padding: 12px 26px; border-radius: 10px; border: 1px dashed #0b5294; display: inline-block;">
            ${escapeHtml(otp)}
          </span>
        </div>`
    : '';

  const magicLinkBlock = showMagicLink
    ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${escapeHtml(magicLinkUrl)}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 14px rgba(5,150,105,0.35);">${buttonText}</a>
        </div>`
    : '';

  const senderFooter = params.senderEmail
    ? `<p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">Remitente institucional: ${escapeHtml(params.senderEmail)}</p>`
    : '';

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #0b5294; color: #ffffff; padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 800;">${headerTitle}</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #bfdbfe;">${headerSubtitle}</p>
      </div>

      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <p style="font-size: 15px; font-weight: bold; margin-top: 0;">${greeting}</p>
        <p style="font-size: 14px; margin: 12px 0;">${bodyHtml}</p>
        ${otpBlock}
        ${magicLinkBlock}
      </div>

      <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0;">${footerText}</p>
        ${senderFooter}
      </div>
    </div>
  `;

  return { subject, html };
}

export function parseAllowedDomains(allowedDomainsRaw?: string): string[] {
  const raw = (allowedDomainsRaw ?? DEFAULT_LOGIN_CONFIG.loginAllowedDomains).trim();
  if (!raw || raw === '*') return [];
  return raw
    .split(/[\s,;]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
    .map((d) => (d.startsWith('@') ? d : `@${d}`));
}

export function isEmailDomainAllowed(email: string, allowedDomainsRaw?: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) return false;

  const raw = (allowedDomainsRaw ?? '').trim();
  if (raw === '*') return true;

  const domains = parseAllowedDomains(allowedDomainsRaw);
  if (domains.length === 0) return true;

  return domains.some((domain) => cleanEmail.endsWith(domain));
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
      emailOtpSubject:
        data.email_otp_subject != null
          ? String(data.email_otp_subject)
          : (electionConfigStore.emailOtpSubject ?? DEFAULT_OTP_EMAIL_CONFIG.emailOtpSubject),
      emailOtpHeaderTitle:
        data.email_otp_header_title != null
          ? String(data.email_otp_header_title)
          : (electionConfigStore.emailOtpHeaderTitle ?? DEFAULT_OTP_EMAIL_CONFIG.emailOtpHeaderTitle),
      emailOtpHeaderSubtitle:
        data.email_otp_header_subtitle != null
          ? String(data.email_otp_header_subtitle)
          : (electionConfigStore.emailOtpHeaderSubtitle ?? DEFAULT_OTP_EMAIL_CONFIG.emailOtpHeaderSubtitle),
      emailOtpGreeting:
        data.email_otp_greeting != null
          ? String(data.email_otp_greeting)
          : (electionConfigStore.emailOtpGreeting ?? DEFAULT_OTP_EMAIL_CONFIG.emailOtpGreeting),
      emailOtpBodyText:
        data.email_otp_body_text != null
          ? String(data.email_otp_body_text)
          : (electionConfigStore.emailOtpBodyText ?? DEFAULT_OTP_EMAIL_CONFIG.emailOtpBodyText),
      emailOtpShowCode:
        data.email_otp_show_code != null
          ? Boolean(data.email_otp_show_code)
          : (electionConfigStore.emailOtpShowCode ?? DEFAULT_OTP_EMAIL_CONFIG.emailOtpShowCode),
      emailOtpShowMagicLink:
        data.email_otp_show_magic_link != null
          ? Boolean(data.email_otp_show_magic_link)
          : (electionConfigStore.emailOtpShowMagicLink ?? DEFAULT_OTP_EMAIL_CONFIG.emailOtpShowMagicLink),
      emailOtpButtonText:
        data.email_otp_button_text != null
          ? String(data.email_otp_button_text)
          : (electionConfigStore.emailOtpButtonText ?? DEFAULT_OTP_EMAIL_CONFIG.emailOtpButtonText),
      emailOtpFooterText:
        data.email_otp_footer_text != null
          ? String(data.email_otp_footer_text)
          : (electionConfigStore.emailOtpFooterText ?? DEFAULT_OTP_EMAIL_CONFIG.emailOtpFooterText),
      loginTitle:
        data.login_title != null
          ? String(data.login_title)
          : (electionConfigStore.loginTitle ?? DEFAULT_LOGIN_CONFIG.loginTitle),
      loginSubtitle:
        data.login_subtitle != null
          ? String(data.login_subtitle)
          : (electionConfigStore.loginSubtitle ?? DEFAULT_LOGIN_CONFIG.loginSubtitle),
      loginShowInstructions:
        data.login_show_instructions != null
          ? Boolean(data.login_show_instructions)
          : (electionConfigStore.loginShowInstructions ?? DEFAULT_LOGIN_CONFIG.loginShowInstructions),
      loginInstructionsTitle:
        data.login_instructions_title != null
          ? String(data.login_instructions_title)
          : (electionConfigStore.loginInstructionsTitle ?? DEFAULT_LOGIN_CONFIG.loginInstructionsTitle),
      loginStep1Title:
        data.login_step1_title != null
          ? String(data.login_step1_title)
          : (electionConfigStore.loginStep1Title ?? DEFAULT_LOGIN_CONFIG.loginStep1Title),
      loginStep1Detail:
        data.login_step1_detail != null
          ? String(data.login_step1_detail)
          : (electionConfigStore.loginStep1Detail ?? DEFAULT_LOGIN_CONFIG.loginStep1Detail),
      loginStep2Title:
        data.login_step2_title != null
          ? String(data.login_step2_title)
          : (electionConfigStore.loginStep2Title ?? DEFAULT_LOGIN_CONFIG.loginStep2Title),
      loginStep2Detail:
        data.login_step2_detail != null
          ? String(data.login_step2_detail)
          : (electionConfigStore.loginStep2Detail ?? DEFAULT_LOGIN_CONFIG.loginStep2Detail),
      loginStep3Title:
        data.login_step3_title != null
          ? String(data.login_step3_title)
          : (electionConfigStore.loginStep3Title ?? DEFAULT_LOGIN_CONFIG.loginStep3Title),
      loginStep3Detail:
        data.login_step3_detail != null
          ? String(data.login_step3_detail)
          : (electionConfigStore.loginStep3Detail ?? DEFAULT_LOGIN_CONFIG.loginStep3Detail),
      loginShowApoderadoMode:
        data.login_show_apoderado_mode != null
          ? Boolean(data.login_show_apoderado_mode)
          : (electionConfigStore.loginShowApoderadoMode ?? DEFAULT_LOGIN_CONFIG.loginShowApoderadoMode),
      loginShowFuncionarioMode:
        data.login_show_funcionario_mode != null
          ? Boolean(data.login_show_funcionario_mode)
          : (electionConfigStore.loginShowFuncionarioMode ?? DEFAULT_LOGIN_CONFIG.loginShowFuncionarioMode),
      loginApoderadoTabLabel:
        data.login_apoderado_tab_label != null
          ? String(data.login_apoderado_tab_label)
          : (electionConfigStore.loginApoderadoTabLabel ?? DEFAULT_LOGIN_CONFIG.loginApoderadoTabLabel),
      loginFuncionarioTabLabel:
        data.login_funcionario_tab_label != null
          ? String(data.login_funcionario_tab_label)
          : (electionConfigStore.loginFuncionarioTabLabel ?? DEFAULT_LOGIN_CONFIG.loginFuncionarioTabLabel),
      loginRutLabel:
        data.login_rut_label != null
          ? String(data.login_rut_label)
          : (electionConfigStore.loginRutLabel ?? DEFAULT_LOGIN_CONFIG.loginRutLabel),
      loginStudentRutLabel:
        data.login_student_rut_label != null
          ? String(data.login_student_rut_label)
          : (electionConfigStore.loginStudentRutLabel ?? DEFAULT_LOGIN_CONFIG.loginStudentRutLabel),
      loginEmailLabel:
        data.login_email_label != null
          ? String(data.login_email_label)
          : (electionConfigStore.loginEmailLabel ?? DEFAULT_LOGIN_CONFIG.loginEmailLabel),
      loginEmailPlaceholder:
        data.login_email_placeholder != null
          ? String(data.login_email_placeholder)
          : (electionConfigStore.loginEmailPlaceholder ?? DEFAULT_LOGIN_CONFIG.loginEmailPlaceholder),
      loginAllowedDomains:
        data.login_allowed_domains != null
          ? String(data.login_allowed_domains)
          : (electionConfigStore.loginAllowedDomains ?? DEFAULT_LOGIN_CONFIG.loginAllowedDomains),
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
      if (updated.emailOtpSubject !== undefined) payload.email_otp_subject = updated.emailOtpSubject;
      if (updated.emailOtpHeaderTitle !== undefined) payload.email_otp_header_title = updated.emailOtpHeaderTitle;
      if (updated.emailOtpHeaderSubtitle !== undefined) payload.email_otp_header_subtitle = updated.emailOtpHeaderSubtitle;
      if (updated.emailOtpGreeting !== undefined) payload.email_otp_greeting = updated.emailOtpGreeting;
      if (updated.emailOtpBodyText !== undefined) payload.email_otp_body_text = updated.emailOtpBodyText;
      if (updated.emailOtpShowCode !== undefined) payload.email_otp_show_code = updated.emailOtpShowCode;
      if (updated.emailOtpShowMagicLink !== undefined) payload.email_otp_show_magic_link = updated.emailOtpShowMagicLink;
      if (updated.emailOtpButtonText !== undefined) payload.email_otp_button_text = updated.emailOtpButtonText;
      if (updated.emailOtpFooterText !== undefined) payload.email_otp_footer_text = updated.emailOtpFooterText;
      if (updated.loginTitle !== undefined) payload.login_title = updated.loginTitle;
      if (updated.loginSubtitle !== undefined) payload.login_subtitle = updated.loginSubtitle;
      if (updated.loginShowInstructions !== undefined) payload.login_show_instructions = updated.loginShowInstructions;
      if (updated.loginInstructionsTitle !== undefined) payload.login_instructions_title = updated.loginInstructionsTitle;
      if (updated.loginStep1Title !== undefined) payload.login_step1_title = updated.loginStep1Title;
      if (updated.loginStep1Detail !== undefined) payload.login_step1_detail = updated.loginStep1Detail;
      if (updated.loginStep2Title !== undefined) payload.login_step2_title = updated.loginStep2Title;
      if (updated.loginStep2Detail !== undefined) payload.login_step2_detail = updated.loginStep2Detail;
      if (updated.loginStep3Title !== undefined) payload.login_step3_title = updated.loginStep3Title;
      if (updated.loginStep3Detail !== undefined) payload.login_step3_detail = updated.loginStep3Detail;
      if (updated.loginShowApoderadoMode !== undefined) payload.login_show_apoderado_mode = updated.loginShowApoderadoMode;
      if (updated.loginShowFuncionarioMode !== undefined) payload.login_show_funcionario_mode = updated.loginShowFuncionarioMode;
      if (updated.loginApoderadoTabLabel !== undefined) payload.login_apoderado_tab_label = updated.loginApoderadoTabLabel;
      if (updated.loginFuncionarioTabLabel !== undefined) payload.login_funcionario_tab_label = updated.loginFuncionarioTabLabel;
      if (updated.loginRutLabel !== undefined) payload.login_rut_label = updated.loginRutLabel;
      if (updated.loginStudentRutLabel !== undefined) payload.login_student_rut_label = updated.loginStudentRutLabel;
      if (updated.loginEmailLabel !== undefined) payload.login_email_label = updated.loginEmailLabel;
      if (updated.loginEmailPlaceholder !== undefined) payload.login_email_placeholder = updated.loginEmailPlaceholder;
      if (updated.loginAllowedDomains !== undefined) payload.login_allowed_domains = updated.loginAllowedDomains;

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
