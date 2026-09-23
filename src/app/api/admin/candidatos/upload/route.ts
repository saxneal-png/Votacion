import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, addAuditEntry, validateAdminSession } from '@/lib/admin-session';
import { bulkImportCandidatosAsync, CandidateFormData } from '@/lib/candidates-store';
import { parseCandidatesWorkbook } from '@/lib/candidates-excel';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión administrativa no autorizada o expirada.' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    // Modo A: Multipart Form Data (Archivo Excel / CSV subido)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const replaceMode = formData.get('replaceMode') === 'true';

      if (!file) {
        return NextResponse.json(
          { message: 'Debes seleccionar un archivo Excel (.xlsx, .xls) o .csv para la carga.' },
          { status: 400 },
        );
      }

      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
        return NextResponse.json(
          { message: 'Formato no soportado. El archivo debe tener extensión .xlsx, .xls o .csv' },
          { status: 400 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const parsed = parseCandidatesWorkbook(arrayBuffer);

      if (parsed.records.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'El archivo no contiene registros de candidatos válidos.',
            erroresDetalle: parsed.erroresDetalle,
          },
          { status: 400 },
        );
      }

      const result = await bulkImportCandidatosAsync(parsed.records, replaceMode);

      addAuditEntry({
        ts: Date.now(),
        ip,
        event: 'access',
        detail: `Ingesta masiva de candidatos: ${result.insertedCount} registrados (Modo: ${replaceMode ? 'Reemplazo total' : 'Agregar/Actualizar'}).`,
      });

      return NextResponse.json({
        success: true,
        totalFilasLeidas: parsed.totalFilasLeidas,
        registrosInsertados: result.insertedCount,
        erroresDetalle: parsed.erroresDetalle,
        records: result.records,
        message: `Se importaron ${result.insertedCount} candidaturas exitosamente.`,
      });
    }

    // Modo B: JSON Body (Registros ya pre-procesados en cliente)
    const body = (await request.json()) as {
      records?: CandidateFormData[];
      replaceMode?: boolean;
    };

    if (!body.records || !Array.isArray(body.records) || body.records.length === 0) {
      return NextResponse.json(
        { message: 'Debes proporcionar un arreglo de candidatos válido en el cuerpo de la solicitud.' },
        { status: 400 },
      );
    }

    const result = await bulkImportCandidatosAsync(body.records, Boolean(body.replaceMode));

    addAuditEntry({
      ts: Date.now(),
      ip,
      event: 'access',
      detail: `Ingesta masiva de candidatos vía JSON: ${result.insertedCount} registros procesados.`,
    });

    return NextResponse.json({
      success: true,
      registrosInsertados: result.insertedCount,
      errors: result.errors,
      records: result.records,
      message: `Se importaron ${result.insertedCount} candidaturas exitosamente.`,
    });
  } catch (error) {
    console.error('Error en /api/admin/candidatos/upload:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Error al procesar e importar candidatos.',
      },
      { status: 400 },
    );
  }
}
