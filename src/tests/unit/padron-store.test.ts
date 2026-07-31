import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { cleanAndValidateRUT, formatRut } from '@/lib/rut-validator';
import {
  addSingleVoter,
  calculateEstamentoQuorums,
  deleteVoterRecord,
  normalizeEstamentoDecreto102,
  processPadronExcelBuffer,
  toggleVoterHabilitado,
} from '@/lib/padron-store';

describe('rut-validator', () => {
  it('valida correctamente un RUN chileno válido con algoritmo Módulo 11', () => {
    const res = cleanAndValidateRUT('16.940.271-k');
    expect(res.valid).toBe(true);
    expect(res.cleanRut).toBe('16940271K');
    expect(res.formattedRut).toBe('16.940.271-K');
  });

  it('rechaza un RUN con dígito verificador matemático incorrecto', () => {
    const res = cleanAndValidateRUT('12.345.678-9');
    expect(res.valid).toBe(false);
    expect(res.errorReason).toContain('Módulo 11');
  });

  it('formatea un RUN limpio correctamente', () => {
    expect(formatRut('123456785')).toBe('12.345.678-5');
  });
});

describe('padron-store', () => {
  it('normaliza nombres de estamentos al Enum estricto del Decreto 102', () => {
    expect(normalizeEstamentoDecreto102('Estudiantes')).toBe('ESTUDIANTES');
    expect(normalizeEstamentoDecreto102('Padres y Apoderados')).toBe('PADRES_APODERADOS');
    expect(normalizeEstamentoDecreto102('Profesor Docente')).toBe('DOCENTES');
    expect(normalizeEstamentoDecreto102('Asistente de la Educación')).toBe('ASISTENTES');
    expect(normalizeEstamentoDecreto102('Jefe UTP')).toBe('DIRECTIVOS');
  });

  it('calcula el Quórum inicial del 30% por estamento', () => {
    const quorums = calculateEstamentoQuorums();
    expect(quorums.length).toBe(5);
    const apoderadosQuorum = quorums.find((q) => q.estamento === 'PADRES_APODERADOS');
    expect(apoderadosQuorum).toBeDefined();
    expect(apoderadosQuorum?.quorum30Requerido).toBeGreaterThan(0);
  });

  it('agrega un votante manualmente y permite alternar su habilitación', () => {
    const newVoter = addSingleVoter({
      rutVotante: '12.345.678-5', // Votante único de prueba
      nombreCompleto: 'Prueba Votante Manual',
      estamento: 'ESTUDIANTES',
      rbdEstablecimiento: '10202',
      nombreEstablecimiento: 'Escuela Martín Prado',
    });

    expect(newVoter.id).toBeDefined();
    expect(newVoter.rutVotante).toBe('123456785');

    // Cambiar estado habilitado
    const updated = toggleVoterHabilitado(newVoter.id);
    expect(updated.habilitado).toBe(false);

    // Eliminar
    const deleted = deleteVoterRecord(newVoter.id);
    expect(deleted).toBe(true);
  });

  it('exige RUN de Estudiante al agregar un Apoderado', () => {
    expect(() =>
      addSingleVoter({
        rutVotante: '12.345.678-5', // RUN matemáticamente válido (12345678-5)
        nombreCompleto: 'Apoderado Sin Hijo',
        estamento: 'PADRES_APODERADOS',
        rbdEstablecimiento: '10202',
        nombreEstablecimiento: 'Escuela Martín Prado',
      }),
    ).toThrow(/Decreto 102/);
  });

  it('procesa e ingesta correctamente buffers de Excel multi-hoja con alias como R.U.N. y RUT_FAMILIAR y hoja de estudiantes', () => {
    const wb = XLSX.utils.book_new();

    const sheetFuncionariosData = [
      ['R.U.N.', 'Nombres', 'Apellidos', 'Estamento', 'Escuela/Liceo', 'RBD'],
      ['16.445.435-5', 'Dionicio Felipe', 'Flores Vilches', 'DOCENTES', 'Liceo Bicentenario', '12345'],
    ];
    const wsFuncionarios = XLSX.utils.aoa_to_sheet(sheetFuncionariosData);
    XLSX.utils.book_append_sheet(wb, wsFuncionarios, 'funcionarios');

    const sheetApoderadosData = [
      ['RUT_FAMILIAR', 'NOMBRE_FAMILIAR', 'RUT_ALUMNO', 'NOMBRE_ESTABLECIMIENTO', 'RBD'],
      ['11.223.344-K', 'Carlos Ignacio Vergara', '23.456.789-6', 'Liceo Bicentenario', '12345'],
    ];
    const wsApoderados = XLSX.utils.aoa_to_sheet(sheetApoderadosData);
    XLSX.utils.book_append_sheet(wb, wsApoderados, 'apoderados');

    const sheetEstudiantesData = [
      ['RUT_ALUMNO', 'NOMBRE_ALUMNO', 'AP_PATERNO_ALUMNO', 'AP_MATERNO_ALUMNO', 'NOMBRE_ESTABLECIMIENTO', 'RBD'],
      ['23.456.789-6', 'Esteban', 'Vergara', 'Pérez', 'Liceo Bicentenario', '12345'],
    ];
    const wsEstudiantes = XLSX.utils.aoa_to_sheet(sheetEstudiantesData);
    XLSX.utils.book_append_sheet(wb, wsEstudiantes, 'estudiantes');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const res = processPadronExcelBuffer(buf);

    expect(res.success).toBe(true);
    expect(res.registrosInsertados).toBeGreaterThanOrEqual(3);
  });
});
