import * as XLSX from 'xlsx';
import type { Candidate, Estamento } from '@/types';
import type { CandidateFormData } from '@/lib/candidates-store';

/**
 * Normaliza cualquier variante de estamento a los 5 estamentos canónicos
 */
export function normalizeEstamento(raw: unknown): Estamento | null {
  if (!raw) return null;
  const str = String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (str.includes('directiv') || str === 'director' || str === 'directora') {
    return 'directivos';
  }
  if (str.includes('docent') || str.includes('profesor') || str === 'doc') {
    return 'docentes';
  }
  if (str.includes('asistent') || str.includes('asist') || str.includes('paradocent')) {
    return 'asistentes';
  }
  if (
    str.includes('apoderad') ||
    str.includes('padre') ||
    str.includes('madre') ||
    str.includes('familia') ||
    str === 'padres_apoderados'
  ) {
    return 'apoderados';
  }
  if (str.includes('estudiant') || str.includes('alumn') || str === 'est') {
    return 'estudiantes';
  }

  return null;
}

/**
 * Mapeo de nombres canónicos de estamento para presentación en Excel
 */
export const ESTAMENTO_LABELS: Record<Estamento, string> = {
  directivos: 'Directivos',
  docentes: 'Docentes',
  asistentes: 'Asistentes de la Educación',
  apoderados: 'Padres y Apoderados',
  estudiantes: 'Estudiantes',
};

export interface ParsedCandidateItem {
  id?: string;
  nombreCompleto: string;
  estamento: Estamento;
  numero?: number | null;
  rbd?: string;
  escuelaEstablecimiento: string;
  propuestaPrincipal: string;
  biografia?: string;
  fotoPerfil?: string;
}

export interface ParseCandidateResult {
  records: ParsedCandidateItem[];
  erroresDetalle: Array<{ fila: number; candidato?: string; motivo: string }>;
  totalFilasLeidas: number;
}

/**
 * Normaliza nombres de encabezados para coincidencia flexible
 */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Parsea un archivo Excel (.xlsx, .xls) o CSV con candidaturas
 */
export function parseCandidatesWorkbook(data: ArrayBuffer | Buffer): ParseCandidateResult {
  const readType = typeof Buffer !== 'undefined' && Buffer.isBuffer(data) ? 'buffer' : 'array';
  const workbook = XLSX.read(data, { type: readType });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo no contiene ninguna hoja de datos.');
  }

  const records: ParsedCandidateItem[] = [];
  const erroresDetalle: Array<{ fila: number; candidato?: string; motivo: string }> = [];
  let totalFilasLeidas = 0;

  for (const sheetName of workbook.SheetNames) {
    // Si la hoja se llama "instrucciones" o "ayuda", se omite
    if (sheetName.toLowerCase().includes('instruccion') || sheetName.toLowerCase().includes('ayuda')) {
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
    if (!rawRows || rawRows.length === 0) continue;

    // Detectar si la primera fila tiene cabeceras o si necesitamos mapear índices
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNumber = i + 2; // +2 por índice 0 y cabecera en fila 1
      totalFilasLeidas++;

      // Extraer campos buscando en todas las claves posibles
      let rawNumero: unknown = undefined;
      let rawNombre: unknown = undefined;
      let rawEstamento: unknown = undefined;
      let rawRbd: unknown = undefined;
      let rawEscuela: unknown = undefined;
      let rawPropuesta: unknown = undefined;
      let rawBiografia: unknown = undefined;
      let rawFoto: unknown = undefined;
      let rawId: unknown = undefined;

      for (const [key, value] of Object.entries(row)) {
        const normKey = normalizeHeader(key);

        if (['n', 'nro', 'numero', 'num', 'sorteo', 'papeleta', 'nposicion', 'posicion', 'no'].includes(normKey) || normKey.startsWith('num') || normKey.startsWith('nro')) {
          rawNumero = value;
        } else if (normKey.includes('rbd')) {
          rawRbd = value;
        } else if (normKey.includes('nombre') || normKey.includes('candidat') || normKey.includes('postulant')) {
          rawNombre = value;
        } else if (normKey.includes('estamento') || normKey === 'rol' || normKey === 'tipo') {
          rawEstamento = value;
        } else if (normKey.includes('establecimiento') || normKey.includes('escuela') || normKey.includes('colegio') || normKey.includes('institucion') || normKey.includes('cargo')) {
          rawEscuela = value;
        } else if (normKey.includes('propuesta') || normKey.includes('slogan') || normKey.includes('lema') || normKey.includes('programa')) {
          rawPropuesta = value;
        } else if (normKey.includes('biograf') || normKey.includes('bio') || normKey.includes('trayectoria') || normKey.includes('resena') || normKey.includes('descripcion')) {
          rawBiografia = value;
        } else if (normKey.includes('foto') || normKey.includes('imagen') || normKey.includes('avatar') || normKey.includes('fotografia')) {
          rawFoto = value;
        } else if (['id', 'idcandidato', 'candidateid', 'candidatoid', 'idsistema'].includes(normKey)) {
          rawId = value;
        }
      }

      const nombre = String(rawNombre ?? '').trim();
      const escuela = String(rawEscuela ?? '').trim();
      const propuesta = String(rawPropuesta ?? '').trim();
      const rbd = rawRbd !== undefined && rawRbd !== null && String(rawRbd).trim() !== '' ? String(rawRbd).trim() : undefined;
      const biografia = rawBiografia !== undefined && rawBiografia !== null ? String(rawBiografia).trim() : '';
      const fotoPerfil = rawFoto !== undefined && rawFoto !== null && String(rawFoto).trim() !== '' ? String(rawFoto).trim() : undefined;
      const customId = rawId !== undefined && rawId !== null && String(rawId).trim() !== '' ? String(rawId).trim() : undefined;

      // Si la fila está completamente vacía, saltar
      if (!nombre && !rawEstamento && !escuela && !propuesta) {
        continue;
      }

      // Validar Nombre
      if (!nombre) {
        erroresDetalle.push({
          fila: rowNumber,
          motivo: 'Falta el nombre completo del candidato.',
        });
        continue;
      }

      // Validar Estamento
      const normalizedEstamento = normalizeEstamento(rawEstamento);
      if (!normalizedEstamento) {
        erroresDetalle.push({
          fila: rowNumber,
          candidato: nombre,
          motivo: `Estamento no reconocido o vacío ("${String(rawEstamento ?? '')}"). Debe ser: directivos, docentes, asistentes, apoderados o estudiantes.`,
        });
        continue;
      }

      // Validar Establecimiento / Escuela
      if (!escuela && !rbd) {
        erroresDetalle.push({
          fila: rowNumber,
          candidato: nombre,
          motivo: 'Falta el nombre del establecimiento o el código RBD.',
        });
        continue;
      }

      // Validar Propuesta
      if (!propuesta) {
        erroresDetalle.push({
          fila: rowNumber,
          candidato: nombre,
          motivo: 'Falta la propuesta principal o lema de la candidatura.',
        });
        continue;
      }

      // Parsear Número de Sorteo / Papeleta
      let numero: number | null = null;
      if (rawNumero !== undefined && rawNumero !== null && String(rawNumero).trim() !== '') {
        const parsed = parseInt(String(rawNumero).trim(), 10);
        if (!isNaN(parsed) && parsed > 0) {
          numero = parsed;
        }
      }

      records.push({
        id: customId,
        nombreCompleto: nombre,
        estamento: normalizedEstamento,
        numero,
        rbd,
        escuelaEstablecimiento: escuela || (rbd ? `Establecimiento RBD ${rbd}` : 'Establecimiento SLEP'),
        propuestaPrincipal: propuesta,
        biografia,
        fotoPerfil,
      });
    }
  }

  return {
    records,
    erroresDetalle,
    totalFilasLeidas,
  };
}

/**
 * Crea un libro de trabajo Excel con el listado completo de candidaturas
 */
export function exportCandidatesToWorkbook(candidates: Candidate[]): XLSX.WorkBook {
  const headers = [
    'N°',
    'Nombre Completo',
    'Estamento',
    'RBD',
    'Establecimiento / Escuela',
    'Propuesta Principal',
    'Biografía / Trayectoria',
    'Foto Perfil (URL)',
    'ID Sistema',
  ];

  const rows = candidates.map((c) => [
    c.numero ?? '',
    c.nombreCompleto || c.name || '',
    ESTAMENTO_LABELS[c.estamento] || c.estamento || '',
    c.rbd || '',
    c.escuelaEstablecimiento || c.role || '',
    c.propuestaPrincipal || c.slogan || '',
    c.biografia || '',
    c.fotoPerfil || '',
    c.id || '',
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Anchos de columna recomendados
  worksheet['!cols'] = [
    { wch: 6 },  // N°
    { wch: 30 }, // Nombre Completo
    { wch: 24 }, // Estamento
    { wch: 10 }, // RBD
    { wch: 38 }, // Establecimiento
    { wch: 45 }, // Propuesta
    { wch: 40 }, // Biografía
    { wch: 35 }, // Foto Perfil
    { wch: 25 }, // ID
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidatos');

  return workbook;
}

/**
 * Genera el Buffer de Excel (.xlsx) a partir de una lista de candidatos
 */
export function exportCandidatesToBuffer(candidates: Candidate[]): Buffer {
  const workbook = exportCandidatesToWorkbook(candidates);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * Genera el contenido CSV con BOM UTF-8 a partir de una lista de candidatos
 */
export function exportCandidatesToCsv(candidates: Candidate[]): string {
  const headers = [
    'N°',
    'Nombre Completo',
    'Estamento',
    'RBD',
    'Establecimiento / Escuela',
    'Propuesta Principal',
    'Biografía',
    'Foto Perfil (URL)',
    'ID Sistema',
  ];

  function escapeCell(val: unknown): string {
    if (val === null || val === undefined) return '""';
    const s = String(val);
    return `"${s.replace(/"/g, '""')}"`;
  }

  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(';'));

  candidates.forEach((c) => {
    lines.push(
      [
        c.numero ?? '',
        c.nombreCompleto || c.name || '',
        ESTAMENTO_LABELS[c.estamento] || c.estamento || '',
        c.rbd || '',
        c.escuelaEstablecimiento || c.role || '',
        c.propuestaPrincipal || c.slogan || '',
        c.biografia || '',
        c.fotoPerfil || '',
        c.id || '',
      ]
        .map(escapeCell)
        .join(';'),
    );
  });

  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Genera una plantilla de ejemplo para importación de candidatos
 */
export function generateCandidateTemplateWorkbook(): Buffer {
  const headers = [
    'N°',
    'Nombre Completo',
    'Estamento',
    'RBD',
    'Establecimiento / Escuela',
    'Propuesta Principal',
    'Biografía / Trayectoria',
    'Foto Perfil (URL)',
  ];

  const sampleRows = [
    [
      1,
      'María José Valenzuela Soto',
      'Docentes',
      '10201',
      'Liceo Roberto Humeres Noble',
      'Fortalecimiento de la convivencia escolar y apoyo a la innovación pedagógica en el aula.',
      'Profesora de Educación General Básica con 12 años de trayectoria docente en el SLEP.',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    ],
    [
      2,
      'Carlos Eduardo Morales Pino',
      'Docentes',
      '10202',
      'Escuela Martín Prado',
      'Optimización de recursos pedagógicos e integración comunitaria.',
      'Docente de Ciencias Naturales y coordinador de proyectos ambientales.',
      '',
    ],
    [
      1,
      'Patricia Andrea Gómez Lagos',
      'Asistentes de la Educación',
      '10203',
      'Colegio República de Costa Rica',
      'Dignificación y capacitación continua para todo el estamento de asistentes.',
      'Asistente de aula con 8 años de servicio en el establecimiento.',
      '',
    ],
    [
      1,
      'Roberto Ignacio Muñoz Vega',
      'Padres y Apoderados',
      '10204',
      'Liceo José Victorino Lastarria',
      'Participación activa y transparente de las familias en las decisiones del Consejo Local.',
      'Presidente del Centro General de Padres y Apoderados.',
      '',
    ],
    [
      1,
      'Sofía Belén Castro Rivas',
      'Estudiantes',
      '10205',
      'Liceo Carmela Carvajal de Prat',
      'Voz estudiantil para una educación pública integral, inclusiva y con mejor salud mental.',
      'Presidenta del Centro de Alumnos y delegada comunal.',
      '',
    ],
    [
      1,
      'Héctor Fernando Silva Ortiz',
      'Directivos',
      '10201',
      'Liceo Roberto Humeres Noble',
      'Liderazgo directivo participativo y gestión escolar de alto impacto.',
      'Director de establecimiento educacional con amplia trayectoria en gestión pública.',
      '',
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

  worksheet['!cols'] = [
    { wch: 6 },  // N°
    { wch: 30 }, // Nombre Completo
    { wch: 24 }, // Estamento
    { wch: 10 }, // RBD
    { wch: 38 }, // Establecimiento
    { wch: 45 }, // Propuesta
    { wch: 40 }, // Biografía
    { wch: 35 }, // Foto Perfil
  ];

  // Hoja de instrucciones
  const instructionHeaders = ['Campo', 'Obligatorio', 'Descripción', 'Ejemplos válidos'];
  const instructionRows = [
    ['N°', 'Opcional', 'Número de sorteo o posición en la papeleta de votación.', '1, 2, 3...'],
    ['Nombre Completo', 'SÍ', 'Nombre y dos apellidos del candidato postulante.', 'María José Valenzuela Soto'],
    ['Estamento', 'SÍ', 'Estamento al que postula la candidatura.', 'Docentes, Asistentes, Apoderados, Estudiantes, Directivos'],
    ['RBD', 'Opcional', 'Rol Base de Datos oficial del colegio (número).', '10201, 10202...'],
    ['Establecimiento / Escuela', 'SÍ', 'Nombre oficial del colegio o escuela del candidato.', 'Liceo Roberto Humeres Noble'],
    ['Propuesta Principal', 'SÍ', 'Propuesta o lema principal para el Consejo Local SLEP.', 'Fortalecer la convivencia escolar...'],
    ['Biografía / Trayectoria', 'Opcional', 'Breve reseña personal y trayectoria del candidato.', 'Docente con 10 años de experiencia...'],
    ['Foto Perfil (URL)', 'Opcional', 'Enlace web directo (https) a la fotografía del candidato.', 'https://miservidor.cl/foto.jpg'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet([instructionHeaders, ...instructionRows]);
  wsInstructions['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 45 },
    { wch: 45 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Candidatos');
  XLSX.utils.book_append_sheet(workbook, wsInstructions, 'Instrucciones');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
