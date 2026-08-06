import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import { processPadronChunkAsync } from '@/lib/padron-store';
import type { ParsedPadronItem } from '@/lib/padron-parser';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      records?: ParsedPadronItem[];
      chunkIndex?: number;
      totalChunks?: number;
    };

    if (!body.records || !Array.isArray(body.records) || body.records.length === 0) {
      return NextResponse.json(
        { message: 'El lote enviando no contiene registros válidos.' },
        { status: 400 },
      );
    }

    const result = await processPadronChunkAsync(body.records);

    return NextResponse.json({
      ...result,
      chunkIndex: body.chunkIndex ?? 0,
      totalChunks: body.totalChunks ?? 1,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al procesar el lote del padrón.';
    console.error('Error en /api/admin/padron/upload-chunk:', error);

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 400 },
    );
  }
}
