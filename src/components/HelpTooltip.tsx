'use client';

import React, { useId, useState } from 'react';

interface HelpTooltipProps {
  title: string;
  description: string;
  align?: 'left' | 'right';
}

export function HelpTooltip({ title, description, align = 'right' }: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-label={`Ayuda: ${title}`}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        className="help-trigger"
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5.8 5.2a1.45 1.45 0 0 1 2.53.93c0 .88-.58 1.2-1.07 1.55-.43.3-.78.58-.78 1.18" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
          <circle cx="7" cy="10.5" r="0.7" fill="currentColor" />
        </svg>
      </button>

      <div
        id={tooltipId}
        role="tooltip"
        className={`help-tooltip ${isOpen ? 'help-tooltip-open' : ''} ${align === 'left' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}`}
      >
        <p className="m-0 text-[11px] font-bold font-sans uppercase tracking-[0.12em] text-[#1c3d5c]">
          {title}
        </p>
        <p className="mt-1.5 mb-0 text-[12px] font-sans leading-relaxed text-[#4e6a85]">
          {description}
        </p>
      </div>
    </div>
  );
}