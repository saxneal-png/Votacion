import { expect, test } from '@playwright/test';

// Credentials that live in VALID_USER (mock-api.ts)
const VALID_RUT_NUMBER = '12345678';
const VALID_RUT_VERIFIER = '5';
const VALID_EMAIL = 'director@slep.cl';
const VALID_OTP = '111111';

async function fillOtp(page: Parameters<typeof test>[0]['page'], otp: string) {
  const digits = otp.split('');
  for (let i = 0; i < digits.length; i += 1) {
    await page.getByLabel(`Dígito ${i + 1} de 6`).fill(digits[i]);
  }
}

test.describe('Flujo completo de votación', () => {
  test('completa el flujo login → otp → vote → success', async ({ page }) => {
    await page.goto('/');

    // --- Paso 1: Login ---
    await expect(page.getByText(/Paso 1 de 3/i)).toBeVisible();
    await page.getByPlaceholder('12345678').fill(VALID_RUT_NUMBER);
    await page.getByPlaceholder('9').fill(VALID_RUT_VERIFIER);
    await page.getByPlaceholder('usuario@slep.cl').fill(VALID_EMAIL);
    await page.getByRole('button', { name: /continuar/i }).click();

    // --- Paso 2: OTP ---
    await expect(page.getByText(/Paso 2 de 3/i)).toBeVisible();
    await fillOtp(page, VALID_OTP);
    await page.getByRole('button', { name: /acceder/i }).click();

    // --- Paso 3: Papeleta ---
    await expect(page.getByText(/Emision de voto/i)).toBeVisible();
    // Seleccionar el primer candidato disponible
    const candidateButtons = page.getByRole('button', { name: /Pablo|Claudia|Rodrigo/i });
    await candidateButtons.first().click();
    await page.getByRole('button', { name: /confirmar voto/i }).click();
    await page.getByRole('button', { name: /emitir voto/i }).click();

    // --- Paso 4: Confirmación ---
    await expect(page.getByText(/Voto registrado/i)).toBeVisible();
    await expect(page.getByText(/SLEP-/i)).toBeVisible();
  });
});

test.describe('Login — validación', () => {
  test('muestra error con credenciales incorrectas', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('12345678').fill('99999999');
    await page.getByPlaceholder('9').fill('0');
    await page.getByPlaceholder('usuario@slep.cl').fill('wrong@test.cl');
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.getByText(/No encontramos una coincidencia/i)).toBeVisible();
  });

  test('bloquea el formulario tras 5 intentos fallidos', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 5; i++) {
      await page.getByPlaceholder('12345678').fill('99999999');
      await page.getByPlaceholder('9').fill('0');
      await page.getByPlaceholder('usuario@slep.cl').fill('wrong@test.cl');
      await page.getByRole('button', { name: /continuar/i }).click();
      await page.waitForTimeout(1600); // esperar latencia mock
    }
    await expect(page.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });
});

test.describe('OTP — validación', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('12345678').fill(VALID_RUT_NUMBER);
    await page.getByPlaceholder('9').fill(VALID_RUT_VERIFIER);
    await page.getByPlaceholder('usuario@slep.cl').fill(VALID_EMAIL);
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.getByText(/Paso 2 de 3/i)).toBeVisible();
  });

  test('muestra error con OTP incorrecto', async ({ page }) => {
    await fillOtp(page, '000000');
    await page.getByRole('button', { name: /acceder/i }).click();
    await expect(page.getByText(/OTP no es valido/i)).toBeVisible();
  });

  test('regresa a login al pulsar el botón Volver', async ({ page }) => {
    await page.getByRole('button', { name: /volver/i }).click();
    await expect(page.getByText(/Paso 1 de 3/i)).toBeVisible();
  });

  test('regresa a login forzado tras 3 intentos fallidos de OTP', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await fillOtp(page, '000000');
      await page.getByRole('button', { name: /acceder/i }).click();
      await page.waitForTimeout(1600);
    }
    await expect(page.getByText(/Paso 1 de 3/i)).toBeVisible();
  });
});

test.describe('Seguridad — sin datos de demo en UI', () => {
  test('no muestra credenciales de prueba en la pantalla de login', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=/12345678.*9.*slep/i')).not.toBeVisible();
  });

  test('no muestra el OTP de prueba en la pantalla de verificación', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('12345678').fill(VALID_RUT_NUMBER);
    await page.getByPlaceholder('9').fill(VALID_RUT_VERIFIER);
    await page.getByPlaceholder('usuario@slep.cl').fill(VALID_EMAIL);
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.getByText(/Paso 2 de 3/i)).toBeVisible();
    await expect(page.locator('text=/Demo:/i')).not.toBeVisible();
  });
});
