'use client';

import React from 'react';
import type { User, VoterEstamentoOption } from '@/types';

interface BallotSelectionViewProps {
  user: User;
  availableEstamentos: VoterEstamentoOption[];
  isSubmitting?: boolean;
  onSelectEstamento: (estamento: string) => void;
  onExitSession: () => void;
}

const ESTAMENTO_ICONS: Record<string, string> = {
  DOCENTES: '👨‍🏫',
  DIRECTIVOS: '👔',
  ASISTENTES: '💼',
  PADRES_APODERADOS: '👪',
  ESTUDIANTES: '🎓',
};

const ESTAMENTO_TITLES: Record<string, string> = {
  DOCENTES: 'Estamento Docentes',
  DIRECTIVOS: 'Estamento Equipo Directivo',
  ASISTENTES: 'Estamento Asistentes de la Educación',
  PADRES_APODERADOS: 'Estamento Padres y Apoderados',
  ESTUDIANTES: 'Estamento Estudiantes',
};

const ESTAMENTO_DESCRIPTIONS: Record<string, string> = {
  DOCENTES: 'Papeleta de votación para representantes del cuerpo docente del establecimiento.',
  DIRECTIVOS: 'Papeleta de votación para representantes del equipo directivo del establecimiento.',
  ASISTENTES: 'Papeleta de votación para representantes de los asistentes de la educación.',
  PADRES_APODERADOS: 'Papeleta de votación para representantes de los padres, madres y apoderados.',
  ESTUDIANTES: 'Papeleta de votación para representantes del estamento de estudiantes.',
};

export const BallotSelectionView: React.FC<BallotSelectionViewProps> = ({
  user,
  availableEstamentos,
  isSubmitting = false,
  onSelectEstamento,
  onExitSession,
}) => {
  const totalBallots = availableEstamentos.length;
  const votedCount = availableEstamentos.filter((e) => e.haVotado).length;
  const pendingCount = totalBallots - votedCount;
  const allCompleted = pendingCount === 0;

  return (
    <section className="relative z-10 grid gap-5 p-5 md:p-7 rounded-3xl bg-white/95 border border-slate-200 shadow-2xl backdrop-blur-xl animate-fade-in">
      {/* Encabezado del Votante */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold font-sans uppercase tracking-wider bg-blue-50 text-[#0b5294] border border-blue-200/60 mb-2">
            🗳️ Votante Acreditado Multirrol
          </div>
          <h1 className="font-serif text-2xl md:text-3xl text-slate-900 font-bold tracking-tight">
            Hola, {user.fullName}
          </h1>
          <p className="mt-1 text-sm text-slate-600 font-sans">
            RUT: <span className="font-mono font-semibold text-slate-800">{user.rut || 'Acreditado'}</span> • {user.organization}
          </p>
        </div>

        <button
          type="button"
          onClick={onExitSession}
          className="self-end sm:self-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold font-sans uppercase tracking-wider text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar Sesión
        </button>
      </div>

      {/* Banner de Estado Multirrol */}
      <div className={`p-4 rounded-2xl border ${allCompleted ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-900' : 'bg-sky-50/80 border-sky-200/80 text-sky-900'}`}>
        <div className="flex items-start gap-3">
          <div className="text-2xl shrink-0 mt-0.5">
            {allCompleted ? '🎉' : '📋'}
          </div>
          <div className="text-xs md:text-sm font-sans leading-relaxed">
            {allCompleted ? (
              <p className="m-0 font-medium">
                <strong>¡Proceso electoral completado!</strong> Has emitido tu voto en la totalidad de las papeletas acreditadas para tu RUN ({votedCount} de {totalBallots}). Tus comprobantes han sido registrados de forma atómica.
              </p>
            ) : (
              <p className="m-0">
                Tu RUN se encuentra acreditado para participar en <strong>{totalBallots} papeletas electorales</strong> distintas (Decreto N° 102). Puedes votar en cada una mediante esta misma sesión:
                <span className="block mt-1 font-semibold text-sky-950">
                  Progreso: {votedCount} de {totalBallots} papeletas completadas ({pendingCount} pendiente{pendingCount > 1 ? 's' : ''})
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Tarjetas de Papeletas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
        {availableEstamentos.map((option) => {
          const rawEst = option.estamento.toUpperCase();
          const icon = ESTAMENTO_ICONS[rawEst] || '🗳️';
          const title = ESTAMENTO_TITLES[rawEst] || option.label || `Estamento ${option.estamento}`;
          const description = ESTAMENTO_DESCRIPTIONS[rawEst] || 'Papeleta oficial del proceso electoral.';
          const isVoted = option.haVotado;

          return (
            <div
              key={option.estamento}
              className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 ${
                isVoted
                  ? 'bg-slate-50/90 border-slate-200/80 opacity-90'
                  : 'bg-white border-blue-200/90 shadow-md hover:shadow-lg hover:border-[#0b5294]/50 ring-1 ring-blue-500/10'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-2 rounded-xl bg-slate-100/80 border border-slate-200/50">
                      {icon}
                    </span>
                    <div>
                      <h2 className="font-serif font-bold text-lg text-slate-900 leading-tight">
                        {title}
                      </h2>
                      <p className="text-xs text-slate-500 font-sans mt-0.5">
                        {option.nombreEstablecimiento || user.organization}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold font-sans uppercase tracking-wider ${
                      isVoted
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    {isVoted ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Voto Emitido
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Pendiente
                      </>
                    )}
                  </span>
                </div>

                <p className="text-xs text-slate-600 font-sans leading-relaxed mb-4">
                  {description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100">
                {isVoted ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-sans text-xs font-bold uppercase tracking-wider cursor-not-allowed border border-slate-200/60"
                  >
                    Sufragio Registrado en Acta
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => onSelectEstamento(option.estamento)}
                    className="w-full py-3 px-4 rounded-xl bg-[#0b5294] hover:bg-[#083d70] active:scale-[0.99] text-white font-sans text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
                  >
                    {isSubmitting ? 'Cargando papeleta...' : '🗳️ Ingresar a esta Papeleta'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
