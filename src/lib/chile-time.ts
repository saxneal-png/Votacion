/**
 * Utilidades de fecha y hora oficial de Chile Continental (America/Santiago / Referencia SHOA ntp.shoa.cl)
 * 
 * Garantiza que todos los registros de auditoría, sufragios y marcas temporales
 * se muestren en la hora oficial de Chile Continental independientemente de la zona
 * horaria del servidor (ej. Vercel / Cloud Run en UTC).
 */

export const CHILE_TIMEZONE = 'America/Santiago';

/**
 * Formatea cualquier fecha (Date, ISO string o timestamp en ms) a la hora oficial de Chile Continental (ej. "01/08/2026, 12:55:10")
 */
export function formatChileDateTime(dateOrTs?: Date | string | number | null): string {
  if (!dateOrTs) return '—';
  try {
    const d = typeof dateOrTs === 'string' || typeof dateOrTs === 'number' ? new Date(dateOrTs) : dateOrTs;
    if (isNaN(d.getTime())) return '—';

    return d.toLocaleString('es-CL', {
      timeZone: CHILE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '—';
  }
}

/**
 * Formatea únicamente la hora oficial de Chile Continental (ej. "12:55:10")
 */
export function formatChileTimeOnly(dateOrTs?: Date | string | number | null): string {
  if (!dateOrTs) return '—';
  try {
    const d = typeof dateOrTs === 'string' || typeof dateOrTs === 'number' ? new Date(dateOrTs) : dateOrTs;
    if (isNaN(d.getTime())) return '—';

    return d.toLocaleTimeString('es-CL', {
      timeZone: CHILE_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '—';
  }
}

/**
 * Retorna la representación ISO formateada
 */
export function getChileISOString(dateOrTs?: Date | string | number | null): string {
  const d = dateOrTs
    ? typeof dateOrTs === 'string' || typeof dateOrTs === 'number'
      ? new Date(dateOrTs)
      : dateOrTs
    : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}
