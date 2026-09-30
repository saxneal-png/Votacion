/**
 * Módulo de Métricas Territoriales de Participación Electoral
 *
 * Mapeo territorial de participación por Establecimiento Educacional (RBD),
 * Estamento y Comuna en relación al Padrón Electoral Habilitado (Decreto N° 102).
 */

import { getAllPadronRecordsAsync, getPadronRecords, type PadronRecord } from '@/lib/padron-store';
import { getSchoolsMasterMapAsync, getSchoolsMasterAsync } from '@/lib/schools-master-store';
import { getVotingRecordsAsync, getVotingRecords } from '@/lib/voting-record-store';
import { getElectionConfigAsync } from '@/lib/election-config-store';
import { getEstamentoVariants } from '@/lib/candidates-store';
import { formatChileDateTime } from '@/lib/chile-time';

export type EstamentoCode = 'DOCENTES' | 'ASISTENTES' | 'PADRES_APODERADOS' | 'DIRECTIVOS' | 'ESTUDIANTES';

export interface EstamentoParticipation {
  padron: number;
  votos: number;
  pendientes: number;
  porcentaje: number;
  porcentajeFormateado: string;
  quorum30Alcanzado: boolean;
}

export interface SchoolParticipationMetric {
  rbd: string;
  nombreEstablecimiento: string;
  comuna: string;
  padronTotal: number;
  votosTotal: number;
  pendientesTotal: number;
  porcentajeTotal: number;
  porcentajeTotalFormateado: string;
  nivelParticipacion: string;
  estamentos: Record<EstamentoCode, EstamentoParticipation>;
}

export interface ComunaParticipationMetric {
  comuna: string;
  totalEstablecimientos: number;
  padronTotal: number;
  votosTotal: number;
  pendientesTotal: number;
  porcentajeTotal: number;
  porcentajeTotalFormateado: string;
  nivelParticipacion: string;
  estamentos: Record<EstamentoCode, EstamentoParticipation>;
  establecimientos: SchoolParticipationMetric[];
}

export interface TerritorialReport {
  tituloProceso: string;
  fechaEmision: string;
  fechaEmisionChile: string;
  totalEstablecimientos: number;
  totalComunas: number;
  padronGlobal: number;
  votosGlobal: number;
  porcentajeGlobal: number;
  porcentajeGlobalFormateado: string;
  comunas: ComunaParticipationMetric[];
  schools: SchoolParticipationMetric[];
}

const ESTAMENTOS_LIST: Array<{ code: EstamentoCode; label: string }> = [
  { code: 'DOCENTES', label: 'Docentes' },
  { code: 'ASISTENTES', label: 'Asistentes de la Educación' },
  { code: 'PADRES_APODERADOS', label: 'Padres y Apoderados' },
  { code: 'DIRECTIVOS', label: 'Directivos' },
  { code: 'ESTUDIANTES', label: 'Estudiantes' },
];

function getNivelParticipacion(pct: number, padron: number): string {
  if (padron === 0) return 'Sin Padrón';
  if (pct === 0) return 'Sin Votos (0%)';
  if (pct >= 50) return 'Alta (≥50%)';
  if (pct >= 30) return 'Media (30-49%)';
  return 'Baja (<30%)';
}

function normalizeEstamentoKey(rawEstamento: string): EstamentoCode | null {
  const vars = getEstamentoVariants(rawEstamento).map((v) => v.toLowerCase());
  if (vars.includes('docentes') || vars.includes('docente')) return 'DOCENTES';
  if (vars.includes('asistentes') || vars.includes('asistente')) return 'ASISTENTES';
  if (vars.includes('apoderados') || vars.includes('padres_apoderados') || vars.includes('padres y apoderados')) return 'PADRES_APODERADOS';
  if (vars.includes('directivos') || vars.includes('directivo')) return 'DIRECTIVOS';
  if (vars.includes('estudiantes') || vars.includes('estudiante')) return 'ESTUDIANTES';
  return null;
}

/**
 * Calcula y genera el reporte territorial consolidado
 */
export async function getTerritorialParticipationReportAsync(): Promise<TerritorialReport> {
  const config = await getElectionConfigAsync().catch(() => ({
    tituloProceso: 'Elecciones Consejo Local SLEP 2026',
    estadoEleccion: 'ABIERTA',
    fechaInicio: new Date().toISOString(),
    fechaFin: new Date().toISOString(),
    estamentosHabilitados: ['DOCENTES', 'ASISTENTES', 'PADRES_APODERADOS', 'DIRECTIVOS', 'ESTUDIANTES'],
  }));

  const nowChile = formatChileDateTime(new Date());

  // 1. Cargar Padrón
  let padronRecords: PadronRecord[] = [];
  try {
    const res = await getAllPadronRecordsAsync().catch(() => null);
    if (res && res.records.length > 0) {
      padronRecords = res.records;
    } else {
      padronRecords = getPadronRecords({ pageSize: 100000 }).records;
    }
  } catch {
    padronRecords = getPadronRecords({ pageSize: 100000 }).records;
  }

  // 2. Cargar Catálogo Maestro de Escuelas y Comunas
  const schoolsMasterMap = await getSchoolsMasterMapAsync().catch(() => new Map());
  const masterSchoolsList = await getSchoolsMasterAsync().catch(() => []);

  // 3. Cargar Actas de Sufragio
  let votingRecords: Array<{ rbdEstablecimiento: string; estamento: string; rutVotante: string }> = [];
  try {
    const res = await getVotingRecordsAsync().catch(() => null);
    if (res && res.records.length > 0) {
      votingRecords = res.records;
    } else {
      votingRecords = getVotingRecords().records;
    }
  } catch {
    votingRecords = getVotingRecords().records;
  }

  // Mapa de Colegios detectados: RBD -> info
  const schoolsDataMap = new Map<
    string,
    {
      rbd: string;
      nombre: string;
      comuna: string;
      padronSets: Record<EstamentoCode, Set<string>>;
      votedSets: Record<EstamentoCode, Set<string>>;
    }
  >();

  // Inicializar con catálogo maestro
  masterSchoolsList.forEach((sch) => {
    const rbd = String(sch.rbd).trim();
    if (!rbd) return;
    schoolsDataMap.set(rbd, {
      rbd,
      nombre: sch.nombreOficial || `Establecimiento RBD ${rbd}`,
      comuna: sch.comuna?.trim() || 'Sin Comuna',
      padronSets: {
        DOCENTES: new Set<string>(),
        ASISTENTES: new Set<string>(),
        PADRES_APODERADOS: new Set<string>(),
        DIRECTIVOS: new Set<string>(),
        ESTUDIANTES: new Set<string>(),
      },
      votedSets: {
        DOCENTES: new Set<string>(),
        ASISTENTES: new Set<string>(),
        PADRES_APODERADOS: new Set<string>(),
        DIRECTIVOS: new Set<string>(),
        ESTUDIANTES: new Set<string>(),
      },
    });
  });

  // Procesar Padrón Electoral
  padronRecords.forEach((p) => {
    const rbd = String(p.rbdEstablecimiento || '10201').trim();
    const cleanRut = p.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase();
    if (!cleanRut) return;

    const estKey = normalizeEstamentoKey(p.estamento);
    if (!estKey) return;

    if (!schoolsDataMap.has(rbd)) {
      // Consultar estrictamente la Base de Datos Maestra de Establecimientos Educacionales
      const masterInfo = schoolsMasterMap.get(rbd);
      schoolsDataMap.set(rbd, {
        rbd,
        nombre: masterInfo?.nombreOficial || p.nombreEstablecimiento || `Establecimiento RBD ${rbd}`,
        comuna: masterInfo?.comuna?.trim() || 'Sin Comuna Registrada',
        padronSets: {
          DOCENTES: new Set<string>(),
          ASISTENTES: new Set<string>(),
          PADRES_APODERADOS: new Set<string>(),
          DIRECTIVOS: new Set<string>(),
          ESTUDIANTES: new Set<string>(),
        },
        votedSets: {
          DOCENTES: new Set<string>(),
          ASISTENTES: new Set<string>(),
          PADRES_APODERADOS: new Set<string>(),
          DIRECTIVOS: new Set<string>(),
          ESTUDIANTES: new Set<string>(),
        },
      });
    }

    const schoolEntry = schoolsDataMap.get(rbd)!;
    
    // Si la comuna o nombre aún no provienen del maestro oficial, sincronizarla
    const masterInfo = schoolsMasterMap.get(rbd);
    if (masterInfo) {
      if (masterInfo.nombreOficial) schoolEntry.nombre = masterInfo.nombreOficial;
      if (masterInfo.comuna) schoolEntry.comuna = masterInfo.comuna.trim();
    }

    schoolEntry.padronSets[estKey].add(cleanRut);

    if (p.haVotado) {
      schoolEntry.votedSets[estKey].add(cleanRut);
    }
  });

  // Procesar Actas de Sufragio para asegurar coherencia
  votingRecords.forEach((v) => {
    const rbd = String(v.rbdEstablecimiento || '10201').trim();
    const cleanRut = v.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase();
    const estKey = normalizeEstamentoKey(v.estamento);
    if (!estKey || !schoolsDataMap.has(rbd)) return;

    const schoolEntry = schoolsDataMap.get(rbd)!;
    if (cleanRut) {
      schoolEntry.votedSets[estKey].add(cleanRut);
    }
  });

  // Construir lista de métricas por escuela
  const schoolMetricsList: SchoolParticipationMetric[] = [];

  schoolsDataMap.forEach((entry) => {
    const estamentosObj = {} as Record<EstamentoCode, EstamentoParticipation>;
    let totalSchoolPadron = 0;
    let totalSchoolVotos = 0;

    ESTAMENTOS_LIST.forEach(({ code }) => {
      const padronCount = entry.padronSets[code].size;
      const votedCount = entry.votedSets[code].size;
      const effectiveVoted = Math.min(votedCount, Math.max(padronCount, votedCount));
      const pendientes = Math.max(0, padronCount - effectiveVoted);
      const pct = padronCount > 0 ? (effectiveVoted / padronCount) * 100 : 0;

      totalSchoolPadron += padronCount;
      totalSchoolVotos += effectiveVoted;

      estamentosObj[code] = {
        padron: padronCount,
        votos: effectiveVoted,
        pendientes,
        porcentaje: pct,
        porcentajeFormateado: padronCount > 0 ? `${pct.toFixed(1)}%` : '0.0%',
        quorum30Alcanzado: pct >= 30,
      };
    });

    const totalPct = totalSchoolPadron > 0 ? (totalSchoolVotos / totalSchoolPadron) * 100 : 0;
    const totalPendientes = Math.max(0, totalSchoolPadron - totalSchoolVotos);

    schoolMetricsList.push({
      rbd: entry.rbd,
      nombreEstablecimiento: entry.nombre,
      comuna: entry.comuna || 'Sin Comuna',
      padronTotal: totalSchoolPadron,
      votosTotal: totalSchoolVotos,
      pendientesTotal: totalPendientes,
      porcentajeTotal: totalPct,
      porcentajeTotalFormateado: totalSchoolPadron > 0 ? `${totalPct.toFixed(1)}%` : '0.0%',
      nivelParticipacion: getNivelParticipacion(totalPct, totalSchoolPadron),
      estamentos: estamentosObj,
    });
  });

  // Agrupar por Comuna
  const comunaMap = new Map<string, SchoolParticipationMetric[]>();
  schoolMetricsList.forEach((sch) => {
    const com = sch.comuna || 'Sin Comuna';
    if (!comunaMap.has(com)) comunaMap.set(com, []);
    comunaMap.get(com)!.push(sch);
  });

  const comunaMetricsList: ComunaParticipationMetric[] = [];
  let globalPadron = 0;
  let globalVotos = 0;

  Array.from(comunaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([comunaName, schList]) => {
      let comPadron = 0;
      let comVotos = 0;
      const comEstamentos = {} as Record<EstamentoCode, EstamentoParticipation>;

      ESTAMENTOS_LIST.forEach(({ code }) => {
        let estPad = 0;
        let estVot = 0;

        schList.forEach((s) => {
          estPad += s.estamentos[code].padron;
          estVot += s.estamentos[code].votos;
        });

        const estPct = estPad > 0 ? (estVot / estPad) * 100 : 0;
        const estPend = Math.max(0, estPad - estVot);

        comEstamentos[code] = {
          padron: estPad,
          votos: estVot,
          pendientes: estPend,
          porcentaje: estPct,
          porcentajeFormateado: estPad > 0 ? `${estPct.toFixed(1)}%` : '0.0%',
          quorum30Alcanzado: estPct >= 30,
        };

        comPadron += estPad;
        comVotos += estVot;
      });

      const comPct = comPadron > 0 ? (comVotos / comPadron) * 100 : 0;
      const comPend = Math.max(0, comPadron - comVotos);

      globalPadron += comPadron;
      globalVotos += comVotos;

      // Ordenar colegios dentro de la comuna por mayor % de participación
      schList.sort((a, b) => b.porcentajeTotal - a.porcentajeTotal);

      comunaMetricsList.push({
        comuna: comunaName,
        totalEstablecimientos: schList.length,
        padronTotal: comPadron,
        votosTotal: comVotos,
        pendientesTotal: comPend,
        porcentajeTotal: comPct,
        porcentajeTotalFormateado: comPadron > 0 ? `${comPct.toFixed(1)}%` : '0.0%',
        nivelParticipacion: getNivelParticipacion(comPct, comPadron),
        estamentos: comEstamentos,
        establecimientos: schList,
      });
    });

  // Ordenar lista general de colegios por comuna y luego por RBD
  schoolMetricsList.sort((a, b) => {
    if (a.comuna !== b.comuna) return a.comuna.localeCompare(b.comuna);
    return a.rbd.localeCompare(b.rbd);
  });

  const globalPct = globalPadron > 0 ? (globalVotos / globalPadron) * 100 : 0;

  return {
    tituloProceso: config.tituloProceso,
    fechaEmision: new Date().toISOString(),
    fechaEmisionChile: nowChile,
    totalEstablecimientos: schoolMetricsList.length,
    totalComunas: comunaMetricsList.length,
    padronGlobal: globalPadron,
    votosGlobal: globalVotos,
    porcentajeGlobal: globalPct,
    porcentajeGlobalFormateado: globalPadron > 0 ? `${globalPct.toFixed(1)}%` : '0.0%',
    comunas: comunaMetricsList,
    schools: schoolMetricsList,
  };
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Genera el archivo CSV oficial con codificación UTF-8 + BOM y delimitador ';'
 * optimizado para Excel, PowerBI, QGIS y análisis territorial.
 */
export async function generateTerritorialParticipationCsvAsync(): Promise<string> {
  const report = await getTerritorialParticipationReportAsync();
  const lines: string[] = [];

  // ENCABEZADO OFICIAL
  lines.push('\uFEFF================================================================================');
  lines.push('REPORTE TERRITORIAL DE PARTICIPACIÓN ELECTORAL POR ESTABLECIMIENTO, ESTAMENTO Y COMUNA');
  lines.push('SERVICIO LOCAL DE EDUCACIÓN PÚBLICA (SLEP) - ELECCIONES CONSEJO LOCAL (DEC. 102)');
  lines.push('================================================================================');
  lines.push(`Proceso Electoral;${escapeCsv(report.tituloProceso)}`);
  lines.push(`Fecha y Hora de Emisión (Chile);${escapeCsv(report.fechaEmisionChile)}`);
  lines.push('Fuente Comunal y Establecimientos;Base de Datos Oficial de Establecimientos Educacionales (bd_establecimientos_maestro)');
  lines.push(`Total de Comunas en el Territorio;${report.totalComunas}`);
  lines.push(`Total de Establecimientos Monitoreados;${report.totalEstablecimientos}`);
  lines.push(`Padrón Electoral Global Habilitado;${report.padronGlobal}`);
  lines.push(`Total Sufragios Emitidos Global;${report.votosGlobal}`);
  lines.push(`Participación Territorial Global %;${report.porcentajeGlobalFormateado}`);
  lines.push('');

  // SECCIÓN 1: RESUMEN Y MAPEO POR COMUNA
  lines.push('================================================================================');
  lines.push('1. RESUMEN TERRITORIAL Y MAPEO POR COMUNA');
  lines.push('================================================================================');
  lines.push(
    [
      'Comuna',
      'N° Establecimientos',
      'Padrón Comuna',
      'Votos Comuna',
      'Pendientes',
      'Participación Comuna %',
      'Nivel Territorial',
      'Docentes (Padrón)',
      'Docentes (Votos)',
      'Docentes (%)',
      'Asistentes (Padrón)',
      'Asistentes (Votos)',
      'Asistentes (%)',
      'Apoderados (Padrón)',
      'Apoderados (Votos)',
      'Apoderados (%)',
      'Directivos (Padrón)',
      'Directivos (Votos)',
      'Directivos (%)',
      'Estudiantes (Padrón)',
      'Estudiantes (Votos)',
      'Estudiantes (%)',
    ].map(escapeCsv).join(';'),
  );

  report.comunas.forEach((c) => {
    lines.push(
      [
        escapeCsv(c.comuna),
        c.totalEstablecimientos,
        c.padronTotal,
        c.votosTotal,
        c.pendientesTotal,
        escapeCsv(c.porcentajeTotalFormateado),
        escapeCsv(c.nivelParticipacion),
        c.estamentos.DOCENTES.padron,
        c.estamentos.DOCENTES.votos,
        escapeCsv(c.estamentos.DOCENTES.porcentajeFormateado),
        c.estamentos.ASISTENTES.padron,
        c.estamentos.ASISTENTES.votos,
        escapeCsv(c.estamentos.ASISTENTES.porcentajeFormateado),
        c.estamentos.PADRES_APODERADOS.padron,
        c.estamentos.PADRES_APODERADOS.votos,
        escapeCsv(c.estamentos.PADRES_APODERADOS.porcentajeFormateado),
        c.estamentos.DIRECTIVOS.padron,
        c.estamentos.DIRECTIVOS.votos,
        escapeCsv(c.estamentos.DIRECTIVOS.porcentajeFormateado),
        c.estamentos.ESTUDIANTES.padron,
        c.estamentos.ESTUDIANTES.votos,
        escapeCsv(c.estamentos.ESTUDIANTES.porcentajeFormateado),
      ].join(';'),
    );
  });
  lines.push('');

  // SECCIÓN 2: MATRIZ DE PARTICIPACIÓN POR ESTABLECIMIENTO (RBD) Y COMUNA
  lines.push('================================================================================');
  lines.push('2. MATRIZ DE PARTICIPACIÓN POR ESTABLECIMIENTO EDUCACIONAL (RBD) Y COMUNA');
  lines.push('================================================================================');
  lines.push(
    [
      'Comuna',
      'RBD',
      'Nombre Establecimiento',
      'Padrón Total Colegio',
      'Votos Totales Colegio',
      'Pendientes Colegio',
      '% Participación Colegio',
      'Nivel Territorial',
      'Docentes (Padrón)',
      'Docentes (Votos)',
      'Docentes (%)',
      'Asistentes (Padrón)',
      'Asistentes (Votos)',
      'Asistentes (%)',
      'Apoderados (Padrón)',
      'Apoderados (Votos)',
      'Apoderados (%)',
      'Directivos (Padrón)',
      'Directivos (Votos)',
      'Directivos (%)',
      'Estudiantes (Padrón)',
      'Estudiantes (Votos)',
      'Estudiantes (%)',
    ].map(escapeCsv).join(';'),
  );

  report.schools.forEach((s) => {
    lines.push(
      [
        escapeCsv(s.comuna),
        escapeCsv(s.rbd),
        escapeCsv(s.nombreEstablecimiento),
        s.padronTotal,
        s.votosTotal,
        s.pendientesTotal,
        escapeCsv(s.porcentajeTotalFormateado),
        escapeCsv(s.nivelParticipacion),
        s.estamentos.DOCENTES.padron,
        s.estamentos.DOCENTES.votos,
        escapeCsv(s.estamentos.DOCENTES.porcentajeFormateado),
        s.estamentos.ASISTENTES.padron,
        s.estamentos.ASISTENTES.votos,
        escapeCsv(s.estamentos.ASISTENTES.porcentajeFormateado),
        s.estamentos.PADRES_APODERADOS.padron,
        s.estamentos.PADRES_APODERADOS.votos,
        escapeCsv(s.estamentos.PADRES_APODERADOS.porcentajeFormateado),
        s.estamentos.DIRECTIVOS.padron,
        s.estamentos.DIRECTIVOS.votos,
        escapeCsv(s.estamentos.DIRECTIVOS.porcentajeFormateado),
        s.estamentos.ESTUDIANTES.padron,
        s.estamentos.ESTUDIANTES.votos,
        escapeCsv(s.estamentos.ESTUDIANTES.porcentajeFormateado),
      ].join(';'),
    );
  });
  lines.push('');

  // SECCIÓN 3: DATA CRUDA FILA POR FILA (OPTIMIZADA PARA TABLAS DINÁMICAS, GIS Y POWER BI)
  lines.push('================================================================================');
  lines.push('3. DESGLOSE DETALLADO FILA POR FILA (BI / GIS / MAPAS TERRITORIALES)');
  lines.push('================================================================================');
  lines.push(
    [
      'Comuna',
      'RBD',
      'Establecimiento Educacional',
      'Código Estamento',
      'Nombre Estamento',
      'Padrón Habilitado',
      'Votos Emitidos',
      'Votantes Pendientes',
      'Porcentaje Participación %',
      'Nivel Territorial',
      'Quórum 30% Alcanzado',
    ].map(escapeCsv).join(';'),
  );

  report.schools.forEach((s) => {
    ESTAMENTOS_LIST.forEach(({ code, label }) => {
      const est = s.estamentos[code];
      lines.push(
        [
          escapeCsv(s.comuna),
          escapeCsv(s.rbd),
          escapeCsv(s.nombreEstablecimiento),
          escapeCsv(code),
          escapeCsv(label),
          est.padron,
          est.votos,
          est.pendientes,
          escapeCsv(est.porcentajeFormateado),
          escapeCsv(getNivelParticipacion(est.porcentaje, est.padron)),
          escapeCsv(est.quorum30Alcanzado ? 'SÍ (≥30%)' : 'NO (<30%)'),
        ].join(';'),
      );
    });
  });

  return lines.join('\r\n');
}
