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

  useEffect(() => {
    let isMounted = true;
    async function loadSchools() {
      try {
        const res = await fetch('/api/admin/schools-master', { credentials: 'same-origin' });
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          const list = (data.records || data.schools || data.data) as Array<Record<string, unknown>> | undefined;
          if (isMounted && list && Array.isArray(list) && list.length > 0) {
            const formatted = list
              .map((s) => ({
                rbd: String(s.rbd || s.RBD || '').trim(),
                nombre_oficial: String(s.nombreOficial || s.nombre_oficial || s.nombre || '').trim(),
                comuna: s.comuna ? String(s.comuna).trim() : '',
              }))
              .filter((s) => s.rbd && s.nombre_oficial);

            setSchools(formatted);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback a endpoint alternativo o lista vacía
      }

      if (isMounted) setLoading(false);
    }

    void loadSchools();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="block text-xs font-bold text-slate-700 uppercase mb-0.5">
        Establecimiento Educacional (Catálogo Maestro SLEP)
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
          {loading ? 'Cargando 131 establecimientos...' : '-- Seleccione Colegio --'}
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
