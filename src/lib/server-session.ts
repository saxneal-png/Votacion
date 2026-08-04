import { randomUUID } from 'crypto';

export const SESSION_COOKIE_NAME = 'voting_session';

interface SessionRecord {
  userRut: string;
  /** Correo electrónico real con el que el votante se autenticó */
  userEmail: string;
  /** Estamento real del votante (padres_apoderados, docentes, asistentes, directivos, estudiantes) */
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
}

const MAX_OTP_ATTEMPTS = 3;

const SESSION_TTL_MS = 10 * 60 * 1000;

// In development, Next.js Hot Module Replacement re-evaluates this module on
// every rebuild, which would reset the in-memory Maps and lose all active sessions.
// Storing them on `globalThis` keeps them alive across hot reloads.
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
 * Crear sesión con todos los datos del votante autenticado.
 * Almacenar estamento, email y nombre en la sesión evita depender
 * de getMockUserByRut (que puede fallar en entornos serverless).
 */
export function createSession(params: {
  userRut: string;
  userEmail: string;
  userEstamento: string;
  userFullName: string;
  userRbd: string;
  userOrganization: string;
  userOtp: string;
}) {
  const sessionId = randomUUID();
  sessionStore.set(sessionId, {
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
  });
  return sessionId;
}

export function getSession(sessionId: string | undefined) {
  if (!sessionId) return null;

  const session = sessionStore.get(sessionId);
  if (!session) return null;

  if (isSessionExpired(session)) {
    sessionStore.delete(sessionId);
    return null;
  }

  return session;
}

export function markOtpVerified(sessionId: string) {
  const session = sessionStore.get(sessionId);
  if (!session) return;

  session.otpVerified = true;
}

/**
 * Increments the OTP failure counter for a session.
 * Returns the new count. The caller is responsible for destroying the session
 * when the count reaches MAX_OTP_ATTEMPTS.
 * Returns MAX_OTP_ATTEMPTS + 1 if the session no longer exists.
 */
export function incrementOtpAttempts(sessionId: string): number {
  const session = sessionStore.get(sessionId);
  if (!session) return MAX_OTP_ATTEMPTS + 1;

  session.otpAttempts += 1;
  return session.otpAttempts;
}

export { MAX_OTP_ATTEMPTS };

export function destroySession(sessionId: string | undefined) {
  if (!sessionId) return;
  sessionStore.delete(sessionId);
}

/**
 * Verifica si el votante ya emitió su voto para un estamento concreto.
 * La clave compuesta "{rut}:{estamento}" permite que un usuario con doble rol
 * (ej. Docente + Apoderado) pueda sufragar en cada estamento de forma independiente.
 */
export function hasUserVoted(userRut: string, userEstamento: string = '') {
  const key = userEstamento ? `${userRut}:${userEstamento.toLowerCase()}` : userRut;
  return votedUsers.has(key);
}

/**
 * Marca el voto del votante para el estamento concreto.
 */
export function markUserAsVoted(userRut: string, userEstamento: string = '') {
  const key = userEstamento ? `${userRut}:${userEstamento.toLowerCase()}` : userRut;
  votedUsers.add(key);
}

export function clearVotedUsers() {
  votedUsers.clear();
}