import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import { processPadronExcelBuffer } from '@/lib/padron-store';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { message: 'Debes seleccionar un archivo Excel (.xlsx o .xlsm) para la carga.' },
        { status: 400 },
      );
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xlsm')) {
      return NextResponse.json(
        { message: 'Formato no soportado. El archivo debe tener extensión .xlsx o .xlsm' },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = processPadronExcelBuffer(buffer);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al procesar la planilla Excel.';
    console.error('Error en /api/admin/padron/upload:', error);

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 400 },
    );
  }
}
