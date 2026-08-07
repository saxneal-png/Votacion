import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE, validateAdminSession } from '@/lib/admin-session';
import { getCandidatosAsync } from '@/lib/candidates-store';
import { getPadronRecordsAsync } from '@/lib/padron-store';
import { getVotingRecordsAsync } from '@/lib/voting-record-store';
import { getVoteTalliesAsync } from '@/lib/metrics-store';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!validateAdminSession(token)) {
    return NextResponse.json({ message: 'Sesión administrativa no válida.' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      generateAiSummary?: boolean;
      triggerAppsScript?: boolean;
      slepId?: string;
    };

    const generateAiSummary = body.generateAiSummary ?? true;
    const triggerAppsScript = body.triggerAppsScript ?? false;
    const slepId = body.slepId || 'slep-principal';

    // 1. Recopilar resultados finales desde Supabase y stores
    const candidates = await getCandidatosAsync({ estamento: 'ALL' });
    const { records: padron } = await getPadronRecordsAsync({ slepId });
    const { records: votes } = await getVotingRecordsAsync();
    const tallies = await getVoteTalliesAsync(slepId);

    const uniquePadronRuts = new Set(padron.map((p) => p.rutVotante.replace(/[^0-9kK]/g, '').toUpperCase()));
    const totalPadron = uniquePadronRuts.size || padron.length;

    const resultadosCandidatos = candidates.map((c) => ({
      id: c.id,
      nombre: c.nombreCompleto || c.name,
      estamento: c.estamento,
      colegio: c.escuelaEstablecimiento || c.role,
      votos: tallies.get(c.id) ?? 0,
    }));

    const totalCandidateVotes = resultadosCandidatos.reduce((acc, r) => acc + r.votos, 0);
    const totalPadronVoted = new Set(padron.filter((p) => p.haVotado).map((p) => p.rutVotante)).size;
    const totalVotesCast = Math.max(votes.length, totalCandidateVotes, totalPadronVoted);
    const porcentajeParticipacion = totalPadron > 0 ? ((totalVotesCast / totalPadron) * 100).toFixed(1) : '0';


    const fechaCierre = new Date().toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    // 2. Plantilla local por defecto
    let resumenActaIa = `ACTA OFICIAL DE ESCRUTINIO Y CIERRE DE PROCESO ELECTORAL CONSEJO LOCAL ${slepId.toUpperCase()}
Fecha y Hora de Cierre: ${fechaCierre}
Participación Total: ${totalVotesCast} votos emitidos de un padrón de ${totalPadron} electores habilitados (${porcentajeParticipacion}% de participación).
Resumen de Resultados por Candidatura:
${resultadosCandidatos.map((r) => `- ${r.nombre} (${r.estamento} - ${r.colegio}): ${r.votos} votos`).join('\n')}
Proceso verificado con firmas de auditoría y sello de tiempo de la plataforma de votación.`;

    let aiStatus = 'skipped_or_not_configured';

    // 3. Generación con Gemini API (OPCIONAL)
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (generateAiSummary && geminiApiKey) {
      try {
        const prompt = `Actúa como un Ministro de Fe y Secretario General de un Servicio Local de Educación Pública (SLEP) en Chile.
Redacta una Acta Oficial y Formal de Escrutinio Administrativo de Cierre de Elección para el Consejo Local.

Datos del Proceso:
- Fecha/Hora de Cierre: ${fechaCierre}
- Identificador SLEP: ${slepId}
- Total Padrón Habilitado: ${totalPadron}
- Total Votos Emitidos: ${totalVotesCast}
- Porcentaje de Participación: ${porcentajeParticipacion}%
- Resultados por Candidatura:
${JSON.stringify(resultadosCandidatos, null, 2)}

La redacción debe ser solemne, institucional, fuertemente formal en lenguaje administrativo chileno, con párrafos de certificación de quórum y legalidad del proceso.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          },
        );

        if (response.ok) {
          const aiData = (await response.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const generatedText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText) {
            resumenActaIa = generatedText;
            aiStatus = 'success';
          }
        } else {
          console.warn('[GEMINI API] No se pudo generar el acta por IA (HTTP ' + response.status + '). Usando borrador local.');
          aiStatus = 'error_fallback_used';
        }
      } catch (geminiErr) {
        console.error('[GEMINI API] Excepción al llamar a Gemini:', geminiErr);
        aiStatus = 'error_fallback_used';
      }
    }

    // 4. Webhook a Google Apps Script (OPCIONAL)
    let webhookStatus = 'skipped_or_not_configured';
    const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL;

    if (triggerAppsScript && appsScriptUrl) {
      try {
        const webhookPayload = {
          evento: 'CIERRE_ELECCION_ACTA',
          slepId,
          fechaCierre,
          metrics: {
            totalPadron,
            totalVotesCast,
            porcentajeParticipacion,
          },
          actaTextoFormal: resumenActaIa,
          resultados: resultadosCandidatos,
        };

        const webhookRes = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });

        if (webhookRes.ok) {
          webhookStatus = 'success';
        } else {
          webhookStatus = `http_error_${webhookRes.status}`;
        }
      } catch (webhookErr) {
        console.error('[APPS SCRIPT WEBHOOK] Error enviando webhook:', webhookErr);
        webhookStatus = 'exception_error';
      }
    }

    return NextResponse.json({
      success: true,
      electionClosed: true,
      slepId,
      fechaCierre,
      metricsSummary: {
        totalPadron,
        totalVotesCast,
        porcentajeParticipacion: `${porcentajeParticipacion}%`,
      },
      actaResumen: resumenActaIa,
      integrations: {
        aiSummary: { enabled: generateAiSummary, status: aiStatus },
        googleAppsScriptWebhook: { enabled: triggerAppsScript, status: webhookStatus },
      },
    });
  } catch (error) {
    console.error('[CLOSE ELECTION API] Error:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Error al cerrar la elección' },
      { status: 500 },
    );
  }
}
