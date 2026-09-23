import { randomUUID } from 'crypto';
import type { VoterEstamentoOption } from '@/types';
import { supabaseAdmin } from '@/lib/supabase-client';

export const SESSION_COOKIE_NAME = 'voting_session';

export interface SessionRecord {
  userRut: string;
  /** Correo electrónico real con el que el votante se autenticó */
  userEmail: string;
  /** Estamento activo actual del votante (padres_apoderados, docentes, asistentes, directivos, estudiantes) */
  userEstamento: string;
  /** Nombre completo del votante según el padrón */
  userFullName: string;
  /** RBD del establecimiento del votante */
  userRbd: string;
  /** Nombre del establecimiento del votante */
  userOrganization: string;
  /** OTP generado y enviado por correo para verificar la identidad del votante */
  userOtp: string;
  otpVerified: boolean;
  otpAttempts: number;
  createdAt: number;
  availableEstamentos?: VoterEstamentoOption[];
  activeEstamento?: string;
}

const MAX_OTP_ATTEMPTS = 3;

const SESSION_TTL_MS = 10 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __votingSessionStore: Map<string, SessionRecord> | undefined;
  // eslint-disable-next-line no-var
  var __votingVotedUsers: Set<string> | undefined;
}

const sessionStore: Map<string, SessionRecord> =
  globalThis.__votingSessionStore ??
  (globalThis.__votingSessionStore = new Map());

const votedUsers: Set<string> =
  globalThis.__votingVotedUsers ??
  (globalThis.__votingVotedUsers = new Set());

function isSessionExpired(record: SessionRecord) {
  return Date.now() - record.createdAt > SESSION_TTL_MS;
}

/**
 * Crear sesión asíncrona con persistencia en Supabase Pro y caché en memoria.
 */
export async function createSessionAsync(params: {
  userRut: string;
  userEmail: string;
  userEstamento: string;
  userFullName: string;
  userRbd: string;
  userOrganization: string;
  userOtp: string;
  availableEstamentos?: VoterEstamentoOption[];
}): Promise<string> {
  const sessionId = randomUUID();
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();

  const record: SessionRecord = {
    userRut: params.userRut,
    userEmail: params.userEmail,
    userEstamento: params.userEstamento.toLowerCase(),
    userFullName: params.userFullName,
    userRbd: params.userRbd,
    userOrganization: params.userOrganization,
    userOtp: params.userOtp,
    otpVerified: false,
    otpAttempts: 0,
    createdAt: now,
    availableEstamentos: params.availableEstamentos,
    activeEstamento: params.userEstamento.toLowerCase(),
  };

  // 1. Guardar en memoria local
  sessionStore.set(sessionId, record);

  // 2. Persistir en Supabase Pro si está disponible
  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from('sesiones_votacion').upsert({
        id: sessionId,
        user_rut: params.userRut,
        user_email: params.userEmail,
        user_estamento: params.userEstamento.toLowerCase(),
        user_full_name: params.userFullName,
        user_rbd: params.userRbd,
        user_organization: params.userOrganization,
        user_otp: params.userOtp,
        otp_verified: false,
        otp_attempts: 0,
        created_at: new Date(now).toISOString(),
        expires_at: expiresAt,
      });
    } catch (err) {
      console.error('[SESSION PERSISTENCE ERROR] Error guardando sesión en Supabase:', err);
    }
  }

  return sessionId;
}

/**
 * Versión síncrona de createSession (mantiene compatibilidad)
 */
export function createSession(params: {
  userRut: string;
  userEmail: string;
  userEstamento: string;
  userFullName: string;
  userRbd: string;
  userOrganization: string;
  userOtp: string;
  availableEstamentos?: VoterEstamentoOption[];
}): string {
  const sessionId = randomUUID();
  const record: SessionRecord = {
    userRut: params.userRut,
    userEmail: params.userEmail,
    userEstamento: params.userEstamento.toLowerCase(),
    userFullName: params.userFullName,
    userRbd: params.userRbd,
    userOrganization: params.userOrganization,
    userOtp: params.userOtp,
    otpVerified: false,
    otpAttempts: 0,
    createdAt: Date.now(),
    availableEstamentos: params.availableEstamentos,
    activeEstamento: params.userEstamento.toLowerCase(),
  };

  sessionStore.set(sessionId, record);

  // Intentar persistir en background
  if (supabaseAdmin) {
    void (async () => {
      try {
        await supabaseAdmin.from('sesiones_votacion').upsert({
          id: sessionId,
          user_rut: params.userRut,
          user_email: params.userEmail,
          user_estamento: params.userEstamento.toLowerCase(),
          user_full_name: params.userFullName,
          user_rbd: params.userRbd,
          user_organization: params.userOrganization,
          user_otp: params.userOtp,
          otp_verified: false,
          otp_attempts: 0,
          created_at: new Date(record.createdAt).toISOString(),
          expires_at: new Date(record.createdAt + SESSION_TTL_MS).toISOString(),
        });
      } catch {
        // Ignorar error en background
      }
    })();
  }

  return sessionId;
}

/**
 * Obtener sesión asíncrona desde Supabase Pro con fallback a memoria local.
 */
export async function getSessionAsync(sessionId: string | undefined): Promise<SessionRecord | null> {
  if (!sessionId) return null;

  // 1. Intentar consultar en Supabase Pro
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('sesiones_votacion')
        .select('*')
        .eq('id', sessionId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!error && data) {
        const record: SessionRecord = {
          userRut: data.user_rut,
          userEmail: data.user_email,
          userEstamento: data.user_estamento,
          userFullName: data.user_full_name,
          userRbd: data.user_rbd,
          userOrganization: data.user_organization,
          userOtp: data.user_otp || '',
          otpVerified: Boolean(data.otp_verified),
          otpAttempts: Number(data.otp_attempts) || 0,
          createdAt: new Date(data.created_at).getTime(),
          activeEstamento: data.user_estamento,
        };

        // Actualizar caché de memoria local
        sessionStore.set(sessionId, record);
        return record;
      }
    } catch {
      // Continuar al fallback de memoria
    }
  }

  // 2. Fallback a memoria local
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  if (isSessionExpired(session)) {
    sessionStore.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Obtener sesión síncrona desde memoria local.
 */
export function getSession(sessionId: string | undefined): SessionRecord | null {
  if (!sessionId) return null;

  const session = sessionStore.get(sessionId);
  if (!session) return null;

  if (isSessionExpired(session)) {
    sessionStore.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Marca la sesión como verificada tras OTP correcto.
 */
export async function markOtpVerifiedAsync(sessionId: string): Promise<void> {
  const session = sessionStore.get(sessionId);
  if (session) {
    session.otpVerified = true;
  }

  if (supabaseAdmin) {
    try {
      await supabaseAdmin
        .from('sesiones_votacion')
        .update({ otp_verified: true })
        .eq('id', sessionId);
    } catch (err) {
      console.error('[SESSION UPDATE ERROR] Error al marcar OTP verificado en Supabase:', err);
    }
  }
}

export function markOtpVerified(sessionId: string): void {
  const session = sessionStore.get(sessionId);
  if (session) {
    session.otpVerified = true;
  }

  if (supabaseAdmin) {
    void (async () => {
      try {
        await supabaseAdmin
          .from('sesiones_votacion')
          .update({ otp_verified: true })
          .eq('id', sessionId);
      } catch {}
    })();
  }
}

/**
 * Incrementa el contador de intentos fallidos de OTP.
 */
export async function incrementOtpAttemptsAsync(sessionId: string): Promise<number> {
  let attempts = 1;
  const session = sessionStore.get(sessionId);
  if (session) {
    session.otpAttempts += 1;
    attempts = session.otpAttempts;
  }

  if (supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from('sesiones_votacion')
        .select('otp_attempts')
        .eq('id', sessionId)
        .maybeSingle();

      const currentDbAttempts = Number(data?.otp_attempts || 0) + 1;
      await supabaseAdmin
        .from('sesiones_votacion')
        .update({ otp_attempts: currentDbAttempts })
        .eq('id', sessionId);

      attempts = currentDbAttempts;
    } catch {
      // Usar valor en memoria
    }
  }

  return attempts;
}

export function incrementOtpAttempts(sessionId: string): number {
  const session = sessionStore.get(sessionId);
  if (!session) return MAX_OTP_ATTEMPTS + 1;

  session.otpAttempts += 1;

  if (supabaseAdmin) {
    void (async () => {
      try {
        await supabaseAdmin
          .from('sesiones_votacion')
          .update({ otp_attempts: session.otpAttempts })
          .eq('id', sessionId);
      } catch {}
    })();
  }

  return session.otpAttempts;
}

export { MAX_OTP_ATTEMPTS };

/**
 * Destruye la sesión (cierre de sesión o revocación).
 */
export async function destroySessionAsync(sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  sessionStore.delete(sessionId);

  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from('sesiones_votacion').delete().eq('id', sessionId);
    } catch {
      // Ignorar error
    }
  }
}

export function destroySession(sessionId: string | undefined): void {
  if (!sessionId) return;
  sessionStore.delete(sessionId);

  if (supabaseAdmin) {
    void (async () => {
      try {
        await supabaseAdmin.from('sesiones_votacion').delete().eq('id', sessionId);
      } catch {}
    })();
  }
}

export function hasUserVoted(userRut: string, userEstamento: string = ''): boolean {
  const cleanRut = userRut.replace(/[^0-9kK]/g, '').toUpperCase();
  const cleanEst = userEstamento.toLowerCase().trim();
  const key = cleanEst ? `${cleanRut}:${cleanEst}` : cleanRut;
  return votedUsers.has(key);
}

export function markUserAsVoted(userRut: string, userEstamento: string = ''): void {
  const cleanRut = userRut.replace(/[^0-9kK]/g, '').toUpperCase();
  const cleanEst = userEstamento.toLowerCase().trim();
  const key = cleanEst ? `${cleanRut}:${cleanEst}` : cleanRut;
  votedUsers.add(key);
}

export async function setActiveEstamentoAsync(sessionId: string, estamento: string): Promise<void> {
  const session = sessionStore.get(sessionId);
  if (session) {
    session.userEstamento = estamento.toLowerCase();
    session.activeEstamento = estamento.toLowerCase();
  }

  if (supabaseAdmin) {
    try {
      await supabaseAdmin
        .from('sesiones_votacion')
        .update({ user_estamento: estamento.toLowerCase() })
        .eq('id', sessionId);
    } catch {
      // Ignorar error
    }
  }
}

export function setActiveEstamento(sessionId: string, estamento: string): void {
  const session = sessionStore.get(sessionId);
  if (session) {
    session.userEstamento = estamento.toLowerCase();
    session.activeEstamento = estamento.toLowerCase();
  }

  if (supabaseAdmin) {
    void (async () => {
      try {
        await supabaseAdmin
          .from('sesiones_votacion')
          .update({ user_estamento: estamento.toLowerCase() })
          .eq('id', sessionId);
      } catch {}
    })();
  }
}

export async function markEstamentoVotedInSessionAsync(sessionId: string, estamento: string): Promise<void> {
  const session = await getSessionAsync(sessionId);
  if (!session || !session.availableEstamentos) return;

  const target = session.availableEstamentos.find(
    (e) => e.estamento.toLowerCase() === estamento.toLowerCase(),
  );
  if (target) {
    target.haVotado = true;
  }
}

export function markEstamentoVotedInSession(sessionId: string, estamento: string): void {
  const session = sessionStore.get(sessionId);
  if (!session || !session.availableEstamentos) return;

  const target = session.availableEstamentos.find(
    (e) => e.estamento.toLowerCase() === estamento.toLowerCase(),
  );
  if (target) {
    target.haVotado = true;
  }
}

export function clearVotedUsers(): void {
  votedUsers.clear();
}