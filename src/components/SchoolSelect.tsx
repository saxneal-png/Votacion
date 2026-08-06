'use client';

import React, { useEffect, useState } from 'react';

export interface SchoolOption {
  rbd: string;
  nombre_oficial: string;
  comuna?: string;
}

interface SchoolSelectProps {
  selectedRbd: string;
  onSchoolSelect: (school: { rbd: string; nombre_oficial: string }) => void;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export function SchoolSelect({
  selectedRbd,
  onSchoolSelect,
  required = true,
  className = '',
  disabled = false,
}: SchoolSelectProps) {
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSchools() {
      if (isMounted) {
        setLoading(true);
        setErrorMessage(null);
      }

      try {
        // Petición a la API interna de Next.js (cumple 'self' en CSP)
        let response = await fetch('/api/admin/schools-master', { credentials: 'same-origin' });
        if (!response.ok) {
          response = await fetch('/api/schools-master', { credentials: 'same-origin' });
        }

        if (!response.ok) {
          throw new Error(`Error de servidor (${response.status}) al obtener el listado de colegios.`);
        }

        const result = (await response.json()) as unknown;
        let list: Array<Record<string, unknown>> = [];

        if (Array.isArray(result)) {
          list = result as Array<Record<string, unknown>>;
        } else if (result && typeof result === 'object') {
          const resObj = result as Record<string, unknown>;
          if (Array.isArray(resObj.records)) {
            list = resObj.records as Array<Record<string, unknown>>;
          } else if (Array.isArray(resObj.schools)) {
            list = resObj.schools as Array<Record<string, unknown>>;
          } else if (Array.isArray(resObj.data)) {
            list = resObj.data as Array<Record<string, unknown>>;
          }
        }

        if (!list || list.length === 0) {
          if (isMounted) {
            setErrorMessage('No se encontraron colegios en la base de datos (0 registros en catálogo maestro).');
            setLoading(false);
          }
          return;
        }

        const formatted = list
          .map((s) => ({
            rbd: String(s.rbd || s.RBD || '').trim(),
            nombre_oficial: String(s.nombreOficial || s.nombre_oficial || s.nombre || '').trim(),
            comuna: s.comuna ? String(s.comuna).trim() : '',
          }))
          .filter((s) => s.rbd && s.nombre_oficial);

        if (isMounted) {
          setSchools(formatted);
          setLoading(false);
        }
      } catch (err) {
        console.error('[SchoolSelect] Error al cargar establecimientos:', err);
        if (isMounted) {
          setErrorMessage(err instanceof Error ? err.message : 'Error de conexión');
          setLoading(false);
        }
      }
    }

    void loadSchools();
    return () => {
      isMounted = false;
    };
  }, []);

  if (errorMessage && schools.length === 0) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex flex-col gap-1 font-medium">
        <div className="font-bold flex items-center gap-1 text-amber-800">
          <span>⚠️ Catálogo de Establecimientos:</span>
        </div>
        <span>{errorMessage}</span>
        <span className="text-[10px] text-amber-700">
          Tip: Carga el archivo Excel en la pestaña Catálogo Maestro de la Administración o ejecuta el script SQL <code>supabase_optimization_v2.sql</code>.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="block text-xs font-bold text-slate-700 uppercase mb-0.5">
        Establecimiento Educacional (131 Escuelas SLEP)
      </label>
      <select
        value={selectedRbd}
        onChange={(e) => {
          const rbd = e.target.value;
          const school = schools.find((s) => s.rbd === rbd);
          if (school) {
            onSchoolSelect({
              rbd: school.rbd,
              nombre_oficial: school.nombre_oficial,
            });
          } else {
            onSchoolSelect({ rbd: '', nombre_oficial: '' });
          }
        }}
        disabled={loading || disabled}
        required={required}
        className={`w-full h-10 px-3 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0b5294] focus:border-[#0b5294] transition ${className}`}
      >
        <option value="">
          {loading
            ? 'Cargando establecimientos...'
            : `-- Seleccione Colegio (${schools.length} disponibles) --`}
        </option>
        {schools.map((school) => (
          <option key={school.rbd} value={school.rbd}>
            {school.nombre_oficial} (RBD {school.rbd}
            {school.comuna ? ` - ${school.comuna}` : ''})
          </option>
        ))}
      </select>
    </div>
  );
}
