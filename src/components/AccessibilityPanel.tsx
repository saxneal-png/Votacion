'use client';

type FontScale = 'small' | 'normal' | 'large';

interface AccessibilityPanelProps {
  isOpen: boolean;
  isHighContrast: boolean;
  isPrivacyMode: boolean;
  isSimplifiedMode: boolean;
  isReducedMotion: boolean;
  fontScale: FontScale;
  onToggleOpen: () => void;
  onHighContrastChange: (enabled: boolean) => void;
  onPrivacyModeChange: (enabled: boolean) => void;
  onSimplifiedModeChange: (enabled: boolean) => void;
  onReducedMotionChange: (enabled: boolean) => void;
  onFontScaleChange: (value: FontScale) => void;
}

function AccessibilityIcon({ path, filled = false }: { path: string; filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={path}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ControlButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`a11y-icon-button ${active ? 'a11y-icon-button-active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AccessibilityPanel({
  isOpen,
  isHighContrast,
  isPrivacyMode,
  isSimplifiedMode,
  isReducedMotion,
  fontScale,
  onToggleOpen,
  onHighContrastChange,
  onPrivacyModeChange,
  onSimplifiedModeChange,
  onReducedMotionChange,
  onFontScaleChange,
}: AccessibilityPanelProps) {
  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {isOpen ? (
        <aside className="w-[248px] max-w-[calc(100vw-24px)] rounded-[22px] border border-white/35 bg-white/96 p-3.5 shadow-[0_20px_54px_rgba(6,18,38,0.22)] backdrop-blur-[18px]">
          <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-900/[0.08]">
            <div>
              <p className="m-0 text-[10px] font-bold font-sans uppercase tracking-[0.16em] text-[#4e6a85]">
                Accesibilidad
              </p>
              <p className="m-0 mt-1 text-[12px] font-sans text-[#4e6a85] leading-relaxed">
                Ajustes rapidos del flujo
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-slate-900/[0.12] bg-white px-2.5 py-1.5 text-[10px] font-bold font-sans uppercase tracking-[0.12em] text-[#1c3d5c] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5294]/15"
              onClick={onToggleOpen}
              aria-label="Cerrar panel de accesibilidad"
            >
              Cerrar
            </button>
          </div>

          <div className="mt-3 grid gap-3">
            <div className="grid grid-cols-4 gap-2">
              <ControlButton
                label="Contraste alto"
                active={isHighContrast}
                onClick={() => onHighContrastChange(!isHighContrast)}
              >
                <AccessibilityIcon path="M12 3a9 9 0 1 0 0 18V3Z" filled />
              </ControlButton>

              <ControlButton
                label="Lectura simplificada"
                active={isSimplifiedMode}
                onClick={() => onSimplifiedModeChange(!isSimplifiedMode)}
              >
                <AccessibilityIcon path="M6 7h12M6 12h9M6 17h7" />
              </ControlButton>

              <ControlButton
                label="Privacidad visible"
                active={isPrivacyMode}
                onClick={() => onPrivacyModeChange(!isPrivacyMode)}
              >
                <AccessibilityIcon path="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Zm9 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              </ControlButton>

              <ControlButton
                label="Movimiento reducido"
                active={isReducedMotion}
                onClick={() => onReducedMotionChange(!isReducedMotion)}
              >
                <AccessibilityIcon path="M5 12h5m4 0h5M12 5v5m0 4v5" />
              </ControlButton>
            </div>

            <div className="rounded-2xl border border-slate-900/[0.08] bg-slate-50 px-3 py-3">
              <p className="m-0 text-[10px] font-bold font-sans uppercase tracking-[0.14em] text-[#1c3d5c]">
                Tamaño de texto
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([
                  { value: 'small', label: 'A-' },
                  { value: 'normal', label: 'A' },
                  { value: 'large', label: 'A+' },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    title={`Texto ${option.label}`}
                    aria-label={`Texto ${option.label}`}
                    className={`rounded-xl border px-0 py-2 text-[13px] font-bold font-sans transition ${
                      fontScale === option.value
                        ? 'border-[#0b5294] bg-[#0b5294] text-white'
                        : 'border-slate-200 bg-white text-[#1c3d5c] hover:bg-slate-50'
                    } focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0b5294]/15`}
                    onClick={() => onFontScaleChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="m-0 px-1 text-[11px] font-sans leading-relaxed text-[#4e6a85]">
              Usa los iconos para activar apoyo visual sin abrir bloques largos dentro del flujo.
            </p>
          </div>
        </aside>
      ) : null}

      <button
        type="button"
        className="a11y-fab group"
        aria-label={isOpen ? 'Cerrar accesibilidad' : 'Abrir accesibilidad'}
        title="Accesibilidad"
        aria-expanded={isOpen}
        onClick={onToggleOpen}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="5" r="2.2" fill="currentColor" />
          <path d="M4 9.5h16M12 7.5v12M8.5 20l3.5-4 3.5 4M9 9.5l-2 5M15 9.5l2 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

export type { FontScale };