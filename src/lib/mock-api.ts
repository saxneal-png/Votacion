import { getPadronRecords } from '@/lib/padron-store';
import type { Candidate, Estamento, User } from '@/types';

interface MockUserRecord extends User {
  rut: string;
  studentRut?: string;
  email: string;
  otp: string;
  /** ID matching a school in src/lib/schools-data.ts SCHOOLS array */
  schoolId: string;
}

// ---------------------------------------------------------------------------
// Usuarios ficticios de prueba — uno por estamento
// ---------------------------------------------------------------------------
// RUT 12345678-5 → Directivos
// RUT 16940271-k → Docentes
// RUT 19876543-0 → Asistentes de la Educación
// RUT 14567890-1 / Estudiante 23456789-2 → Apoderados
// ---------------------------------------------------------------------------
const VALID_USERS: MockUserRecord[] = [
  {
    rut: '12345678-5',
    email: 'director@slep.cl',
    otp: '111111',
    fullName: 'Carlos Muñoz Reyes',
    organization: 'SLEP VALLE DIGUILLÍN',
    estamento: 'directivos',
    schoolId: 'roberto-humeres',
  },
  {
    rut: '16940271-k',
    email: 'docente@slep.cl',
    otp: '222222',
    fullName: 'María González Pérez',
    organization: 'SLEP VALLE DIGUILLÍN',
    estamento: 'docentes',
    schoolId: 'martin-prado',
  },
  {
    rut: '19876543-0',
    email: 'asistente@slep.cl',
    otp: '333333',
    fullName: 'Ana Soto Vidal',
    organization: 'SLEP VALLE DIGUILLÍN',
    estamento: 'asistentes',
    schoolId: 'costa-rica',
  },
  {
    rut: '14567890-1',
    studentRut: '23456789-2',
    email: 'apoderado@slep.cl',
    otp: '444444',
    fullName: 'Verónica Alarcón Fuentes',
    organization: 'SLEP VALLE DIGUILLÍN',
    estamento: 'apoderados',
    schoolId: 'martin-prado',
  },
];

export const candidates: Candidate[] = [
  // ── Directivos ────────────────────────────────────────────────────────────
  {
    id: 'pablo-reyes',
    name: 'Pablo Reyes',
    role: 'Director establecimiento zona norte',
    slogan: 'Liderazgo pedagógico centrado en resultados colectivos.',
    initials: 'PR',
    accentColor: '#1a4a7a',
    estamento: 'directivos',
  },
  {
    id: 'claudia-fuentes',
    name: 'Claudia Fuentes',
    role: 'Directora establecimiento zona sur',
    slogan: 'Gestión participativa para comunidades escolares fuertes.',
    initials: 'CF',
    accentColor: '#4a1a5a',
    estamento: 'directivos',
  },
  {
    id: 'rodrigo-espinoza',
    name: 'Rodrigo Espinoza',
    role: 'Jefe de Unidad Técnico-Pedagógica',
    slogan: 'Innovación curricular con base en evidencia educativa.',
    initials: 'RE',
    accentColor: '#1a5a3a',
    estamento: 'directivos',
  },
  // ── Docentes ─────────────────────────────────────────────────────────────
  {
    id: 'marisol-huerta',
    name: 'Marisol Huerta',
    role: 'Escuela Martin Prado',
    slogan: 'Participacion informada con foco en continuidad pedagogica.',
    initials: 'MH',
    accentColor: '#8c4f2f',
    estamento: 'docentes',
  },
  {
    id: 'vianka-mejias',
    name: 'Vianka Mejias',
    role: 'Colegio República de Costa Rica',
    slogan: 'Coordinacion intersectorial para escuelas mas conectadas.',
    initials: 'VM',
    accentColor: '#355c7d',
    estamento: 'docentes',
  },
  {
    id: 'ximena-pino',
    name: 'Ximena Pino',
    role: 'Liceo José Victorino Lastarria',
    slogan: 'Vinculos de confianza para comunidades escolares solidas.',
    initials: 'XP',
    accentColor: '#44633f',
    estamento: 'docentes',
  },
  // ── Asistentes de la Educación ────────────────────────────────────────────
  {
    id: 'carmen-lagos',
    name: 'Carmen Lagos',
    role: 'Colegio República de Costa Rica',
    slogan: 'Reconocimiento y valoración del trabajo asistencial.',
    initials: 'CL',
    accentColor: '#7a3a1a',
    estamento: 'asistentes',
  },
  {
    id: 'miguel-torres',
    name: 'Miguel Torres',
    role: 'Colegio de Aplicación Artística y Cultural',
    slogan: 'Coordinación efectiva entre equipos de apoyo escolar.',
    initials: 'MT',
    accentColor: '#1a6a6a',
    estamento: 'asistentes',
  },
  // ── Apoderados ────────────────────────────────────────────────────────────
  {
    id: 'gonzalo-silva',
    name: 'Gonzalo Silva',
    role: 'Centro General de Padres y Apoderados',
    slogan: 'Participación activa de las familias en el desarrollo educativo.',
    initials: 'GS',
    accentColor: '#d97706',
    estamento: 'apoderados',
  },
  {
    id: 'loreto-morales',
    name: 'Loreto Morales',
    role: 'Subcentro de Apoderados Escuela Martin Prado',
    slogan: 'Compromiso y comunicación fluida con la comunidad escolar.',
    initials: 'LM',
    accentColor: '#059669',
    estamento: 'apoderados',
  },
  {
    id: 'fernando-castro',
    name: 'Fernando Castro',
    role: 'Representante Apoderados Enseñanza Media',
    slogan: 'Infraestructura digna y bienestar para todos nuestros hijos.',
    initials: 'FC',
    accentColor: '#9333ea',
    estamento: 'apoderados',
  },
];

const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 1000;

function wait(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
}

function normalizeRut(rut: string) {
  return rut.replace(/\./g, '').trim().toLowerCase();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function toPublicUser(user: MockUserRecord): User {
  return {
    fullName: user.fullName,
    organization: user.organization,
    estamento: user.estamento,
    studentRut: user.studentRut,
  };
}

export function getMockUserByRut(rut: string): MockUserRecord | null {
  const normalizedRut = normalizeRut(rut);
  const found = VALID_USERS.find((user) => normalizeRut(user.rut) === normalizedRut);
  if (found) return found;

  const cleanRutStr = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  const padronRecord = getPadronRecords().records.find(
    (r) => r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === cleanRutStr,
  );

  if (padronRecord) {
    const estamentoLower = (
      padronRecord.estamento === 'PADRES_APODERADOS' ? 'apoderados' : padronRecord.estamento.toLowerCase()
    ) as Estamento;

    return {
      rut: padronRecord.formattedRutVotante || rut,
      email: 'votante@slepvallediguillin.gob.cl',
      otp: '111111',
      fullName: padronRecord.nombreCompleto,
      organization: padronRecord.nombreEstablecimiento || 'SLEP VALLE DIGUILLÍN',
      estamento: estamentoLower,
      schoolId: padronRecord.rbdEstablecimiento || 'martin-prado',
      studentRut: padronRecord.formattedRutEstudiante || undefined,
    };
  }

  // No retornar un usuario docente por defecto — puede causar votación en estamento equivocado.
  // Los flujos post-autenticación usan los datos de la sesión directamente.
  return null;
}

export async function verifyUserCredentials(
  rut: string,
  email: string,
  studentRut?: string,
): Promise<MockUserRecord> {
  await wait(randomDelay());

  const normalizedRut = normalizeRut(rut);
  const normalizedEmail = normalizeEmail(email);
  const normalizedStudentRut = studentRut ? normalizeRut(studentRut) : null;

  const match = VALID_USERS.find((u) => {
    const isRutMatch = normalizeRut(u.rut) === normalizedRut;
    const isEmailMatch = normalizeEmail(u.email) === normalizedEmail;

    if (u.estamento === 'apoderados') {
      if (!normalizedStudentRut) return false;
      const isStudentMatch = normalizeRut(u.studentRut || '') === normalizedStudentRut;
      return isRutMatch && isEmailMatch && isStudentMatch;
    }

    return isRutMatch && isEmailMatch;
  });

  if (match) return match;

  if (normalizedStudentRut) {
    throw new Error(
      'No encontramos una coincidencia válida para el RUN de apoderado, RUN de estudiante y correo ingresados.',
    );
  }

  throw new Error('No encontramos una coincidencia valida para el RUT y correo ingresados.');
}

export async function verifyOtpCode(otp: string, expectedOtp: string): Promise<void> {
  await wait(randomDelay());
  if (otp.trim() === expectedOtp.trim()) return;
  throw new Error('El codigo OTP no es valido o ha expirado.');
}

import { getCandidatoById as getFromStoreById, getCandidatosAsync } from '@/lib/candidates-store';

export function getCandidateById(candidateId: string): Candidate | null {
  return getFromStoreById(candidateId) ?? null;
}

export async function getCandidates(estamento: Estamento): Promise<Candidate[]> {
  await wait(300);
  return getCandidatosAsync({ estamento });
}

export async function submitVote(
  candidateId: string,
): Promise<{ receiptCode: string; candidate: Candidate }> {
  await wait(randomDelay());
  const candidate = getCandidateById(candidateId);
  if (!candidate) {
    throw new Error('No fue posible registrar el voto para la candidatura seleccionada.');
  }

  return {
    receiptCode: `SLEP-${candidate.initials}-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
    candidate,
  };
}
