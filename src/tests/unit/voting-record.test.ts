import { describe, expect, it } from 'vitest';

import {
  generateVotingRecordsCsv,
  getVotingRecords,
  recordOfficialVote,
  resetVotingRecords,
} from '@/lib/voting-record-store';

describe('Registro Oficial de Votantes con Folio Único y Exportación CSV', () => {
  it('registra correctamente un voto emitiendo un Folio Único con formato FOL-2026-XXXXX-XXXX', () => {
    const entry = recordOfficialVote({
      rutVotante: '123456789',
      emailRegistrado: 'votante.test@gmail.com',
      estamento: 'PADRES_APODERADOS',
      rbdEstablecimiento: '10202',
      nombreEstablecimiento: 'Escuela Martín Prado',
    });

    expect(entry.folio).toMatch(/^FOL-2026-\d{5}-[A-Z0-9]{4}$/);
    expect(entry.rutVotante).toBe('123456789');
    expect(entry.emailRegistrado).toBe('votante.test@gmail.com');
    expect(entry.estamento).toBe('PADRES_APODERADOS');
    expect(entry.rbdEstablecimiento).toBe('10202');
    expect(entry.fechaHoraFormateada).toBeTruthy();
  });

  it('permite filtrar el registro por búsqueda de texto y por estamento', () => {
    recordOfficialVote({
      rutVotante: '999888776',
      emailRegistrado: 'docente.especial@eduvallediguillin.gob.cl',
      estamento: 'DOCENTES',
      rbdEstablecimiento: '10101',
      nombreEstablecimiento: 'Liceo Bicentenario',
    });

    const searchResult = getVotingRecords({ search: 'docente.especial' });
    expect(searchResult.total).toBeGreaterThanOrEqual(1);
    expect(searchResult.records[0].emailRegistrado).toBe('docente.especial@eduvallediguillin.gob.cl');

    const estamentoResult = getVotingRecords({ estamento: 'DOCENTES' });
    expect(estamentoResult.records.every((r) => r.estamento === 'DOCENTES')).toBe(true);
  });

  it('genera un CSV compatible con Excel que incluye BOM UTF-8 y los campos clave', () => {
    const csv = generateVotingRecordsCsv();

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Folio Único";"RUN Votante"');
    expect(csv).toContain('Correo Electrónico Registrado');
    expect(csv).toContain('Establecimiento Educacional');
  });

  it('vacía el registro oficial al invocar resetVotingRecords()', () => {
    resetVotingRecords();
    const result = getVotingRecords();
    expect(result.total).toBe(0);
  });
});
