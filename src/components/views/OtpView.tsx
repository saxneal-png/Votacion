'use client';

import React, { useRef } from 'react';

import { HelpTooltip } from '@/components/HelpTooltip';
import type { Estamento, User } from '@/types';

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

function maskEmail(email: string): string {
  const [localPart = '', domain = ''] = email.trim().split('@');
  if (!localPart || !domain) return email;

  const visible = localPart.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(localPart.length - 2, 2))}@${domain}`;
}

function maskFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fullName;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

interface OtpViewProps {
  email: string;
  user: User | null;
  otp: string;
  isPrivacyMode: boolean;
  isSimplifiedMode: boolean;
  isScreenObscured: boolean;
  isSubmitting: boolean;
  isLocked: boolean;
  errorMessage: string | null;
  onOtpChange: (value: string) => void;
  onBack: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

const digitClass =
  'w-full h-12 rounded-xl border-[1.5px] border-slate-900/[0.14] bg-white text-[#0c2138] text-[22px] font-bold text-center tabular-nums font-sans transition-all duration-150 focus:outline-none focus:border-[#0b5294] focus:ring-2 focus:ring-[#0b5294]/15 disabled:opacity-50';

export function OtpView({
  email,
  user,
  otp,
  isPrivacyMode,
  isSimplifiedMode,
  isScreenObscured,
  isSubmitting,
  isLocked,
  errorMessage,
  onOtpChange,
  onBack,
  onSubmit,
}: OtpViewProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => otp[i] ?? '');
  const maskedEmail = maskEmail(email);

  function handleDigitInput(index: number, value: string) {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, i) => (i === index ? clean : d));
    onOtpChange(next.join(''));
    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = digits.map((d, i) => (i === index - 1 ? '' : d));
      onOtpChange(next.join(''));
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onOtpChange(pasted);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  const isComplete = otp.replace(/\D/g, '').length === 6;

  return (
    <section className="rounded-2xl bg-white/95 backdrop-blur-sm border border-slate-900/10 text-ink p-5">
      <div className="mb-4 pb-4 border-b border-slate-900/[0.08]">
        <div className="flex items-start justify-between gap-3">
          <h1 className="mt-0 mb-0 font-serif text-[clamp(20px,2.6vw,28px)] text-ink leading-none tracking-tight">
            {isSimplifiedMode ? 'Escribe tu codigo' : 'Codigo de acceso'}
          </h1>
          <HelpTooltip
            title="Codigo OTP"
            description="Puedes escribir o pegar los seis digitos. Si te equivocas, usa retroceso para corregir sin perder el foco."
          />
        </div>
        <p className="mt-2 mb-0 text-sm text-ink-muted font-sans leading-relaxed">
          {isSimplifiedMode ? (
            <>Te enviamos un codigo a <strong className={isScreenObscured ? 'sensitive-blur' : ''}>{maskedEmail}</strong>. Escríbelo abajo.</>
          ) : (
            <>Enviamos un codigo de 6 digitos a <strong className={isScreenObscured ? 'sensitive-blur' : ''}>{maskedEmail}</strong>. Ingresalo a continuacion.</>
          )}
        </p>
      </div>

      {/* User info card */}
      {user ? (
        <div className={`mb-4 flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-slate-50 border border-slate-900/[0.08] ${isScreenObscured ? 'sensitive-panel-blur' : ''}`}>
          <div
            className="shrink-0 w-10 h-10 rounded-full inline-grid place-items-center text-[13px] font-bold font-sans"
            style={{
              background: `color-mix(in srgb, ${ESTAMENTO_COLORS[user.estamento]} 18%, white)`,
              color: ESTAMENTO_COLORS[user.estamento],
            }}
          >
            {user.fullName.split(' ').slice(0, 2).map((n) => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <p className={`m-0 font-sans font-bold text-[14px] text-ink leading-tight truncate ${isScreenObscured ? 'sensitive-blur' : ''}`}>
              {isPrivacyMode ? 'Participante verificado' : maskFullName(user.fullName)}
            </p>
            <p className={`m-0 mt-0.5 font-sans text-[11px] text-ink-muted leading-tight ${isScreenObscured ? 'sensitive-blur' : ''}`}>
              {isPrivacyMode ? 'Datos visibles reducidos por privacidad' : user.organization}
            </p>
          </div>
          <span
            className="ml-auto shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold font-sans uppercase tracking-wide whitespace-nowrap"
            style={{
              background: `color-mix(in srgb, ${ESTAMENTO_COLORS[user.estamento]} 14%, white)`,
              color: ESTAMENTO_COLORS[user.estamento],
              border: `1px solid color-mix(in srgb, ${ESTAMENTO_COLORS[user.estamento]} 28%, white)`,
            }}
          >
            {ESTAMENTO_LABELS[user.estamento]}
          </span>
        </div>
      ) : null}

      <form className="grid gap-3.5" onSubmit={onSubmit} autoComplete="off">
        <div className="grid gap-2">
          <span className="text-[11px] font-bold font-sans text-[#1c3d5c] uppercase tracking-wide">
            Codigo de 6 digitos
          </span>
          <div className="grid grid-cols-6 gap-2">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                className={digitClass}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={2}
                value={digit}
                onChange={(e) => handleDigitInput(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                onPaste={handlePaste}
                disabled={isSubmitting || isLocked}
                aria-label={`D&#237;gito ${i + 1} de 6`}
              />
            ))}
          </div>
        </div>

        {errorMessage ? (
          <p role="alert" aria-live="assertive" className="m-0 px-3.5 py-2.5 rounded-xl text-[13px] font-sans font-medium text-red-600 bg-red-50 border border-red-200">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex gap-2.5">
          <button
            className="inline-flex items-center justify-center h-11 px-4 rounded-xl bg-white text-[#1c3d5c] font-sans text-sm font-bold border-[1.5px] border-slate-900/[0.14] shadow-sm hover:bg-slate-50 hover:-translate-y-px active:translate-y-0 disabled:opacity-45 disabled:cursor-not-allowed transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5294]/15"
            type="button"
            onClick={onBack}
            disabled={isSubmitting || isLocked}
          >
            ← Volver
          </button>
          <button
            className="flex-1 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-[#0b5294] text-white font-sans text-sm font-bold tracking-wide shadow-[0_4px_14px_rgba(11,82,148,0.40),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[#0a4278] hover:-translate-y-px active:translate-y-0 disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5294]/20"
            type="submit"
            disabled={isSubmitting || isLocked || !isComplete}
          >
            {isSubmitting ? <><span className="btn-spinner mr-2" />Verificando…</> : 'Acceder a la papeleta →'}
          </button>
        </div>
      </form>
    </section>
  );
}