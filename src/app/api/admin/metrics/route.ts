import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { getCandidatosAsync, getEstamentoVariants } from '@/lib/candidates-store';
import { getAllPadronRecordsAsync, getAllSchoolsAsync } from '@/lib/padron-store';
import { getVotingRecordsAsync } from '@/lib/voting-record-store';
import { getVoteTalliesAsync } from '@/lib/metrics-store';
import { getElectionConfigAsync } from '@/lib/election-config-store';
import {
  ADMIN_SESSION_COOKIE,
  addAuditEntry,
  validateAdminSession,
} from '@/lib/admin-session';
import type { AdminMetrics, CandidateResult, EstamentoResult, Estamento, SchoolResult } from '@/types';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = validateAdminSession(token);

  if (!session) {
    return NextResponse.json(
      { message: 'Sesión administrativa no válida o expirada.' },
      { status: 401 },
    );
  }

  addAuditEntry({ ts: Date.now(), ip, event: 'access' });

  const url = new URL(request.url);
  const slepId = url.searchParams.get('slep_id') || url.searchParams.get('slepId') || 'ALL';
  const schoolId = url.searchParams.get('school_id') || url.searchParams.get('rbd') || 'ALL';

  // 1. Config del proceso electoral (para filtrar estamentos habilitados)
  const electionConfig = await getElectionConfigAsync();
  const estamentosHabilitadosSet = new Set(
    (electionConfig.estamentosHabilitados ?? []).map((e: string) => e.toUpperCase())
  );

  // 2. Obtener candidatos actualizados (Supabase / Store)
  const allCandidates = await getCandidatosAsync({ estamento: 'ALL' });

  // 3. Obtener padrón oficial sin truncamiento (paginación por lotes de 1.000 filas)
  const { records: padronRecords, total: totalPadronCount } = await getAllPadronRecordsAsync({
    rbd: schoolId,
    slepId,
  });

  // 4. Obtener actas oficiales de voto desde Supabase (supabaseAdmin, sin límite de RLS)
  const { records: rawVotingRecords } = await getVotingRecordsAsync();
  const votingRecords = rawVotingRecords.filter((v) => {
    if (schoolId !== 'ALL' && v.rbdEstablecimiento !== schoolId) return false;
    return true;
  });

  const tallies = await getVoteTalliesAsync(slepId, schoolId);

  // ── Padrón totals por estamento ──────────────────────────────────────────
  const padron = {
    total: 0,
    directivos: 0,
    docentes: 0,
    asistentes: 0,
    apoderados: 0,
    estudiantes: 0,
  };

  if (padronRecords.length > 0) {
    padron.total = totalPadronCount || padronRecords.length;
    padronRecords.forEach((p) => {
      const vars = getEstamentoVariants(p.estamento).map((v) => v.toLowerCase());
      if (vars.includes('directivos')) padron.directivos++;
      else if (vars.includes('docentes')) padron.docentes++;
      else if (vars.includes('asistentes')) padron.asistentes++;
      else if (vars.includes('apoderados')) padron.apoderados++;
      else if (vars.includes('estudiantes')) padron.estudiantes++;
    });
  }

  // ── Votos totales emitidos por estamento (desde acta oficial Supabase) ───
  const votes = {
    total: votingRecords.length,
    directivos: 0,
    docentes: 0,
    asistentes: 0,
    apoderados: 0,
    estudiantes: 0,
  };

  // Construir mapa rbd → estamentos que votaron (desde acta_sufragio real)
  const schoolsVotedRealMap = new Map<string, Set<string>>();
  votingRecords.forEach((v) => {
    const vars = getEstamentoVariants(v.estamento).map((val) => val.toLowerCase());
    if (vars.includes('directivos')) votes.directivos++;
    else if (vars.includes('docentes')) votes.docentes++;
    else if (vars.includes('asistentes')) votes.asistentes++;
    else if (vars.includes('apoderados')) votes.apoderados++;
    else if (vars.includes('estudiantes')) votes.estudiantes++;

    // Registrar participación por RBD y estamento (fuente: Supabase real)
    const rbd = v.rbdEstablecimiento?.trim();
    const estNorm = vars.includes('directivos') ? 'directivos'
      : vars.includes('docentes') ? 'docentes'
      : vars.includes('asistentes') ? 'asistentes'
      : vars.includes('apoderados') ? 'apoderados'
      : vars.includes('estudiantes') ? 'estudiantes'
      : null;
    if (rbd && estNorm) {
      if (!schoolsVotedRealMap.has(rbd)) schoolsVotedRealMap.set(rbd, new Set());
      schoolsVotedRealMap.get(rbd)!.add(estNorm);
    }
  });

  // ── Desglose por estamento y sus candidaturas vinculadas ───────────────────
  const ESTAMENTO_META = [
    { estamento: 'directivos' as Estamento, label: 'Directivos', color: '#1a4a7a' },
    { estamento: 'docentes' as Estamento, label: 'Docentes', color: '#8c4f2f' },
    { estamento: 'asistentes' as Estamento, label: 'Asistentes de la Educación', color: '#1a6a6a' },
    { estamento: 'apoderados' as Estamento, label: 'Apoderados', color: '#d97706' },
    { estamento: 'estudiantes' as Estamento, label: 'Estudiantes', color: '#0284c7' },
  ];

  // Filtrar solo los estamentos que están habilitados en la configuración del proceso
  const ESTAMENTO_VARIANTS: Record<string, string> = {
    'directivos': 'DIRECTIVOS',
    'docentes': 'DOCENTES',
    'asistentes': 'ASISTENTES',
    'apoderados': 'PADRES_APODERADOS',
    'estudiantes': 'ESTUDIANTES',
  };

  const estamentos: EstamentoResult[] = ESTAMENTO_META
    .filter(({ estamento }) => {
      // Si no hay config de estamentos, mostrar todos
      if (estamentosHabilitadosSet.size === 0) return true;
      const code = ESTAMENTO_VARIANTS[estamento] ?? estamento.toUpperCase();
      return estamentosHabilitadosSet.has(code);
    })
    .map(({ estamento, label, color }) => {
    const estamentoVariants = getEstamentoVariants(estamento).map((v) => v.toLowerCase());
    const estamentoCandidates = allCandidates.filter((c) =>
      estamentoVariants.includes(c.estamento.toLowerCase()),
    );

    const candidateResults: CandidateResult[] = estamentoCandidates.map((c) => ({
      id: c.id,
      name: c.nombreCompleto || c.name,
      initials: c.initials,
      accentColor: c.accentColor,
      votes: tallies.get(c.id) ?? 0,
    }));

    return {
      estamento,
      label,
      color,
      padronCount: padron[estamento] ?? 0,
      votesCast: votes[estamento] ?? 0,
      candidates: candidateResults,
    };
  });

  // ── Escuelas: getAllSchoolsAsync + padronRecords cargado ──
  const allSchoolsList = await getAllSchoolsAsync();

  const realSchoolsMap = new Map<string, { rbd: string; name: string }>();
  allSchoolsList.forEach((s) => {
    if (s.rbd) realSchoolsMap.set(s.rbd, { rbd: s.rbd, name: s.nombre });
  });

  // Agregar además cualquier RBD presente en el padrón cargado
  padronRecords.forEach((p) => {
    const rbd = String(p.rbdEstablecimiento || '').trim();
    const name = String(p.nombreEstablecimiento || '').trim();
    if (rbd && !realSchoolsMap.has(rbd)) {
      realSchoolsMap.set(rbd, { rbd, name: name || `Establecimiento RBD ${rbd}` });
    }
  });

  const schools: SchoolResult[] = Array.from(realSchoolsMap.values()).map((s) => {
    // Usar mapa construido desde acta_sufragio (Supabase real) para determinar participación
    const votedSet = schoolsVotedRealMap.get(s.rbd);

    const schoolPadron = {
      directivos: 0,
      docentes: 0,
      asistentes: 0,
      apoderados: 0,
    };

    padronRecords.forEach((p) => {
      if (p.rbdEstablecimiento === s.rbd) {
        const vars = getEstamentoVariants(p.estamento).map((v) => v.toLowerCase());
        if (vars.includes('directivos')) schoolPadron.directivos++;
        else if (vars.includes('docentes')) schoolPadron.docentes++;
        else if (vars.includes('asistentes')) schoolPadron.asistentes++;
        else if (vars.includes('apoderados')) schoolPadron.apoderados++;
      }
    });

    return {
      id: s.rbd,
      name: s.name,
      shortName: s.name,
      padron: schoolPadron,
      voted: {
        directivos: votedSet?.has('directivos') ?? false,
        docentes: votedSet?.has('docentes') ?? false,
        asistentes: votedSet?.has('asistentes') ?? false,
        apoderados: votedSet?.has('apoderados') ?? false,
      },
    };
  });

  const metrics: AdminMetrics = {
    lastUpdated: Date.now(),
    padron,
    votes,
    estamentos,
    schools,
  };

  return NextResponse.json(metrics, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
