import { describe, expect, it } from 'vitest';
import {
  generateOtpToken,
  getAzureM365Config,
  sendOtpEmailViaGraph,
  testM365Connection,
  updateAzureM365Config,
  verifyOtpToken,
} from '@/lib/azure-m365-service';

describe('azure-m365-service', () => {
  it('obtiene y actualiza la configuración de Azure M365', () => {
    const initialConfig = getAzureM365Config();
    expect(initialConfig.casillaEmail).toBeDefined();

    const updated = updateAzureM365Config({
      tenantId: '12345678-abcd-efgh-1234-567890abcdef',
      useSimulation: true,
    });

    expect(updated.tenantId).toBe('12345678-abcd-efgh-1234-567890abcdef');
    expect(updated.useSimulation).toBe(true);
  });

  it('efectúa prueba de conexión con medición de latencia en milisegundos', async () => {
    const testResult = await testM365Connection();
    expect(testResult.success).toBe(true);
    expect(testResult.latencyMs).toBeGreaterThan(0);
    expect(testResult.mode).toBe('simulation');
    expect(testResult.accessTokenSample).toContain('eyJhbGciOiJSUzI1NiIs');
  });

  it('genera token OTP con vigencia de 10 minutos conforme al Decreto 102', () => {
    const otpData = generateOtpToken('12345678-9', 'docentes');
    expect(otpData.otp).toMatch(/^\d{6}$/);
    expect(otpData.magicToken).toContain('slep-magic-');

    // Verificar que la fecha de expiración esté en los próximos 10 minutos (600,000 ms)
    const timeDiffMs = otpData.expiresAt - Date.now();
    expect(timeDiffMs).toBeGreaterThan(9 * 60 * 1000);
    expect(timeDiffMs).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it('valida tokens OTP correctamente', () => {
    const userRut = '98765432-1';
    const otpData = generateOtpToken(userRut, 'apoderados');

    const validCheck = verifyOtpToken(userRut, otpData.otp);
    expect(validCheck.valid).toBe(true);

    const invalidCheck = verifyOtpToken(userRut, '000000');
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.reason).toBeDefined();
  });

  it('despacha correo institucional en modo simulación', async () => {
    const sendResult = await sendOtpEmailViaGraph({
      toEmail: 'profesor@colegio.cl',
      voterName: 'Juan Valdés',
      estamentoLabel: 'DOCENTES',
      otp: '654321',
      magicToken: 'magic-token-123',
    });

    expect(sendResult.success).toBe(true);
    expect(sendResult.mode).toBe('simulation');
    expect(sendResult.message).toContain('654321');
  });
});
