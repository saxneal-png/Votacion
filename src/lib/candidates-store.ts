import type { Candidate, Estamento } from '@/types';

export interface CandidateFormData {
  nombreCompleto: string;
  estamento: Estamento;
  biografia: string;
  propuestaPrincipal: string;
  escuelaEstablecimiento: string;
  fotoPerfil?: string;
}

const INITIAL_CANDIDATES: Candidate[] = [
  // ── Directivos ────────────────────────────────────────────────────────────
  {
    id: 'pablo-reyes',
    name: 'Pablo Reyes',
    nombreCompleto: 'Pablo Reyes Castro',
    role: 'Director Escuela Zona Norte',
    slogan: 'Liderazgo pedagógico centrado en resultados colectivos.',
    initials: 'PR',
    accentColor: '#1a4a7a',
    estamento: 'directivos',
    biografia: 'Profesor de Estado con más de 15 años de experiencia directiva en el sistema público. Especialista en gestión de equipos de alto rendimiento.',
    propuestaPrincipal: 'Implementar un plan de fortalecimiento de liderazgo directivo participativo y transparencia en el Consejo Local.',
    escuelaEstablecimiento: 'Liceo Roberto Humeres Noble',
    fotoPerfil: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'claudia-fuentes',
    name: 'Claudia Fuentes',
    nombreCompleto: 'Claudia Fuentes Morales',
    role: 'Directora Escuela Zona Sur',
    slogan: 'Gestión participativa para comunidades escolares fuertes.',
    initials: 'CF',
    accentColor: '#4a1a5a',
    estamento: 'directivos',
    biografia: 'Magíster en Educación con mención en Gestión Escolar. Ha liderado proyectos de convivencia escolar y vinculación territorial en SLEP.',
    propuestaPrincipal: 'Crear redes comunitarias entre establecimientos para compartir buenas prácticas pedagógicas y recursos de infraestructura.',
    escuelaEstablecimiento: 'Escuela Martín Prado',
    fotoPerfil: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'rodrigo-espinoza',
    name: 'Rodrigo Espinoza',
    nombreCompleto: 'Rodrigo Espinoza Silva',
    role: 'Jefe UTP',
    slogan: 'Innovación curricular con base en evidencia educativa.',
    initials: 'RE',
    accentColor: '#1a5a3a',
    estamento: 'directivos',
    biografia: 'Docente e Investigador Pedagógico. Enfocado en la transformación digital de las aulas rurales e inclusión tecnológica.',
    propuestaPrincipal: 'Priorizar el presupuesto para conectividad digital e equipamiento tecnológico de vanguardia en todas las salas de clases.',
    escuelaEstablecimiento: 'Colegio República de Costa Rica',
    fotoPerfil: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  },
  // ── Docentes ─────────────────────────────────────────────────────────────
  {
    id: 'marisol-huerta',
    name: 'Marisol Huerta',
    nombreCompleto: 'Marisol Huerta Sepúlveda',
    role: 'Docente Educación Básica',
    slogan: 'Participación informada con foco en continuidad pedagógica.',
    initials: 'MH',
    accentColor: '#8c4f2f',
    estamento: 'docentes',
    biografia: 'Profesora de Educación General Básica con 12 años en el aula pública. Defensora del bienestar emocional del cuerpo docente.',
    propuestaPrincipal: 'Resguardar las horas no lectivas para planificación colaborativa y reducir la sobrecarga administrativa.',
    escuelaEstablecimiento: 'Escuela Martín Prado',
    fotoPerfil: 'https://images.unsplash.com/photo-1580894732413-80642a6b329c?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'vianka-mejias',
    name: 'Vianka Mejías',
    nombreCompleto: 'Vianka Mejías Araya',
    role: 'Docente de Matemáticas',
    slogan: 'Cuidado docente y mejores condiciones para el aprendizaje.',
    initials: 'VM',
    accentColor: '#2b5f7e',
    estamento: 'docentes',
    biografia: 'Licenciada en Educación con especialización en resolución de problemas y metodologías STEM para escuelas públicas.',
    propuestaPrincipal: 'Impulsar laboratorios interactivos de ciencias y apoyo especializado para estudiantes con necesidades educativas especiales.',
    escuelaEstablecimiento: 'Liceo Bicentenario',
    fotoPerfil: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  },
  // ── Asistentes ────────────────────────────────────────────────────────────
  {
    id: 'roberto-lara',
    name: 'Roberto Lara',
    nombreCompleto: 'Roberto Lara Valenzuela',
    role: 'Inspector General',
    slogan: 'Reconocimiento y dignidad para la labor de asistentes.',
    initials: 'RL',
    accentColor: '#6f3b89',
    estamento: 'asistentes',
    biografia: 'Asistente de la Educación con 18 años de trayectoria en inspectoría y contención escolar en la educación pública.',
    propuestaPrincipal: 'Capacitación continua en primeros auxilios psicológicos y equiparación de asignaciones para asistentes.',
    escuelaEstablecimiento: 'Colegio República de Costa Rica',
    fotoPerfil: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'carolina-tapia',
    name: 'Carolina Tapia',
    nombreCompleto: 'Carolina Tapia Godoy',
    role: 'Psicopedagoga',
    slogan: 'Comunidad escolar integrada con valor en cada rol.',
    initials: 'CT',
    accentColor: '#366d48',
    estamento: 'asistentes',
    biografia: 'Profesional PIE enfocada en diagnóstico e intervención socioemocional integral para comunidades vulnerables.',
    propuestaPrincipal: 'Crear duplas psicosociales permanentes en todos los colegios de la comuna para contención de crisis.',
    escuelaEstablecimiento: 'Escuela Martín Prado',
    fotoPerfil: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  // ── Apoderados ───────────────────────────────────────────────────────────
  {
    id: 'felipe-alvarez',
    name: 'Felipe Álvarez',
    nombreCompleto: 'Felipe Álvarez Orellana',
    role: 'Presidente Centro de Padres',
    slogan: 'Voz activa para las familias en las decisiones del servicio.',
    initials: 'FA',
    accentColor: '#b05d25',
    estamento: 'apoderados',
    biografia: 'Apoderado comprometido con la fiscalización transparente de recursos y mejora del servicio de alimentación de JUNAEB.',
    propuestaPrincipal: 'Auditorías participativas semestrales y mejor calidad en la alimentación e infraestructura escolar.',
    escuelaEstablecimiento: 'Escuela Martín Prado',
    fotoPerfil: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'daniela-salinas',
    name: 'Daniela Salinas',
    nombreCompleto: 'Daniela Salinas Palma',
    role: 'Representante Apoderados',
    slogan: 'Transparencia, infraestructura y bienestar estudiantil.',
    initials: 'DS',
    accentColor: '#20635b',
    estamento: 'apoderados',
    biografia: 'Madre y dirigente vecinal con amplia vocación comunitaria y defensa del transporte escolar rural.',
    propuestaPrincipal: 'Garantizar rutas de transporte escolar rural gratuitas y climatización en salas para invierno y verano.',
    escuelaEstablecimiento: 'Liceo Roberto Humeres Noble',
    fotoPerfil: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
  },
  // ── Estudiantes ───────────────────────────────────────────────────────────
  {
    id: 'ignacio-paredes',
    name: 'Ignacio Paredes',
    nombreCompleto: 'Ignacio Paredes Soto',
    role: 'Presidente Centro de Estudiantes',
    slogan: 'Voz juvenil, espacios recreativos y participación democrática real.',
    initials: 'IP',
    accentColor: '#0284c7',
    estamento: 'estudiantes',
    biografia: 'Estudiante de Enseñanza Media y líder estudiantil en actividades deportivas, culturales y medioambientales.',
    propuestaPrincipal: 'Crear presupuestos participativos estudiantiles para financiar torneos deportivos y talleres culturales inter-escolares.',
    escuelaEstablecimiento: 'Liceo Bicentenario',
    fotoPerfil: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __candidatesStore: Candidate[] | undefined;
}

const candidatesStore: Candidate[] =
  globalThis.__candidatesStore ?? (globalThis.__candidatesStore = INITIAL_CANDIDATES);

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (fullName.substring(0, 2) || 'CA').toUpperCase();
}

function getRandomAccentColor(estamento: Estamento): string {
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
    filtered = filtered.filter((c) => c.estamento.toLowerCase() === estamento.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (c) =>
        (c.nombreCompleto || c.name).toLowerCase().includes(q) ||
        (c.escuelaEstablecimiento || c.role).toLowerCase().includes(q) ||
        (c.slogan || '').toLowerCase().includes(q) ||
        (c.propuestaPrincipal || '').toLowerCase().includes(q),
    );
  }

  return filtered;
}

/**
 * Obtener un candidato por ID
 */
export function getCandidatoById(id: string): Candidate | undefined {
  return candidatesStore.find((c) => c.id === id);
}

/**
 * Crear un nuevo candidato
 */
export function addCandidato(data: CandidateFormData): Candidate {
  if (!data.nombreCompleto || !data.estamento || !data.propuestaPrincipal || !data.escuelaEstablecimiento) {
    throw new Error('Todos los campos principales del candidato son obligatorios.');
  }

  const id = `cand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
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
    biografia: data.biografia.trim(),
    propuestaPrincipal: data.propuestaPrincipal.trim(),
    escuelaEstablecimiento: data.escuelaEstablecimiento.trim(),
    fotoPerfil: data.fotoPerfil?.trim() || undefined,
  };

  candidatesStore.unshift(newCandidate);
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

  const updatedCandidate: Candidate = {
    ...existing,
    name: updatedName,
    nombreCompleto: updatedName,
    role: updatedSchool,
    slogan: updatedPropuesta,
    initials: getInitials(updatedName),
    estamento: updatedEstamento,
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
