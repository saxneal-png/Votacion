import { describe, expect, it } from 'vitest';
import {
  getElectionConfigAsync,
  saveElectionConfigAsync,
  checkVotingWindowStatusAsync,
} from '@/lib/election-config-store';

describe('election-config-store', () => {
  it('guarda y obtiene la configuración electoral y estamentos seleccionados', async () => {
    const saved = await saveElectionConfigAsync({
      tituloProceso: 'Elección Especial Docentes 2026',
      estamentosHabilitados: ['DOCENTES', 'DIRECTIVOS'],
      fechaInicio: '2026-08-01T00:00:00.000Z',
      fechaFin: '2026-12-31T23:59:59.000Z',
      estadoEleccion: 'ABIERTA',
    });

    expect(saved.tituloProceso).toBe('Elección Especial Docentes 2026');
    expect(saved.estamentosHabilitados).toEqual(['DOCENTES', 'DIRECTIVOS']);

    const fetched = await getElectionConfigAsync();
    expect(fetched.tituloProceso).toBe('Elección Especial Docentes 2026');
    expect(fetched.estamentosHabilitados).toContain('DOCENTES');
    expect(fetched.estamentosHabilitados).not.toContain('ESTUDIANTES');
  });

  it('rechaza votantes de un estamento no habilitado', async () => {
    await saveElectionConfigAsync({
      estamentosHabilitados: ['DOCENTES'],
      fechaInicio: '2026-01-01T00:00:00.000Z',
      fechaFin: '2026-12-31T23:59:59.000Z',
      estadoEleccion: 'ABIERTA',
    });

    const checkDocente = await checkVotingWindowStatusAsync('DOCENTES');
    expect(checkDocente.canVote).toBe(true);

    const checkEstudiante = await checkVotingWindowStatusAsync('ESTUDIANTES');
    expect(checkEstudiante.canVote).toBe(false);
    expect(checkEstudiante.status).toBe('ESTAMENTO_DISABLED');
  });

  it('detecta correctamente cuando el período de votación está cerrado o pausado', async () => {
    await saveElectionConfigAsync({
      estamentosHabilitados: ['DOCENTES', 'ESTUDIANTES'],
      fechaInicio: '2026-01-01T00:00:00.000Z',
      fechaFin: '2026-12-31T23:59:59.000Z',
      estadoEleccion: 'PAUSADA',
    });

    const checkPausada = await checkVotingWindowStatusAsync('DOCENTES');
    expect(checkPausada.canVote).toBe(false);
    expect(checkPausada.status).toBe('PAUSED');
  });
});
