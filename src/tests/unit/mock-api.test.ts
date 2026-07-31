import { describe, expect, it } from 'vitest';

import { submitVote, verifyOtpCode, verifyUserCredentials } from '@/lib/mock-api';

describe('mock-api — verifyUserCredentials', () => {
  it('resuelve con el usuario cuando RUT y email son correctos', async () => {
    const user = await verifyUserCredentials('12345678-5', 'director@slep.cl');
    expect(user.fullName).toBeTruthy();
    expect(user.organization).toBeTruthy();
  });

  it('normaliza puntos y mayúsculas en el RUT', async () => {
    const user = await verifyUserCredentials('12.345.678-5', 'DIRECTOR@SLEP.CL');
    expect(user).toBeDefined();
  });

  it('valida credenciales para apoderado con RUN de estudiante', async () => {
    const user = await verifyUserCredentials('14567890-1', 'apoderado@slep.cl', '23456789-2');
    expect(user.estamento).toBe('apoderados');
    expect(user.studentRut).toBe('23456789-2');
  });

  it('lanza error con credenciales incorrectas', async () => {
    await expect(verifyUserCredentials('00000000-0', 'wrong@slep.cl')).rejects.toThrow();
  });
});

describe('mock-api — verifyOtpCode', () => {
  it('resuelve con el OTP correcto', async () => {
    await expect(verifyOtpCode('111111', '111111')).resolves.toBeUndefined();
  });

  it('lanza error con OTP incorrecto', async () => {
    await expect(verifyOtpCode('000000', '111111')).rejects.toThrow();
  });
});

describe('mock-api — submitVote', () => {
  it('devuelve receiptCode y candidate para un candidato válido', async () => {
    const result = await submitVote('marisol-huerta');
    expect(result.receiptCode).toMatch(/^SLEP-MH-/);
    expect(result.candidate.name).toBe('Marisol Huerta');
  });

  it('receiptCode no contiene timestamp (formato UUID fragmento)', async () => {
    const result = await submitVote('marisol-huerta');
    const suffix = result.receiptCode.split('-').pop() ?? '';
    expect(suffix).toMatch(/^[0-9A-F]{8}$/);
  });

  it('lanza error para un candidateId inexistente', async () => {
    await expect(submitVote('candidato-inexistente')).rejects.toThrow();
  });
});
