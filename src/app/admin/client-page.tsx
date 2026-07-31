'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { AdminView } from '@/components/views/AdminView';
import type { AdminAuditEntry, AdminMetrics } from '@/types';

const POLL_INTERVAL_MS = 8_000;

export default function AdminClientPage() {
  // ── Auth state ───────────────────────────────────────────────────────────
  const [pin, setPin] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // ── Dashboard state ──────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [auditLog, setAuditLog] = useState<AdminAuditEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const intervalRef = useRef<number | null>(null);

  // ── Load metrics ─────────────────────────────────────────────────────────
  const loadMetrics = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/metrics', { credentials: 'same-origin' });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return (await res.json()) as AdminMetrics;
    } catch {
      return null;
    } finally {
      if (background) setRefreshing(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audit', { credentials: 'same-origin' });
      if (!res.ok) return;
      const body = (await res.json()) as { log: AdminAuditEntry[] };
      setAuditLog(body.log);
    } catch {
      // non-critical
    }
  }, []);

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    const [data] = await Promise.all([loadMetrics(true), loadAudit()]);
    if (data) setMetrics(data);
  }, [loadMetrics, loadAudit]);

  // ── Session expired mid-session ──────────────────────────────────────────
  const handleSessionExpired = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setAuthenticated(false);
    setMetrics(null);
    setAuditLog([]);
    setAuthError('La sesión administrativa expiró. Por favor vuelve a ingresar el PIN.');
  }, []);

  // ── Polling ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authenticated) return;

    const id = window.setInterval(async () => {
      const data = await loadMetrics(true);
      if (data === null) {
        handleSessionExpired();
      } else {
        setMetrics(data);
      }
    }, POLL_INTERVAL_MS);

    intervalRef.current = id;
    return () => window.clearInterval(id);
  }, [authenticated, loadMetrics, handleSessionExpired]);

  // ── PIN submit ───────────────────────────────────────────────────────────
  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const loginRes = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
        credentials: 'same-origin',
      });

      if (!loginRes.ok) {
        const body = (await loginRes.json()) as { message?: string };
        setAuthError(body.message ?? 'PIN incorrecto.');
        return;
      }
    } catch {
      setAuthError('Error de red. Intenta nuevamente.');
      return;
    } finally {
      setAuthLoading(false);
    }

    setPin('');

    const [data] = await Promise.all([loadMetrics(), loadAudit()]);
    if (!data) {
      setAuthError('No se pudieron cargar las métricas.');
      return;
    }

    setMetrics(data);
    setAuthenticated(true);
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    await fetch('/api/admin/logout', { method: 'DELETE', credentials: 'same-origin' });
    setAuthenticated(false);
    setMetrics(null);
    setAuditLog([]);
    setAuthError(null);
  }, []);

  // ── PIN gate ─────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 bg-[#082f5a]"
        style={{ backgroundImage: 'linear-gradient(135deg, #061d3d 0%, #0a3566 52%, #0b5294 100%)' }}
      >
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
          <div className="text-center mb-8">
            <div
              className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#0b5294' }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1
              className="text-xl font-bold"
              style={{ color: '#0c2138', fontFamily: 'Cambria, Georgia, serif' }}
            >
              Panel Administrativo
            </h1>
            <p className="text-sm mt-1" style={{ color: '#5b6b7f' }}>
              Padrón Electoral y Métricas · SLEP VALLE DIGUILLÍN
            </p>
          </div>

          <form onSubmit={handlePinSubmit} noValidate>
            <div className="mb-4">
              <label
                htmlFor="admin-pin"
                className="block text-sm font-semibold mb-1.5"
                style={{ color: '#0c2138' }}
              >
                PIN de acceso
              </label>
              <input
                id="admin-pin"
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setAuthError(null);
                }}
                autoComplete="current-password"
                className="w-full border rounded-lg px-4 py-2.5 text-base outline-none transition-shadow focus:ring-2"
                style={{
                  borderColor: authError ? '#e02a3b' : '#d1d5db',
                  color: '#0c2138',
                }}
                placeholder="Ingresa el PIN"
                aria-describedby={authError ? 'auth-error' : undefined}
                aria-invalid={!!authError}
              />
              {authError && (
                <p
                  id="auth-error"
                  role="alert"
                  className="mt-1.5 text-sm"
                  style={{ color: '#e02a3b' }}
                >
                  {authError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={authLoading || pin.trim().length === 0}
              className="w-full py-2.5 rounded-lg font-semibold text-white transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: '#0b5294' }}
            >
              {authLoading && (
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              )}
              {authLoading ? 'Verificando…' : 'Acceder'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (!metrics) return null;

  return (
    <AdminView
      metrics={metrics}
      auditLog={auditLog}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      onLogout={handleLogout}
    />
  );
}
