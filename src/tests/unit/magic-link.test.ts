import { describe, expect, it } from 'vitest';
import { generateOtpToken, verifyMagicToken } from '@/lib/azure-m365-service';

describe('Magic Link verification', () => {
  it('valida un Magic Token generado activamente', () => {
    const userRut = '12345678-9';
    const otpData = generateOtpToken(userRut, 'docentes');

    const result = verifyMagicToken(otpData.magicToken);
    expect(result.valid).toBe(true);
    expect(result.userRut).toBe(userRut);
    expect(result.estamento).toBe('docentes');
  });

  it('rechaza tokens vacíos o no existentes', () => {
    const result = verifyMagicToken('');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('no proporcionado');

    const invalidResult = verifyMagicToken('token-inexistente-123');
    expect(invalidResult.valid).toBe(false);
  });

  it('acepta tokens demo slep-magic-*', () => {
    const result = verifyMagicToken('slep-magic-test-token-999');
    expect(result.valid).toBe(true);
    expect(result.userRut).toBe('16940271-k');
  });
});
