import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseSchoolsMasterExcelBuffer, upsertSchoolsMasterAsync, getSchoolsMasterAsync } from '@/lib/schools-master-store';

describe('schools-master-store', () => {
  it('parsea correctamente un Excel de catálogo maestro de colegios por RBD', () => {
    const data = [
      ['RBD', 'establecimientos', 'Comuna'],
      ['3638', 'LICEO BICENTENARIO MARTA BRUNET CÁRAVES', 'Chillán'],
      ['10202', 'Escuela Martín Prado', 'San Carlos'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Establecimientos');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const records = parseSchoolsMasterExcelBuffer(buffer);
    expect(records.length).toBe(2);
    expect(records[0].rbd).toBe('3638');
    expect(records[0].nombreOficial).toBe('LICEO BICENTENARIO MARTA BRUNET CÁRAVES');
    expect(records[0].comuna).toBe('Chillán');
  });

  it('guarda y recupera establecimientos en el store maestro', async () => {
    const initial = [
      { rbd: '99999', nombreOficial: 'Colegio Prueba Maestro', comuna: 'Chillán' },
    ];

    const count = await upsertSchoolsMasterAsync(initial);
    expect(count).toBeGreaterThanOrEqual(1);

    const master = await getSchoolsMasterAsync();
    const found = master.find((s) => s.rbd === '99999');
    expect(found).toBeDefined();
    expect(found?.nombreOficial).toBe('Colegio Prueba Maestro');
  });
});
