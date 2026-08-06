import * as XLSX from 'xlsx';
import { cleanAndValidateRUT } from '@/lib/rut-validator';
import { normalizeEstamentoDecreto102, type EstamentoDecreto102, type SchoolMasterRecord } from '@/lib/padron-store';

export interface ParsedPadronItem {
  rutVotante: string;
  formattedRutVotante: string;
  rutEstudianteAsociado: string | null;
  formattedRutEstudiante: string | null;
  nombreCompleto: string;
  estamento: EstamentoDecreto102;
  rbdEstablecimiento: string;
  nombreEstablecimiento: string;
}

export interface ParsedWorkbookResult {
  records: ParsedPadronItem[];
  erroresDetalle: Array<{ fila: number; rut?: string; motivo: string }>;
  totalFilasLeidas: number;
}

/**
 * Parsea un Buffer o ArrayBuffer de Excel (.xlsx / .xlsm) en el cliente o servidor.
 * Retorna la lista de registros estructurados y validados, más el desglose de errores por fila.
 */
export function parsePadronWorkbook(
  buffer: ArrayBuffer | Buffer,
  masterMap?: Map<string, SchoolMasterRecord>,
): ParsedWorkbookResult {
  const readType = typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer) ? 'buffer' : 'array';
  const workbook = XLSX.read(buffer, { type: readType });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas de datos.');
  }

  let totalFilasLeidas = 0;
  const records: ParsedPadronItem[] = [];
  const erroresDetalle: Array<{ fila: number; rut?: string; motivo: string }> = [];
  const existingKeys = new Set<string>();

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

      // 5. Prevenir Duplicados dentro de la planilla Excel
      const dedupKey = estamentoEnum === 'PADRES_APODERADOS'
        ? `${estamentoEnum}:${rutVal.cleanRut}:${cleanStudentRut}`
        : `${estamentoEnum}:${rutVal.cleanRut}`;

      if (existingKeys.has(dedupKey)) {
        erroresDetalle.push({
          fila: filaNum,
          rut: rutVal.formattedRut,
          motivo: `[Hoja ${sheetName}] Registro duplicado ya existente en la planilla para este estamento`,
        });
        continue;
      }
      existingKeys.add(dedupKey);

      const cleanRbdStr = String(rawRbd || '10101').replace(/[^0-9]/g, '').trim();
      const masterSchool = masterMap?.get(cleanRbdStr);
      const nombreEstablecimientoFinal = masterSchool
        ? masterSchool.nombreOficial
        : (rawNombreColegio || 'Establecimiento SLEP').trim();

      records.push({
        rutVotante: rutVal.cleanRut,
        formattedRutVotante: rutVal.formattedRut,
        rutEstudianteAsociado: cleanStudentRut,
        formattedRutEstudiante: formattedStudentRut,
        nombreCompleto: rawNombreCompleto.trim(),
        estamento: estamentoEnum,
        rbdEstablecimiento: cleanRbdStr || '10101',
        nombreEstablecimiento: nombreEstablecimientoFinal,
      });
    }
  }

  return {
    records,
    erroresDetalle,
    totalFilasLeidas,
  };
}
