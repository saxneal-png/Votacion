import { describe, expect, it } from 'vitest';

import { resetMetrics } from '@/lib/metrics-store';
import { addSingleVoter, getPadronRecords, resetPadronVotes } from '@/lib/padron-store';
import { clearVotedUsers, hasUserVoted, markUserAsVoted } from '@/lib/server-session';

describe('Reinicio de Proceso Electoral (Ministro de Fe)', () => {
  it('restablece correctamente todas las marcas del padrón electoral', () => {
    addSingleVoter({
      rutVotante: '16.940.271-K',
      nombreCompleto: 'María González Pérez',
      estamento: 'DOCENTES',
      rbdEstablecimiento: '10202',
      nombreEstablecimiento: 'Escuela Martín Prado',
    });
    const records = getPadronRecords().records;
    records[0].haVotado = true;
    records[0].fechaVoto = new Date().toISOString();

    expect(records[0].haVotado).toBe(true);

    resetPadronVotes();

    expect(records[0].haVotado).toBe(false);
    expect(records[0].fechaVoto).toBeNull();
  });


  it('limpia las sesiones de sufragio de los usuarios', () => {
    const testRut = '16940271-K';
    markUserAsVoted(testRut);

    expect(hasUserVoted(testRut)).toBe(true);

    clearVotedUsers();

    expect(hasUserVoted(testRut)).toBe(false);
  });

  it('restablece métricas y urnas sin arrojar errores', () => {
    expect(() => {
      resetMetrics();
    }).not.toThrow();
  });
});
