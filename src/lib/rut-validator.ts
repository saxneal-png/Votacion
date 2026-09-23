/**
 * Helper Avanzado de Sanitización, Auto-corrección y Validación Módulo 11
 * para RUN Chileno — Servicio Local de Educación Pública (Decreto 102)
 */

export interface RutValidationResult {
  valid: boolean;
  cleanRut: string; // Formato limpio de 8 o 9 caracteres (Ej: 16940271K)
  formattedRut: string; // Formato con puntos y guion (Ej: 16.940.271-K)
  errorReason?: string;
  autoCorrected?: boolean;
}

/**
 * Calcula matemáticamente el Dígito Verificador Módulo 11 para un cuerpo numérico de RUT
 */
export function calculateModulo11DV(numberPart: string): string {
  const digits = numberPart.replace(/\D/g, '').split('').reverse().map(Number);
  if (digits.length === 0) return '';

  const multipliers = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * multipliers[i % multipliers.length];
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/**
 * Limpia y normaliza una cadena o número proveniente de Excel.
 */
export function cleanRutString(rawRut: string | number, rawDv?: string | number): string {
  if (rawRut === null || rawRut === undefined) return '';

  let bodyStr = '';

  if (typeof rawRut === 'number') {
    bodyStr = String(Math.floor(rawRut));
  } else {
    bodyStr = String(rawRut).trim();
    if (bodyStr.endsWith('.0')) {
      bodyStr = bodyStr.slice(0, -2);
    }
  }

  let dvStr = '';
  if (rawDv !== null && rawDv !== undefined) {
    dvStr = String(rawDv).trim().toUpperCase();
    if (dvStr.endsWith('.0')) dvStr = dvStr.slice(0, -2);
  }

  // Si se proporcionó un DV explícito en otra columna
  if (dvStr) {
    const cleanBody = bodyStr.replace(/\D/g, '');
    const cleanDvChar = dvStr.replace(/[^0-9kK]/g, '').slice(0, 1).toUpperCase();
    return `${cleanBody}${cleanDvChar}`;
  }

  // Remover puntos, guiones y espacios conservando dígitos y K
  return bodyStr.replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Aplica la verificación matemática Módulo 11 al RUN chileno o IPE/IPA (rango 100.000.000+)
 */
export function validateRutModulo11(cleanRut: string): boolean {
  // Soporta desde 7 dígitos (ej: 1.000.000-K -> 8 chars) hasta 9 dígitos de cuerpo (ej: 100.000.000-K -> 10 chars)
  if (!cleanRut || cleanRut.length < 8 || cleanRut.length > 10) {
    return false;
  }

  const numberPart = cleanRut.slice(0, -1);
  const dvInput = cleanRut.slice(-1).toUpperCase();

  if (!/^\d+$/.test(numberPart)) {
    return false;
  }

  // Identificador Provisorio Escolar (IPE / IPA) asignado por MINEDUC (cuerpo >= 100.000.000)
  if (parseInt(numberPart, 10) >= 100000000) {
    return true;
  }

  const expectedDv = calculateModulo11DV(numberPart);
  return dvInput === expectedDv;
}

/**
 * Formatea un RUN limpio a su representación visual estándar con puntos y guion.
 * Ejemplos:
 * "16940271K" -> "16.940.271-K"
 * "1001234567" -> "100.123.456-7"
 */
export function formatRut(cleanRut: string): string {
  if (!cleanRut) return '';
  const sanitized = cleanRutString(cleanRut);
  if (sanitized.length < 2) return sanitized;

  const numberPart = sanitized.slice(0, -1);
  const dv = sanitized.slice(-1);

  const formattedNumber = numberPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedNumber}-${dv}`;
}

/**
 * Sanitiza y valida un RUN / IPE utilizando las reglas chilenas Módulo 11:
 * 1. Si pertenece al rango IPE/IPA (cuerpo >= 100.000.000), es aceptado como identificador provisorio MINEDUC.
 * 2. Si viene con DV (8 a 10 caracteres), lo valida estrictamente por Módulo 11.
 * 3. Si viene únicamente el cuerpo numérico (7 a 9 dígitos), calcula el DV automáticamente.
 * 4. Proporciona mensajes de alerta detallados en caso de invalidez.
 */
export function cleanAndValidateRUT(
  rawRut: string | number,
  rawDv?: string | number,
): RutValidationResult {
  const cleanRut = cleanRutString(rawRut, rawDv);

  if (!cleanRut) {
    return {
      valid: false,
      cleanRut: '',
      formattedRut: '',
      errorReason: 'RUN vacío o no proporcionado en la fila.',
    };
  }

  const isExplicitDvProvided = Boolean(rawDv) || (typeof rawRut === 'string' && rawRut.includes('-'));

  // Caso Identificador Provisorio MINEDUC (IPE / IPA con cuerpo >= 100.000.000)
  if (cleanRut.length >= 9) {
    const cuerpoWithDv = cleanRut.slice(0, -1);
    if (/^\d+$/.test(cuerpoWithDv) && parseInt(cuerpoWithDv, 10) >= 100000000) {
      return {
        valid: true,
        cleanRut,
        formattedRut: formatRut(cleanRut),
      };
    }
    if (/^\d+$/.test(cleanRut) && parseInt(cleanRut, 10) >= 100000000 && !isExplicitDvProvided) {
      const computedDv = calculateModulo11DV(cleanRut);
      const fullRut = `${cleanRut}${computedDv}`;
      return {
        valid: true,
        cleanRut: fullRut,
        formattedRut: formatRut(fullRut),
        autoCorrected: true,
      };
    }
  }

  // Caso 1: Si se proporcionó un DV explícito o tiene 8 a 10 caracteres con DV al final
  if (isExplicitDvProvided || (cleanRut.length >= 8 && cleanRut.length <= 10 && /[0-9K]/.test(cleanRut.slice(-1)))) {
    const isValid = validateRutModulo11(cleanRut);
    if (isValid) {
      return {
        valid: true,
        cleanRut,
        formattedRut: formatRut(cleanRut),
      };
    }
  }

  // Caso 2: Si el valor ingresado es un cuerpo estrictamente numérico (7 u 8 dígitos sin DV explícito)
  if (!isExplicitDvProvided && (typeof rawRut === 'number' || /^\d{7,8}$/.test(cleanRut))) {
    const computedDv = calculateModulo11DV(cleanRut);
    const fullRut = `${cleanRut}${computedDv}`;

    if (validateRutModulo11(fullRut)) {
      return {
        valid: true,
        cleanRut: fullRut,
        formattedRut: formatRut(fullRut),
        autoCorrected: true,
      };
    }
  }

  // Validación de longitud/caracteres para alertas específicas
  if (cleanRut.length < 8) {
    return {
      valid: false,
      cleanRut,
      formattedRut: formatRut(cleanRut),
      errorReason: `RUN "${rawRut}" incompleto o con longitud insuficiente (mínimo 7 dígitos más dígito verificador).`,
    };
  }

  if (cleanRut.length > 10) {
    return {
      valid: false,
      cleanRut,
      formattedRut: formatRut(cleanRut),
      errorReason: `RUN "${rawRut}" excede la longitud máxima permitida (máximo 9 dígitos más dígito verificador).`,
    };
  }

  return {
    valid: false,
    cleanRut,
    formattedRut: formatRut(cleanRut),
    errorReason: `Dígito verificador de RUN "${rawRut}" matemáticamente incorrecto según Módulo 11.`,
  };
}
