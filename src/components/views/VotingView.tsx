'use client';

import React, { useEffect, useRef, useState } from 'react';

import { HelpTooltip } from '@/components/HelpTooltip';
import type { Candidate, Estamento } from '@/types';

const ESTAMENTO_LABELS: Record<Estamento, string> = {
  directivos: 'Directivos',
  docentes: 'Docentes',
  asistentes: 'Asistentes de la Educación',
  apoderados: 'Apoderados',
  estudiantes: 'Estudiantes',
};

const ESTAMENTO_COLORS: Record<Estamento, string> = {
  directivos: '#1a4a7a',
  docentes: '#8c4f2f',
  asistentes: '#1a6a6a',
  apoderados: '#d97706',
  estudiantes: '#0284c7',
};

interface VotingViewProps {
  candidates: Candidate[];
  voterName: string;
  estamento: Estamento;
  isDemoMode: boolean;
  isPrivacyMode: boolean;
  isSimplifiedMode: boolean;
  isScreenObscured: boolean;
  selectedCandidateId: string | null;
  remainingSeconds: number;
  hasExpired: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSelectCandidate: (candidateId: string) => void;
  onSubmitVote: () => void;
}

function formatTimer(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function VotingView({
  candidates,
  voterName,
  estamento,
  isDemoMode,
  isPrivacyMode,
  isSimplifiedMode,
  isScreenObscured,
  selectedCandidateId,
  remainingSeconds,
  hasExpired,
  isSubmitting,
  errorMessage,
  onSelectCandidate,
  onSubmitVote,
}: VotingViewProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalPanelRef = useRef<HTMLDivElement | null>(null);
  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId) ?? null;
  const displayName = isPrivacyMode ? 'Participante' : voterName.split(/\s+/).filter(Boolean)[0] ?? voterName;

  function handleConfirmClick() {
    if (!selectedCandidateId || hasExpired) return;
    setShowConfirmModal(true);
  }

  useEffect(() => {
    if (!showConfirmModal) {
      confirmButtonRef.current?.focus();
      return;
    }

    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowConfirmModal(false);
        return;
      }

      if (event.key !== 'Tab' || !modalPanelRef.current) return;

      const focusable = modalPanelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfirmModal]);

  return (
    <>
    <section className="rounded-2xl bg-white/95 backdrop-blur-sm border border-slate-900/10 text-ink p-5">
      {/* Header row: title + timer */}
      <div className="flex gap-3 justify-between items-start mb-4 pb-4 border-b border-slate-900/[0.08]">
        <div className="min-w-0">
          <p className="mt-0 mb-0 text-[10px] font-bold font-sans uppercase tracking-[0.16em] text-ink-muted">
            Papeleta digital
          </p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="m-0 font-serif text-[clamp(20px,2.6vw,28px)] text-ink leading-none tracking-tight">
              {isSimplifiedMode ? 'Elige una opcion' : 'Emision de voto'}
            </h1>
            <HelpTooltip
              title="Papeleta"
              description="Revisa el padron mostrado, marca una sola candidatura y usa el boton de confirmacion una sola vez. En movil, la accion principal queda fija al borde inferior."
              align="left"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className={`m-0 text-sm text-ink-muted font-sans leading-relaxed ${isScreenObscured ? 'sensitive-blur' : ''}`}>
              {isSimplifiedMode
                ? `${displayName}, marca una candidatura y confirma una vez.`
                : `${displayName}, selecciona una candidatura y confirma tu voto antes de que expire la sesion.`}
            </p>
            <span
              className={`inline-flex shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold font-sans uppercase tracking-wide ${isScreenObscured ? 'sensitive-blur' : ''}`}
              style={{
                background: `color-mix(in srgb, ${ESTAMENTO_COLORS[estamento]} 14%, white)`,
                color: ESTAMENTO_COLORS[estamento],
                border: `1px solid color-mix(in srgb, ${ESTAMENTO_COLORS[estamento]} 28%, white)`,
              }}
            >
              Padron: {ESTAMENTO_LABELS[estamento]}
            </span>
            {isDemoMode ? (
              <span className="inline-flex shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold font-sans uppercase tracking-wide border border-emerald-200 bg-emerald-50 text-emerald-700">
                Simulacion guiada
              </span>
            ) : null}
            <span className="inline-flex shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold font-sans uppercase tracking-wide border border-[#0b5294]/15 bg-[#0b5294]/6 text-[#0b5294]">
              Flujo verificado
            </span>
          </div>
        </div>

        {/* Timer */}
        <div className={`shrink-0 min-w-[120px] px-3 py-2.5 rounded-2xl border text-center font-sans shadow-sm transition-all duration-300 ${
          hasExpired || remainingSeconds <= 10
            ? 'border-red-200 text-red-600 bg-red-50'
            : remainingSeconds <= 30
            ? 'border-amber-200 text-amber-700 bg-amber-50'
            : 'border-slate-900/10 text-ink bg-white'
        }`}>
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">Tiempo</span>
          <strong className="block mt-1 text-xl tabular-nums">{formatTimer(remainingSeconds)}</strong>
        </div>
      </div>

      {/* Candidate grid */}
      <div className="grid grid-cols-2 gap-3">
        {candidates.map((candidate) => {
          const isSelected = selectedCandidateId === candidate.id;
          return (
            <button
              key={candidate.id}
              type="button"
              className={`grid gap-2 p-3.5 text-left rounded-2xl border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b5294]/40 ${
                isSelected
                  ? 'candidate-selected bg-gradient-to-b from-white to-slate-50/80'
                  : 'border-slate-900/[0.1] bg-gradient-to-b from-white to-slate-50/80 hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-900/20'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => onSelectCandidate(candidate.id)}
              aria-pressed={isSelected}
              disabled={hasExpired || isSubmitting}
              style={{ ['--accent' as string]: candidate.accentColor }}
            >
              <span className="candidate-badge inline-grid place-items-center w-11 h-11 rounded-full text-[15px]">
                {candidate.initials}
              </span>
              <span className="text-[17px] font-bold text-ink font-serif leading-tight">
                {candidate.name}
              </span>
              <span className="text-[11px] font-sans font-medium text-ink-muted leading-tight">
                {candidate.role}
              </span>
              {!isSimplifiedMode ? (
                <span className="text-[11px] font-sans italic text-ink-muted/70 leading-snug line-clamp-2">
                  &ldquo;{candidate.slogan}&rdquo;
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {errorMessage ? (
        <p className="m-0 mt-3 px-3.5 py-2.5 rounded-xl text-[13px] font-sans font-medium text-red-600 bg-red-50 border border-red-200">
          {errorMessage}
        </p>
      ) : null}

      {hasExpired ? (
        <p className="m-0 mt-3 px-3.5 py-2.5 rounded-xl text-[13px] font-sans font-medium text-amber-700 bg-amber-50 border border-amber-200">
          El tiempo de la sesion termino. Debes reiniciar el flujo para emitir tu voto.
        </p>
      ) : null}

      <div className="sticky bottom-3 mt-3 -mx-1 px-1 md:static md:mx-0 md:px-0">
        <div className="flex justify-end rounded-2xl border border-slate-900/[0.08] bg-white/96 p-2 shadow-[0_8px_24px_rgba(6,18,38,0.08)] backdrop-blur-sm md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          <button
            ref={confirmButtonRef}
            className="inline-flex items-center justify-center w-full md:w-auto h-11 px-6 rounded-xl bg-[#0b5294] text-white font-sans text-sm font-bold tracking-wide shadow-[0_4px_14px_rgba(11,82,148,0.40),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[#0a4278] hover:-translate-y-px active:translate-y-0 disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5294]/20"
            type="button"
            onClick={handleConfirmClick}
            disabled={hasExpired || isSubmitting || !selectedCandidateId}
          >
            {isSubmitting ? <><span className="btn-spinner mr-2" />Registrando…</> : 'Confirmar voto →'}
          </button>
        </div>
      </div>
    </section>
      {showConfirmModal && selectedCandidate ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmModal(false); }}
        >
          <div ref={modalPanelRef} className="modal-panel">
            <div className="p-5 border-b border-slate-900/[0.08]">
              <h2 id="modal-title" className="m-0 font-serif text-[20px] text-ink leading-tight tracking-tight">
                Confirma tu voto
              </h2>
              <p id="modal-description" className="mt-1.5 mb-0 text-sm text-ink-muted font-sans">
                {isSimplifiedMode ? 'Revisa tu opcion antes de continuar.' : 'Esta accion no se puede deshacer.'}
              </p>
            </div>
            <div className="p-5 grid gap-4">
              <div
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-900/[0.08]"
                style={{ ['--accent' as string]: selectedCandidate.accentColor }}
              >
                <span className="candidate-badge inline-grid place-items-center w-11 h-11 rounded-full text-[15px] shrink-0">
                  {selectedCandidate.initials}
                </span>
                <div className="min-w-0">
                  <p className="m-0 font-serif font-bold text-[16px] text-ink leading-tight">{selectedCandidate.name}</p>
                  <p className="m-0 mt-0.5 font-sans text-[11px] text-ink-muted leading-tight">{selectedCandidate.role}</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button
                  ref={cancelButtonRef}
                  className="flex-1 inline-flex items-center justify-center h-11 px-4 rounded-xl bg-white text-[#1c3d5c] font-sans text-sm font-bold border-[1.5px] border-slate-900/[0.14] hover:bg-slate-50 transition-all duration-150 disabled:opacity-45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5294]/15"
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-[#0b5294] text-white font-sans text-sm font-bold tracking-wide shadow-[0_4px_14px_rgba(11,82,148,0.40)] hover:bg-[#0a4278] transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5294]/20"
                  type="button"
                  onClick={() => { setShowConfirmModal(false); onSubmitVote(); }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <><span className="btn-spinner mr-2" />Registrando…</> : 'Emitir voto →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>  );
}