import * as XLSX from 'xlsx';
import { cleanAndValidateRUT, formatRut } from '@/lib/rut-validator';
import { supabaseAdmin } from '@/lib/supabase-client';
import { getSchoolsMasterAsync, getSchoolsMasterMapAsync, SchoolMasterRecord } from '@/lib/schools-master-store';

export type EstamentoDecreto102 =
  | 'ESTUDIANTES'
  | 'PADRES_APODERADOS'
  | 'DOCENTES'
  | 'ASISTENTES'
  | 'DIRECTIVOS';

export interface PadronRecord {
  id: string;
  rutVotante: string;
  formattedRutVotante: string;
  rutEstudianteAsociado: string | null;
  formattedRutEstudiante: string | null;
  nombreCompleto: string;
  estamento: EstamentoDecreto102;
  rbdEstablecimiento: string;
  nombreEstablecimiento: string;
  slepId?: string;
  schoolId?: string;
  habilitado: boolean;
  haVotado: boolean;
  fechaVoto: string | null;
  createdAt: string;
}

export interface QuorumEstamentoStatus {
  estamento: EstamentoDecreto102;
  label: string;
  padronTotal: number;
  quorum30Requerido: number;
  votosEmitidos: number;
  porcentajeParticipacion: number;
  quorumAlcanzado: boolean;
}

export interface SchoolFilterOption {
  rbd: string;
  nombre: string;
}

export interface ExcelProcessingResult {
  success: boolean;
  totalFilas: number;
  registrosInsertados: number;
  registrosRechazados: number;
  quorums: QuorumEstamentoStatus[];
  erroresDetalle: Array<{ fila: number; rut?: string; motivo: string }>;
}

declare global {
  // eslint-disable-next-line no-var
  var __padronStore: PadronRecord[] | undefined;
}

// Registros iniciales vacíos (únicamente registros reales cargados de Supabase o Excel)
const INITIAL_MOCK_PADRON: PadronRecord[] = [];

const padronStore: PadronRecord[] =
  globalThis.__padronStore ?? (globalThis.__padronStore = INITIAL_MOCK_PADRON);


/**
 * Normaliza cualquier texto de estamento a los 5 Enums estrictos del Decreto N° 102
 */
export function normalizeEstamentoDecreto102(rawEstamento: string): EstamentoDecreto102 | null {
  if (!rawEstamento) return null;
  const sanitized = String(rawEstamento).trim().toUpperCase();

  if (
    sanitized.includes('ESTUDIANTE') ||
    sanitized.includes('ALUMNO') ||
    sanitized.includes('PUPILO') ||
    sanitized === 'EST'
  ) {
    return 'ESTUDIANTES';
  }
  if (
    sanitized.includes('PADRE') ||
    sanitized.includes('APODERADO') ||
    sanitized.includes('FAMILIAR') ||
    sanitized.includes('TUTOR') ||
    sanitized.includes('PADRES_APODERADOS') ||
    sanitized === 'APO'
  ) {
    return 'PADRES_APODERADOS';
  }
  if (
    sanitized.includes('DOCENTE') ||
    sanitized.includes('PROFESOR') ||
    sanitized.includes('MAESTRO') ||
    sanitized.includes('EDUCADOR') ||
    sanitized === 'DOC'
  ) {
    return 'DOCENTES';
  }
  if (
    sanitized.includes('ASISTENTE') ||
    sanitized.includes('PARADOCENTE') ||
    sanitized.includes('ADMINISTRATIVO') ||
    sanitized === 'ASI'
  ) {
    return 'ASISTENTES';
  }
  if (
    sanitized.includes('DIRECTIV') ||
    sanitized.includes('DIRECTOR') ||
    sanitized.includes('JEFE UTP') ||
    sanitized.includes('EQUIPO DIRECTIVO') ||
    sanitized === 'DIR'
  ) {
    return 'DIRECTIVOS';
  }

  return null;
}

/**
 * Calcula el Quórum inicial del 30% por estamento
 */
export function calculateEstamentoQuorums(records: PadronRecord[] = padronStore): QuorumEstamentoStatus[] {
  const estamentoMeta: Array<{ estamento: EstamentoDecreto102; label: string }> = [
    { estamento: 'ESTUDIANTES', label: 'Estudiantes' },
    { estamento: 'PADRES_APODERADOS', label: 'Padres y Apoderados' },
    { estamento: 'DOCENTES', label: 'Docentes' },
    { estamento: 'ASISTENTES', label: 'Asistentes de la Educación' },
    { estamento: 'DIRECTIVOS', label: 'Directivos' },
  ];

  return estamentoMeta.map(({ estamento, label }) => {
    const recordsByEstamento = records.filter((r) => r.estamento === estamento && r.habilitado);
    const padronTotal = recordsByEstamento.length;
    const quorum30Requerido = Math.ceil(padronTotal * 0.3);
    const votosEmitidos = recordsByEstamento.filter((r) => r.haVotado).length;
    const porcentajeParticipacion = padronTotal > 0 ? Number(((votosEmitidos / padronTotal) * 100).toFixed(1)) : 0;

    return {
      estamento,
      label,
      padronTotal,
      quorum30Requerido,
      votosEmitidos,
      porcentajeParticipacion,
      quorumAlcanzado: votosEmitidos >= quorum30Requerido && quorum30Requerido > 0,
    };
  });
}

/**
 * Extrae de forma dinámica todos los establecimientos reales presentes en el padrón
 */
export function getAvailableSchools(records: PadronRecord[] = padronStore): SchoolFilterOption[] {
  const map = new Map<string, string>();
  records.forEach((r) => {
    if (r.rbdEstablecimiento && r.nombreEstablecimiento) {
      map.set(r.rbdEstablecimiento, r.nombreEstablecimiento);
    }
  });

  return Array.from(map.entries()).map(([rbd, nombre]) => ({ rbd, nombre }));
}



/**
 * Obtiene el padrón completo con opciones de filtrado y búsqueda
 */
export function getPadronRecords({
  search = '',
  estamento = '',
  rbd = '',
  page = 1,
  pageSize = 50,
}: {
  search?: string;
  estamento?: string;
  rbd?: string;
  page?: number;
  pageSize?: number;
} = {}): {
  records: PadronRecord[];
  total: number;
  quorums: QuorumEstamentoStatus[];
  schools: SchoolFilterOption[];
} {
  let filtered = [...padronStore];

  if (search) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (r) =>
        r.nombreCompleto.toLowerCase().includes(q) ||
        r.rutVotante.toLowerCase().includes(q) ||
        r.formattedRutVotante.toLowerCase().includes(q) ||
        (r.rutEstudianteAsociado && r.rutEstudianteAsociado.toLowerCase().includes(q)),
    );
  }

  if (estamento && estamento !== 'ALL') {
    filtered = filtered.filter((r) => r.estamento === estamento);
  }

  if (rbd && rbd !== 'ALL') {
    filtered = filtered.filter((r) => r.rbdEstablecimiento === rbd);
  }

  return {
    records: filtered,
    total: filtered.length,
    quorums: calculateEstamentoQuorums(padronStore),
    schools: getAvailableSchools(padronStore),
  };
}

/**
 * Agrega un nuevo votante al padrón con validación Módulo 11 y Decreto 102
 */
export function addSingleVoter(data: {
  rutVotante: string;
  rutEstudianteAsociado?: string;
  nombreCompleto: string;
  estamento: EstamentoDecreto102;
  rbdEstablecimiento: string;
  nombreEstablecimiento: string;
}): PadronRecord {
  const rutValidation = cleanAndValidateRUT(data.rutVotante);
  if (!rutValidation.valid) {
    throw new Error(`RUN de votante inválido: ${rutValidation.errorReason}`);
  }

  let studentRutClean: string | null = null;
  let studentRutFormatted: string | null = null;

  if (data.estamento === 'PADRES_APODERADOS') {
    if (!data.rutEstudianteAsociado) {
      throw new Error(
        'Regla Decreto 102: Para el estamento Padres y Apoderados es obligatorio proporcionar el RUN del Estudiante asociado.',
      );
    }
    const studentValidation = cleanAndValidateRUT(data.rutEstudianteAsociado);
    if (!studentValidation.valid) {
      throw new Error(`RUN del estudiante asociado inválido: ${studentValidation.errorReason}`);
    }
    studentRutClean = studentValidation.cleanRut;
    studentRutFormatted = studentValidation.formattedRut;
  }

  // Comprobar duplicidad
  const duplicate = padronStore.find((r) => {
    if (r.estamento !== data.estamento) return false;
    if (data.estamento === 'PADRES_APODERADOS') {
      return r.rutVotante === rutValidation.cleanRut && r.rutEstudianteAsociado === studentRutClean;
    }
    return r.rutVotante === rutValidation.cleanRut;
  });

  if (duplicate) {
    throw new Error('Ya existe un registro con las mismas claves de identificación en este estamento.');
  }

  const newRecord: PadronRecord = {
    id: `padron-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    rutVotante: rutValidation.cleanRut,
    formattedRutVotante: rutValidation.formattedRut,
    rutEstudianteAsociado: studentRutClean,
    formattedRutEstudiante: studentRutFormatted,
    nombreCompleto: data.nombreCompleto.trim(),
    estamento: data.estamento,
    rbdEstablecimiento: data.rbdEstablecimiento.trim(),
    nombreEstablecimiento: data.nombreEstablecimiento.trim(),
    habilitado: true,
    haVotado: false,
    fechaVoto: null,
    createdAt: new Date().toISOString(),
  };

  padronStore.unshift(newRecord);
  return newRecord;
}

/**
 * Habilita o inhabilita un votante en el padrón
 */
export function toggleVoterHabilitado(id: string): PadronRecord {
  const index = padronStore.findIndex((r) => r.id === id);
  if (index === -1) {
    throw new Error('Registro del padrón no encontrado.');
  }

  padronStore[index].habilitado = !padronStore[index].habilitado;
  return padronStore[index];
}

/**
 * Elimina un registro del padrón
 */
export function deleteVoterRecord(id: string): boolean {
  const index = padronStore.findIndex((r) => r.id === id);
  if (index === -1) {
    return false;
  }

  padronStore.splice(index, 1);
  return true;
}

// ---------------------------------------------------------------------------
// MOTOR DE INGESTA EXCEL ROBUSTO MULTI-HOJA CON DETECCIÓN DE TABLA Y POSICIONES
// ---------------------------------------------------------------------------

/**
 * Ingesta Masiva desde Buffer de Excel (.xlsx / .xlsm)
 */
export function processPadronExcelBuffer(
  buffer: Buffer,
  masterMap?: Map<string, SchoolMasterRecord>,
): ExcelProcessingResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas de datos.');
  }

  let totalFilasLeidas = 0;
  let registrosInsertados = 0;
  const erroresDetalle: Array<{ fila: number; rut?: string; motivo: string }> = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
    if (!matrix || matrix.length === 0) continue;

    const sheetNameUpper = sheetName.toUpperCase();
    let defaultEstamento: EstamentoDecreto102 | null = null;
    if (sheetNameUpper.includes('APODERADO') || sheetNameUpper.includes('PADRE') || sheetNameUpper.includes('FAMILIAR')) {
      defaultEstamento = 'PADRES_APODERADOS';
    } else if (sheetNameUpper.includes('ESTUDIANTE') || sheetNameUpper.includes('ALUMNO')) {
      defaultEstamento = 'ESTUDIANTES';
    } else if (sheetNameUpper.includes('DOCENTE') || sheetNameUpper.includes('PROFESOR')) {
      defaultEstamento = 'DOCENTES';
    } else if (sheetNameUpper.includes('ASISTENTE')) {
      defaultEstamento = 'ASISTENTES';
    } else if (sheetNameUpper.includes('DIRECTIV') || sheetNameUpper.includes('FUNCIONARIO')) {
      defaultEstamento = 'DIRECTIVOS';
    }

    // Detección de Fila de Encabezados
    let headerRowIndex = -1;
    let colRutFamiliar = -1;
    let colNombreFamiliar = -1;
    let colApPaternoFamiliar = -1;
    let colApMaternoFamiliar = -1;
    let colNombreEstablecimiento = -1;
    let colRbd = -1;

    let colRutAlumno = -1;
    let colNombreAlumno = -1;
    let colApPaternoAlumno = -1;
    let colApMaternoAlumno = -1;

    let colRutGeneral = -1;
    let colNombresGeneral = -1;
    let colApellPaternoGeneral = -1;
    let colApellMaternoGeneral = -1;
    let colNombreCompletoGeneral = -1;
    let colEstamentoGeneral = -1;

    for (let r = 0; r < Math.min(25, matrix.length); r++) {
      const row = matrix[r];
      if (!Array.isArray(row)) continue;

      row.forEach((cellVal, c) => {
        const valStr = String(cellVal ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

        if (valStr === 'rutfamiliar' || valStr === 'runfamiliar' || valStr === 'rutapoderado' || valStr === 'runapoderado') {
          colRutFamiliar = c;
        } else if (valStr === 'nombrefamiliar' || valStr === 'nombreapoderado') {
          colNombreFamiliar = c;
        } else if (valStr === 'appaternofamiliar' || valStr === 'appaternoapoderado') {
          colApPaternoFamiliar = c;
        } else if (valStr === 'apmaternofamiliar' || valStr === 'apmaternoapoderado') {
          colApMaternoFamiliar = c;
        } else if (valStr === 'nombreestablecimiento' || valStr === 'escuelaliceo' || valStr === 'establecimiento' || valStr === 'nombrecolegio') {
          colNombreEstablecimiento = c;
        } else if (valStr === 'rbd' || valStr === 'codrbd') {
          colRbd = c;
        } else if (valStr === 'rutalumno' || valStr === 'runalumno' || valStr === 'rutestudiante' || valStr === 'runestudiante') {
          colRutAlumno = c;
        } else if (valStr === 'nombrealumno' || valStr === 'nombreestudiante') {
          colNombreAlumno = c;
        } else if (valStr === 'appaternoalumno' || valStr === 'appaternoestudiante') {
          colApPaternoAlumno = c;
        } else if (valStr === 'apmaternoalumno' || valStr === 'apmaternoestudiante') {
          colApMaternoAlumno = c;
        } else if (valStr === 'run' || valStr === 'rut' || valStr === 'cedula' || valStr === 'identificacion') {
          colRutGeneral = c;
        } else if (valStr === 'nombres' || valStr === 'nombre') {
          colNombresGeneral = c;
        } else if (valStr === 'apellidopaterno' || valStr === 'paterno') {
          colApellPaternoGeneral = c;
        } else if (valStr === 'apellidomaterno' || valStr === 'materno') {
          colApellMaternoGeneral = c;
        } else if (valStr === 'nombrecompleto' || valStr === 'votante') {
          colNombreCompletoGeneral = c;
        } else if (valStr === 'estamento' || valStr === 'cargo' || valStr === 'tipo') {
          colEstamentoGeneral = c;
        }
      });

      if (
        colRutFamiliar !== -1 ||
        colRutAlumno !== -1 ||
        (colRutGeneral !== -1 && (colNombreCompletoGeneral !== -1 || colNombresGeneral !== -1 || colEstamentoGeneral !== -1))
      ) {
        headerRowIndex = r;
        break;
      }
    }

    const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
    totalFilasLeidas += (matrix.length - startRow);

    for (let r = startRow; r < matrix.length; r++) {
      const row = matrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const filaNum = r + 1;

      // Extracción posicional estándar MINEDUC (Columnas A-S)
      const posNombreFamiliar = String(row[0] ?? '').trim();
      const posApPaternoFamiliar = String(row[1] ?? '').trim();
      const posApMaternoFamiliar = String(row[2] ?? '').trim();
      const posRutFamiliar = String(row[3] ?? '').trim();

      const posNombreEstablecimiento = String(row[4] ?? '').trim();
      const posRbd = String(row[5] ?? '').trim();

      const posRutAlumno = String(row[15] ?? '').trim();
      const posNombreAlumno = String(row[16] ?? '').trim();
      const posApPaternoAlumno = String(row[17] ?? '').trim();
      const posApMaternoAlumno = String(row[18] ?? '').trim();

      const hdrRutFamiliar = colRutFamiliar !== -1 ? String(row[colRutFamiliar] ?? '').trim() : '';
      const hdrRutAlumno = colRutAlumno !== -1 ? String(row[colRutAlumno] ?? '').trim() : '';
      const hdrRutGeneral = colRutGeneral !== -1 ? String(row[colRutGeneral] ?? '').trim() : '';

      const hdrNombreEstablecimiento = colNombreEstablecimiento !== -1 ? String(row[colNombreEstablecimiento] ?? '').trim() : '';
      const hdrRbd = colRbd !== -1 ? String(row[colRbd] ?? '').trim() : '';

      // ASIGNACIÓN ESTRICTA Y EXPLICITA DE HOJA
      let isApoderadoSheet = false;
      let isEstudianteSheet = false;

      if (defaultEstamento === 'PADRES_APODERADOS') {
        isApoderadoSheet = true;
      } else if (defaultEstamento === 'ESTUDIANTES') {
        isEstudianteSheet = true;
      } else if (colRutFamiliar !== -1) {
        isApoderadoSheet = true;
      } else if (colRutAlumno !== -1) {
        isEstudianteSheet = true;
      }

      let rawRutVotante = '';
      let rawRutEstudiante: string | null = null;
      let rawNombreCompleto = '';
      let rawEstamento = '';
      let rawRbd = '';
      let rawNombreColegio = '';

      if (isApoderadoSheet) {
        rawEstamento = 'PADRES_APODERADOS';
        rawRutVotante = hdrRutFamiliar || posRutFamiliar;
        rawRutEstudiante = hdrRutAlumno || posRutAlumno;

        if (colNombreFamiliar !== -1) {
          const nom = String(row[colNombreFamiliar] ?? '').trim();
          const pat = colApPaternoFamiliar !== -1 ? String(row[colApPaternoFamiliar] ?? '').trim() : '';
          const mat = colApMaternoFamiliar !== -1 ? String(row[colApMaternoFamiliar] ?? '').trim() : '';
          rawNombreCompleto = [nom, pat, mat].filter(Boolean).join(' ').trim();
        } else {
          rawNombreCompleto = [posNombreFamiliar, posApPaternoFamiliar, posApMaternoFamiliar].filter(Boolean).join(' ').trim();
        }

        rawNombreColegio = hdrNombreEstablecimiento || posNombreEstablecimiento || 'Establecimiento SLEP';
        rawRbd = hdrRbd || posRbd || '10101';

        // FILTRO DE DISCRIMINACIÓN: OMITIR SI NO HAY RUN DE APODERADO
        const cleanRutDigits = rawRutVotante.replace(/[^0-9kK]/g, '');
        if (
          !rawRutVotante ||
          !cleanRutDigits ||
          cleanRutDigits === '0' ||
          cleanRutDigits.length < 7 ||
          rawRutVotante.toUpperCase().includes('SIN') ||
          rawRutVotante.toUpperCase().includes('NO REGISTRA')
        ) {
          continue;
        }

      } else if (isEstudianteSheet) {
        rawEstamento = 'ESTUDIANTES';
        // En hoja de estudiantes, buscar el RUN del estudiante en todas las fuentes probables
        rawRutVotante =
          hdrRutAlumno ||
          hdrRutGeneral ||
          (posRutAlumno && posRutAlumno.length >= 7 ? posRutAlumno : '') ||
          (posRutFamiliar && posRutFamiliar.length >= 7 ? posRutFamiliar : '') ||
          String(row[0] ?? '').trim();
        rawRutEstudiante = null;

        if (colNombreAlumno !== -1) {
          const nom = String(row[colNombreAlumno] ?? '').trim();
          const pat = colApPaternoAlumno !== -1 ? String(row[colApPaternoAlumno] ?? '').trim() : '';
          const mat = colApMaternoAlumno !== -1 ? String(row[colApMaternoAlumno] ?? '').trim() : '';
          rawNombreCompleto = [nom, pat, mat].filter(Boolean).join(' ').trim();
        } else if (colNombresGeneral !== -1) {
          const nom = String(row[colNombresGeneral] ?? '').trim();
          const pat = colApellPaternoGeneral !== -1 ? String(row[colApellPaternoGeneral] ?? '').trim() : '';
          const mat = colApellMaternoGeneral !== -1 ? String(row[colApellMaternoGeneral] ?? '').trim() : '';
          rawNombreCompleto = [nom, pat, mat].filter(Boolean).join(' ').trim();
        } else if (posNombreAlumno || posApPaternoAlumno || posApMaternoAlumno) {
          rawNombreCompleto = [posNombreAlumno, posApPaternoAlumno, posApMaternoAlumno].filter(Boolean).join(' ').trim();
        } else if (posNombreFamiliar || posApPaternoFamiliar || posApMaternoFamiliar) {
          rawNombreCompleto = [posNombreFamiliar, posApPaternoFamiliar, posApMaternoFamiliar].filter(Boolean).join(' ').trim();
        } else {
          rawNombreCompleto = [String(row[1] ?? ''), String(row[2] ?? ''), String(row[3] ?? '')].filter(Boolean).join(' ').trim();
        }

        rawNombreColegio = hdrNombreEstablecimiento || posNombreEstablecimiento || String(row[4] ?? '').trim() || 'Establecimiento SLEP';
        rawRbd = hdrRbd || posRbd || String(row[5] ?? '').trim() || '10101';

        // FILTRO DE DISCRIMINACIÓN DE ESTUDIANTES SIN RUN
        const cleanRutDigits = rawRutVotante.replace(/[^0-9kK]/g, '');
        if (!rawRutVotante || !cleanRutDigits || cleanRutDigits === '0' || cleanRutDigits.length < 7) {
          continue;
        }

      } else {
        // Hoja General de Funcionarios
        rawRutVotante = hdrRutGeneral || String(row[0] ?? '').trim();
        rawEstamento = colEstamentoGeneral !== -1 ? String(row[colEstamentoGeneral] ?? '').trim() : String(row[4] ?? '').trim();

        if (colNombreCompletoGeneral !== -1 && String(row[colNombreCompletoGeneral] ?? '').trim()) {
          rawNombreCompleto = String(row[colNombreCompletoGeneral] ?? '').trim();
        } else if (colNombresGeneral !== -1) {
          const nom = String(row[colNombresGeneral] ?? '').trim();
          const pat = colApellPaternoGeneral !== -1 ? String(row[colApellPaternoGeneral] ?? '').trim() : '';
          const mat = colApellMaternoGeneral !== -1 ? String(row[colApellMaternoGeneral] ?? '').trim() : '';
          rawNombreCompleto = [nom, pat, mat].filter(Boolean).join(' ').trim();
        } else {
          rawNombreCompleto = [String(row[3] ?? ''), String(row[1] ?? ''), String(row[2] ?? '')].filter(Boolean).join(' ').trim();
        }

        rawNombreColegio = hdrNombreEstablecimiento || String(row[5] ?? '').trim() || 'Establecimiento SLEP';
        rawRbd = hdrRbd || String(row[6] ?? '').trim() || '10101';
      }

      // Omitir filas vacías
      if (!rawRutVotante && !rawNombreCompleto && !rawEstamento) {
        continue;
      }

      // 1. Validar RUN Votante
      const rutVal = cleanAndValidateRUT(rawRutVotante);
      if (!rutVal.valid) {
        erroresDetalle.push({
          fila: filaNum,
          rut: String(rawRutVotante || 'Desconocido'),
          motivo: `[Hoja ${sheetName}] RUN de Votante inválido: ${rutVal.errorReason}`,
        });
        continue;
      }

      // 2. Validar Nombre
      if (!rawNombreCompleto || rawNombreCompleto.trim().length < 2) {
        erroresDetalle.push({
          fila: filaNum,
          rut: rutVal.formattedRut,
          motivo: `[Hoja ${sheetName}] El nombre completo es requerido en el registro.`,
        });
        continue;
      }

      // 3. Validar Estamento Decreto 102
      let estamentoEnum = normalizeEstamentoDecreto102(rawEstamento);
      if (!estamentoEnum) {
        estamentoEnum = defaultEstamento;
      }

      if (!estamentoEnum) {
        erroresDetalle.push({
          fila: filaNum,
          rut: rutVal.formattedRut,
          motivo: `[Hoja ${sheetName}] Estamento no reconocido ("${rawEstamento || 'Vacío'}"). Debe ser Estudiantes, Padres/Apoderados, Docentes, Asistentes o Directivos.`,
        });
        continue;
      }

      // 4. Validar Binomio Apoderado-Estudiante para PADRES_APODERADOS
      let cleanStudentRut: string | null = null;
      let formattedStudentRut: string | null = null;

      if (estamentoEnum === 'PADRES_APODERADOS') {
        const cleanStudentDigits = (rawRutEstudiante ?? '').replace(/[^0-9kK]/g, '');

        if (!rawRutEstudiante || !cleanStudentDigits || cleanStudentDigits === '0' || cleanStudentDigits.length < 7) {
          erroresDetalle.push({
            fila: filaNum,
            rut: rutVal.formattedRut,
            motivo:
              `[Hoja ${sheetName}] Regla Decreto 102: Para el apoderado "${rawNombreCompleto}" no se especificó un RUN válido de Estudiante (RUT_ALUMNO).`,
          });
          continue;
        }

        const studentRutVal = cleanAndValidateRUT(rawRutEstudiante);
        if (!studentRutVal.valid) {
          erroresDetalle.push({
            fila: filaNum,
            rut: rutVal.formattedRut,
            motivo: `[Hoja ${sheetName}] RUN del Estudiante asociado inválido (${rawRutEstudiante}) para apoderado "${rawNombreCompleto}": ${studentRutVal.errorReason}`,
          });
          continue;
        }

        cleanStudentRut = studentRutVal.cleanRut;
        formattedStudentRut = studentRutVal.formattedRut;
      }

      // 5. Prevenir Duplicados
      const isDuplicate = padronStore.some((r) => {
        if (r.estamento !== estamentoEnum) return false;
        if (estamentoEnum === 'PADRES_APODERADOS') {
          return r.rutVotante === rutVal.cleanRut && r.rutEstudianteAsociado === cleanStudentRut;
        }
        return r.rutVotante === rutVal.cleanRut;
      });

      if (isDuplicate) {
        erroresDetalle.push({
          fila: filaNum,
          rut: rutVal.formattedRut,
          motivo: `[Hoja ${sheetName}] Registro duplicado ya existente en el padrón para este estamento`,
        });
        continue;
      }

      const cleanRbdStr = String(rawRbd || '10101').replace(/[^0-9]/g, '').trim();
      const masterSchool = masterMap?.get(cleanRbdStr);
      const nombreEstablecimientoFinal = masterSchool
        ? masterSchool.nombreOficial
        : (rawNombreColegio || 'Establecimiento SLEP').trim();

      // 6. Inserción en Lote
      padronStore.push({
        id: `padron-excel-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 5)}`,
        rutVotante: rutVal.cleanRut,
        formattedRutVotante: rutVal.formattedRut,
        rutEstudianteAsociado: cleanStudentRut,
        formattedRutEstudiante: formattedStudentRut,
        nombreCompleto: rawNombreCompleto.trim(),
        estamento: estamentoEnum,
        rbdEstablecimiento: cleanRbdStr || '10101',
        nombreEstablecimiento: nombreEstablecimientoFinal,
        habilitado: true,
        haVotado: false,
        fechaVoto: null,
        createdAt: new Date().toISOString(),
      });

      registrosInsertados++;
    }
  }

  return {
    success: true,
    totalFilas: totalFilasLeidas,
    registrosInsertados,
    registrosRechazados: erroresDetalle.length,
    quorums: calculateEstamentoQuorums(padronStore),
    erroresDetalle,
  };
}

export function resetPadronVotes() {
  padronStore.forEach((record) => {
    record.haVotado = false;
    record.fechaVoto = null;
  });
}

export async function resetPadronVotesAsync(): Promise<void> {
  resetPadronVotes();
  try {
    const { error } = await supabaseAdmin
      .from('bd_padron')
      .update({ ha_votado: false, fecha_voto: null })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('[SUPABASE] Error al resetear ha_votado en bd_padron:', error.message);
    } else {
      console.log('[SUPABASE] Estado de votos en bd_padron reseteado a cero.');
    }
  } catch (err) {
    console.error('[SUPABASE] Excepción en resetPadronVotesAsync:', err);
  }
}

export function clearPadronStore(): void {
  padronStore.length = 0;
}

export async function clearPadronStoreAsync(): Promise<void> {
  clearPadronStore();
  try {
    const { error } = await supabaseAdmin
      .from('bd_padron')
      .delete()
      .neq('rut_votante', '');

    if (error) {
      console.error('[SUPABASE] Error al vaciar bd_padron:', error.message);
    } else {
      console.log('[SUPABASE] Padrón electoral eliminado masivamente.');
    }
  } catch (err) {
    console.error('[SUPABASE] Excepción en clearPadronStoreAsync:', err);
  }
}


// ===========================================================================
// FUNCIONES ASÍNCRONAS CON PERSISTENCIA EN SUPABASE (bd_padron)
// ===========================================================================

function mapRowToPadronRecord(item: Record<string, unknown>): PadronRecord {
  return {
    id: String(item.id ?? ''),
    rutVotante: String(item.rut_votante ?? ''),
    formattedRutVotante: String(item.formatted_rut_votante ?? item.rut_votante ?? ''),
    rutEstudianteAsociado: item.rut_estudiante_asociado ? String(item.rut_estudiante_asociado) : null,
    formattedRutEstudiante: item.formatted_rut_estudiante ? String(item.formatted_rut_estudiante) : null,
    nombreCompleto: String(item.nombre_completo ?? ''),
    estamento: String(item.estamento ?? '') as EstamentoDecreto102,
    rbdEstablecimiento: String(item.rbd_establecimiento ?? ''),
    nombreEstablecimiento: String(item.nombre_establecimiento ?? ''),
    slepId: item.slep_id ? String(item.slep_id) : 'slep-principal',
    schoolId: item.school_id ? String(item.school_id) : String(item.rbd_establecimiento ?? ''),
    habilitado: Boolean(item.habilitado ?? true),
    haVotado: Boolean(item.ha_votado ?? false),
    fechaVoto: item.fecha_voto ? String(item.fecha_voto) : null,
    createdAt: String(item.created_at ?? new Date().toISOString()),
  };
}

/**
 * Obtiene la lista completa de todos los establecimientos únicos desde:
 * 1. bd_establecimientos_maestro (131 colegios oficiales - fuente de verdad)
 * 2. bd_padron via DISTINCT rbd_establecimiento (complementa colegios no en maestro)
 */
export async function getAllSchoolsAsync(): Promise<SchoolFilterOption[]> {
  const map = new Map<string, string>();

  if (!supabaseAdmin) {
    // Fallback solo en memoria local
    const localSchools = getAvailableSchools(padronStore);
    localSchools.forEach((s) => { if (s.rbd && s.nombre) map.set(s.rbd, s.nombre); });
    return Array.from(map.entries()).map(([rbd, nombre]) => ({ rbd, nombre }));
  }

  // 1. Catálogo Maestro (fuente de verdad: 131 RBDs oficiales)
  try {
    const masterSchools = await getSchoolsMasterAsync();
    masterSchools.forEach((s) => {
      const rbd = String(s.rbd || '').trim();
      const nombre = String(s.nombreOficial || '').trim();
      if (rbd && nombre) map.set(rbd, nombre);
    });
  } catch (err) {
    console.error('[SUPABASE] Error obteniendo catálogo maestro en getAllSchoolsAsync:', err);
  }

  // 2. Consulta DISTINCT a bd_padron para capturar RBDs no presentes en el maestro
  try {
    // Paginación por lotes de 1.000 (respetando el límite por defecto de PostgREST)
    const BATCH = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('bd_padron')
        .select('rbd_establecimiento, nombre_establecimiento')
        .not('rbd_establecimiento', 'is', null)
        .order('rbd_establecimiento', { ascending: true })
        .range(page * BATCH, (page + 1) * BATCH - 1);

      if (error || !data || data.length === 0) { hasMore = false; break; }

      data.forEach((item: Record<string, unknown>) => {
        const rbd = String(item.rbd_establecimiento || '').trim();
        const nombre = String(item.nombre_establecimiento || '').trim();
        // Solo agregar si no está ya en el mapa (el maestro tiene prioridad)
        if (rbd && nombre && !map.has(rbd)) map.set(rbd, nombre);
      });

      if (data.length < BATCH) { hasMore = false; } else { page++; }
    }
  } catch (err) {
    console.error('[SUPABASE] Error obteniendo establecimientos de bd_padron:', err);
  }

  // 3. Fallback en memoria local si todo falló
  if (map.size === 0) {
    const localSchools = getAvailableSchools(padronStore);
    localSchools.forEach((s) => { if (s.rbd && s.nombre) map.set(s.rbd, s.nombre); });
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([rbd, nombre]) => ({ rbd, nombre }));
}

/**
 * Obtiene la TOTALIDAD de los registros del padrón desde Supabase realizando paginación interna en lotes de 1.000 filas.
 * Esto evita la pérdida o truncamiento de registros por el límite max_rows por defecto de PostgREST / Supabase.
 */
export async function getAllPadronRecordsAsync({
  search = '',
  estamento = '',
  rbd = '',
  slepId = '',
}: {
  search?: string;
  estamento?: string;
  rbd?: string;
  slepId?: string;
} = {}): Promise<{
  records: PadronRecord[];
  total: number;
}> {
  if (!supabaseAdmin) {
    const local = getPadronRecords({ search, estamento, rbd });
    return { records: local.records, total: local.records.length };
  }

  try {
    const allRecords: PadronRecord[] = [];
    let page = 0;
    const BATCH_SIZE = 1000;
    let totalCount = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabaseAdmin
        .from('bd_padron')
        .select('*', { count: 'exact' })
        .order('nombre_completo', { ascending: true });

      if (slepId && slepId !== 'ALL') {
        query = query.eq('slep_id', slepId);
      }
      if (estamento && estamento !== 'ALL') {
        query = query.eq('estamento', estamento.toUpperCase());
      }
      if (rbd && rbd !== 'ALL') {
        query = query.eq('rbd_establecimiento', rbd);
      }
      if (search) {
        const q = search.trim();
        query = query.or(
          `rut_votante.ilike.%${q}%,nombre_completo.ilike.%${q}%,nombre_establecimiento.ilike.%${q}%`,
        );
      }

      const from = page * BATCH_SIZE;
      const to = from + BATCH_SIZE - 1;

      const { data, count, error } = await query.range(from, to);

      if (error || !data || data.length === 0) {
        if (page === 0) {
          if (error) console.error('[SUPABASE] Error en getAllPadronRecordsAsync:', error.message);
          const local = getPadronRecords({ search, estamento, rbd });
          return { records: local.records, total: local.records.length };
        }
        hasMore = false;
        break;
      }

      if (count !== null && count !== undefined) {
        totalCount = count;
      }

      const mapped = data.map((item) => mapRowToPadronRecord(item as Record<string, unknown>));
      allRecords.push(...mapped);

      if (data.length < BATCH_SIZE || (totalCount > 0 && allRecords.length >= totalCount)) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return {
      records: allRecords,
      total: totalCount || allRecords.length,
    };
  } catch (err) {
    console.error('[SUPABASE] Excepción en getAllPadronRecordsAsync:', err);
    const local = getPadronRecords({ search, estamento, rbd });
    return { records: local.records, total: local.records.length };
  }
}

/**
 * Obtener el padrón filtrado desde Supabase (o fallback en memoria)
 */
export async function getPadronRecordsAsync({
  search = '',
  estamento = '',
  rbd = '',
  slepId = '',
  page = 1,
  pageSize = 50,
}: {
  search?: string;
  estamento?: string;
  rbd?: string;
  slepId?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{
  records: PadronRecord[];
  total: number;
  totalPages: number;
  currentPage: number;
  quorums: QuorumEstamentoStatus[];
  schools: SchoolFilterOption[];
}> {
  try {
    let query = supabaseAdmin
      .from('bd_padron')
      .select('*', { count: 'exact' })
      .order('nombre_completo', { ascending: true });

    if (slepId && slepId !== 'ALL') {
      query = query.eq('slep_id', slepId);
    }
    if (estamento && estamento !== 'ALL') {
      query = query.eq('estamento', estamento.toUpperCase());
    }
    if (rbd && rbd !== 'ALL') {
      query = query.eq('rbd_establecimiento', rbd);
    }
    if (search) {
      const q = search.trim();
      query = query.or(
        `rut_votante.ilike.%${q}%,nombre_completo.ilike.%${q}%,nombre_establecimiento.ilike.%${q}%`,
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error('[SUPABASE] Error leyendo bd_padron:', error.message);
      const localData = getPadronRecords({ search, estamento, rbd });
      const totalLocal = localData.records.length;
      const slicedLocal = localData.records.slice(from, from + pageSize);
      return {
        records: slicedLocal,
        total: totalLocal,
        totalPages: Math.ceil(totalLocal / pageSize) || 1,
        currentPage: page,
        quorums: localData.quorums,
        schools: localData.schools,
      };
    }

    const records = (data || []).map((item) => mapRowToPadronRecord(item as Record<string, unknown>));
    const total = count ?? records.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const allSchools = await getAllSchoolsAsync();

    // Obtener los registros necesarios para el cálculo exacto de quórums a nivel de padrón
    const { records: quorumRecords } = await getAllPadronRecordsAsync({ search, estamento, rbd, slepId });

    return {
      records,
      total,
      totalPages,
      currentPage: page,
      quorums: calculateEstamentoQuorums(quorumRecords.length > 0 ? quorumRecords : records),
      schools: allSchools,
    };
  } catch (err) {
    console.error('[SUPABASE] Excepción al consultar bd_padron:', err);
    const localData = getPadronRecords({ search, estamento, rbd });
    return {
      records: localData.records.slice(0, pageSize),
      total: localData.records.length,
      totalPages: Math.ceil(localData.records.length / pageSize) || 1,
      currentPage: page,
      quorums: localData.quorums,
      schools: localData.schools,
    };
  }
}

/**
 * Busca específicamente en Supabase bd_padron todos los registros asociados a un RUN Apoderado
 */
export async function findApoderadoRecordsAsync(rutApoderado: string): Promise<PadronRecord[]> {
  const clean = rutApoderado.replace(/[^0-9kK]/g, '').toUpperCase();
  const digits = clean.replace(/[^0-9]/g, '');

  if (!supabaseAdmin || !digits) {
    return getPadronRecords().records.filter(
      (r) => r.estamento === 'PADRES_APODERADOS' && r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('bd_padron')
      .select('*')
      .eq('estamento', 'PADRES_APODERADOS')
      .or(`rut_votante.ilike.%${digits}%,formatted_rut_votante.ilike.%${digits}%`);

    if (error || !data || data.length === 0) {
      return getPadronRecords().records.filter(
        (r) => r.estamento === 'PADRES_APODERADOS' && r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
      );
    }

    const records = data.map((item) => mapRowToPadronRecord(item as Record<string, unknown>));
    return records.filter((r) => r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean);
  } catch (err) {
    console.error('[SUPABASE] Excepción al buscar registros de apoderado:', err);
    return getPadronRecords().records.filter(
      (r) => r.estamento === 'PADRES_APODERADOS' && r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
    );
  }
}

/**
 * Busca específicamente en Supabase bd_padron el registro de un funcionario (Docente/Asistente/Directivo) por su RUN
 */
export async function findFuncionarioRecordAsync(rutFuncionario: string): Promise<PadronRecord | null> {
  const clean = rutFuncionario.replace(/[^0-9kK]/g, '').toUpperCase();
  const digits = clean.replace(/[^0-9]/g, '');

  if (!supabaseAdmin || !digits) {
    return (
      getPadronRecords().records.find(
        (r) =>
          ['DOCENTES', 'ASISTENTES', 'DIRECTIVOS'].includes(r.estamento) &&
          r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
      ) ?? null
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('bd_padron')
      .select('*')
      .in('estamento', ['DOCENTES', 'ASISTENTES', 'DIRECTIVOS'])
      .or(`rut_votante.ilike.%${digits}%,formatted_rut_votante.ilike.%${digits}%`);

    if (error || !data || data.length === 0) {
      return (
        getPadronRecords().records.find(
          (r) =>
            ['DOCENTES', 'ASISTENTES', 'DIRECTIVOS'].includes(r.estamento) &&
            r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
        ) ?? null
      );
    }

    const records = data.map((item) => mapRowToPadronRecord(item as Record<string, unknown>));
    return records.find((r) => r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean) ?? null;
  } catch (err) {
    console.error('[SUPABASE] Excepción al buscar registro de funcionario:', err);
    return (
      getPadronRecords().records.find(
        (r) =>
          ['DOCENTES', 'ASISTENTES', 'DIRECTIVOS'].includes(r.estamento) &&
          r.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase() === clean,
      ) ?? null
    );
  }
}

/**
 * Agregar un votante al padrón en Supabase y en memoria
 */
export async function addSingleVoterAsync(data: {
  rutVotante: string;
  rutEstudianteAsociado?: string;
  nombreCompleto: string;
  estamento: EstamentoDecreto102;
  rbdEstablecimiento: string;
  nombreEstablecimiento: string;
}): Promise<PadronRecord> {
  // Primero validar con la función síncrona (que maneja validación RUT, duplicados, etc.)
  const localRecord = addSingleVoter(data);

  // Luego persistir en Supabase
  try {
    const { error } = await supabaseAdmin.from('bd_padron').insert({
      rut_votante: localRecord.rutVotante,
      formatted_rut_votante: localRecord.formattedRutVotante,
      rut_estudiante_asociado: localRecord.rutEstudianteAsociado,
      formatted_rut_estudiante: localRecord.formattedRutEstudiante,
      nombre_completo: localRecord.nombreCompleto,
      estamento: localRecord.estamento,
      rbd_establecimiento: localRecord.rbdEstablecimiento,
      nombre_establecimiento: localRecord.nombreEstablecimiento,
      habilitado: true,
      ha_votado: false,
      fecha_voto: null,
      created_at: localRecord.createdAt,
    });

    if (error) {
      console.error('[SUPABASE] Error insertando en bd_padron:', error.message);
    } else {
      console.log('[SUPABASE] Votante insertado en bd_padron:', localRecord.rutVotante);
    }
  } catch (err) {
    console.error('[SUPABASE] Excepción al insertar votante:', err);
  }

  return localRecord;
}

/**
 * Habilitar/inhabilitar votante en Supabase y en memoria
 */
export async function toggleVoterHabilitadoAsync(id: string): Promise<PadronRecord> {
  const local = toggleVoterHabilitado(id);

  try {
    const { error } = await supabaseAdmin
      .from('bd_padron')
      .update({ habilitado: local.habilitado })
      .eq('rut_votante', local.rutVotante);

    if (error) {
      console.error('[SUPABASE] Error actualizando habilitado en bd_padron:', error.message);
    }
  } catch (err) {
    console.error('[SUPABASE] Excepción al actualizar habilitado:', err);
  }

  return local;
}

/**
 * Eliminar votante en Supabase y en memoria
 */
export async function deleteVoterRecordAsync(id: string): Promise<boolean> {
  // Buscar el rut_votante antes de eliminar de memoria
  const record = padronStore.find((r) => r.id === id);
  const deleted = deleteVoterRecord(id);

  if (deleted && record) {
    try {
      const { error } = await supabaseAdmin
        .from('bd_padron')
        .delete()
        .eq('rut_votante', record.rutVotante);

      if (error) {
        console.error('[SUPABASE] Error eliminando de bd_padron:', error.message);
      } else {
        console.log('[SUPABASE] Votante eliminado de bd_padron:', record.rutVotante);
      }
    } catch (err) {
      console.error('[SUPABASE] Excepción al eliminar votante:', err);
    }
  }

  return deleted;
}

/**
 * Carga masiva de Excel con persistencia en Supabase
 */
export async function processPadronExcelBufferAsync(buffer: Buffer): Promise<ExcelProcessingResult> {
  const masterMap = await getSchoolsMasterMapAsync();
  const result = processPadronExcelBuffer(buffer, masterMap);

  // Sincronizar los registros nuevos a Supabase en lotes
  if (result.registrosInsertados > 0) {
    const newRecords = padronStore.slice(padronStore.length - result.registrosInsertados);
    const rows = newRecords.map((r) => ({
      rut_votante: r.rutVotante,
      formatted_rut_votante: r.formattedRutVotante,
      rut_estudiante_asociado: r.rutEstudianteAsociado,
      formatted_rut_estudiante: r.formattedRutEstudiante,
      nombre_completo: r.nombreCompleto,
      estamento: r.estamento,
      rbd_establecimiento: r.rbdEstablecimiento,
      nombre_establecimiento: r.nombreEstablecimiento,
      habilitado: r.habilitado,
      ha_votado: r.haVotado,
      fecha_voto: r.fechaVoto,
      created_at: r.createdAt,
    }));

    try {
      const BATCH_SIZE = 500;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabaseAdmin
          .from('bd_padron')
          .insert(batch);

        if (error) {
          console.error(`[SUPABASE] Error en carga masiva Excel a bd_padron (Lote ${Math.floor(i / BATCH_SIZE) + 1}):`, error.message);
        } else {
          console.log(`[SUPABASE] Lote de ${batch.length} registros cargados en bd_padron (${i + batch.length}/${result.registrosInsertados}).`);
        }
      }
    } catch (err) {
      console.error('[SUPABASE] Excepción en carga masiva:', err);
    }
  }

  return result;
}
