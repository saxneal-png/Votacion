import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parsePadronWorkbook } from '@/lib/padron-parser';

describe('Compatibilidad de Importación entre "Creación de Padrón" y "Votacion"', () => {
  const padronUnificadoPath = 'C:/Users/DionicioFelipeFlores/Downloads/Creación de Padrón/Padron_Electoral_Unificado_FINAL.xlsx';

  it('analiza y parsea Padron_Electoral_Unificado_FINAL.xlsx', () => {
    if (!fs.existsSync(padronUnificadoPath)) {
      console.log('Archivo no encontrado:', padronUnificadoPath);
      return;
    }

    const buffer = fs.readFileSync(padronUnificadoPath);
    console.log(`Leyendo archivo de ${buffer.length} bytes...`);

    const t0 = Date.now();
    const result = parsePadronWorkbook(buffer);
    const elapsed = Date.now() - t0;

    console.log(`--- RESULTADOS DE INGESTA ---`);
    console.log(`Tiempo de procesamiento: ${elapsed}ms`);
    console.log(`Total filas leídas: ${result.totalFilasLeidas}`);
    console.log(`Registros válidos procesados: ${result.records.length}`);
    console.log(`Errores / Observaciones detectadas: ${result.erroresDetalle.length}`);

    // Agrupar registros válidos por estamento
    const porEstamento: Record<string, number> = {};
    result.records.forEach((r) => {
      porEstamento[r.estamento] = (porEstamento[r.estamento] || 0) + 1;
    });
    console.log('Distribución por estamento:', porEstamento);

    // Agrupar primeros 10 errores por motivo
    const errorCountByReason: Record<string, number> = {};
    result.erroresDetalle.forEach((e) => {
      const simplified = e.motivo.split(':')[0] || e.motivo;
      errorCountByReason[simplified] = (errorCountByReason[simplified] || 0) + 1;
    });
    console.log('Resumen de motivos de error / filtrado:', errorCountByReason);

    expect(result.records.length).toBeGreaterThan(0);
  }, 30000);
});
