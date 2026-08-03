import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseSchoolsMasterExcelBuffer,
  upsertSchoolsMasterAsync,
  getSchoolsMasterAsync,
  updateSchoolMasterAsync,
  deleteSchoolMasterAsync,
  clearSchoolsMasterAsync,
} from '@/lib/schools-master-store';

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

  it('permite editar un colegio maestro existente', async () => {
    await upsertSchoolsMasterAsync([
      { rbd: '88888', nombreOficial: 'Escuela Original', comuna: 'Chillán' },
    ]);

    const updated = await updateSchoolMasterAsync('88888', {
      nombreOficial: 'Escuela Modificada Oficial',
      comuna: 'Chillán Viejo',
    });
    expect(updated).toBe(true);

    const master = await getSchoolsMasterAsync();
    const found = master.find((s) => s.rbd === '88888');
    expect(found?.nombreOficial).toBe('Escuela Modificada Oficial');
    expect(found?.comuna).toBe('Chillán Viejo');
  });

  it('permite eliminar un colegio maestro individual', async () => {
    await upsertSchoolsMasterAsync([
      { rbd: '77777', nombreOficial: 'Escuela a Eliminar', comuna: 'Pinto' },
    ]);

    const deleted = await deleteSchoolMasterAsync('77777');
    expect(deleted).toBe(true);

    const master = await getSchoolsMasterAsync();
    const found = master.find((s) => s.rbd === '77777');
    expect(found).toBeUndefined();
  });

  it('permite vaciar todo el catálogo maestro', async () => {
    await upsertSchoolsMasterAsync([
      { rbd: '66666', nombreOficial: 'Escuela Uno', comuna: 'Chillán' },
      { rbd: '55555', nombreOficial: 'Escuela Dos', comuna: 'Bulnes' },
    ]);

    const cleared = await clearSchoolsMasterAsync();
    expect(cleared).toBe(true);

    const master = await getSchoolsMasterAsync();
    const foundOne = master.find((s) => s.rbd === '66666' || s.rbd === '55555');
    expect(foundOne).toBeUndefined();
  });
});
