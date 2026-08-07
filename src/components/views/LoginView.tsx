import React, { useState } from 'react';
import { HelpTooltip } from '@/components/HelpTooltip';

function validateRut(number: string, verifier: string): 'valid' | 'invalid' | 'empty' {
  if (!number || !verifier) return 'empty';
  const digits = number.split('').reverse().map(Number);
  const multipliers = [2, 3, 4, 5, 6, 7];
  const sum = digits.reduce((acc, d, i) => acc + d * multipliers[i % multipliers.length], 0);
  const remainder = 11 - (sum % 11);
  const expected = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
  return verifier.toUpperCase() === expected ? 'valid' : 'invalid';
}

function formatRutNumber(raw: string): string {
  if (raw.length <= 3) return raw;
  const rev = raw.split('').reverse();
  const groups: string[] = [];
  for (let i = 0; i < rev.length; i += 3) {
    groups.push(rev.slice(i, i + 3).join(''));
  }
  return groups.join('.').split('').reverse().join('');
}

function maskEmail(email: string): string {
  const [localPart = '', domain = ''] = email.trim().split('@');
  if (!localPart || !domain) return email;

  const visible = localPart.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(localPart.length - 2, 2))}@${domain}`;
}

const inputClass =
  'w-full h-11 px-3.5 rounded-xl border-[1.5px] border-slate-900/[0.14] bg-white text-[#0c2138] font-sans text-[15px] transition-all duration-150 focus:outline-none focus:border-[#0b5294] focus:ring-2 focus:ring-[#0b5294]/15 placeholder:text-slate-400/70';

const labelClass = 'text-[11px] font-bold font-sans text-[#1c3d5c] uppercase tracking-wide';

export type VoterType = 'funcionario' | 'apoderado';

interface LoginViewProps {
  voterType: VoterType;
  rutNumber: string;
  rutVerifier: string;
  studentRutNumber: string;
  studentRutVerifier: string;
  email: string;
  isSimplifiedMode: boolean;
  isSubmitting: boolean;
  isLocked: boolean;
  errorMessage: string | null;
  onVoterTypeChange: (type: VoterType) => void;
  onRutNumberChange: (value: string) => void;
  onRutVerifierChange: (value: string) => void;
  onStudentRutNumberChange: (value: string) => void;
  onStudentRutVerifierChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function LoginView({
  voterType,
  rutNumber,
  rutVerifier,
  studentRutNumber,
  studentRutVerifier,
  email,
  isSimplifiedMode,
  isSubmitting,
  isLocked,
  errorMessage,
  onVoterTypeChange,
  onRutNumberChange,
  onRutVerifierChange,
  onStudentRutNumberChange,
  onStudentRutVerifierChange,
  onEmailChange,
  onSubmit,
}: LoginViewProps) {
  const rutStatus = validateRut(rutNumber, rutVerifier);
  const studentRutStatus = validateRut(studentRutNumber, studentRutVerifier);
  const errorId = errorMessage ? 'login-form-error' : undefined;
  const rutStatusId = rutStatus !== 'empty' ? 'rut-status' : undefined;
  const studentRutStatusId = studentRutStatus !== 'empty' ? 'student-rut-status' : undefined;
  const trimmedEmail = email.trim();
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  return (
    <section className="rounded-2xl bg-white/95 backdrop-blur-sm border border-slate-900/10 text-[#0c2138] p-5">
      <div className="mb-4 pb-4 border-b border-slate-900/[0.08]">
        <div className="flex items-start justify-between gap-3">
          <h1 className="mt-0 mb-0 font-serif text-[clamp(20px,2.6vw,28px)] text-[#0c2138] leading-none tracking-tight">
            {isSimplifiedMode ? 'Ingresa tus datos' : 'Identificación del Votante'}
          </h1>
          <HelpTooltip
            title="Identificación por Estamento"
            description="Si eres Funcionario (Directivo, Docente, Asistente) ingresa tu RUN y correo. Si eres Apoderado, se requiere además el RUN del estudiante."
          />
        </div>
        <p className="mt-2 mb-0 text-sm text-slate-500 font-sans leading-relaxed">
          {isSimplifiedMode
            ? 'Ingresa tu RUN de Apoderado, el RUN de tu estudiante y tu correo.'
            : 'Bienvenido(a) al Portal Electoral Institucional. Por favor, selecciona tu estamento e ingresa tus credenciales acreditadas para continuar.'}
        </p>
      </div>

      {/* Guía Clara del Proceso de Votación */}
      <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-blue-50/90 border border-blue-200/80 shadow-xs">
        <h2 className="text-xs font-bold font-sans uppercase tracking-wider text-[#0b5294] flex items-center gap-2 mb-2.5">
          <span>ℹ️ Instrucciones del Proceso de Votación</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/90 border border-blue-100 shadow-2xs">
            <span className="flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-[#0b5294] text-white font-sans text-xs font-bold">1</span>
            <div>
              <p className="text-xs font-bold font-sans text-slate-800 m-0">1. Identificación</p>
              <p className="text-[11px] text-slate-600 font-sans m-0 mt-0.5 leading-snug">
                Selecciona tu estamento e ingresa tu RUN y correo. Si eres apoderado, suma el RUN del estudiante.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/90 border border-blue-100 shadow-2xs">
            <span className="flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-[#0b5294] text-white font-sans text-xs font-bold">2</span>
            <div>
              <p className="text-xs font-bold font-sans text-slate-800 m-0">2. Enlace Mágico</p>
              <p className="text-[11px] text-slate-600 font-sans m-0 mt-0.5 leading-snug">
                Recibirás en tu correo un enlace directo seguro para autenticarte sin contraseña.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/90 border border-blue-100 shadow-2xs">
            <span className="flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-[#0b5294] text-white font-sans text-xs font-bold">3</span>
            <div>
              <p className="text-xs font-bold font-sans text-slate-800 m-0">3. Emisión del Voto</p>
              <p className="text-[11px] text-slate-600 font-sans m-0 mt-0.5 leading-snug">
                Accede a tu papeleta, selecciona la candidatura de tu preferencia y confirma tu sufragio secreto.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Tipo de Votante */}
      <div className="mb-4 flex p-1 bg-slate-100/90 rounded-xl border border-slate-900/[0.06]">
        <button
          type="button"
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold font-sans transition-all duration-150 ${
            voterType === 'apoderado'
              ? 'bg-[#0b5294] text-white shadow-md ring-1 ring-[#0b5294]/30'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
          onClick={() => onVoterTypeChange('apoderado')}
        >
          👨‍👩‍👧 Estamento Apoderados (Predeterminado)
        </button>
        <button
          type="button"
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold font-sans transition-all duration-150 ${
            voterType === 'funcionario'
              ? 'bg-[#0b5294] text-white shadow-md ring-1 ring-[#0b5294]/30'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
          onClick={() => onVoterTypeChange('funcionario')}
        >
          🏫 Funcionario SLEP (@eduvallediguillin.gob.cl)
        </button>
      </div>

      <form className="grid gap-3.5" onSubmit={onSubmit} autoComplete="off">
        {/* RUT Principal (Votante o Apoderado) */}
        <fieldset className="grid gap-2 min-w-0">
          <legend className={labelClass}>
            {voterType === 'apoderado' ? 'RUN del Apoderado' : 'RUT / RUN Funcionario'}
          </legend>
          <div className="grid grid-cols-[1fr_auto_88px] gap-2 items-center">
            <label className="sr-only" htmlFor="rut-number">
              Número de RUT
            </label>
            <input
              id="rut-number"
              className={inputClass}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="12345678"
              value={rutNumber}
              aria-describedby={[rutStatusId, errorId].filter(Boolean).join(' ') || undefined}
              onChange={(event) => {
                const sanitized = event.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                onRutNumberChange(sanitized);
              }}
              required
            />
            <span className="text-[#36506c] text-xl font-bold select-none">–</span>
            <label className="sr-only" htmlFor="rut-verifier">
              Dígito verificador
            </label>
            <input
              id="rut-verifier"
              className={`${inputClass} text-center uppercase`}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="9"
              value={rutVerifier}
              aria-describedby={[rutStatusId, errorId].filter(Boolean).join(' ') || undefined}
              onChange={(event) => {
                const sanitized = event.target.value.replace(/[^0-9kK]/g, '').slice(0, 1).toUpperCase();
                onRutVerifierChange(sanitized);
              }}
              required
            />
          </div>
          {rutStatus !== 'empty' ? (
            <p id="rut-status" className={`m-0 flex items-center gap-1.5 text-[12px] font-sans font-medium ${rutStatus === 'valid' ? 'text-emerald-600' : 'text-red-500'}`}>
              {rutStatus === 'valid' ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M3.5 6.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {formatRutNumber(rutNumber)}-{rutVerifier.toUpperCase()} — RUN válido
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Dígito verificador incorrecto
                </>
              )}
            </p>
          ) : null}
        </fieldset>

        {/* RUN del Estudiante / Alumno (Solo para Apoderados) */}
        {voterType === 'apoderado' ? (
          <fieldset className="grid gap-2 min-w-0 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
            <legend className={`${labelClass} text-amber-900`}>RUN del Estudiante (Carga / Alumno)</legend>
            <div className="grid grid-cols-[1fr_auto_88px] gap-2 items-center">
              <label className="sr-only" htmlFor="student-rut-number">
                Número de RUT del estudiante
              </label>
              <input
                id="student-rut-number"
                className={inputClass}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="23456789"
                value={studentRutNumber}
                aria-describedby={[studentRutStatusId, errorId].filter(Boolean).join(' ') || undefined}
                onChange={(event) => {
                  const sanitized = event.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                  onStudentRutNumberChange(sanitized);
                }}
                required
              />
              <span className="text-[#36506c] text-xl font-bold select-none">–</span>
              <label className="sr-only" htmlFor="student-rut-verifier">
                Dígito verificador estudiante
              </label>
              <input
                id="student-rut-verifier"
                className={`${inputClass} text-center uppercase`}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="2"
                value={studentRutVerifier}
                aria-describedby={[studentRutStatusId, errorId].filter(Boolean).join(' ') || undefined}
                onChange={(event) => {
                  const sanitized = event.target.value.replace(/[^0-9kK]/g, '').slice(0, 1).toUpperCase();
                  onStudentRutVerifierChange(sanitized);
                }}
                required
              />
            </div>
            {studentRutStatus !== 'empty' ? (
              <p id="student-rut-status" className={`m-0 flex items-center gap-1.5 text-[12px] font-sans font-medium ${studentRutStatus === 'valid' ? 'text-emerald-600' : 'text-red-500'}`}>
                {studentRutStatus === 'valid' ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M3.5 6.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {formatRutNumber(studentRutNumber)}-{studentRutVerifier.toUpperCase()} — RUN Estudiante válido
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <circle cx="6.5" cy="6.5" r="6" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Dígito verificador incorrecto
                  </>
                )}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        <label className="grid gap-2">
          <div className="flex justify-between items-center">
            <span className={labelClass} id="email-label">
              {voterType === 'funcionario' ? 'Correo Institucional SLEP' : 'Correo electrónico de contacto'}
            </span>
            {voterType === 'funcionario' ? (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                @eduvallediguillin.gob.cl
              </span>
            ) : null}
          </div>
          <input
            className={inputClass}
            type="email"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={254}
            placeholder={voterType === 'apoderado' ? 'apoderado@gmail.com' : 'docente@eduvallediguillin.gob.cl'}
            value={email}
            aria-describedby={errorId}
            onChange={(event) => onEmailChange(event.target.value)}
            required
          />
        </label>

        {hasValidEmail ? (
          <p className="m-0 px-3.5 py-2.5 rounded-xl text-[12px] font-sans font-medium text-emerald-700 bg-emerald-50 border border-emerald-200">
            Te enviaremos el código a {maskEmail(trimmedEmail)}.
          </p>
        ) : null}

        {errorMessage === 'SUCCESS_MAGIC_LINK_SENT' ? (
          <div role="status" aria-live="polite" className="m-0 p-5 rounded-2xl text-[14px] font-sans text-emerald-950 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-emerald-50 border border-emerald-300 shadow-md grid gap-3.5 animate-fade-in">
            <div className="flex items-center gap-2.5 font-bold text-base text-emerald-900">
              <span className="text-xl">✨</span>
              <span>¡Acreditación enviada con éxito!</span>
            </div>
            <p className="m-0 leading-relaxed text-slate-700">
              Hemos despachado tu acreditación oficial a la casilla <strong className="underline decoration-emerald-400 font-semibold">{email}</strong>.
            </p>
            <div className="p-3.5 rounded-xl bg-white/90 border border-emerald-200/80 shadow-xs space-y-2">
              <p className="m-0 text-[13px] font-semibold text-emerald-900 leading-snug flex items-start gap-2">
                <span className="text-base leading-none">📧</span>
                <span>
                  Por favor, <strong>revisa tu correo electrónico</strong> (incluyendo la carpeta de SPAM o correo no deseado) y haz clic en el enlace <strong>"Ingresar a mi Papeleta de Votación"</strong> para completar tu sufragio de forma segura y directa.
                </span>
              </p>
              <p className="m-0 text-[12px] font-medium text-slate-500 italic pl-6">
                No necesitas realizar ninguna otra acción en esta pantalla. ¡Agradecemos enormemente tu participación en este proceso democrático!
              </p>
            </div>
          </div>
        ) : (
          <>
            {errorMessage ? (
              <p id="login-form-error" role="alert" aria-live="assertive" className="m-0 px-3.5 py-2.5 rounded-xl text-[13px] font-sans font-medium text-red-600 bg-red-50 border border-red-200">
                {errorMessage}
              </p>
            ) : null}

            <button
              className="inline-flex items-center justify-center w-full h-11 px-5 rounded-xl bg-[#0b5294] text-white font-sans text-sm font-bold tracking-wide shadow-[0_4px_14px_rgba(11,82,148,0.40),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[#0a4278] hover:shadow-[0_6px_20px_rgba(11,82,148,0.48)] hover:-translate-y-px active:translate-y-0 disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5294]/20"
              type="submit"
              disabled={isSubmitting || isLocked}
            >
              {isSubmitting ? <><span className="btn-spinner mr-2" />Validando…</> : 'Continuar →'}
            </button>
          </>
        )}

      </form>
    </section>
  );
}