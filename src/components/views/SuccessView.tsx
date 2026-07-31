interface SuccessViewProps {
  voterName: string;
  candidateName: string;
  receiptCode: string;
  receiptIssuedAt: string;
  isDemoMode: boolean;
  isPrivacyMode: boolean;
  onRestart: () => void;
}

function formatReceiptDate(value: string) {
  if (!value) return '';

  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function SuccessView({ voterName, candidateName, receiptCode, receiptIssuedAt, isDemoMode, isPrivacyMode, onRestart }: SuccessViewProps) {
  const displayName = isPrivacyMode ? 'Participante' : voterName.split(/\s+/).filter(Boolean)[0] ?? voterName;
  const formattedIssuedAt = formatReceiptDate(receiptIssuedAt);

  return (
    <section className="rounded-2xl bg-white/95 backdrop-blur-sm border border-slate-900/10 text-ink p-6">
      <div className="grid gap-4 justify-items-center text-center">

        {/* Animated check icon */}
        <div className="check-circle w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path
              className="check-path"
              d="M7 16l6 6 12-12"
              stroke="#059669"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="grid gap-1.5">
          <h1 className="m-0 font-serif text-[clamp(22px,3vw,30px)] text-ink leading-none tracking-tight">
            ¡Voto registrado!
          </h1>
          <p className="m-0 text-sm text-ink-muted font-sans leading-relaxed">
            {displayName}, tu preferencia fue registrada correctamente.
          </p>
        </div>

        <div className="w-full flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold font-sans uppercase tracking-[0.14em] border border-emerald-200 bg-emerald-50 text-emerald-700">
            Flujo verificado
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold font-sans uppercase tracking-[0.14em] border border-slate-200 bg-slate-50 text-[#1c3d5c]">
            Comprobante imprimible
          </span>
        </div>

        <div className="receipt-card w-full px-4 py-4 rounded-2xl border border-slate-900/10 bg-white shadow-sm text-left">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-dashed border-slate-200">
            <div>
              <span className="block text-[10px] font-bold font-sans uppercase tracking-[0.14em] text-ink-muted mb-1">
                Comprobante de emision
              </span>
              <strong className="block text-[17px] font-serif text-ink">{isPrivacyMode ? 'Voto emitido con privacidad protegida' : candidateName}</strong>
            </div>
            <button
              className="receipt-print-button inline-flex items-center justify-center h-10 px-4 rounded-xl bg-white text-[#1c3d5c] font-sans text-sm font-bold border-[1.5px] border-slate-900/[0.14] hover:bg-slate-50 transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5294]/15"
              type="button"
              onClick={() => window.print()}
            >
              Imprimir comprobante
            </button>
          </div>

          <div className="grid gap-3 pt-3 sm:grid-cols-2">
            <div>
              <span className="block text-[10px] font-bold font-sans uppercase tracking-[0.14em] text-ink-muted mb-1">
                Candidatura elegida
              </span>
              <strong className="block text-[15px] font-serif text-ink">{candidateName}</strong>
            </div>
            <div>
              <span className="block text-[10px] font-bold font-sans uppercase tracking-[0.14em] text-ink-muted mb-1">
                Codigo de comprobante
              </span>
              <code className="block text-[12px] font-mono text-ink tracking-wider break-all">{receiptCode}</code>
            </div>
            <div>
              <span className="block text-[10px] font-bold font-sans uppercase tracking-[0.14em] text-ink-muted mb-1">
                Estado del flujo
              </span>
              <strong className="block text-[14px] font-sans text-ink">Sesion cerrada y registrada</strong>
            </div>
            <div>
              <span className="block text-[10px] font-bold font-sans uppercase tracking-[0.14em] text-ink-muted mb-1">
                Emitido
              </span>
              <strong className="block text-[14px] font-sans text-ink">{formattedIssuedAt || 'Disponible al confirmar'}</strong>
            </div>
          </div>
        </div>

        <p className="m-0 w-full px-3.5 py-2.5 rounded-xl text-[12px] font-sans text-emerald-700 bg-emerald-50 border border-emerald-200 text-left">
          {isDemoMode
            ? 'Modo simulacion activo — este recorrido se uso solo para capacitacion y no representa una emision real.'
            : 'Entorno de prueba — datos simulados del portal institucional.'}
        </p>

        <button
          className="screen-only inline-flex items-center justify-center w-full h-11 px-5 rounded-xl bg-[#0b5294] text-white font-sans text-sm font-bold tracking-wide shadow-[0_4px_14px_rgba(11,82,148,0.40),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[#0a4278] hover:-translate-y-px active:translate-y-0 transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5294]/20"
          type="button"
          onClick={onRestart}
        >
          {isDemoMode ? 'Reiniciar simulacion' : 'Reiniciar demo'}
        </button>
      </div>
    </section>
  );
}