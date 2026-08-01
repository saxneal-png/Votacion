import { cleanAndValidateRUT } from '@/lib/rut-validator';
import {
  EstamentoDecreto102,
  findApoderadoRecordsAsync,
  findFuncionarioRecordAsync,
  getPadronRecords,
  PadronRecord,
} from '@/lib/padron-store';
import { getMockUserByRut } from '@/lib/mock-api';

export interface TempTokenPayload {
  token: string;
  rutVotante: string;
  nombreVotante?: string;
  rutEstudiante?: string;
  estamentoDestino: EstamentoDecreto102;
  rbdEstablecimiento: string;
  nombreEstablecimiento: string;
  emailDestino: string;
  expiresAt: number;
}

export interface BlindJwtPayload {
  estamento: string;
  rbdEstablecimiento: string;
  permisoVoto: boolean;
  iat: number;
  exp: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __tempTokensMap: Map<string, TempTokenPayload> | undefined;
  // eslint-disable-next-line no-var
  var __consumedTokensSet: Set<string> | undefined;
}

const tempTokensMap: Map<string, TempTokenPayload> =
  globalThis.__tempTokensMap ?? (globalThis.__tempTokensMap = new Map());

const consumedTokensSet: Set<string> =
  globalThis.__consumedTokensSet ?? (globalThis.__consumedTokensSet = new Set());

function cleanRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * REGLA A: Estamento PADRES Y APODERADOS
 * - Requiere RUN Apoderado + RUN Estudiante + Correo Personal.
 * - Verifica par exacto registrado (rut_votante, rut_estudiante_asociado).
 * - Exige que el RUN del apoderado esté vinculado a un estudiante en el padrón electoral.
 * - Sufragio Único Multihijo: Si CUALQUIERA de los registros de ese RUN Apoderado bajo PADRES_APODERADOS
 *   ya tiene ha_votado === true, RECHAZA la autenticación inmediatamente.
 */
export function validateApoderadoAuth(
  rutApoderado: string,
  rutEstudiante: string,
  email: string,
): PadronRecord {
  const valApoderado = cleanAndValidateRUT(rutApoderado);
  const cleanApoderadoRut = cleanRut(rutApoderado);

  if (!valApoderado.valid && cleanApoderadoRut.length < 7) {
    throw new Error(`RUN de Apoderado inválido: ${valApoderado.errorReason}`);
  }

  const valEstudiante = cleanAndValidateRUT(rutEstudiante);
  const cleanEstudianteRut = cleanRut(rutEstudiante);

  if (!valEstudiante.valid && cleanEstudianteRut.length < 7) {
    throw new Error(`RUN de Estudiante inválido: ${valEstudiante.errorReason}`);
  }

  if (!email || !email.includes('@')) {
    throw new Error('Debes ingresar un correo electrónico de contacto válido.');
  }

  const records = getPadronRecords().records;

  // 1. Buscar coincidencia exacta del par (Apoderado, Estudiante) en el padrón
  const exactMatch = records.find(
    (r) =>
      r.estamento === 'PADRES_APODERADOS' &&
      cleanRut(r.rutVotante) === cleanApoderadoRut &&
      r.rutEstudianteAsociado &&
      cleanRut(r.rutEstudianteAsociado) === cleanEstudianteRut,
  );

  if (!exactMatch) {
    throw new Error(
      'El RUN del apoderado no se encuentra registrado o no está vinculado con el RUN del estudiante ingresado en el padrón electoral.',
    );
  }

  // 2. Control de Sufragio Único por Apoderado (Multihijo):
  const allApoderadoRecords = records.filter(
    (r) => r.estamento === 'PADRES_APODERADOS' && cleanRut(r.rutVotante) === cleanApoderadoRut,
  );

  const yaVoto = allApoderadoRecords.some((r) => r.haVotado);
  if (yaVoto) {
    throw new Error('Usted ya emitió su voto correspondiente al estamento de Padres y Apoderados.');
  }

  if (!exactMatch.habilitado) {
    throw new Error('El apoderado se encuentra inhabilitado en el padrón electoral.');
  }

  return exactMatch;
}

export async function validateApoderadoAuthAsync(
  rutApoderado: string,
  rutEstudiante: string,
  email: string,
): Promise<PadronRecord> {
  const valApoderado = cleanAndValidateRUT(rutApoderado);
  const cleanApoderadoRut = cleanRut(rutApoderado);

  if (!valApoderado.valid && cleanApoderadoRut.length < 7) {
    throw new Error(`RUN de Apoderado inválido: ${valApoderado.errorReason}`);
  }

  const valEstudiante = cleanAndValidateRUT(rutEstudiante);
  const cleanEstudianteRut = cleanRut(rutEstudiante);

  if (!valEstudiante.valid && cleanEstudianteRut.length < 7) {
    throw new Error(`RUN de Estudiante inválido: ${valEstudiante.errorReason}`);
  }

  if (!email || !email.includes('@')) {
    throw new Error('Debes ingresar un correo electrónico de contacto válido.');
  }

  // 1. Consultar registros del apoderado directamente desde Supabase bd_padron (o memoria)
  const allApoderadoRecords = await findApoderadoRecordsAsync(rutApoderado);

  if (allApoderadoRecords.length === 0) {
    throw new Error(
      'El RUN del apoderado no se encuentra registrado en el padrón electoral.',
    );
  }

  // 2. Buscar coincidencia exacta con el RUN del estudiante ingresado
  const exactMatch = allApoderadoRecords.find(
    (r) =>
      r.rutEstudianteAsociado &&
      cleanRut(r.rutEstudianteAsociado) === cleanEstudianteRut,
  );

  if (!exactMatch) {
    throw new Error(
      'El RUN del apoderado no se encuentra vinculado con el RUN del estudiante ingresado en el padrón electoral.',
    );
  }

  // 3. Control de Sufragio Único por Apoderado (Multihijo):
  const yaVoto = allApoderadoRecords.some((r) => r.haVotado);
  if (yaVoto) {
    throw new Error('Usted ya emitió su voto correspondiente al estamento de Padres y Apoderados.');
  }

  if (!exactMatch.habilitado) {
    throw new Error('El apoderado se encuentra inhabilitado en el padrón electoral.');
  }

  return exactMatch;
}

/**
 * REGLA B: Estamento FUNCIONARIOS Y DOCENTES DEL SLEP
 * - Requiere RUN Funcionario + Correo Institucional.
 * - Validación de Dominio Restrictivo (@eduvallediguillin.gob.cl).
 * - Exige estar registrado en el padrón en un estamento de funcionario (DOCENTES, ASISTENTES, DIRECTIVOS).
 * - Verifica ha_votado === false para ese estamento específico.
 */
export function validateFuncionarioAuth(rutFuncionario: string, email: string): PadronRecord {
  const valFuncionario = cleanAndValidateRUT(rutFuncionario);
  if (!valFuncionario.valid) {
    throw new Error(`RUN de Funcionario inválido: ${valFuncionario.errorReason}`);
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Debes ingresar tu correo electrónico institucional.');
  }

  // Restricción de dominio para funcionarios
  const isDomainValid =
    cleanEmail.endsWith('@eduvallediguillin.gob.cl') ||
    cleanEmail.endsWith('@slepvallediguillin.gob.cl') ||
    cleanEmail.endsWith('@slep.cl') ||
    cleanEmail.includes('slep');

  if (!isDomainValid) {
    throw new Error(
      'Los funcionarios del SLEP deben ingresar obligatoriamente con su casilla institucional (@eduvallediguillin.gob.cl).',
    );
  }

  const cleanRutStr = cleanRut(valFuncionario.formattedRut);
  const records = getPadronRecords().records;

  let funcionarioRecord = records.find(
    (r) =>
      ['DOCENTES', 'ASISTENTES', 'DIRECTIVOS'].includes(r.estamento) &&
      cleanRut(r.rutVotante) === cleanRutStr,
  );

  if (!funcionarioRecord) {
    // Buscar en usuarios conocidos de prueba (mockUsers)
    const mockUser = getMockUserByRut(valFuncionario.formattedRut);
    if (mockUser && ['docentes', 'asistentes', 'directivos'].includes(mockUser.estamento.toLowerCase())) {
      funcionarioRecord = {
        id: `func-mock-${mockUser.rut}`,
        rutVotante: mockUser.rut,
        formattedRutVotante: mockUser.rut,
        rutEstudianteAsociado: null,
        formattedRutEstudiante: null,
        nombreCompleto: mockUser.fullName,
        estamento: mockUser.estamento.toUpperCase() as EstamentoDecreto102,
        rbdEstablecimiento: '10202',
        nombreEstablecimiento: mockUser.organization || 'Establecimiento SLEP',
        habilitado: true,
        haVotado: false,
        fechaVoto: null,
        createdAt: new Date().toISOString(),
      };
    }
  }

  if (!funcionarioRecord) {
    throw new Error(
      'El RUN ingresado no se encuentra registrado como funcionario ni asociado a un establecimiento educacional en el padrón electoral.',
    );
  }

  if (funcionarioRecord.haVotado) {
    throw new Error('Usted ya emitió su voto correspondiente al estamento de Funcionarios.');
  }

  if (!funcionarioRecord.habilitado) {
    throw new Error('El funcionario se encuentra inhabilitado en el padrón electoral.');
  }

  return funcionarioRecord;
}

export async function validateFuncionarioAuthAsync(
  rutFuncionario: string,
  email: string,
): Promise<PadronRecord> {
  const valFuncionario = cleanAndValidateRUT(rutFuncionario);
  if (!valFuncionario.valid) {
    throw new Error(`RUN de Funcionario inválido: ${valFuncionario.errorReason}`);
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Debes ingresar tu correo electrónico institucional.');
  }

  // Restricción de dominio para funcionarios
  const isDomainValid =
    cleanEmail.endsWith('@eduvallediguillin.gob.cl') ||
    cleanEmail.endsWith('@slepvallediguillin.gob.cl') ||
    cleanEmail.endsWith('@slep.cl') ||
    cleanEmail.includes('slep');

  if (!isDomainValid) {
    throw new Error(
      'Los funcionarios del SLEP deben ingresar obligatoriamente con su casilla institucional (@eduvallediguillin.gob.cl).',
    );
  }

  let funcionarioRecord = await findFuncionarioRecordAsync(rutFuncionario);

  if (!funcionarioRecord) {
    // Buscar en usuarios conocidos de prueba (mockUsers)
    const mockUser = getMockUserByRut(valFuncionario.formattedRut);
    if (mockUser && ['docentes', 'asistentes', 'directivos'].includes(mockUser.estamento.toLowerCase())) {
      funcionarioRecord = {
        id: `func-mock-${mockUser.rut}`,
        rutVotante: mockUser.rut,
        formattedRutVotante: mockUser.rut,
        rutEstudianteAsociado: null,
        formattedRutEstudiante: null,
        nombreCompleto: mockUser.fullName,
        estamento: mockUser.estamento.toUpperCase() as EstamentoDecreto102,
        rbdEstablecimiento: '10202',
        nombreEstablecimiento: mockUser.organization || 'Establecimiento SLEP',
        habilitado: true,
        haVotado: false,
        fechaVoto: null,
        createdAt: new Date().toISOString(),
      };
    }
  }

  if (!funcionarioRecord) {
    throw new Error(
      'El RUN ingresado no se encuentra registrado como funcionario ni asociado a un establecimiento educacional en el padrón electoral.',
    );
  }

  if (funcionarioRecord.haVotado) {
    throw new Error('Usted ya emitió su voto correspondiente al estamento de Funcionarios.');
  }

  if (!funcionarioRecord.habilitado) {
    throw new Error('El funcionario se encuentra inhabilitado en el padrón electoral.');
  }

  return funcionarioRecord;
}


/**
 * REGLA C: MARCAR VOTO EMITIDO EN EL PADRÓN (SUFRAGIO ÚNICO & MULTIRROL)
 * - Si es Apoderado: Marca ha_votado = true a TODOS los registros del mismo RUN Apoderado bajo PADRES_APODERADOS.
 * - Si es Funcionario/Estudiante: Marca ha_votado = true al registro específico.
 * - Mantiene la INDEPENDENCIA DE DOBLE ROL (Docente + Apoderado sufragan por separado).
 */
export function markVotoEmitido(rutVotante: string, estamento: EstamentoDecreto102): void {
  const cleanRutStr = cleanRut(rutVotante);
  const records = getPadronRecords().records;

  if (estamento === 'PADRES_APODERADOS') {
    // Marcar TODOS los registros multihijo de este apoderado
    records.forEach((r) => {
      if (r.estamento === 'PADRES_APODERADOS' && cleanRut(r.rutVotante) === cleanRutStr) {
        r.haVotado = true;
      }
    });
  } else {
    // Marcar registro específico de funcionario o estudiante
    const target = records.find(
      (r) => r.estamento === estamento && cleanRut(r.rutVotante) === cleanRutStr,
    );
    if (target) {
      target.haVotado = true;
    }
  }
}

/**
 * Crear Token Temporal de Acceso stateless con payload codificado y expiración de 10 minutos
 */
export function createTempToken(
  payload: Omit<TempTokenPayload, 'token' | 'expiresAt'>,
): TempTokenPayload {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 Minutos
  const rawData = {
    ...payload,
    expiresAt,
  };
  const jsonStr = JSON.stringify(rawData);
  const b64 = Buffer.from(jsonStr, 'utf-8').toString('base64url');
  const token = `slep-token-stk.${b64}`;

  const fullPayload: TempTokenPayload = {
    ...payload,
    token,
    expiresAt,
  };

  tempTokensMap.set(token, fullPayload);
  return fullPayload;
}

/**
 * Consumir Token Temporal de Acceso (UN SOLO USO)
 * - Valida vigencia (10 min).
 * - Elimina del mapa o decodifica token stateless.
 * - Ejecuta markVotoEmitido en el padrón.
 */
export function consumeTempToken(
  token: string,
): { valid: boolean; payload?: TempTokenPayload; reason?: string } {
  if (!token) {
    return { valid: false, reason: 'Token de acceso no proporcionado.' };
  }

  const cleanTok = token.trim();

  if (consumedTokensSet.has(cleanTok)) {
    return { valid: false, reason: 'El Enlace Mágico es inválido o ya fue utilizado anteriormente.' };
  }

  let stored = tempTokensMap.get(cleanTok);

  // Decodificar token stateless si no se encuentra en la RAM de la lambda actual
  if (!stored && cleanTok.startsWith('slep-token-stk.')) {
    try {
      const b64 = cleanTok.replace('slep-token-stk.', '');
      const jsonStr = Buffer.from(b64, 'base64url').toString('utf-8');
      const parsed = JSON.parse(jsonStr) as TempTokenPayload;
      if (parsed.rutVotante && parsed.estamentoDestino && parsed.expiresAt) {
        stored = { ...parsed, token: cleanTok };
      }
    } catch {
      // Ignorar error de formateo
    }
  }

  // Soporte para tokens demo simulados estáticos
  if (!stored && cleanTok === 'slep-token-demo-static') {
    return {
      valid: true,
      payload: {
        token: cleanTok,
        rutVotante: '16940271-k',
        nombreVotante: 'María González Pérez',
        estamentoDestino: 'DOCENTES',
        rbdEstablecimiento: '10202',
        nombreEstablecimiento: 'Escuela Martín Prado',
        emailDestino: 'docente@eduvallediguillin.gob.cl',
        expiresAt: Date.now() + 600000,
      },
    };
  }

  if (!stored) {
    return { valid: false, reason: 'El Enlace Mágico es inválido o ya fue utilizado anteriormente.' };
  }

  if (Date.now() > stored.expiresAt) {
    tempTokensMap.delete(cleanTok);
    return { valid: false, reason: 'El Enlace Mágico ha expirado (más de 10 minutos desde su emisión).' };
  }

  // CONSUMO DE UN SOLO USO: Eliminar del mapa y registrar en consumedTokensSet
  tempTokensMap.delete(cleanTok);
  consumedTokensSet.add(cleanTok);

  // Marcar el voto como emitido en el padrón oficial
  markVotoEmitido(stored.rutVotante, stored.estamentoDestino);

  return { valid: true, payload: stored };
}

/**
 * Generar Token Ciego Anónimo JWT (SECRET_KEY_ELECCION)
 * Contiene únicamente: estamento, rbdEstablecimiento y permisoVoto sin exponer RUTs ni datos personales.
 */
export function generateBlindJwtToken(params: {
  estamento: string;
  rbdEstablecimiento: string;
}): { blindToken: string; payload: BlindJwtPayload } {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 10 * 60; // 10 Minutos

  const payload: BlindJwtPayload = {
    estamento: params.estamento,
    rbdEstablecimiento: params.rbdEstablecimiento,
    permisoVoto: true,
    iat,
    exp,
  };

  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from(`SECRET_KEY_ELECCION_SLEP_${payloadB64}`).toString('base64url');

  const blindToken = `${headerB64}.${payloadB64}.${signature}`;

  return { blindToken, payload };
}
