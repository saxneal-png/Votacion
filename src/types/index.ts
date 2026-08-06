export type Estamento = 'directivos' | 'docentes' | 'asistentes' | 'apoderados' | 'estudiantes';

export interface TenantContext {
  slepId?: string;
  schoolId?: string;
  rbd?: string;
}

export interface User extends TenantContext {
  fullName: string;
  organization: string;
  estamento: Estamento;
  studentRut?: string;
}

export interface Candidate extends TenantContext {
  id: string;
  name: string;
  role: string;
  slogan: string;
  initials: string;
  accentColor: string;
  estamento: Estamento;
  numero?: number;
  // Campos extendidos para Módulo Candidaturas
  nombreCompleto?: string;
  biografia?: string;
  propuestaPrincipal?: string;
  escuelaEstablecimiento?: string;
  rbd?: string;
  fotoPerfil?: string;
}

export type AppState = 'intro' | 'login' | 'otp' | 'vote' | 'success';

// ---------------------------------------------------------------------------
// Admin metrics types
// ---------------------------------------------------------------------------

export interface CandidateResult {
  id: string;
  name: string;
  initials: string;
  accentColor: string;
  votes: number;
  numero?: number;
}

export interface EstamentoResult {
  estamento: Estamento;
  label: string;
  color: string;
  padronCount: number;
  votesCast: number;
  candidates: CandidateResult[];
}

export interface SchoolResult {
  id: string;
  name: string;
  shortName: string;
  slepId?: string;
  rbd?: string;
  padron: { directivos: number; docentes: number; asistentes: number; apoderados?: number; estudiantes?: number };
  voted: { directivos: boolean; docentes: boolean; asistentes: boolean; apoderados?: boolean; estudiantes?: boolean };
}

export interface AdminMetrics extends TenantContext {
  lastUpdated: number;
  padron: { total: number; directivos: number; docentes: number; asistentes: number; apoderados?: number; estudiantes?: number };
  votes: { total: number; directivos: number; docentes: number; asistentes: number; apoderados?: number; estudiantes?: number };
  estamentos: EstamentoResult[];
  schools: SchoolResult[];
}

export type AdminAuditEvent =
  | 'login_success'
  | 'login_failure'
  | 'access'
  | 'logout'
  | 'lockout_blocked';

export interface AdminAuditEntry {
  ts: number;
  ip: string;
  event: AdminAuditEvent;
  detail?: string;
}