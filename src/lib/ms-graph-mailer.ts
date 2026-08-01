/**
 * Servicio de envío de correos utilizando Microsoft Graph API (Microsoft 365 A5)
 * Servicio Local de Educación Pública
 */

interface SendOtpEmailParams {
  toEmail: string;
  userName?: string;
  otpCode: string;
}

interface AzureTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

/**
 * Obtiene un token de acceso OAuth 2.0 desde Microsoft Azure AD
 * utilizando el flujo Client Credentials.
 */
async function getAzureAccessToken(): Promise<string> {
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  const tenantId = process.env.MS_GRAPH_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId || tenantId === 'tu-tenant-id-aqui') {
    throw new Error(
      'Configuración incompleta: Faltan las variables MS_GRAPH_TENANT_ID o MS_GRAPH_CLIENT_SECRET en .env.local',
    );
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = (await response.json()) as AzureTokenResponse;

  if (!response.ok || !data.access_token) {
    console.error('Error al obtener token de Azure AD:', data);
    throw new Error(
      `Error de autenticación Azure AD (${response.status}): ${data.error_description || data.error || 'Token no recibido'}`,
    );
  }

  return data.access_token;
}

/**
 * Envia un correo electrónico con el código OTP usando la API de Microsoft Graph
 */
export async function sendOtpEmail({
  toEmail,
  userName = 'Estimado(a) Votante',
  otpCode,
}: SendOtpEmailParams): Promise<{ success: boolean; messageId?: string }> {
  const senderEmail =
    process.env.MS_GRAPH_SENDER_EMAIL || 'dionicio.flores@slepvallediguillin.gob.cl';

  // 1. Obtener Access Token de Azure AD
  const token = await getAzureAccessToken();

  // 2. Construir plantilla de correo HTML institucional
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #0056b3;">
        <h2 style="color: #0056b3; margin: 0;">Portal de Votación Digital</h2>
        <p style="color: #666666; font-size: 14px; margin-top: 4px;">Servicio Local de Educación Pública</p>
      </div>

      <div style="padding: 24px 0;">
        <p style="font-size: 16px; color: #333333;">Hola <strong>${userName}</strong>,</p>
        <p style="font-size: 15px; color: #555555; line-height: 1.5;">
          Has solicitado ingresar al Portal de Votación Digital. Utiliza el siguiente código de seguridad (OTP) para verificar tu identidad:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #0056b3; background-color: #f0f4f9; padding: 12px 28px; border-radius: 8px; border: 1px dashed #0056b3; display: inline-block;">
            ${otpCode}
          </span>
        </div>

        <p style="font-size: 13px; color: #777777; line-height: 1.4;">
          ⚠️ Este código es confidencial, de uso único y tiene una validez de <strong>10 minutos</strong>. Si no has solicitado este acceso, por favor desestima este mensaje.
        </p>
      </div>

      <div style="border-top: 1px solid #e0e0e0; padding-top: 16px; text-align: center; font-size: 12px; color: #999999;">
        <p>Este correo ha sido generado automáticamente por la plataforma de Votación Digital del SLEP.</p>
        <p>Remitente institucional: ${senderEmail}</p>
      </div>
    </div>
  `;

  // 3. Enviar correo a través de Microsoft Graph API /users/{id|userPrincipalName}/sendMail
  const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    senderEmail,
  )}/sendMail`;

  const mailPayload = {
    message: {
      subject: `Código de Verificación: ${otpCode} - Portal de Votación SLEP`,
      body: {
        contentType: 'HTML',
        content: htmlBody,
      },
      toRecipients: [
        {
          emailAddress: {
            address: toEmail,
          },
        },
      ],
    },
    saveToSentItems: false,
  };

  const response = await fetch(sendMailUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mailPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error al enviar correo vía Microsoft Graph:', response.status, errorText);
    throw new Error(
      `Error Microsoft Graph API (${response.status}): ${errorText || 'No se pudo entregar el correo'}`,
    );
  }

  return { success: true };
}

/**
 * Encola el envío de correo OTP a través de Upstash QStash o ejecutor asíncrono.
 * Si no está configurada la cola, realiza el envío síncrono transparente.
 */
export async function enqueueOtpEmail(params: SendOtpEmailParams): Promise<{ queued: boolean; messageId?: string }> {
  const qstashToken = process.env.QSTASH_TOKEN;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (qstashToken) {
    try {
      const qstashUrl = `https://qstash.upstash.io/v2/publish/${appBaseUrl}/api/jobs/send-email`;
      const response = await fetch(qstashUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${qstashToken}`,
          'Content-Type': 'application/json',
          'Upstash-Retries': '3',
        },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        const resData = (await response.json()) as { messageId?: string };
        console.log('[QSTASH] Correo OTP encolado con éxito:', resData.messageId);
        return { queued: true, messageId: resData.messageId };
      }
    } catch (err) {
      console.error('[QSTASH] Error publicando en cola QStash, ejecutando envío directo:', err);
    }
  }

  // Fallback directo si no se utiliza QStash
  const directResult = await sendOtpEmail(params);
  return { queued: false, messageId: directResult.messageId };
}
