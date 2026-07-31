import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { candidates } from '@/lib/mock-api';
import { getSchoolsVoted, getVoteTallies } from '@/lib/metrics-store';
import { SCHOOLS } from '@/lib/schools-data';
import {
  ADMIN_SESSION_COOKIE,
  addAuditEntry,
  validateAdminSession,
} from '@/lib/admin-session';
import type { AdminMetrics, CandidateResult, EstamentoResult, SchoolResult } from '@/types';

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

  const tallies = getVoteTallies();
  const schoolsVotedMap = getSchoolsVoted();

  // ── Padrón totals (derived from schools data) ───────────────────────────
  const padron = SCHOOLS.reduce(
    (acc, s) => ({
      total:
        acc.total +
        s.voters.directivos +
        s.voters.docentes +
        s.voters.asistentes +
        s.voters.apoderados,
      directivos: acc.directivos + s.voters.directivos,
      docentes: acc.docentes + s.voters.docentes,
      asistentes: acc.asistentes + s.voters.asistentes,
      apoderados: acc.apoderados + s.voters.apoderados,
    }),
    { total: 0, directivos: 0, docentes: 0, asistentes: 0, apoderados: 0 },
  );

  // ── Per-estamento vote tallies ───────────────────────────────────────────
  function countVotesByEstamento(estamento: string) {
    return candidates
      .filter((c) => c.estamento === estamento)
      .reduce((sum, c) => sum + (tallies.get(c.id) ?? 0), 0);
  }

  const votes = {
    directivos: countVotesByEstamento('directivos'),
    docentes: countVotesByEstamento('docentes'),
    asistentes: countVotesByEstamento('asistentes'),
    apoderados: countVotesByEstamento('apoderados'),
    total: 0,
  };
  votes.total = votes.directivos + votes.docentes + votes.asistentes + votes.apoderados;

  // ── Estamento breakdowns ─────────────────────────────────────────────────
  const ESTAMENTO_META = [
    { estamento: 'directivos', label: 'Directivos', color: '#1a4a7a' },
    { estamento: 'docentes', label: 'Docentes', color: '#8c4f2f' },
    { estamento: 'asistentes', label: 'Asistentes de la Educación', color: '#1a6a6a' },
    { estamento: 'apoderados', label: 'Apoderados', color: '#d97706' },
  ] as const;

  const estamentos: EstamentoResult[] = ESTAMENTO_META.map(({ estamento, label, color }) => {
    const estamentoCandidates = candidates.filter((c) => c.estamento === estamento);

    const candidateResults: CandidateResult[] = estamentoCandidates.map((c) => ({
      id: c.id,
      name: c.name,
      initials: c.initials,
      accentColor: c.accentColor,
      votes: tallies.get(c.id) ?? 0,
    }));

    return {
      estamento,
      label,
      color,
      padronCount: padron[estamento],
      votesCast: votes[estamento],
      candidates: candidateResults,
    };
  });

  // ── Schools ──────────────────────────────────────────────────────────────
  const schools: SchoolResult[] = SCHOOLS.map((s) => {
    const votedSet = schoolsVotedMap.get(s.id);
    return {
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      padron: s.voters,
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
