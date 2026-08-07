import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/export-metrics-csv/route';
import { createAdminSession, ADMIN_SESSION_COOKIE } from '@/lib/admin-session';

describe('export-metrics-csv API route', () => {
  it('rechaza solicitudes sin sesión administrativa', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/export-metrics-csv', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('genera un CSV estructurado con BOM UTF-8 y secciones de métricas cuando hay sesión administrativa', async () => {
    const token = createAdminSession('admin');
    const headers = new Headers();
    headers.set('cookie', `${ADMIN_SESSION_COOKIE}=${token}`);

    const req = new NextRequest('http://localhost:3000/api/admin/export-metrics-csv', {
      method: 'GET',
      headers,
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('resultados_metricas_eleccion_');

    const csvText = await res.text();
    expect(csvText).toContain('REPORTE OFICIAL DE RESULTADOS Y MÉTRICAS ELECTORALES');
    expect(csvText).toContain('1. RESUMEN DE PARTICIPACIÓN POR ESTAMENTO (DECRETO N° 102)');
    expect(csvText).toContain('2. ESCRUTINIO Y RESULTADOS POR CANDIDATURA');
    expect(csvText).toContain('3. PARTICIPACIÓN POR ESTABLECIMIENTO EDUCACIONAL (RBD)');
  }, 30000);
});

