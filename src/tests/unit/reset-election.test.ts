import { describe, expect, it } from 'vitest';

import { resetMetrics } from '@/lib/metrics-store';
import { getPadronRecords, resetPadronVotes } from '@/lib/padron-store';
import { clearVotedUsers, hasUserVoted, markUserAsVoted } from '@/lib/server-session';

describe('Reinicio de Proceso Electoral (Ministro de Fe)', () => {
  it('restablece correctamente todas las marcas del padrón electoral', () => {
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
