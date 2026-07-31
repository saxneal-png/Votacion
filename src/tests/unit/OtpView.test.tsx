import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OtpView } from '@/components/views/OtpView';

function renderOtp(overrides: Partial<React.ComponentProps<typeof OtpView>> = {}) {
  const props: React.ComponentProps<typeof OtpView> = {
    email: 'usuario@slep.cl',
    otp: '',
    isPrivacyMode: false,
    isSimplifiedMode: false,
    isSubmitting: false,
    isLocked: false,
    errorMessage: null,
    onOtpChange: vi.fn(),
    onBack: vi.fn(),
    onSubmit: vi.fn((e) => e.preventDefault()),
    ...overrides,
  };
  return { ...render(<OtpView {...props} />), props };
}

describe('OtpView', () => {
  it('muestra el email enmascarado en el texto de instrucciones', () => {
    renderOtp({ email: 'usuario@slep.cl' });
    expect(screen.getByText(/us•••••@slep\.cl/i)).toBeInTheDocument();
  });

  it('renderiza el input de OTP con maxLength 6', () => {
    renderOtp();
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
    inputs.forEach((input) => expect(input).toHaveAttribute('maxLength', '2'));
  });

  it('muestra los botones Volver y Acceder', () => {
    renderOtp();
    expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acceder/i })).toBeInTheDocument();
  });

  it('deshabilita ambos botones cuando isSubmitting es true', () => {
    renderOtp({ isSubmitting: true });
    expect(screen.getByRole('button', { name: /ayuda: codigo otp/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /volver/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /verificando|acceder/i })).toBeDisabled();
  });

  it('deshabilita ambos botones cuando isLocked es true', () => {
    renderOtp({ isLocked: true });
    expect(screen.getByRole('button', { name: /ayuda: codigo otp/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /volver/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /acceder/i })).toBeDisabled();
  });

  it('muestra mensaje de error cuando errorMessage tiene valor', () => {
    renderOtp({ errorMessage: 'El código OTP no es válido o ha expirado.' });
    expect(screen.getByText(/otp no es válido/i)).toBeInTheDocument();
  });

  it('llama a onBack al pulsar el botón Volver', async () => {
    const onBack = vi.fn();
    renderOtp({ onBack });
    await userEvent.click(screen.getByRole('button', { name: /volver/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('no muestra el chip de demo en la UI', () => {
    renderOtp();
    expect(screen.queryByText(/demo:/i)).not.toBeInTheDocument();
  });

  it('muestra ayuda contextual desde el icono de pregunta', async () => {
    renderOtp();
    await userEvent.click(screen.getByRole('button', { name: /ayuda: codigo otp/i }));
    expect(screen.getByText(/Puedes escribir o pegar los seis digitos/i)).toBeInTheDocument();
  });

  it('oculta el nombre visible cuando privacy mode está activo', () => {
    renderOtp({
      isPrivacyMode: true,
      user: {
        fullName: 'Test Votante',
        organization: 'Escuela Test',
        estamento: 'docentes',
        id: '1',
        email: 'usuario@slep.cl',
        rut: '11111111-1',
      },
    });
    expect(screen.getByText(/Participante verificado/i)).toBeInTheDocument();
  });
});
