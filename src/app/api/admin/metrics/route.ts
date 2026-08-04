import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { getCandidatosAsync, getEstamentoVariants } from '@/lib/candidates-store';
import { getAllPadronRecordsAsync, getAllSchoolsAsync } from '@/lib/padron-store';
import { getSchoolsMasterAsync } from '@/lib/schools-master-store';
import { getVotingRecordsAsync } from '@/lib/voting-record-store';
import { getSchoolsVoted, getVoteTalliesAsync } from '@/lib/metrics-store';
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

  // 1. Obtener candidatos actualizados (Supabase / Store)
  const allCandidates = await getCandidatosAsync({ estamento: 'ALL' });

  // 2. Obtener padrón oficial de votantes sin truncamiento de 1.000 filas (Paginación por lotes)
  const { records: padronRecords, total: totalPadronCount } = await getAllPadronRecordsAsync({
    rbd: schoolId,
    slepId,
  });

  // 3. Obtener actas oficiales de voto (Supabase / Store)
  const { records: rawVotingRecords } = await getVotingRecordsAsync();
  const votingRecords = rawVotingRecords.filter((v) => {
    if (schoolId !== 'ALL' && v.rbdEstablecimiento !== schoolId) return false;
    return true;
  });

  const tallies = await getVoteTalliesAsync(slepId, schoolId);
  const schoolsVotedMap = getSchoolsVoted(slepId);

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

  // ── Votos totales emitidos por estamento (desde acta oficial) ────────────
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

  // ── Desglose por estamento y sus candidaturas vinculadas ───────────────────
  const ESTAMENTO_META = [
    { estamento: 'directivos' as Estamento, label: 'Directivos', color: '#1a4a7a' },
    { estamento: 'docentes' as Estamento, label: 'Docentes', color: '#8c4f2f' },
    { estamento: 'asistentes' as Estamento, label: 'Asistentes de la Educación', color: '#1a6a6a' },
    { estamento: 'apoderados' as Estamento, label: 'Apoderados', color: '#d97706' },
    { estamento: 'estudiantes' as Estamento, label: 'Estudiantes', color: '#0284c7' },
  ];

  const estamentos: EstamentoResult[] = ESTAMENTO_META.map(({ estamento, label, color }) => {
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

  // ── Escuelas Reales del Padrón y Catálogo Maestro ────────────────────────
  const realSchoolsList = await getAllSchoolsAsync();
  const masterSchoolsList = await getSchoolsMasterAsync();

  const realSchoolsMap = new Map<string, { rbd: string; name: string }>();
  realSchoolsList.forEach((s) => realSchoolsMap.set(s.rbd, { rbd: s.rbd, name: s.nombre }));
  masterSchoolsList.forEach((s) => {
    if (!realSchoolsMap.has(s.rbd)) {
      realSchoolsMap.set(s.rbd, { rbd: s.rbd, name: s.nombreOficial });
    }
  });

  const schools: SchoolResult[] = Array.from(realSchoolsMap.values()).map((s) => {
    const votedSet = schoolsVotedMap.get(s.rbd);

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
