import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getTerritorialParticipationReportAsync,
  generateTerritorialParticipationCsvAsync,
} from '@/lib/territorial-participation-store';
import { GET } from '@/app/api/admin/export-participacion-territorial/route';
import { createAdminSession, ADMIN_SESSION_COOKIE } from '@/lib/admin-session';

describe('Métricas de Participación Territorial por Establecimiento, Estamento y Comuna', () => {
  it('rechaza solicitudes sin sesión administrativa', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/export-participacion-territorial', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('calcula y estructura el reporte territorial con comunas y establecimientos', async () => {
    const report = await getTerritorialParticipationReportAsync();

    expect(report).toBeDefined();
    expect(report.tituloProceso).toBeTruthy();
    expect(report.fechaEmisionChile).toBeTruthy();
    expect(typeof report.totalComunas).toBe('number');
    expect(typeof report.totalEstablecimientos).toBe('number');
    expect(typeof report.padronGlobal).toBe('number');
    expect(typeof report.votosGlobal).toBe('number');
    expect(typeof report.porcentajeGlobal).toBe('number');
    expect(Array.isArray(report.comunas)).toBe(true);
    expect(Array.isArray(report.schools)).toBe(true);
  }, 30000);

  it('genera un CSV oficial con BOM UTF-8, delimitador ";" y 3 secciones de mapeo territorial', async () => {
    const csv = await generateTerritorialParticipationCsvAsync();

    // 1. Debe iniciar con UTF-8 BOM (\uFEFF) para abrir correctamente en Excel
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // 2. Debe contener los títulos y secciones
    expect(csv).toContain('REPORTE TERRITORIAL DE PARTICIPACIÓN ELECTORAL');
    expect(csv).toContain('1. RESUMEN TERRITORIAL Y MAPEO POR COMUNA');
    expect(csv).toContain('2. MATRIZ DE PARTICIPACIÓN POR ESTABLECIMIENTO EDUCACIONAL (RBD) Y COMUNA');
    expect(csv).toContain('3. DESGLOSE DETALLADO FILA POR FILA (BI / GIS / MAPAS TERRITORIALES)');

    // 3. Debe contener columnas clave para el mapeo
    expect(csv).toContain('Comuna');
    expect(csv).toContain('RBD');
    expect(csv).toContain('Nombre Establecimiento');
    expect(csv).toContain('Padrón Habilitado');
    expect(csv).toContain('Votos Emitidos');
    expect(csv).toContain('Porcentaje Participación %');
    expect(csv).toContain('Nivel Territorial');
    expect(csv).toContain('Quórum 30% Alcanzado');

    // 4. Debe incluir los 5 estamentos
    expect(csv).toContain('Docentes');
    expect(csv).toContain('Asistentes de la Educación');
    expect(csv).toContain('Padres y Apoderados');
    expect(csv).toContain('Directivos');
    expect(csv).toContain('Estudiantes');
  }, 30000);

  it('descarga el reporte territorial vía endpoint API cuando hay sesión administrativa', async () => {
    const token = createAdminSession('admin');
    const headers = new Headers();
    headers.set('cookie', `${ADMIN_SESSION_COOKIE}=${token}`);

    const req = new NextRequest('http://localhost:3000/api/admin/export-participacion-territorial', {
      method: 'GET',
      headers,
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('participacion_territorial_comunas_establecimientos_');

    const csvText = await res.text();
    expect(csvText).toContain('REPORTE TERRITORIAL DE PARTICIPACIÓN ELECTORAL');
  }, 30000);
});
