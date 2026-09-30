import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordAnonymousVote,
  getAnonymousVotes,
  generateAnonymousVotesCsvAsync,
  resetAnonymousVotes,
} from '@/lib/anonymous-votes-store';

describe('Almacén y Exportación de Votos Anónimos (Urna Digital)', () => {
  beforeEach(() => {
    resetAnonymousVotes();
  });

  it('registra votos anónimos correctamente en la urna digital', () => {
    const vote = recordAnonymousVote({
      estamento: 'docentes',
      candidateId: 'marisol-huerta',
    });

    expect(vote).toBeDefined();
    expect(vote.id).toBeTruthy();
    expect(vote.estamento).toBe('docentes');
    expect(vote.candidateId).toBe('marisol-huerta');
    expect(vote.createdAt).toBeTruthy();

    const { records, total } = getAnonymousVotes();
    expect(total).toBe(1);
    expect(records[0].candidateId).toBe('marisol-huerta');
  });

  it('filtra votos anónimos por estamento y por búsqueda', () => {
    recordAnonymousVote({
      estamento: 'docentes',
      candidateId: 'marisol-huerta',
    });
    recordAnonymousVote({
      estamento: 'asistentes',
      candidateId: 'carmen-lagos',
    });
    recordAnonymousVote({
      estamento: 'directivos',
      candidateId: 'pablo-reyes',
    });

    const docentes = getAnonymousVotes({ estamento: 'docentes' });
    expect(docentes.total).toBe(1);
    expect(docentes.records[0].candidateId).toBe('marisol-huerta');

    const searchDoc = getAnonymousVotes({ search: 'marisol' });
    expect(searchDoc.total).toBe(1);
    expect(searchDoc.records[0].candidateId).toBe('marisol-huerta');
  });

  it('genera un CSV estructurado con codificación UTF-8 + BOM y delimitador para Excel', async () => {
    recordAnonymousVote({
      estamento: 'docentes',
      candidateId: 'marisol-huerta',
    });
    recordAnonymousVote({
      estamento: 'apoderados',
      candidateId: 'gonzalo-silva',
    });

    const csv = await generateAnonymousVotesCsvAsync();

    // Validar BOM UTF-8 (\uFEFF)
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // Validar encabezados oficiales
    expect(csv).toContain('N° Correlativo');
    expect(csv).toContain('ID Voto en Urna (UUID / Folio)');
    expect(csv).toContain('Estamento Electoral');
    expect(csv).toContain('Candidato / Opción Votada');
    expect(csv).toContain('Fecha y Hora de Sufragio (Chile)');

    // Validar contenido
    expect(csv).toContain('Docentes');
    expect(csv).toContain('Padres y Apoderados');

    // Validar que NO contenga RUT ni correo para preservar el secreto del voto
    expect(csv).not.toContain('rut_votante');
    expect(csv).not.toContain('email_registrado');
  });

  it('vacía la urna en memoria al ejecutar resetAnonymousVotes()', () => {
    recordAnonymousVote({
      estamento: 'docentes',
      candidateId: 'marisol-huerta',
    });
    expect(getAnonymousVotes().total).toBe(1);

    resetAnonymousVotes();
    expect(getAnonymousVotes().total).toBe(0);
  });
});
