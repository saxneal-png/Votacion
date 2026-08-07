import { type NextRequest, NextResponse } from 'next/server';
import { getElectionConfigAsync, checkVotingWindowStatusAsync } from '@/lib/election-config-store';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const estamento = url.searchParams.get('estamento') || undefined;

  try {
    const config = await getElectionConfigAsync();
    const windowStatus = await checkVotingWindowStatusAsync(estamento);

    return NextResponse.json(
      {
        tituloProceso: config.tituloProceso,
        nombreInstitucion: config.nombreInstitucion,
        logoUrl: config.logoUrl,
        bgImageUrl: config.bgImageUrl,
        estamentosHabilitados: config.estamentosHabilitados,
        estadoEleccion: config.estadoEleccion,
        windowStatus,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al consultar ventana electoral.' },
      { status: 500 },
    );
  }
}
