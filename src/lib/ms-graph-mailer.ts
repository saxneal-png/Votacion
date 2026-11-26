/**
 * Servicio de envío de correos utilizando Microsoft Graph API (Microsoft 365 A5)
 */

import { getElectionConfigAsync, renderOtpEmailTemplate } from '@/lib/election-config-store';

interface SendOtpEmailParams {
  toEmail: string;
  userName?: string;
  otpCode: string;
  estamentoLabel?: string;
  magicLinkUrl?: string;
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
  estamentoLabel,
  magicLinkUrl,
}: SendOtpEmailParams): Promise<{ success: boolean; messageId?: string }> {
  const senderEmail =
    process.env.MS_GRAPH_SENDER_EMAIL || 'dionicio.flores@slepvallediguillin.gob.cl';

  // 1. Obtener Access Token de Azure AD y configuración electoral vigente
  const [token, electionConfig] = await Promise.all([
    getAzureAccessToken(),
    getElectionConfigAsync(),
  ]);

  // 2. Construir plantilla de correo HTML institucional configurable
  const { subject, html: htmlBody } = renderOtpEmailTemplate(electionConfig, {
    otp: otpCode,
    voterName: userName,
    estamentoLabel,
    magicLinkUrl,
    senderEmail,
  });

  // 3. Enviar correo a través de Microsoft Graph API /users/{id|userPrincipalName}/sendMail
  const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    senderEmail,
  )}/sendMail`;

  const mailPayload = {
    message: {
      subject,
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
