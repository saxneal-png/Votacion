'use client';

import React, { memo, useEffect, useRef, useState } from 'react';

import { AccessibilityPanel } from '@/components/AccessibilityPanel';
import { HelpTooltip } from '@/components/HelpTooltip';
import { BallotSelectionView } from '@/components/views/BallotSelectionView';
import { IntroView } from '@/components/views/IntroView';
import { LoginView, VoterType } from '@/components/views/LoginView';
import { OtpView } from '@/components/views/OtpView';
import { SuccessView } from '@/components/views/SuccessView';
import { VotingView } from '@/components/views/VotingView';
import {
  getCandidates,
  resetSession,
  submitVote,
  verifyOtpCode,
  verifyUserCredentials,
} from '@/lib/api-client';
import type { AppState, Candidate, User, VoterEstamentoOption } from '@/types';

const VOTING_WINDOW_SECONDS = 120;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_OTP_ATTEMPTS = 3;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const IDLE_WARNING_SECONDS = 60;
const STEPS = ['Identificacion', 'Verificacion', 'Papeleta'] as const;
const SLOW_REQUEST_MS = 900;
const VERY_SLOW_REQUEST_MS = 2200;

type PendingOperation = 'login' | 'otp' | 'ballot' | 'vote' | null;
type LatencyState = 'idle' | 'slow' | 'very-slow';
type FontScale = 'small' | 'normal' | 'large';

const STEP_INDEX: Record<AppState, number> = {
  intro: 0,
  login: 0,
  otp: 1,
  'ballot-select': 1,
  vote: 2,
  success: 3,
};

const STEP_GUIDANCE: Partial<Record<AppState, { current: string; next: string }>> = {
  login: { current: 'Identificacion', next: 'Completa RUT y correo institucional.' },
  otp: { current: 'Verificacion', next: 'Ingresa el codigo OTP de 6 digitos.' },
  'ballot-select': { current: 'Seleccion de Papeleta', next: 'Selecciona la papeleta en la que deseas votar.' },
  vote: { current: 'Papeleta', next: 'Selecciona una candidatura y confirma una sola vez.' },
};

const DATA_EXPLANATION: Partial<Record<AppState, { title: string; detail: string }>> = {
  login: {
    title: 'Por que pedimos estos datos',
    detail: 'El RUT permite ubicar tu registro en el padron y el correo institucional se usa para enviarte el codigo de verificacion.',
  },
  otp: {
    title: 'Por que pedimos el codigo OTP',
    detail: 'El codigo confirma que quien continua el flujo tiene acceso al canal institucional asociado al registro.',
  },
  'ballot-select': {
    title: 'Papeletas acreditadas para tu RUN',
    detail: 'Como votante registrado en múltiples estamentos, puedes ingresar a cada papeleta correspondiente desde este panel.',
  },
  vote: {
    title: 'Por que mostramos el padron',
    detail: 'El padron visible te ayuda a comprobar que la papeleta corresponde a tu estamento antes de confirmar el voto.',
  },
};

const ALLOWED_TRANSITIONS: Record<AppState, AppState[]> = {
  intro: ['login'],
  login: ['otp'],
  otp: ['login', 'ballot-select', 'vote'],
  'ballot-select': ['login', 'vote'],
  vote: ['login', 'ballot-select', 'success'],
  success: ['intro', 'ballot-select'],
};

function formatShortTimer(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getLatencyMessage(operation: PendingOperation, latencyState: LatencyState) {
  if (!operation || latencyState === 'idle') {
    return null;
  }

  const variant = latencyState === 'very-slow' ? 'very-slow' : 'slow';

  const messages = {
    login: {
      slow: 'La validacion de RUT y correo esta tardando mas de lo habitual. Manten esta pantalla abierta.',
      'very-slow': 'La conexion esta lenta. Seguimos verificando tus datos sin perder el avance actual.',
    },
    otp: {
      slow: 'La verificacion del codigo OTP sigue en curso. No cierres ni recargues la pestaña.',
      'very-slow': 'La respuesta del codigo esta demorada. Conserva esta pantalla abierta mientras completamos la validacion.',
    },
    ballot: {
      slow: 'La carga de la papeleta esta tomando mas tiempo de lo normal. Seguimos consultando tu padron.',
      'very-slow': 'La red esta lenta. Mantendremos tu sesion mientras terminamos de cargar la papeleta.',
    },
    vote: {
      slow: 'Estamos registrando la emision del voto. Evita salir de esta pantalla.',
      'very-slow': 'La confirmacion del voto esta tardando mas de lo habitual. No pulses nuevamente mientras finalizamos.',
    },
  } as const;

  return messages[operation][variant];
}

const StepProgress = memo(function StepProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-start mx-1 mb-2.5 mt-1">
      {STEPS.map((label, index) => {
        const done = currentStep > index;
        const active = currentStep === index;

        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 font-sans font-bold text-[11px] ${
                  done
                    ? 'bg-[#0b5294] text-white'
                    : active
                      ? 'bg-[#0b5294] text-white ring-[3px] ring-[#0b5294]/20'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {done ? (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`text-[9.5px] font-sans font-semibold whitespace-nowrap transition-colors ${
                  done || active ? 'text-[#0b5294] font-bold' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <div className={`flex-1 h-px mt-3 mx-1.5 transition-all duration-500 ${done ? 'bg-[#0b5294]' : 'bg-slate-200'}`} />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
});

const SupportStrip = memo(function SupportStrip() {
  return (
    <div className="mx-1 mt-2 rounded-2xl border border-slate-900/[0.08] bg-slate-50 px-4 py-3" data-decorative="true">
      <p className="m-0 text-[11px] font-bold font-sans uppercase tracking-[0.14em] text-[#1c3d5c]">
        Soporte visible durante la jornada
      </p>
      <p className="mt-1.5 mb-0 text-[13px] font-sans leading-relaxed text-[#4e6a85]">
        Si hay incidencias de acceso, deriva al votante a la mesa de apoyo del establecimiento o al canal local definido para la jornada.
      </p>
    </div>
  );
});

export default function HomePage() {
  const [appState, setAppState] = useState<AppState>('intro');
  const [voterType, setVoterType] = useState<VoterType>('apoderado');
  const [rutNumber, setRutNumber] = useState('');
  const [rutVerifier, setRutVerifier] = useState('');
  const [studentRutNumber, setStudentRutNumber] = useState('');
  const [studentRutVerifier, setStudentRutVerifier] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [receiptCode, setReceiptCode] = useState('');
  const [confirmedCandidateName, setConfirmedCandidateName] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(VOTING_WINDOW_SECONDS);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'back'>('forward');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [isSimplifiedMode, setIsSimplifiedMode] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>('normal');
  const [isAccessibilityPanelOpen, setIsAccessibilityPanelOpen] = useState(false);
  const [idleWarningSeconds, setIdleWarningSeconds] = useState<number | null>(null);
  const [showMultiTabWarning, setShowMultiTabWarning] = useState(false);
  const [receiptIssuedAt, setReceiptIssuedAt] = useState<string>('');
  const [isWindowHidden, setIsWindowHidden] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation>(null);
  const [latencyState, setLatencyState] = useState<LatencyState>('idle');
  const [hasPendingBallots, setHasPendingBallots] = useState(false);

  const appStateRef = useRef(appState);
  const idleResetRef = useRef<() => void>(() => undefined);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isVisibilitySensitiveState = appState === 'otp' || appState === 'vote';
  const tabIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `tab-${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const res = await fetch('/api/session', { credentials: 'same-origin' });
        if (res.ok) {
          const data = (await res.json()) as { authenticated: boolean; user?: User };
          if (data.authenticated && data.user) {
            setUser(data.user);
            const estamentos = data.user.availableEstamentos || [];
            const unvoted = estamentos.filter((e) => e.habilitado && !e.haVotado);

            if (estamentos.length > 1 || unvoted.length > 1) {
              setTransitionDirection('forward');
              setAppState('ballot-select');
            } else {
              setIsLoadingCandidates(true);
              const availableCandidates = await getCandidates();
              setCandidates(availableCandidates);
              setRemainingSeconds(VOTING_WINDOW_SECONDS);
              setSelectedCandidateId(null);
              setTransitionDirection('forward');
              setAppState('vote');
              setIsLoadingCandidates(false);
            }
          }
        }
      } catch (err) {
        console.error('Error al comprobar sesión de Magic Link:', err);
      }
    }

    void checkExistingSession();
  }, []);

  function transitionTo(nextState: AppState) {
    setAppState((currentState) => {
      if (currentState === nextState || ALLOWED_TRANSITIONS[currentState].includes(nextState)) {
        return nextState;
      }

      return currentState;
    });
  }

  function clearAuthenticatedState(nextState: AppState = 'login') {
    transitionTo(nextState);
    setOtp('');
    setUser(null);
    setCandidates([]);
    setSelectedCandidateId(null);
    setReceiptCode('');
    setReceiptIssuedAt('');
    setConfirmedCandidateName('');
    setRemainingSeconds(VOTING_WINDOW_SECONDS);
    setOtpAttempts(0);
    setIsSubmitting(false);
    setIsLoadingCandidates(false);
    setIdleWarningSeconds(null);
  }

  function resetAllState(nextState: AppState = 'intro') {
    setRutNumber('');
    setRutVerifier('');
    setStudentRutNumber('');
    setStudentRutVerifier('');
    setVoterType('apoderado');
    setEmail('');
    setLoginAttempts(0);
    clearAuthenticatedState(nextState);
  }

  async function runMeasuredRequest<T>(operation: Exclude<PendingOperation, null>, action: () => Promise<T>) {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    setPendingOperation(operation);
    setLatencyState('idle');

    const slowTimer = window.setTimeout(() => {
      setLatencyState('slow');
    }, SLOW_REQUEST_MS);

    const verySlowTimer = window.setTimeout(() => {
      setLatencyState('very-slow');
    }, VERY_SLOW_REQUEST_MS);

    try {
      return await action();
    } finally {
      window.clearTimeout(slowTimer);
      window.clearTimeout(verySlowTimer);
      setPendingOperation(null);
      setLatencyState('idle');
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    function hideProtectedContent() {
      if (appStateRef.current === 'otp' || appStateRef.current === 'vote') {
        setIsWindowHidden(true);
      }
    }

    function syncVisibility() {
      if (document.hidden) {
        hideProtectedContent();
      }
    }

    function revealProtectedContent() {
      if (!document.hidden && appStateRef.current !== 'otp' && appStateRef.current !== 'vote') {
        setIsWindowHidden(false);
      }
    }

    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('blur', hideProtectedContent);
    window.addEventListener('focus', revealProtectedContent);

    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('blur', hideProtectedContent);
      window.removeEventListener('focus', revealProtectedContent);
    };
  }, []);

  useEffect(() => {
    if (!isVisibilitySensitiveState) {
      setIsWindowHidden(false);
    }
  }, [isVisibilitySensitiveState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setIsReducedMotion(true);
    }

    return undefined;
  }, []);

  useEffect(() => {
    if (appState !== 'otp' && appState !== 'vote') {
      setIdleWarningSeconds(null);
      return undefined;
    }

    let warningTimer: number | undefined;
    let expiryTimer: number | undefined;

    function clearIdleTimers() {
      if (warningTimer !== undefined) {
        window.clearTimeout(warningTimer);
      }
      if (expiryTimer !== undefined) {
        window.clearTimeout(expiryTimer);
      }
    }

    function resetTimer() {
      clearIdleTimers();
      setIdleWarningSeconds(null);

      warningTimer = window.setTimeout(() => {
        setIdleWarningSeconds(IDLE_WARNING_SECONDS);
      }, IDLE_TIMEOUT_MS - IDLE_WARNING_SECONDS * 1000);

      expiryTimer = window.setTimeout(() => {
        setTransitionDirection('back');
        clearAuthenticatedState('login');
        void resetSession({ keepalive: true });
        setErrorMessage('La sesion expiro por inactividad. Por favor, vuelve a identificarte.');
      }, IDLE_TIMEOUT_MS);
    }

    idleResetRef.current = resetTimer;

    const events = ['mousemove', 'keydown', 'pointerdown', 'touchstart'] as const;
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      idleResetRef.current = () => undefined;
      clearIdleTimers();
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [appState]);

  useEffect(() => {
    if (idleWarningSeconds === null || idleWarningSeconds <= 0) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setIdleWarningSeconds((currentSeconds) =>
        currentSeconds === null ? null : Math.max(0, currentSeconds - 1),
      );
    }, 1000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [idleWarningSeconds]);

  useEffect(() => {
    if (appState !== 'vote' || remainingSeconds <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRemainingSeconds((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [appState, remainingSeconds]);

  useEffect(() => {
    if (appState === 'vote' && !user) {
      setTransitionDirection('back');
      clearAuthenticatedState('login');
      setErrorMessage('La sesion local se reinicio. Vuelve a identificarte antes de continuar.');
    }

    if (appState === 'success' && (!receiptCode || !confirmedCandidateName)) {
      setTransitionDirection('back');
      resetAllState('intro');
      setErrorMessage('El flujo se reinicio para evitar un estado inconsistente en la UI.');
    }
  }, [appState, confirmedCandidateName, receiptCode, user]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return undefined;
    }

    const channel = new BroadcastChannel('votaciones-portal');
    broadcastChannelRef.current = channel;

    channel.onmessage = (event) => {
      const message = event.data as { kind?: 'presence' | 'ack' | 'state'; state?: AppState; tabId?: string };
      if (!message || message.tabId === tabIdRef.current) {
        return;
      }

      if (message.kind === 'presence' || message.kind === 'state') {
        if (appStateRef.current !== 'intro' || message.state !== 'intro') {
          setShowMultiTabWarning(true);
        }
        channel.postMessage({ kind: 'ack', state: appStateRef.current, tabId: tabIdRef.current });
      }

      if (message.kind === 'ack' && (appStateRef.current !== 'intro' || message.state !== 'intro')) {
        setShowMultiTabWarning(true);
      }
    };

    channel.postMessage({ kind: 'presence', state: appStateRef.current, tabId: tabIdRef.current });

    return () => {
      channel.close();
      broadcastChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    broadcastChannelRef.current?.postMessage({ kind: 'state', state: appState, tabId: tabIdRef.current });
  }, [appState]);

  useEffect(() => {
    function cleanupSession() {
      void resetSession({ keepalive: true });
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (!event.persisted) {
        return;
      }

      setTransitionDirection('back');
      resetAllState('intro');
      setErrorMessage('La sesion local se reinicio para evitar datos desactualizados al volver a la pagina.');
    }

    window.addEventListener('pagehide', cleanupSession);
    window.addEventListener('beforeunload', cleanupSession);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pagehide', cleanupSession);
      window.removeEventListener('beforeunload', cleanupSession);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const hasExpired = remainingSeconds <= 0;
  const isLoginLocked = loginAttempts >= MAX_LOGIN_ATTEMPTS;
  const isOtpLocked = otpAttempts >= MAX_OTP_ATTEMPTS;
  const rut = rutNumber && rutVerifier ? `${rutNumber}-${rutVerifier}` : rutNumber;
  const currentStep = STEP_INDEX[appState];
  const showProgress = appState !== 'intro' && appState !== 'success';
  const guidance = STEP_GUIDANCE[appState];
  const dataExplanation = DATA_EXPLANATION[appState];
  const latencyMessage = getLatencyMessage(pendingOperation, latencyState);

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || appState !== 'login') {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const studentRut =
        voterType === 'apoderado' && studentRutNumber && studentRutVerifier
          ? `${studentRutNumber}-${studentRutVerifier}`
          : undefined;

      const authenticatedUser = await runMeasuredRequest('login', () =>
        verifyUserCredentials(rut, email, studentRut, voterType),
      );
      setUser(authenticatedUser);
      setOtpAttempts(0);
      setErrorMessage('SUCCESS_MAGIC_LINK_SENT');
    } catch (error) {
      const nextAttempts = loginAttempts + 1;
      setLoginAttempts(nextAttempts);
      setErrorMessage(
        nextAttempts >= MAX_LOGIN_ATTEMPTS
          ? 'Demasiados intentos fallidos. Recarga la pagina para continuar.'
          : error instanceof Error ? error.message : 'No fue posible validar la identidad.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || appState !== 'otp') {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await runMeasuredRequest('otp', () => verifyOtpCode(otp));
    } catch (error) {
      const nextAttempts = otpAttempts + 1;
      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        setTransitionDirection('back');
        clearAuthenticatedState('login');
        void resetSession();
        setErrorMessage('Demasiados intentos fallidos de OTP. Reinicia el proceso de autenticacion.');
      } else {
        setOtpAttempts(nextAttempts);
        setErrorMessage(error instanceof Error ? error.message : 'No fue posible validar el OTP.');
      }
      setIsSubmitting(false);
      return;
    }

    setOtp('');
    setIsLoadingCandidates(true);

    try {
      let currentUser = user;
      const sessionRes = await fetch('/api/session', { credentials: 'same-origin' });
      if (sessionRes.ok) {
        const sessionData = (await sessionRes.json()) as { authenticated?: boolean; user?: User };
        if (sessionData.authenticated && sessionData.user) {
          currentUser = sessionData.user;
          setUser(sessionData.user);
        }
      }

      const estamentos = currentUser?.availableEstamentos || [];
      const unvoted = estamentos.filter((e) => e.habilitado && !e.haVotado);
      const hasMultiple = estamentos.length > 1 || unvoted.length > 1;

      if (hasMultiple) {
        setTransitionDirection('forward');
        transitionTo('ballot-select');
      } else {
        const availableCandidates = await runMeasuredRequest('ballot', () => getCandidates());
        setCandidates(availableCandidates);
        setRemainingSeconds(VOTING_WINDOW_SECONDS);
        setSelectedCandidateId(null);
        setTransitionDirection('forward');
        transitionTo('vote');
      }
    } catch {
      setErrorMessage('No fue posible cargar la papeleta en este momento.');
    } finally {
      setIsLoadingCandidates(false);
      setIsSubmitting(false);
    }
  }

  async function handleSelectEstamento(estamentoKey: string) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estamento: estamentoKey }),
      });
      if (res.ok) {
        const data = (await res.json()) as { user?: User };
        if (data.user) {
          setUser(data.user);
        }
      }

      setIsLoadingCandidates(true);
      const availableCandidates = await runMeasuredRequest('ballot', () => getCandidates());
      setCandidates(availableCandidates);
      setRemainingSeconds(VOTING_WINDOW_SECONDS);
      setSelectedCandidateId(null);
      setTransitionDirection('forward');
      transitionTo('vote');
    } catch {
      setErrorMessage('No fue posible ingresar a la papeleta seleccionada.');
    } finally {
      setIsLoadingCandidates(false);
      setIsSubmitting(false);
    }
  }

  async function handleVoteSubmit() {
    if (isSubmitting || appState !== 'vote') {
      return;
    }

    if (!selectedCandidateId) {
      setErrorMessage('Debes seleccionar una candidatura antes de votar.');
      return;
    }

    if (hasExpired) {
      setErrorMessage('La sesion ya expiro. Reinicia el flujo de autenticacion para continuar.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await runMeasuredRequest('vote', () => submitVote(selectedCandidateId));
      setReceiptCode(result.receiptCode);
      setReceiptIssuedAt(new Date().toISOString());
      const candName = result?.candidate?.nombreCompleto || result?.candidate?.name || 'la candidatura seleccionada';
      setConfirmedCandidateName(candName);

      const resAny = result as Record<string, unknown>;
      const pending = Boolean(resAny.hasPendingBallots);
      setHasPendingBallots(pending);

      if (resAny.availableEstamentos && Array.isArray(resAny.availableEstamentos)) {
        setUser((prev) =>
          prev ? { ...prev, availableEstamentos: resAny.availableEstamentos as VoterEstamentoOption[] } : null,
        );
      }

      setTransitionDirection('forward');
      transitionTo('success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible registrar el voto.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleStartFlow() {
    setTransitionDirection('forward');
    setErrorMessage(null);
    transitionTo('login');
  }

  function handleRestart() {
    setTransitionDirection('back');
    resetAllState('intro');
    void resetSession();
    setErrorMessage(null);
  }

  function handleBackToLogin() {
    setTransitionDirection('back');
    clearAuthenticatedState('login');
    void resetSession();
    setErrorMessage(null);
  }

  function handleKeepSessionActive() {
    idleResetRef.current();
  }

  function handleRevealProtectedView() {
    if (!document.hidden) {
      setIsWindowHidden(false);
    }
  }

  return (
    <main className={`portal-shell relative min-h-screen overflow-hidden isolate font-serif ${isHighContrast ? 'portal-contrast-high' : ''} ${isSimplifiedMode ? 'portal-simplified-mode' : ''} ${isReducedMotion ? 'portal-reduced-motion' : ''} ${fontScale === 'small' ? 'portal-font-small' : ''} ${fontScale === 'large' ? 'portal-font-large' : ''}`}>
      <div className="absolute inset-0 bg-portal" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#062048]/85 via-[#082a54]/70 to-[#061836]/82" />

      <AccessibilityPanel
        isOpen={isAccessibilityPanelOpen}
        isHighContrast={isHighContrast}
        isPrivacyMode={isPrivacyMode}
        isSimplifiedMode={isSimplifiedMode}
        isReducedMotion={isReducedMotion}
        isTtsEnabled={isTtsEnabled}
        fontScale={fontScale}
        onToggleOpen={() => setIsAccessibilityPanelOpen((currentValue) => !currentValue)}
        onHighContrastChange={setIsHighContrast}
        onPrivacyModeChange={setIsPrivacyMode}
        onSimplifiedModeChange={setIsSimplifiedMode}
        onReducedMotionChange={setIsReducedMotion}
        onTtsToggleChange={setIsTtsEnabled}
        onFontScaleChange={setFontScale}
      />

      <section className="relative z-10 grid place-items-center min-h-screen max-w-[1320px] mx-auto px-4 py-5">
        <div className="relative w-full max-w-[920px] p-2.5 rounded-[20px] border border-white/20 bg-white/90 shadow-[0_24px_64px_rgba(6,18,38,0.36),0_4px_12px_rgba(6,18,38,0.14)] backdrop-blur-[22px] backdrop-saturate-150">
          <div className={`transition-[filter] duration-200 ${isWindowHidden ? 'portal-obscured-surface' : ''}`}>
            <div className="relative z-20 mb-2 px-[18px] py-4 rounded-2xl overflow-visible border border-white/20 bg-[#082f5a]" style={{ background: 'linear-gradient(135deg, #061d3d 0%, #0a3566 50%, #0b5294 100%)' }}>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(255,255,255,0.08),transparent_55%)] pointer-events-none" />
              <div className="relative flex items-start gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <svg className="shrink-0" width="40" height="46" viewBox="0 0 44 50" fill="none" aria-hidden="true">
                    <path d="M22 2L4 10v14c0 12 8.5 22 18 26 9.5-4 18-14 18-26V10L22 2z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M22 9L11 14v9c0 7.5 5 13.5 11 16 6-2.5 11-8.5 11-16v-9L22 9z" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinejoin="round" />
                    <path d="M16 24l4 4 8-8" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="min-w-0">
                    <p className="m-0 mb-1 text-[10px] font-bold font-sans uppercase tracking-[0.16em] text-white/80">
                      Servicio Local de Educacion Publica Valle Diguillin
                    </p>
                    <h2 className="m-0 font-serif text-[clamp(17px,2.4vw,24px)] text-white leading-tight tracking-tight">
                      Portal de votacion del Consejo Local
                    </h2>
                  </div>
                </div>
              </div>

              <div className="relative mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold font-sans uppercase tracking-wide border border-white/18 bg-white/10 text-white/92">
                  {isDemoMode ? 'Simulacion guiada' : 'Flujo institucional guiado'}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-sans uppercase tracking-wide border border-emerald-300/35 bg-emerald-400/10 text-white">
                  Sesion segura verificada
                  <HelpTooltip
                    title="Sesion segura verificada"
                    description="La interfaz protege el flujo con una sola pestaña activa, ocultamiento opcional de datos, expiracion por inactividad y guardas visuales de estado. No reemplaza los controles del backend real que definira cada SLEP."
                    align="left"
                  />
                </span>
                <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold font-sans uppercase tracking-wide border border-white/16 bg-white/8 text-white/78">
                  Una sola pestaña por votante
                </span>
                {isPrivacyMode ? (
                  <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold font-sans uppercase tracking-wide border border-white/16 bg-white/8 text-white/78">
                    Datos visibles reducidos
                  </span>
                ) : null}
              </div>
            </div>

            {showProgress ? <StepProgress currentStep={currentStep} /> : null}

            {guidance ? (
              <div className="mx-1 mb-2 rounded-2xl border border-slate-900/[0.08] bg-slate-50 px-4 py-3">
                <p className="m-0 text-[11px] font-bold font-sans uppercase tracking-[0.14em] text-[#1c3d5c]">
                  Paso actual: {guidance.current}
                </p>
                <p className="mt-1.5 mb-0 text-[13px] font-sans leading-relaxed text-[#4e6a85]">
                  Siguiente accion: {guidance.next}
                </p>
              </div>
            ) : null}

            {dataExplanation ? (
              <div className="mx-1 mb-2 rounded-2xl border border-[#0b5294]/10 bg-[#0b5294]/[0.04] px-4 py-3">
                <p className="m-0 text-[11px] font-bold font-sans uppercase tracking-[0.14em] text-[#1c3d5c]">
                  {dataExplanation.title}
                </p>
                <p className="mt-1.5 mb-0 text-[13px] font-sans leading-relaxed text-[#4e6a85]">
                  {dataExplanation.detail}
                </p>
              </div>
            ) : null}

            {latencyMessage ? (
              <div className={`mx-1 mb-2 rounded-2xl px-4 py-3 ${latencyState === 'very-slow' ? 'border border-amber-200 bg-amber-50' : 'border border-sky-200 bg-sky-50'}`}>
                <p className={`m-0 text-[11px] font-bold font-sans uppercase tracking-[0.14em] ${latencyState === 'very-slow' ? 'text-amber-800' : 'text-sky-800'}`}>
                  {latencyState === 'very-slow' ? 'Conexion lenta detectada' : 'Esperando respuesta'}
                </p>
                <p className={`mt-1.5 mb-0 text-[13px] font-sans leading-relaxed ${latencyState === 'very-slow' ? 'text-amber-900/85' : 'text-sky-900/85'}`}>
                  {latencyMessage}
                </p>
              </div>
            ) : null}

            {showMultiTabWarning ? (
              <div className="mx-1 mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-[11px] font-bold font-sans uppercase tracking-[0.14em] text-amber-800">
                      Otra pestaña detectada
                    </p>
                    <p className="mt-1.5 mb-0 text-[13px] font-sans leading-relaxed text-amber-900/85">
                      Para evitar confusiones en la jornada, completa este flujo en una sola pestaña y cierra las demas ventanas del portal.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[10px] font-bold font-sans uppercase tracking-wide text-amber-800 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
                    onClick={() => setShowMultiTabWarning(false)}
                  >
                    Entendido
                  </button>
                </div>
              </div>
            ) : null}

            {idleWarningSeconds !== null ? (
              <div className="mx-1 mb-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-[11px] font-bold font-sans uppercase tracking-[0.14em] text-red-700">
                      Sesion por inactividad a punto de expirar
                    </p>
                    <p className="mt-1.5 mb-0 text-[13px] font-sans leading-relaxed text-red-900/85">
                      Quedan {formatShortTimer(idleWarningSeconds)} para mantener la sesion activa en esta pantalla.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-red-200 bg-white px-4 py-2 text-[12px] font-bold font-sans text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
                      onClick={handleKeepSessionActive}
                    >
                      Seguir aqui
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-red-200 bg-red-600 px-4 py-2 text-[12px] font-bold font-sans text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
                      onClick={handleRestart}
                    >
                      Reiniciar flujo
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div key={appState} className={transitionDirection === 'forward' ? 'view-enter-forward' : 'view-enter-back'}>
            {appState === 'intro' ? (
              <IntroView
                isDemoMode={isDemoMode}
                onDemoModeChange={setIsDemoMode}
                onStart={handleStartFlow}
              />
            ) : null}

            {appState === 'login' ? (
              <LoginView
                voterType={voterType}
                rutNumber={rutNumber}
                rutVerifier={rutVerifier}
                studentRutNumber={studentRutNumber}
                studentRutVerifier={studentRutVerifier}
                email={email}
                isSimplifiedMode={isSimplifiedMode}
                isSubmitting={isSubmitting}
                isLocked={isLoginLocked}
                errorMessage={errorMessage}
                onVoterTypeChange={setVoterType}
                onRutNumberChange={setRutNumber}
                onRutVerifierChange={setRutVerifier}
                onStudentRutNumberChange={setStudentRutNumber}
                onStudentRutVerifierChange={setStudentRutVerifier}
                onEmailChange={setEmail}
                onSubmit={handleLoginSubmit}
              />
            ) : null}

            {appState === 'otp' ? (
              <OtpView
                email={email}
                user={user}
                otp={otp}
                isPrivacyMode={isPrivacyMode}
                isSimplifiedMode={isSimplifiedMode}
                isScreenObscured={isWindowHidden}
                isSubmitting={isSubmitting}
                isLocked={isOtpLocked}
                errorMessage={errorMessage}
                onOtpChange={setOtp}
                onBack={handleBackToLogin}
                onSubmit={handleOtpSubmit}
              />
            ) : null}

            {appState === 'ballot-select' && user ? (
              <BallotSelectionView
                user={user}
                availableEstamentos={user.availableEstamentos || []}
                isSubmitting={isSubmitting}
                onSelectEstamento={handleSelectEstamento}
                onExitSession={handleRestart}
              />
            ) : null}

            {appState === 'vote' ? (
              isLoadingCandidates ? (
                <section className="rounded-2xl bg-white/95 border border-slate-900/10 p-5">
                  <div className="grid gap-4">
                    <div className="flex gap-3 justify-between items-start pb-4 border-b border-slate-900/[0.08]">
                      <div className="grid gap-2.5 min-w-0 flex-1">
                        <div className="skeleton h-2.5 w-24 rounded-full" />
                        <div className="skeleton h-6 w-36 rounded-lg" />
                        <div className="skeleton h-4 w-52 rounded" />
                        <div className="flex gap-2">
                          <div className="skeleton h-5 w-28 rounded-full" />
                          <div className="skeleton h-5 w-32 rounded-full" />
                        </div>
                      </div>
                      <div className="skeleton shrink-0 w-[120px] h-[66px] rounded-2xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="p-3.5 rounded-2xl border border-slate-100 grid gap-2.5">
                          <div className="skeleton w-11 h-11 rounded-full" />
                          <div className="skeleton h-[22px] w-4/5 rounded-md" />
                          <div className="skeleton h-3.5 w-3/5 rounded" />
                          <div className="skeleton h-3 w-full rounded" />
                          <div className="skeleton h-3 w-2/3 rounded" />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <div className="skeleton h-11 w-36 rounded-xl" />
                    </div>
                  </div>
                </section>
              ) : (
                <VotingView
                  candidates={candidates}
                  voterName={user?.fullName ?? 'Participante'}
                  estamento={user?.estamento ?? 'apoderados'}
                  isDemoMode={isDemoMode}
                  isPrivacyMode={isPrivacyMode}
                  isSimplifiedMode={isSimplifiedMode}
                  isScreenObscured={isWindowHidden}
                  selectedCandidateId={selectedCandidateId}
                  remainingSeconds={remainingSeconds}
                  hasExpired={hasExpired}
                  isSubmitting={isSubmitting}
                  errorMessage={errorMessage}
                  onSelectCandidate={(candidateId) => {
                    setSelectedCandidateId(candidateId);
                    setErrorMessage(null);
                  }}
                  onSubmitVote={handleVoteSubmit}
                />
              )
            ) : null}

            {appState === 'success' ? (
              <SuccessView
                voterName={user?.fullName ?? 'Participante'}
                candidateName={confirmedCandidateName}
                receiptCode={receiptCode}
                receiptIssuedAt={receiptIssuedAt}
                isDemoMode={isDemoMode}
                isPrivacyMode={isPrivacyMode}
                hasPendingBallots={hasPendingBallots}
                pendingCount={(user?.availableEstamentos || []).filter((e) => e.habilitado && !e.haVotado).length}
                onContinueToBallotSelector={() => {
                  setTransitionDirection('forward');
                  transitionTo('ballot-select');
                }}
                onRestart={handleRestart}
              />
            ) : null}
          </div>

            <SupportStrip />
          </div>

          {isWindowHidden && isVisibilitySensitiveState ? (
            <div className="screen-shield" role="dialog" aria-modal="true" aria-labelledby="screen-shield-title" aria-describedby="screen-shield-description">
              <div className="screen-shield-panel">
                <span className="screen-shield-badge">Privacidad activa</span>
                <h2 id="screen-shield-title" className="m-0 font-serif text-[22px] text-[#0c2138] leading-tight">
                  Pantalla protegida mientras esta pestaña no estuvo activa
                </h2>
                <p id="screen-shield-description" className="m-0 text-[14px] font-sans leading-relaxed text-[#4e6a85]">
                  Para reducir exposicion visual, ocultamos temporalmente nombre, correo enmascarado y padron durante OTP o votacion.
                </p>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-11 px-5 rounded-xl bg-[#0b5294] text-white font-sans text-sm font-bold tracking-wide shadow-[0_4px_14px_rgba(11,82,148,0.40)] hover:bg-[#0a4278] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5294]/20"
                  onClick={handleRevealProtectedView}
                  disabled={typeof document !== 'undefined' ? document.hidden : false}
                >
                  Mostrar contenido otra vez
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="mt-4 px-4 text-center">
          <p className="m-0 text-[11px] font-sans font-medium uppercase tracking-[0.12em] text-white/78">
            Desarrollado por 
          </p>
        </footer>
      </section>
    </main>
  );
}
