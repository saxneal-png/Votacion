import { describe, expect, it } from 'vitest';
import {
  exportCandidatesToBuffer,
  exportCandidatesToCsv,
  exportCandidatesToWorkbook,
  generateCandidateTemplateWorkbook,
  normalizeEstamento,
  parseCandidatesWorkbook,
} from '@/lib/candidates-excel';
import {
  addCandidato,
  bulkImportCandidatosAsync,
  deleteCandidato,
  getCandidatos,
} from '@/lib/candidates-store';
import type { Candidate } from '@/types';
import * as XLSX from 'xlsx';

describe('candidates-excel (Exportación e Importación de Candidaturas)', () => {
  it('normaliza correctamente las variantes de estamentos', () => {
    expect(normalizeEstamento('Docentes')).toBe('docentes');
    expect(normalizeEstamento('Profesor')).toBe('docentes');
    expect(normalizeEstamento('ASISTENTES DE LA EDUCACIÓN')).toBe('asistentes');
    expect(normalizeEstamento('Padres y Apoderados')).toBe('apoderados');
    expect(normalizeEstamento('PADRES_APODERADOS')).toBe('apoderados');
    expect(normalizeEstamento('Estudiantes')).toBe('estudiantes');
    expect(normalizeEstamento('Directivo')).toBe('directivos');
    expect(normalizeEstamento('invalido')).toBeNull();
  });

  it('exporta candidatos a libro Excel (.xlsx) respetando todos los campos requeridos', () => {
    const mockCandidates: Candidate[] = [
      {
        id: 'cand-001',
        name: 'Ana María Rojas',
        nombreCompleto: 'Ana María Rojas',
        role: 'Liceo Roberto Humeres Noble',
        escuelaEstablecimiento: 'Liceo Roberto Humeres Noble',
        rbd: '10201',
        slogan: 'Liderazgo participativo para el Consejo Local',
        propuestaPrincipal: 'Liderazgo participativo para el Consejo Local',
        initials: 'AR',
        accentColor: '#8c4f2f',
        estamento: 'docentes',
        numero: 1,
        biografia: 'Docente con 15 años de servicio en San Felipe.',
        fotoPerfil: 'https://ejemplo.cl/foto-ana.jpg',
      },
      {
        id: 'cand-002',
        name: 'Carlos Miranda Soto',
        nombreCompleto: 'Carlos Miranda Soto',
        role: 'Escuela Martín Prado',
        escuelaEstablecimiento: 'Escuela Martín Prado',
        rbd: '10202',
        slogan: 'Modernización de laboratorios e infraestructura',
        propuestaPrincipal: 'Modernización de laboratorios e infraestructura',
        initials: 'CM',
        accentColor: '#1a4a7a',
        estamento: 'directivos',
        numero: 2,
        biografia: '',
        fotoPerfil: undefined,
      },
    ];

    const buffer = exportCandidatesToBuffer(mockCandidates);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);

    // Leer el buffer generado con XLSX para comprobar contenido
    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames).toContain('Candidatos');

    const sheet = wb.Sheets['Candidatos'];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    // Fila de encabezado
    expect(rows[0]).toEqual([
      'N°',
      'Nombre Completo',
      'Estamento',
      'RBD',
      'Establecimiento / Escuela',
      'Propuesta Principal',
      'Biografía / Trayectoria',
      'Foto Perfil (URL)',
      'ID Sistema',
    ]);

    // Fila 1
    expect(rows[1][0]).toBe(1);
    expect(rows[1][1]).toBe('Ana María Rojas');
    expect(rows[1][2]).toBe('Docentes');
    expect(rows[1][3]).toBe('10201');
    expect(rows[1][4]).toBe('Liceo Roberto Humeres Noble');
    expect(rows[1][5]).toBe('Liderazgo participativo para el Consejo Local');
    expect(rows[1][6]).toBe('Docente con 15 años de servicio en San Felipe.');
    expect(rows[1][7]).toBe('https://ejemplo.cl/foto-ana.jpg');
    expect(rows[1][8]).toBe('cand-001');

    // Fila 2
    expect(rows[2][0]).toBe(2);
    expect(rows[2][1]).toBe('Carlos Miranda Soto');
    expect(rows[2][2]).toBe('Directivos');
    expect(rows[2][3]).toBe('10202');
  });

  it('exporta candidatos a formato CSV con BOM UTF-8', () => {
    const mockCandidates: Candidate[] = [
      {
        id: 'cand-csv-1',
        name: 'Lorena Pérez',
        nombreCompleto: 'Lorena Pérez',
        role: 'Colegio República de Costa Rica',
        escuelaEstablecimiento: 'Colegio República de Costa Rica',
        rbd: '10203',
        slogan: 'Apoyo psicoeducativo integral',
        propuestaPrincipal: 'Apoyo psicoeducativo integral',
        initials: 'LP',
        accentColor: '#6f3b89',
        estamento: 'asistentes',
        numero: 3,
      },
    ];

    const csv = exportCandidatesToCsv(mockCandidates);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Lorena Pérez');
    expect(csv).toContain('10203');
    expect(csv).toContain('Colegio República de Costa Rica');
    expect(csv).toContain('Apoyo psicoeducativo integral');
  });

  it('genera la plantilla de ejemplo oficial con hojas de datos e instrucciones', () => {
    const templateBuffer = generateCandidateTemplateWorkbook();
    expect(templateBuffer).toBeDefined();

    const wb = XLSX.read(templateBuffer, { type: 'buffer' });
    expect(wb.SheetNames).toContain('Plantilla Candidatos');
    expect(wb.SheetNames).toContain('Instrucciones');

    const sheet = wb.Sheets['Plantilla Candidatos'];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    expect(rows.length).toBeGreaterThanOrEqual(6); // Cabecera + 5 ejemplos de estamentos
  });

  it('parsea e ingesta planillas Excel con columnas flexibles y valida campos obligatorios', () => {
    const headers = ['N°', 'Nombre Completo', 'Estamento', 'RBD', 'Establecimiento / Escuela', 'Propuesta Principal', 'Biografía', 'Foto'];
    const testRows = [
      headers,
      [1, 'Pedro González Morales', 'Docentes', '10201', 'Liceo Roberto Humeres Noble', 'Innovación pedagógica en ciencias', 'Docente 10 años', 'https://foto.cl/1.jpg'],
      [2, 'María Teresa Silva', 'Padres y Apoderados', '10204', 'Liceo José Victorino Lastarria', 'Participación familiar transparente', '', ''],
      ['', 'Fila Incompleta Sin Estamento Ni Escuela', '', '', '', '', '', ''],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(testRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Candidatos');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const result = parseCandidatesWorkbook(buffer);
    expect(result.records.length).toBe(2);
    expect(result.erroresDetalle.length).toBeGreaterThanOrEqual(1);

    const first = result.records[0];
    expect(first.nombreCompleto).toBe('Pedro González Morales');
    expect(first.estamento).toBe('docentes');
    expect(first.numero).toBe(1);
    expect(first.rbd).toBe('10201');
    expect(first.escuelaEstablecimiento).toBe('Liceo Roberto Humeres Noble');
    expect(first.propuestaPrincipal).toBe('Innovación pedagógica en ciencias');

    const second = result.records[1];
    expect(second.nombreCompleto).toBe('María Teresa Silva');
    expect(second.estamento).toBe('apoderados');
    expect(second.numero).toBe(2);
    expect(second.rbd).toBe('10204');
  });

  it('ejecuta bulkImportCandidatosAsync manteniendo números, RBD y propuestas en el store', async () => {
    const importData = [
      {
        nombreCompleto: 'Ingesta Test Docente',
        estamento: 'docentes' as const,
        numero: 10,
        rbd: '10209',
        escuelaEstablecimiento: 'Escuela San Ignacio de Loyola',
        propuestaPrincipal: 'Propuesta de prueba para ingesta masiva',
        biografia: 'Biografía test',
        fotoPerfil: 'https://foto.cl/docente.jpg',
      },
      {
        nombreCompleto: 'Ingesta Test Estudiante',
        estamento: 'estudiantes' as const,
        numero: 11,
        rbd: '10210',
        escuelaEstablecimiento: 'Escuela Los Almendros',
        propuestaPrincipal: 'Mejor infraestructura deportiva',
      },
    ];

    const res = await bulkImportCandidatosAsync(importData, false);
    expect(res.success).toBe(true);
    expect(res.insertedCount).toBe(2);

    const searchDocente = getCandidatos({ search: 'Ingesta Test Docente' });
    expect(searchDocente.length).toBe(1);
    expect(searchDocente[0].numero).toBe(10);
    expect(searchDocente[0].rbd).toBe('10209');
    expect(searchDocente[0].escuelaEstablecimiento).toBe('Escuela San Ignacio de Loyola');
    expect(searchDocente[0].propuestaPrincipal).toBe('Propuesta de prueba para ingesta masiva');

    const searchEstudiante = getCandidatos({ search: 'Ingesta Test Estudiante' });
    expect(searchEstudiante.length).toBe(1);
    expect(searchEstudiante[0].numero).toBe(11);
    expect(searchEstudiante[0].rbd).toBe('10210');

    // Limpieza
    deleteCandidato(searchDocente[0].id);
    deleteCandidato(searchEstudiante[0].id);
  });
});
