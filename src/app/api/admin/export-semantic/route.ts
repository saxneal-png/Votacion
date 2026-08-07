import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import { getCandidatosAsync, getEstamentoVariants } from '@/lib/candidates-store';
import { getPadronRecordsAsync } from '@/lib/padron-store';
import { getVotingRecordsAsync } from '@/lib/voting-record-store';
import { getVoteTallies } from '@/lib/metrics-store';
import { generateJsonLdMetrics, generateTurtleMetrics } from '@/lib/semantic-export';
import type { AdminMetrics, CandidateResult, EstamentoResult, Estamento } from '@/types';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'jsonld';

  const allCandidates = await getCandidatosAsync({ estamento: 'ALL' });
  const { records: padronRecords } = await getPadronRecordsAsync();
  const { records: votingRecords } = await getVotingRecordsAsync();
  const tallies = getVoteTallies();

  const padron = { total: 0, directivos: 0, docentes: 0, asistentes: 0, apoderados: 0, estudiantes: 0 };
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


  const votes = { total: votingRecords.length, directivos: 0, docentes: 0, asistentes: 0, apoderados: 0, estudiantes: 0 };
  votingRecords.forEach((v) => {
    const vars = getEstamentoVariants(v.estamento).map((val) => val.toLowerCase());
    if (vars.includes('directivos')) votes.directivos++;
    else if (vars.includes('docentes')) votes.docentes++;
    else if (vars.includes('asistentes')) votes.asistentes++;
    else if (vars.includes('apoderados')) votes.apoderados++;
    else if (vars.includes('estudiantes')) votes.estudiantes++;
  });

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

  const metrics: AdminMetrics = {
    lastUpdated: Date.now(),
    padron,
    votes,
    estamentos,
    schools: [],
  };

  if (format === 'turtle' || format === 'ttl') {
    const turtleContent = generateTurtleMetrics(metrics);
    return new NextResponse(turtleContent, {
      headers: {
        'Content-Type': 'text/turtle; charset=utf-8',
        'Content-Disposition': 'attachment; filename="escrutinio-semantico.ttl"',
      },
    });
  }

  const jsonLdContent = generateJsonLdMetrics(metrics);
  return new NextResponse(jsonLdContent, {
    headers: {
      'Content-Type': 'application/ld+json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="escrutinio-semantico.jsonld"',
    },
  });
}
