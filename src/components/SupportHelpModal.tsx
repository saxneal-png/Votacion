'use client';

import React from 'react';
import { buildWhatsAppLink, DEFAULT_WHATSAPP_TEMPLATE, type ElectionConfig } from '@/lib/election-config-store';

interface SupportHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: Partial<ElectionConfig> | null;
  context?: {
    rut?: string;
    estamento?: string;
  };
}

export function SupportHelpModal({
  isOpen,
  onClose,
  config,
  context,
}: SupportHelpModalProps) {
  if (!isOpen) return null;

  const phone = config?.telefonoSoporte || '+56 42 220 0000';
  const whatsapp = config?.whatsappSoporte || '+56 9 1234 5678';
  const email = config?.emailSoporte || 'soporte.elecciones@eduvallediguillin.gob.cl';
  const horario = config?.horarioAtencionSoporte || 'Lunes a Viernes de 08:30 a 17:30 hrs';
  const template = config?.mensajeWhatsappPlantilla || DEFAULT_WHATSAPP_TEMPLATE;

  const cleanPhone = phone.replace(/\s+/g, '');
  const whatsappUrl = buildWhatsAppLink(whatsapp, template, context);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-modal-title"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
        {/* Header con degradado institucional */}
        <div className="bg-gradient-to-r from-[#0b5294] via-[#1a4a7a] to-[#0b5294] p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md text-2xl">
                📞
              </span>
              <div>
                <h3 id="support-modal-title" className="text-base font-extrabold m-0 leading-tight">
                  Mesa de Ayuda Electoral
                </h3>
                <p className="text-[11px] text-blue-200 m-0 mt-0.5 font-medium">
                  Servicio Local de Educación Pública
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition"
              aria-label="Cerrar modal de soporte"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-5 space-y-4 text-slate-800">
          <p className="text-xs text-slate-600 m-0 leading-relaxed font-medium">
            ¿Tienes problemas con tu RUN, correo electrónico o la recepción del código OTP? Nuestro equipo técnico y Ministros de Fe están disponibles para asistirte:
          </p>

          {context?.rut ? (
            <div className="px-3 py-2 rounded-xl bg-blue-50/80 border border-blue-200 text-xs flex items-center justify-between text-[#0b5294]">
              <span className="font-semibold">RUN en consulta:</span>
              <strong className="font-mono bg-white px-2 py-0.5 rounded border border-blue-200">
                {context.rut}
              </strong>
            </div>
          ) : null}

          {/* Opciones de contacto */}
          <div className="grid gap-3">
            {/* Opción 1: WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 transition group shadow-xs"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600 text-white text-xl shadow-xs">
                  💬
                </span>
                <div>
                  <h4 className="text-xs font-extrabold m-0 text-emerald-950">
                    Escribir por WhatsApp
                  </h4>
                  <p className="text-[11px] text-emerald-700 m-0 mt-0.5 font-medium">
                    {whatsapp} (Mensaje pre-cargado)
                  </p>
                </div>
              </div>
              <span className="text-emerald-700 text-sm font-bold group-hover:translate-x-0.5 transition">
                Abrir →
              </span>
            </a>

            {/* Opción 2: Llamada Telefónica */}
            <a
              href={`tel:${cleanPhone}`}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 transition group shadow-xs"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0b5294] text-white text-xl shadow-xs">
                  📞
                </span>
                <div>
                  <h4 className="text-xs font-extrabold m-0 text-blue-950">
                    Llamar por Teléfono
                  </h4>
                  <p className="text-[11px] text-blue-700 m-0 mt-0.5 font-medium">
                    {phone}
                  </p>
                </div>
              </div>
              <span className="text-blue-700 text-sm font-bold group-hover:translate-x-0.5 transition">
                Llamar →
              </span>
            </a>

            {/* Opción 3: Correo de Soporte */}
            {email ? (
              <a
                href={`mailto:${email}?subject=${encodeURIComponent(`Soporte Votación SLEP - RUN: ${context?.rut || 'Sin RUN'}`)}`}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-600 text-white text-xl shadow-xs">
                    ✉️
                  </span>
                  <div>
                    <h4 className="text-xs font-extrabold m-0 text-slate-900">
                      Correo de Asistencia
                    </h4>
                    <p className="text-[11px] text-slate-500 m-0 mt-0.5 font-medium truncate max-w-[200px]">
                      {email}
                    </p>
                  </div>
                </div>
                <span className="text-slate-600 text-sm font-bold group-hover:translate-x-0.5 transition">
                  Enviar →
                </span>
              </a>
            ) : null}
          </div>

          {/* Horario y Footer */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>🕒 Horario: <strong>{horario}</strong></span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition text-xs"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
