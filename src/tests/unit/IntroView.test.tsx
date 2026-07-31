import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IntroView } from '@/components/views/IntroView';

function renderIntro(overrides: Partial<React.ComponentProps<typeof IntroView>> = {}) {
  const props: React.ComponentProps<typeof IntroView> = {
    isDemoMode: false,
    onDemoModeChange: vi.fn(),
    onStart: vi.fn(),
    ...overrides,
  };

  return { ...render(<IntroView {...props} />), props };
}

describe('IntroView', () => {
  it('muestra la orientacion previa y la lista de requisitos', () => {
    renderIntro();
    expect(screen.getByText(/antes de comenzar/i)).toBeInTheDocument();
    expect(screen.getByText(/RUT sin puntos/i)).toBeInTheDocument();
  });

  it('permite activar la simulacion guiada', async () => {
    const onDemoModeChange = vi.fn();
    renderIntro({ onDemoModeChange });
    await userEvent.click(screen.getByLabelText(/activar simulacion guiada/i));
    expect(onDemoModeChange).toHaveBeenCalledWith(true);
  });

  it('llama a onStart al iniciar el flujo', async () => {
    const onStart = vi.fn();
    renderIntro({ onStart });
    await userEvent.click(screen.getByRole('button', { name: /iniciar identificacion/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});