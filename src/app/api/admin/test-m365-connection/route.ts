import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import {
  AzureM365Config,
  getAzureM365Config,
  testM365Connection,
  updateAzureM365Config,
} from '@/lib/azure-m365-service';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  return NextResponse.json({ config: getAzureM365Config() });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión no autorizada.' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Partial<AzureM365Config>;

    // Actualizar configuración si se enviaron nuevas variables
    if (Object.keys(body).length > 0) {
      updateAzureM365Config(body);
    }

    const testResult = await testM365Connection();
    const currentConfig = getAzureM365Config();

    return NextResponse.json({
      ...testResult,
      config: currentConfig,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        latencyMs: 0,
        mode: getAzureM365Config().useSimulation ? 'simulation' : 'production',
        message: error instanceof Error ? error.message : 'Error al probar conexión con Azure AD.',
      },
      { status: 400 },
    );
  }
}
