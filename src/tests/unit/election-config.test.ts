import { describe, expect, it } from 'vitest';
import {
  getElectionConfigAsync,
  saveElectionConfigAsync,
  checkVotingWindowStatusAsync,
  buildWhatsAppLink,
  renderOtpEmailTemplate,
  isEmailDomainAllowed,
  parseAllowedDomains,
  type ElectionConfig,
} from '@/lib/election-config-store';

describe('election-config-store', () => {
  describe('buildWhatsAppLink helper', () => {
    it('generates a valid wa.me link with encoded text', () => {
      const link = buildWhatsAppLink('+56 9 1234 5678', 'Hola necesito ayuda');
      expect(link).toBe('https://wa.me/56912345678?text=Hola%20necesito%20ayuda');
    });

    it('returns empty string if phone number is empty or contains no digits', () => {
      expect(buildWhatsAppLink('')).toBe('');
      expect(buildWhatsAppLink('   ')).toBe('');
      expect(buildWhatsAppLink('abc-+-')).toBe('');
    });

    it('replaces {RUT} and {ESTAMENTO} variables in the template', () => {
      const template = 'RUN: {RUT} | Estamento: {ESTAMENTO} | Problema';
      const link = buildWhatsAppLink('+56 9 8888 9999', template, {
        rut: '12.345.678-9',
        estamento: 'DOCENTES',
      });
      expect(link).toContain('https://wa.me/56988889999?text=');
      const decoded = decodeURIComponent(link.replace('https://wa.me/56988889999?text=', ''));
      expect(decoded).toBe('RUN: 12.345.678-9 | Estamento: DOCENTES | Problema');
    });

    it('handles case-insensitive variable replacements {rut} and {estamento}', () => {
      const template = 'Hola {rut}, tu estamento es {estamento}';
      const link = buildWhatsAppLink('56911112222', template, {
        rut: '9.876.543-2',
        estamento: 'ASISTENTES',
      });
      const decoded = decodeURIComponent(link.replace('https://wa.me/56911112222?text=', ''));
      expect(decoded).toBe('Hola 9.876.543-2, tu estamento es ASISTENTES');
    });

    it('uses fallback values when context is omitted', () => {
      const template = 'Hola {RUT} ({ESTAMENTO})';
      const link = buildWhatsAppLink('+56 9 9999 0000', template);
      expect(link).toContain('https://wa.me/56999990000?text=');
      const decoded = decodeURIComponent(link.replace('https://wa.me/56999990000?text=', ''));
      expect(decoded).toBe('Hola No especificado (Votante)');
    });
  });

  describe('Database and Memory Configuration Persistence', () => {
    it('guarda y obtiene la configuración electoral y estamentos seleccionados', async () => {
      const saved = await saveElectionConfigAsync({
        tituloProceso: 'Elección Especial Docentes 2026',
        nombreInstitucion: 'SLEP Ñuble Cordillera',
        logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        bgImageUrl: '/custom-bg.jpg',
        estamentosHabilitados: ['DOCENTES', 'DIRECTIVOS'],
        fechaInicio: '2026-08-01T00:00:00.000Z',
        fechaFin: '2026-12-31T23:59:59.000Z',
        estadoEleccion: 'ABIERTA',
        habilitarSoporte: true,
        telefonoSoporte: '+56 42 220 9999',
        whatsappSoporte: '+56 9 8765 4321',
        mensajeWhatsappPlantilla: 'Mensaje personalizado de prueba para RUN {RUT}',
        emailSoporte: 'ayuda.electoral@slep.cl',
        horarioAtencionSoporte: '09:00 a 16:00 hrs',
      });

      expect(saved.tituloProceso).toBe('Elección Especial Docentes 2026');
      expect(saved.nombreInstitucion).toBe('SLEP Ñuble Cordillera');
      expect(saved.logoUrl).toContain('data:image/png;base64');
      expect(saved.bgImageUrl).toBe('/custom-bg.jpg');
      expect(saved.estamentosHabilitados).toEqual(['DOCENTES', 'DIRECTIVOS']);
      expect(saved.habilitarSoporte).toBe(true);
      expect(saved.telefonoSoporte).toBe('+56 42 220 9999');
      expect(saved.whatsappSoporte).toBe('+56 9 8765 4321');
      expect(saved.mensajeWhatsappPlantilla).toBe('Mensaje personalizado de prueba para RUN {RUT}');
      expect(saved.emailSoporte).toBe('ayuda.electoral@slep.cl');
      expect(saved.horarioAtencionSoporte).toBe('09:00 a 16:00 hrs');

      const fetched = await getElectionConfigAsync();
      expect(fetched.tituloProceso).toBe('Elección Especial Docentes 2026');
      expect(fetched.nombreInstitucion).toBe('SLEP Ñuble Cordillera');
      expect(fetched.logoUrl).toContain('data:image/png;base64');
      expect(fetched.bgImageUrl).toBe('/custom-bg.jpg');
      expect(fetched.estamentosHabilitados).toContain('DOCENTES');
      expect(fetched.estamentosHabilitados).not.toContain('ESTUDIANTES');
      expect(fetched.telefonoSoporte).toBe('+56 42 220 9999');
      expect(fetched.whatsappSoporte).toBe('+56 9 8765 4321');
    });

    it('rechaza votantes de un estamento no habilitado', async () => {
      await saveElectionConfigAsync({
        estamentosHabilitados: ['DOCENTES'],
        fechaInicio: '2026-01-01T00:00:00.000Z',
        fechaFin: '2026-12-31T23:59:59.000Z',
        estadoEleccion: 'ABIERTA',
      });

      const checkDocente = await checkVotingWindowStatusAsync('DOCENTES');
      expect(checkDocente.canVote).toBe(true);

      const checkEstudiante = await checkVotingWindowStatusAsync('ESTUDIANTES');
      expect(checkEstudiante.canVote).toBe(false);
      expect(checkEstudiante.status).toBe('ESTAMENTO_DISABLED');
    });

    it('detecta correctamente cuando el período de votación está cerrado o pausado', async () => {
      await saveElectionConfigAsync({
        estamentosHabilitados: ['DOCENTES', 'ESTUDIANTES'],
        fechaInicio: '2026-01-01T00:00:00.000Z',
        fechaFin: '2026-12-31T23:59:59.000Z',
        estadoEleccion: 'PAUSADA',
      });

      const checkPausada = await checkVotingWindowStatusAsync('DOCENTES');
      expect(checkPausada.canVote).toBe(false);
      expect(checkPausada.status).toBe('PAUSED');
    });

    it('permite alternar el estado de habilitación de soporte permanentemente', async () => {
      await saveElectionConfigAsync({ habilitarSoporte: false });
      let config = await getElectionConfigAsync();
      expect(config.habilitarSoporte).toBe(false);

      await saveElectionConfigAsync({ habilitarSoporte: true });
      config = await getElectionConfigAsync();
      expect(config.habilitarSoporte).toBe(true);
    });
  });

  describe('renderOtpEmailTemplate & domain helpers', () => {
    it('reemplaza variables dinámicas y escapa HTML en la plantilla OTP', () => {
      const { subject, html } = renderOtpEmailTemplate(
        {
          tituloProceso: 'Elección Directiva 2026',
          nombreInstitucion: 'Asociación <Prueba>',
          emailOtpSubject: 'Código {OTP} - {TITULO_PROCESO}',
          emailOtpHeaderTitle: '{NOMBRE_INSTITUCION}',
          emailOtpGreeting: 'Hola {NOMBRE_VOTANTE}',
          emailOtpBodyText: 'Tu estamento es {ESTAMENTO} para {TITULO_PROCESO}.',
          emailOtpShowCode: true,
          emailOtpShowMagicLink: true,
          emailOtpButtonText: 'Ir a votar',
        },
        {
          otp: '654321',
          voterName: 'Ana <Admin>',
          estamentoLabel: 'DOCENTES',
          magicLinkUrl: 'https://ejemplo.cl/votacion?token=abc',
          senderEmail: 'no-reply@ejemplo.cl',
        },
      );

      expect(subject).toBe('Código 654321 - Elección Directiva 2026');
      expect(html).toContain('Asociación &lt;Prueba&gt;');
      expect(html).toContain('Hola Ana &lt;Admin&gt;');
      expect(html).toContain('654321');
      expect(html).toContain('https://ejemplo.cl/votacion?token=abc');
      expect(html).toContain('Ir a votar');
    });

    it('permite ocultar el bloque OTP o el enlace mágico según configuración', () => {
      const { html } = renderOtpEmailTemplate(
        {
          emailOtpShowCode: true,
          emailOtpShowMagicLink: false,
        },
        {
          otp: '998877',
          magicLinkUrl: 'https://ejemplo.cl/votacion?token=xyz',
        },
      );

      expect(html).toContain('998877');
      expect(html).not.toContain('https://ejemplo.cl/votacion?token=xyz');
    });

    it('valida dominios permitidos y soporta comodín *', () => {
      expect(parseAllowedDomains('miempresa.cl, @otra.cl')).toEqual(['@miempresa.cl', '@otra.cl']);
      expect(isEmailDomainAllowed('juan@miempresa.cl', 'miempresa.cl, @otra.cl')).toBe(true);
      expect(isEmailDomainAllowed('juan@gmail.com', 'miempresa.cl, @otra.cl')).toBe(false);
      expect(isEmailDomainAllowed('juan@gmail.com', '*')).toBe(true);
    });
  });
});
