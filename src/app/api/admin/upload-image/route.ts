import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-client';

const BUCKET_NAME = 'electoral-assets';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function getExtensionFromMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión administrativa no válida.' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    let buffer: Buffer;
    let mimeType = 'image/jpeg';
    let folder = 'candidates';
    let fallbackDataUrl: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const requestedFolder = formData.get('folder');
      if (typeof requestedFolder === 'string' && /^[a-z0-9_-]+$/i.test(requestedFolder)) {
        folder = requestedFolder;
      }

      if (!file || !(file instanceof File)) {
        return NextResponse.json({ message: 'No se recibió ningún archivo de imagen.' }, { status: 400 });
      }
      mimeType = file.type || 'image/jpeg';
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return NextResponse.json({ message: 'Formato no permitido. Usa JPG, PNG, WebP o GIF.' }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ message: 'La imagen excede el límite de 2 MB.' }, { status: 400 });
      }
      buffer = Buffer.from(await file.arrayBuffer());
      fallbackDataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    } else {
      const body = (await request.json()) as { dataUrl?: string; folder?: string };
      if (body.folder && /^[a-z0-9_-]+$/i.test(body.folder)) {
        folder = body.folder;
      }
      const dataUrl = String(body.dataUrl || '').trim();
      const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        return NextResponse.json({ message: 'Imagen inválida. Usa JPG, PNG, WebP o GIF.' }, { status: 400 });
      }
      mimeType = match[1];
      buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > MAX_BYTES) {
        return NextResponse.json({ message: 'La imagen excede el límite de 2 MB.' }, { status: 400 });
      }
      fallbackDataUrl = dataUrl;
    }

    // Intentar almacenar en Supabase Storage (CDN público)
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === BUCKET_NAME);
      if (!exists) {
        await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: MAX_BYTES,
          allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
        });
      }

      const ext = getExtensionFromMime(mimeType);
      const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: mimeType,
          cacheControl: '31536000',
          upsert: false,
        });

      if (!uploadError) {
        const { data: publicData } = supabaseAdmin.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
          return NextResponse.json({
            success: true,
            url: publicData.publicUrl,
            storage: 'supabase',
          });
        }
      } else {
        console.warn('[STORAGE] Fallo al subir a Supabase Storage, usando respaldo inline:', uploadError.message);
      }
    } catch (storageErr) {
      console.warn('[STORAGE] Excepción en Supabase Storage, usando respaldo inline:', storageErr);
    }

    // Respaldo transparente si Storage no está disponible
    return NextResponse.json({
      success: true,
      url: fallbackDataUrl,
      storage: 'inline',
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al procesar la imagen.' },
      { status: 500 },
    );
  }
}
