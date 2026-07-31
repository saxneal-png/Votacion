/**
 * Registro Oficial de Votantes con Folio Único (Decreto N° 102)
 *
 * Mantiene el registro de firmas/asistencia de sufragio con folio único,
 * RUN, correo, fecha/hora, estamento y colegio, garantizando el secreto del voto
 * (no almacena la candidatura seleccionada).
 */

import { formatRut } from '@/lib/rut-validator';

export interface VotingRecordEntry {
  folio: string;
  rutVotante: string;
  formattedRutVotante: string;
  emailRegistrado: string;
  fechaHora: string;
  fechaHoraFormateada: string;
  estamento: string;
  rbdEstablecimiento: string;
  nombreEstablecimiento: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __votingRecordStore: VotingRecordEntry[] | undefined;
}

const votingRecords: VotingRecordEntry[] =
  globalThis.__votingRecordStore ?? (globalThis.__votingRecordStore = []);

// Registros de demostración iniciales
if (votingRecords.length === 0) {
  votingRecords.push(
    {
      folio: 'FOL-2026-00001-A9B2',
      rutVotante: '16940271K',
      formattedRutVotante: '16.940.271-K',
      emailRegistrado: 'maria.gonzalez@eduvallediguillin.gob.cl',
      fechaHora: new Date(Date.now() - 3600000).toISOString(),
      fechaHoraFormateada: new Date(Date.now() - 3600000).toLocaleString('es-CL'),
      estamento: 'DOCENTES',
      rbdEstablecimiento: '10202',
      nombreEstablecimiento: 'Escuela Martín Prado',
    },
    {
      folio: 'FOL-2026-00002-C4D8',
      rutVotante: '145678901',
      formattedRutVotante: '14.567.890-1',
      emailRegistrado: 'apoderado.prueba@gmail.com',
      fechaHora: new Date(Date.now() - 1800000).toISOString(),
      fechaHoraFormateada: new Date(Date.now() - 1800000).toLocaleString('es-CL'),
      estamento: 'PADRES_APODERADOS',
      rbdEstablecimiento: '10202',
      nombreEstablecimiento: 'Escuela Martín Prado',
    },
  );
}

/**
 * Registrar el sufragio emitido en el acta de votación con folio único
 */
export function recordOfficialVote(params: {
  rutVotante: string;
  emailRegistrado: string;
  estamento: string;
  rbdEstablecimiento?: string;
  nombreEstablecimiento?: string;
}): VotingRecordEntry {
  const count = votingRecords.length + 1;
  const folioNum = String(count).padStart(5, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const folio = `FOL-2026-${folioNum}-${randomSuffix}`;

  const now = new Date();
  const formattedRut = formatRut(params.rutVotante);

  const entry: VotingRecordEntry = {
    folio,
    rutVotante: params.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase(),
    formattedRutVotante: formattedRut,
    emailRegistrado: params.emailRegistrado.trim().toLowerCase(),
    fechaHora: now.toISOString(),
    fechaHoraFormateada: now.toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    estamento: params.estamento.toUpperCase(),
    rbdEstablecimiento: params.rbdEstablecimiento || '10201',
    nombreEstablecimiento: params.nombreEstablecimiento || 'Establecimiento SLEP',
  };

  votingRecords.unshift(entry); // Nuevos registros primero
  return entry;
}

/**
 * Obtener registros de votación filtrados
 */
export function getVotingRecords({
  search = '',
  estamento = '',
  rbd = '',
}: {
  search?: string;
  estamento?: string;
  rbd?: string;
} = {}): {
  records: VotingRecordEntry[];
  total: number;
} {
  let filtered = [...votingRecords];

  if (search) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (r) =>
        r.folio.toLowerCase().includes(q) ||
        r.rutVotante.toLowerCase().includes(q) ||
        r.formattedRutVotante.toLowerCase().includes(q) ||
        r.emailRegistrado.toLowerCase().includes(q) ||
        r.nombreEstablecimiento.toLowerCase().includes(q),
    );
  }

  if (estamento && estamento !== 'ALL') {
    filtered = filtered.filter((r) => r.estamento === estamento.toUpperCase());
  }

  if (rbd && rbd !== 'ALL') {
    filtered = filtered.filter((r) => r.rbdEstablecimiento === rbd);
  }

  return {
    records: filtered,
    total: filtered.length,
  };
}

/**
 * Resetear todos los registros de votación (Reinicio Electoral)
 */
export function resetVotingRecords(): void {
  votingRecords.length = 0;
}

/**
 * Generar contenido CSV con codificación UTF-8 + BOM para compatibilidad directa con Microsoft Excel
 */
export function generateVotingRecordsCsv(filters: { search?: string; estamento?: string; rbd?: string } = {}): string {
  const { records } = getVotingRecords(filters);

  const headers = [
    'Folio Único',
    'RUN Votante',
    'RUN Formateado',
    'Correo Electrónico Registrado',
    'Estamento',
    'RBD Colegio',
    'Establecimiento Educacional',
    'Fecha y Hora de Sufragio',
  ];

  const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;

  const rows = records.map((r) => [
    escapeCsv(r.folio),
    escapeCsv(r.rutVotante),
    escapeCsv(r.formattedRutVotante),
    escapeCsv(r.emailRegistrado),
    escapeCsv(r.estamento),
    escapeCsv(r.rbdEstablecimiento),
    escapeCsv(r.nombreEstablecimiento),
    escapeCsv(r.fechaHoraFormateada),
  ]);

  const csvBody = [headers.map(escapeCsv).join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');

  // Anteponer BOM UTF-8 (\uFEFF) para abrir con tildes y caracteres en Excel sin distorsión
  return `\uFEFF${csvBody}`;
}
