import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { getCandidatosAsync, getEstamentoVariants } from '@/lib/candidates-store';
import { getAllPadronRecordsAsync, getAllSchoolsAsync, getPadronRecords, type PadronRecord } from '@/lib/padron-store';
import { getSchoolsMasterAsync } from '@/lib/schools-master-store';
import { getVotingRecords, getVotingRecordsAsync, type VotingRecordEntry } from '@/lib/voting-record-store';
import { getVoteTalliesAsync } from '@/lib/metrics-store';
import { getElectionConfigAsync } from '@/lib/election-config-store';
import { formatChileDateTime } from '@/lib/chile-time';
import {
  ADMIN_SESSION_COOKIE,
  addAuditEntry,
  validateAdminSession,
} from '@/lib/admin-session';
import type { Candidate } from '@/types';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`));
  let token = request.cookies?.get(ADMIN_SESSION_COOKIE)?.value || match?.[1];

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    } catch {
      // Fallback para entorno de pruebas
    }
  }

  const session = validateAdminSession(token);

  if (!session) {
    return NextResponse.json(
      { message: 'Sesión administrativa no válida o expirada.' },
      { status: 401 },
    );
  }

  try {
    // 1. Configuración e información oficial del proceso
    const config = await getElectionConfigAsync();
    const nowChile = formatChileDateTime(new Date());

    // 2. Candidatos y Padrón Electoral (siempre desde Supabase)
    const allCandidates = await getCandidatosAsync({ estamento: 'ALL' }).catch(() => []);

    let padronRecords: PadronRecord[] = [];
    let totalPadronCount = 0;
    try {
      const res = await getAllPadronRecordsAsync().catch(() => null);
      if (res) {
        padronRecords = res.records;
        totalPadronCount = res.total;
      } else {
        const resLocal = getPadronRecords({ pageSize: 100000 });
        padronRecords = resLocal.records;
        totalPadronCount = resLocal.total;
      }
    } catch {
      const resLocal = getPadronRecords({ pageSize: 100000 });
      padronRecords = resLocal.records;
      totalPadronCount = resLocal.total;
    }

    let votingRecords: VotingRecordEntry[] = [];
    try {
      const res = await getVotingRecordsAsync().catch(() => null);
      if (res) {
        votingRecords = res.records;
      } else {
        votingRecords = getVotingRecords().records;
      }
    } catch {
      votingRecords = getVotingRecords().records;
    }

    const tallies = await getVoteTalliesAsync().catch(() => new Map<string, number>());

    // Construir mapa rbd -> estamentos que votaron desde acta_sufragio real
    const schoolsVotedRealMap = new Map<string, Set<string>>();
    votingRecords.forEach((v) => {
      const vars = getEstamentoVariants(v.estamento).map((val) => val.toLowerCase());
      const estNorm = vars.includes('directivos') ? 'directivos'
        : vars.includes('docentes') ? 'docentes'
        : vars.includes('asistentes') ? 'asistentes'
        : vars.includes('apoderados') ? 'apoderados'
        : vars.includes('estudiantes') ? 'estudiantes'
        : null;
      const rbd = v.rbdEstablecimiento?.trim();
      if (rbd && estNorm) {
        if (!schoolsVotedRealMap.has(rbd)) schoolsVotedRealMap.set(rbd, new Set());
        schoolsVotedRealMap.get(rbd)!.add(estNorm);
      }
    });

    // 3. Totales globales de padrón (RUTs únicos por estamento)
    const padron = {
      total: 0,
      directivos: 0,
      docentes: 0,
      asistentes: 0,
      apoderados: 0,
      estudiantes: 0,
    };

    const uniqueRutsByEstamento = {
      directivos: new Set<string>(),
      docentes: new Set<string>(),
      asistentes: new Set<string>(),
      apoderados: new Set<string>(),
      estudiantes: new Set<string>(),
    };

    padronRecords.forEach((p) => {
      const cleanR = p.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase();
      if (!cleanR) return;
      const vars = getEstamentoVariants(p.estamento).map((v) => v.toLowerCase());
      if (vars.includes('directivos')) uniqueRutsByEstamento.directivos.add(cleanR);
      else if (vars.includes('docentes')) uniqueRutsByEstamento.docentes.add(cleanR);
      else if (vars.includes('asistentes')) uniqueRutsByEstamento.asistentes.add(cleanR);
      else if (vars.includes('apoderados')) uniqueRutsByEstamento.apoderados.add(cleanR);
      else if (vars.includes('estudiantes')) uniqueRutsByEstamento.estudiantes.add(cleanR);
    });

    padron.directivos = uniqueRutsByEstamento.directivos.size;
    padron.docentes = uniqueRutsByEstamento.docentes.size;
    padron.asistentes = uniqueRutsByEstamento.asistentes.size;
    padron.apoderados = uniqueRutsByEstamento.apoderados.size;
    padron.estudiantes = uniqueRutsByEstamento.estudiantes.size;

    const globalUniqueRuts = new Set(
      padronRecords.map((p) => p.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase()),
    );
    padron.total = globalUniqueRuts.size;


    // 4. Totales globales de votos emitidos
    const votes = {
      total: votingRecords.length,
      directivos: 0,
      docentes: 0,
      asistentes: 0,
      apoderados: 0,
      estudiantes: 0,
    };

    votingRecords.forEach((v) => {
      const vars = getEstamentoVariants(v.estamento).map((val) => val.toLowerCase());
      if (vars.includes('directivos')) votes.directivos++;
      else if (vars.includes('docentes')) votes.docentes++;
      else if (vars.includes('asistentes')) votes.asistentes++;
      else if (vars.includes('apoderados')) votes.apoderados++;
      else if (vars.includes('estudiantes')) votes.estudiantes++;
    });

    // 5. Construcción del CSV con BOM UTF-8 (\uFEFF) para Excel
    const lines: string[] = [];
    lines.push('\uFEFF================================================================================');
    lines.push('REPORTE OFICIAL DE RESULTADOS Y MÉTRICAS ELECTORALES');
    lines.push('================================================================================');
    lines.push(`Título del Proceso;${escapeCsvCell(config.tituloProceso)}`);
    lines.push(`Fecha de Emisión (Chile);${escapeCsvCell(nowChile)}`);
    lines.push(`Estado del Proceso;${escapeCsvCell(config.estadoEleccion)}`);
    lines.push(`Inicio Programado;${escapeCsvCell(formatChileDateTime(config.fechaInicio))}`);
    lines.push(`Término Programado;${escapeCsvCell(formatChileDateTime(config.fechaFin))}`);
    lines.push(`Padrón Total Habilitado;${padron.total}`);
    lines.push(`Votos Totales Emitidos;${votes.total}`);
    lines.push(`Participación Global %;${padron.total > 0 ? ((votes.total / padron.total) * 100).toFixed(1) + '%' : '0.0%'}`);
    lines.push('');

    // SECCIÓN 1: PARTICIPACIÓN POR ESTAMENTO
    lines.push('================================================================================');
    lines.push('1. RESUMEN DE PARTICIPACIÓN POR ESTAMENTO (DECRETO N° 102)');
    lines.push('================================================================================');
    lines.push('Estamento;Habilitados en Padrón;Votos Emitidos;Participación %;Estado en Elección');

    const estamentoList = [
      { code: 'DOCENTES', label: 'Docentes', padronVal: padron.docentes, votesVal: votes.docentes },
      { code: 'ASISTENTES', label: 'Asistentes de la Educación', padronVal: padron.asistentes, votesVal: votes.asistentes },
      { code: 'PADRES_APODERADOS', label: 'Padres y Apoderados', padronVal: padron.apoderados, votesVal: votes.apoderados },
      { code: 'ESTUDIANTES', label: 'Estudiantes', padronVal: padron.estudiantes, votesVal: votes.estudiantes },
      { code: 'DIRECTIVOS', label: 'Directivos', padronVal: padron.directivos, votesVal: votes.directivos },
    ];

    estamentoList.forEach((e) => {
      const partPct = e.padronVal > 0 ? ((e.votesVal / e.padronVal) * 100).toFixed(1) + '%' : '0.0%';
      const isEnabled = config.estamentosHabilitados.includes(e.code as any) ? 'Habilitado' : 'No Participa';
      lines.push(`${escapeCsvCell(e.label)};${e.padronVal};${e.votesVal};${partPct};${isEnabled}`);
    });
    lines.push('');

    // SECCIÓN 2: ESCRUTINIO DE CANDIDATURAS Y VOTOS
    lines.push('================================================================================');
    lines.push('2. ESCRUTINIO Y RESULTADOS POR CANDIDATURA');
    lines.push('================================================================================');
    lines.push('Estamento;ID Candidato;Nombre Completo;Establecimiento / Escuela;Votos Obtenidos;Porcentaje del Estamento');

    estamentoList.forEach((e) => {
      const estamentoVariants = getEstamentoVariants(e.code).map((v) => v.toLowerCase());
      const estCandidates = allCandidates.filter((c) => estamentoVariants.includes(c.estamento.toLowerCase()));
      const totalEstamentoVotes = e.votesVal;

      if (estCandidates.length === 0) {
        lines.push(`${escapeCsvCell(e.label)};- ;Sin candidaturas registradas;-;0;0.0%`);
      } else {
        estCandidates.forEach((c) => {
          const vCount = tallies.get(c.id) ?? 0;
          const pctVal = totalEstamentoVotes > 0 ? ((vCount / totalEstamentoVotes) * 100).toFixed(1) + '%' : '0.0%';
          const escuelaStr = c.rbd || 'N/A';
          lines.push(
            `${escapeCsvCell(e.label)};${escapeCsvCell(c.id)};${escapeCsvCell(c.nombreCompleto || c.name)};${escapeCsvCell(escuelaStr)};${vCount};${pctVal}`,
          );
        });
      }
    });
    lines.push('');

    // SECCIÓN 3: PARTICIPACIÓN POR ESTABLECIMIENTO EDUCACIONAL (RBD)
    const realSchoolsList = await getAllSchoolsAsync().catch(() => []);
    const masterSchoolsList = await getSchoolsMasterAsync().catch(() => []);
    const realSchoolsMap = new Map<string, { rbd: string; name: string }>();
    // Catálogo maestro tiene prioridad (131 colegios oficiales)
    masterSchoolsList.forEach((s) => {
      if (s.rbd) realSchoolsMap.set(s.rbd, { rbd: s.rbd, name: s.nombreOficial });
    });
    realSchoolsList.forEach((s) => {
      if (!realSchoolsMap.has(s.rbd)) realSchoolsMap.set(s.rbd, { rbd: s.rbd, name: s.nombre });
    });

    lines.push('================================================================================');
    lines.push('3. PARTICIPACIÓN POR ESTABLECIMIENTO EDUCACIONAL (RBD)');
    lines.push('================================================================================');
    lines.push('RBD;Nombre del Establecimiento;Docentes Votaron;Asistentes Votaron;Apoderados Votaron;Directivos Votaron');

    Array.from(realSchoolsMap.values()).forEach((s) => {
      const votedSet = schoolsVotedRealMap.get(s.rbd);
      const docVoted = votedSet?.has('docentes') ? 'SÍ' : 'NO';
      const asisVoted = votedSet?.has('asistentes') ? 'SÍ' : 'NO';
      const apodVoted = votedSet?.has('apoderados') ? 'SÍ' : 'NO';
      const dirVoted = votedSet?.has('directivos') ? 'SÍ' : 'NO';

      lines.push(
        `${escapeCsvCell(s.rbd)};${escapeCsvCell(s.name)};${docVoted};${asisVoted};${apodVoted};${dirVoted}`,
      );
    });

    const csvContent = lines.join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `resultados_metricas_eleccion_${dateStr}.csv`;

    addAuditEntry({
      ts: Date.now(),
      ip,
      event: 'access',
      detail: `Exportación de informe CSV de resultados y métricas electorales completada.`,
    });

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error al exportar CSV de métricas:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al generar exportación CSV.' },
      { status: 500 },
    );
  }
}
