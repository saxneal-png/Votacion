import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VotingView } from '@/components/views/VotingView';
import type { Candidate } from '@/types';

const MOCK_CANDIDATES: Candidate[] = [
  { id: 'c1', name: 'Ana Pérez', role: 'Representante docente', slogan: 'Slogan A', initials: 'AP', accentColor: '#c00', estamento: 'docentes' },
  { id: 'c2', name: 'Luis Torres', role: 'Representante gestión', slogan: 'Slogan B', initials: 'LT', accentColor: '#00c', estamento: 'docentes' },
];

function renderVoting(overrides: Partial<React.ComponentProps<typeof VotingView>> = {}) {
  const props: React.ComponentProps<typeof VotingView> = {
    candidates: MOCK_CANDIDATES,
    voterName: 'Test Votante',
    estamento: 'docentes',
    isDemoMode: false,
    isPrivacyMode: false,
    isSimplifiedMode: false,
    selectedCandidateId: null,
    remainingSeconds: 120,
    hasExpired: false,
    isSubmitting: false,
    errorMessage: null,
    onSelectCandidate: vi.fn(),
    onSubmitVote: vi.fn(),
    ...overrides,
  };
  return { ...render(<VotingView {...props} />), props };
}

describe('VotingView', () => {
  it('muestra el nombre del votante', () => {
    renderVoting();
    expect(screen.getByText(/Test/i)).toBeInTheDocument();
  });

  it('renderiza una tarjeta por cada candidato', () => {
    renderVoting();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Luis Torres')).toBeInTheDocument();
  });

  it('muestra el temporizador con el tiempo inicial', () => {
    renderVoting({ remainingSeconds: 115 });
    expect(screen.getByText('01:55')).toBeInTheDocument();
  });

  it('deshabilita las tarjetas y el botón cuando hasExpired es true', () => {
    renderVoting({ hasExpired: true, selectedCandidateId: 'c1' });
    const candidateButtons = screen.getAllByRole('button', { name: /Ana|Luis/i });
    candidateButtons.forEach((btn) => expect(btn).toBeDisabled());
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeDisabled();
  });

  it('el botón Confirmar está deshabilitado si no hay candidato seleccionado', () => {
    renderVoting({ selectedCandidateId: null });
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeDisabled();
  });

  it('el botón Confirmar está habilitado con candidato seleccionado y tiempo restante', () => {
    renderVoting({ selectedCandidateId: 'c1' });
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeEnabled();
  });

  it('llama a onSelectCandidate al pulsar una tarjeta de candidato', async () => {
    const onSelectCandidate = vi.fn();
    renderVoting({ onSelectCandidate });
    await userEvent.click(screen.getByText('Ana Pérez'));
    expect(onSelectCandidate).toHaveBeenCalledWith('c1');
  });

  it('llama a onSubmitVote al pulsar Confirmar voto', async () => {
    const onSubmitVote = vi.fn();
    renderVoting({ selectedCandidateId: 'c1', onSubmitVote });
    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await userEvent.click(screen.getByRole('button', { name: /emitir voto/i }));
    expect(onSubmitVote).toHaveBeenCalledOnce();
  });

  it('muestra aviso de sesión expirada cuando hasExpired es true', () => {
    renderVoting({ hasExpired: true });
    expect(screen.getByText(/tiempo de la sesion termino/i)).toBeInTheDocument();
  });

  it('muestra mensaje de error cuando errorMessage tiene valor', () => {
    renderVoting({ errorMessage: 'Debes seleccionar una candidatura.' });
    expect(screen.getByText(/debes seleccionar/i)).toBeInTheDocument();
  });

  it('muestra badge de simulacion cuando isDemoMode es true', () => {
    renderVoting({ isDemoMode: true });
    expect(screen.getByText(/simulacion guiada/i)).toBeInTheDocument();
  });

  it('muestra ayuda contextual desde el icono de pregunta', async () => {
    renderVoting();
    await userEvent.click(screen.getByRole('button', { name: /ayuda: papeleta/i }));
    expect(screen.getByText(/marca una sola candidatura/i)).toBeInTheDocument();
  });

  it('muestra sello de flujo verificado', () => {
    renderVoting();
    expect(screen.getByText(/flujo verificado/i)).toBeInTheDocument();
  });
});
