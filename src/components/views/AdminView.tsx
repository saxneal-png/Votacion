'use client';

import React, { useEffect, useState } from 'react';
import type { AdminAuditEntry, AdminMetrics, Candidate, Estamento } from '@/types';
import type { EstamentoDecreto102, ExcelProcessingResult, PadronRecord, QuorumEstamentoStatus } from '@/lib/padron-store';
import type { ConnectionTestResult } from '@/lib/azure-m365-service';
import { cleanAndValidateRUT } from '@/lib/rut-validator';
import type { VotingRecordEntry } from '@/lib/voting-record-store';

interface AdminViewProps {
  metrics: AdminMetrics;
  auditLog: AdminAuditEntry[];
  refreshing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

type AdminTab = 'padron' | 'candidaturas' | 'metrics' | 'registro' | 'audit' | 'azure' | 'cloud';

function pct(part: number, total: number): string {
  if (total === 0) return '0.0';
  return ((part / total) * 100).toFixed(1);
}

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'ahora mismo';
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  return `hace ${m}m`;
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1 shadow-sm">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-2xl font-extrabold leading-none" style={{ color: accent ?? '#0b5294' }}>
        {value}
      </span>
      {sub && <span className="text-xs text-slate-600 mt-1">{sub}</span>}
    </div>
  );
}

function ProgressBar({
  value,
  max,
  color,
  height = 8,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full rounded-full overflow-hidden bg-slate-100" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

const ESTAMENTO_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  ESTUDIANTES: { label: 'Estudiante', bg: 'bg-sky-50', text: 'text-sky-800 border-sky-200' },
  estudiantes: { label: 'Estudiante', bg: 'bg-sky-50', text: 'text-sky-800 border-sky-200' },
  PADRES_APODERADOS: { label: 'Apoderado', bg: 'bg-amber-50', text: 'text-amber-800 border-amber-200' },
  apoderados: { label: 'Apoderado', bg: 'bg-amber-50', text: 'text-amber-800 border-amber-200' },
  DOCENTES: { label: 'Docente', bg: 'bg-orange-50', text: 'text-orange-800 border-orange-200' },
  docentes: { label: 'Docente', bg: 'bg-orange-50', text: 'text-orange-800 border-orange-200' },
  ASISTENTES: { label: 'Asistente', bg: 'bg-teal-50', text: 'text-teal-800 border-teal-200' },
  asistentes: { label: 'Asistente', bg: 'bg-teal-50', text: 'text-teal-800 border-teal-200' },
  DIRECTIVOS: { label: 'Directivo', bg: 'bg-blue-50', text: 'text-blue-800 border-blue-200' },
  directivos: { label: 'Directivo', bg: 'bg-blue-50', text: 'text-blue-800 border-blue-200' },
};

export function AdminView({
  metrics,
  auditLog,
  refreshing,
  onRefresh,
  onLogout,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('padron');
  
  // Padrón State
  const [padronRecords, setPadronRecords] = useState<PadronRecord[]>([]);
  const [quorums, setQuorums] = useState<QuorumEstamentoStatus[]>([]);
  const [availableSchools, setAvailableSchools] = useState<{ rbd: string; nombre: string }[]>([]);
  const [loadingPadron, setLoadingPadron] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEstamentoFilter, setSelectedEstamentoFilter] = useState('ALL');
  const [selectedRbdFilter, setSelectedRbdFilter] = useState('ALL');

  // Modales Padrón
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddVoterModal, setShowAddVoterModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ExcelProcessingResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Formulario manual Votante
  const [newRutVotante, setNewRutVotante] = useState('');
  const [newRutEstudiante, setNewRutEstudiante] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newEstamento, setNewEstamento] = useState<EstamentoDecreto102>('PADRES_APODERADOS');
  const [newRbd, setNewRbd] = useState('10202');
  const [newNombreColegio, setNewNombreColegio] = useState('Escuela Martín Prado');
  const [addVoterError, setAddVoterError] = useState<string | null>(null);
  const [addVoterSuccess, setAddVoterSuccess] = useState(false);

  // Candidatos State (Pestaña 2)
  const [candidatos, setCandidatos] = useState<Candidate[]>([]);
  const [loadingCandidatos, setLoadingCandidatos] = useState(false);
  const [candidatoSearch, setCandidatoSearch] = useState('');
  const [candidatoEstamentoFilter, setCandidatoEstamentoFilter] = useState('ALL');

  // Modales Candidatos (Alta / Edición)
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [savingCandidate, setSavingCandidate] = useState(false);
  const [candError, setCandError] = useState<string | null>(null);
  const [candSuccess, setCandSuccess] = useState(false);

  // Formulario Candidato
  const [formCandNombre, setFormCandNombre] = useState('');
  const [formCandEstamento, setFormCandEstamento] = useState<Estamento>('docentes');
  const [formCandEscuela, setFormCandEscuela] = useState('');
  const [formCandBiografia, setFormCandBiografia] = useState('');
  const [formCandPropuesta, setFormCandPropuesta] = useState('');
  const [formCandFoto, setFormCandFoto] = useState('');

  // Modal Eliminación Candidato
  const [showDeleteCandModal, setShowDeleteCandModal] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState(false);

  // Azure M365 State (Pestaña 5)
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [casillaEmail, setCasillaEmail] = useState('');
  const [useSimulation, setUseSimulation] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [connTestResult, setConnTestResult] = useState<ConnectionTestResult | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);

  // Test Send Mail State
  const [sendingTestMail, setSendingTestMail] = useState(false);
  const [testMailResult, setTestMailResult] = useState<{
    success: boolean;
    message: string;
    otp?: string;
    magicToken?: string;
    mode?: string;
  } | null>(null);

  // Modal Reiniciar Votación State
  const [showResetElectionModal, setShowResetElectionModal] = useState(false);
  const [resetAdminPin, setResetAdminPin] = useState('');
  const [resettingElection, setResettingElection] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Registro de Votación con Folios State
  const [registroRecords, setRegistroRecords] = useState<VotingRecordEntry[]>([]);
  const [loadingRegistro, setLoadingRegistro] = useState(false);
  const [registroSearch, setRegistroSearch] = useState('');
  const [registroEstamentoFilter, setRegistroEstamentoFilter] = useState('ALL');
  const [registroRbdFilter, setRegistroRbdFilter] = useState('ALL');

  async function fetchRegistro() {
    setLoadingRegistro(true);
    try {
      const params = new URLSearchParams();
      if (registroSearch) params.set('search', registroSearch);
      if (registroEstamentoFilter !== 'ALL') params.set('estamento', registroEstamentoFilter);
      if (registroRbdFilter !== 'ALL') params.set('rbd', registroRbdFilter);

      const res = await fetch(`/api/admin/registro-votacion?${params.toString()}`, { credentials: 'same-origin' });
      if (res.ok) {
        const data = (await res.json()) as { records: VotingRecordEntry[]; total: number };
        setRegistroRecords(data.records);
      }
    } catch (err) {
      console.error('Error al cargar registro de votación:', err);
    } finally {
      setLoadingRegistro(false);
    }
  }

  function handleExportRegistroCsv() {
    const params = new URLSearchParams();
    if (registroSearch) params.set('search', registroSearch);
    if (registroEstamentoFilter !== 'ALL') params.set('estamento', registroEstamentoFilter);
    if (registroRbdFilter !== 'ALL') params.set('rbd', registroRbdFilter);

    window.open(`/api/admin/registro-votacion/export?${params.toString()}`, '_blank');
  }

  async function handleResetElection(e: React.FormEvent) {
    e.preventDefault();
    if (!resetAdminPin.trim()) return;

    setResettingElection(true);
    setResetError(null);

    try {
      const res = await fetch('/api/admin/reset-election', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin: resetAdminPin }),
        credentials: 'same-origin',
      });

      const data = (await res.json()) as { success: boolean; message: string };

      if (res.ok && data.success) {
        setResetSuccessMessage(data.message);
        setShowResetElectionModal(false);
        setResetAdminPin('');
        void fetchPadron();
        void fetchRegistro();
        onRefresh();
      } else {
        setResetError(data.message || 'No fue posible reiniciar la votación.');
      }
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Error inesperado al reiniciar la votación.');
    } finally {
      setResettingElection(false);
    }
  }

  async function handleTestSendMail() {
    const emailPrueba = prompt(
      'Ingresa tu dirección de correo de destino para recibir el Magic Link y Código OTP de prueba:',
      casillaEmail,
    );
    if (!emailPrueba) return;

    setSendingTestMail(true);
    setTestMailResult(null);

    try {
      const res = await fetch('/api/admin/enviar-acreditacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rutVotante: '16940271-k',
          emailDestino: emailPrueba.trim(),
          esSimulacion: useSimulation,
        }),
        credentials: 'same-origin',
      });

      const data = (await res.json()) as {
        success: boolean;
        message: string;
        otp?: string;
        magicToken?: string;
        mode?: string;
      };
      setTestMailResult(data);
    } catch (err) {
      setTestMailResult({
        success: false,
        message: err instanceof Error ? err.message : 'Error al despachar el correo de acreditación.',
      });
    } finally {
      setSendingTestMail(false);
    }
  }

  async function fetchPadron() {
    setLoadingPadron(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedEstamentoFilter !== 'ALL') params.set('estamento', selectedEstamentoFilter);
      if (selectedRbdFilter !== 'ALL') params.set('rbd', selectedRbdFilter);

      const res = await fetch(`/api/admin/padron?${params.toString()}`, {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = (await res.json()) as {
          records: PadronRecord[];
          quorums: QuorumEstamentoStatus[];
          schools?: { rbd: string; nombre: string }[];
        };
        setPadronRecords(data.records);
        setQuorums(data.quorums);
        if (data.schools) {
          setAvailableSchools(data.schools);
        }
      }
    } catch (err) {
      console.error('Error al cargar padrón:', err);
    } finally {
      setLoadingPadron(false);
    }
  }

  async function fetchCandidatos() {
    setLoadingCandidatos(true);
    try {
      const params = new URLSearchParams();
      if (candidatoSearch) params.set('search', candidatoSearch);
      if (candidatoEstamentoFilter !== 'ALL') params.set('estamento', candidatoEstamentoFilter);

      const res = await fetch(`/api/admin/candidatos?${params.toString()}`, { credentials: 'same-origin' });
      if (res.ok) {
        const data = (await res.json()) as { candidates: Candidate[] };
        setCandidatos(data.candidates);
      }
    } catch (err) {
      console.error('Error al cargar candidatos:', err);
    } finally {
      setLoadingCandidatos(false);
    }
  }

  async function fetchAzureConfig() {
    try {
      const res = await fetch('/api/admin/test-m365-connection', { credentials: 'same-origin' });
      if (res.ok) {
        const data = (await res.json()) as { config: { tenantId: string; clientId: string; clientSecret: string; casillaEmail: string; useSimulation: boolean } };
        if (data.config) {
          setAzureTenantId(data.config.tenantId || '');
          setAzureClientId(data.config.clientId || '');
          setAzureClientSecret(data.config.clientSecret || '');
          setCasillaEmail(data.config.casillaEmail || '');
          setUseSimulation(Boolean(data.config.useSimulation));
        }
      }
    } catch (err) {
      console.error('Error al obtener config Azure M365:', err);
    }
  }

  useEffect(() => {
    if (activeTab === 'padron') {
      void fetchPadron();
    } else if (activeTab === 'candidaturas') {
      void fetchCandidatos();
    } else if (activeTab === 'registro') {
      void fetchRegistro();
    } else if (activeTab === 'azure' || activeTab === 'cloud') {
      void fetchAzureConfig();
    }
  }, [activeTab, searchQuery, selectedEstamentoFilter, selectedRbdFilter, candidatoSearch, candidatoEstamentoFilter, registroSearch, registroEstamentoFilter, registroRbdFilter]);

  async function handleTestAzureConnection(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setTestingConn(true);
    setConnTestResult(null);

    try {
      const res = await fetch('/api/admin/test-m365-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: azureTenantId,
          clientId: azureClientId,
          clientSecret: azureClientSecret,
          casillaEmail,
          useSimulation,
        }),
        credentials: 'same-origin',
      });

      const data = (await res.json()) as ConnectionTestResult;
      setConnTestResult(data);
    } catch (err) {
      setConnTestResult({
        success: false,
        latencyMs: 0,
        mode: useSimulation ? 'simulation' : 'production',
        message: err instanceof Error ? err.message : 'Error inesperado al probar conexión.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setTestingConn(false);
    }
  }

  async function handleToggleHabilitado(id: string) {
    try {
      const res = await fetch('/api/admin/padron', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        credentials: 'same-origin',
      });
      if (res.ok) {
        void fetchPadron();
      }
    } catch (err) {
      console.error('Error al modificar estado:', err);
    }
  }

  async function handleDeleteVoter(id: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar a este votante del padrón?')) return;
    try {
      const res = await fetch(`/api/admin/padron?id=${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (res.ok) {
        void fetchPadron();
      }
    } catch (err) {
      console.error('Error al eliminar votante:', err);
    }
  }

  async function handleUploadExcel(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await fetch('/api/admin/padron/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });

      const data = (await res.json()) as ExcelProcessingResult & { message?: string };
      if (!res.ok) {
        setUploadError(data.message || 'Error al procesar el archivo Excel.');
      } else {
        setUploadResult(data);
        void fetchPadron();
        onRefresh();
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error inesperado al subir archivo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleAddVoterManual(e: React.FormEvent) {
    e.preventDefault();
    setAddVoterError(null);
    setAddVoterSuccess(false);

    try {
      const res = await fetch('/api/admin/padron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rutVotante: newRutVotante,
          rutEstudianteAsociado: newEstamento === 'PADRES_APODERADOS' ? newRutEstudiante : undefined,
          nombreCompleto: newNombre,
          estamento: newEstamento,
          rbdEstablecimiento: newRbd,
          nombreEstablecimiento: newNombreColegio,
        }),
        credentials: 'same-origin',
      });

      const data = (await res.json()) as { message?: string; success?: boolean };
      if (!res.ok) {
        setAddVoterError(data.message || 'Error al agregar votante.');
      } else {
        setAddVoterSuccess(true);
        setNewRutVotante('');
        setNewRutEstudiante('');
        setNewNombre('');
        void fetchPadron();
        onRefresh();
        setTimeout(() => {
          setShowAddVoterModal(false);
          setAddVoterSuccess(false);
        }, 1200);
      }
    } catch (err) {
      setAddVoterError(err instanceof Error ? err.message : 'Error al conectar con el servidor.');
    }
  }

  // Candidatos CRUD Handlers
  function handleOpenCreateCandidate() {
    setEditingCandidate(null);
    setFormCandNombre('');
    setFormCandEstamento('docentes');
    setFormCandEscuela('');
    setFormCandBiografia('');
    setFormCandPropuesta('');
    setFormCandFoto('');
    setCandError(null);
    setCandSuccess(false);
    setShowCandidateModal(true);
  }

  function handleOpenEditCandidate(c: Candidate) {
    setEditingCandidate(c);
    setFormCandNombre(c.nombreCompleto || c.name);
    setFormCandEstamento(c.estamento);
    setFormCandEscuela(c.escuelaEstablecimiento || c.role);
    setFormCandBiografia(c.biografia || '');
    setFormCandPropuesta(c.propuestaPrincipal || c.slogan);
    setFormCandFoto(c.fotoPerfil || '');
    setCandError(null);
    setCandSuccess(false);
    setShowCandidateModal(true);
  }

  async function handleSaveCandidate(e: React.FormEvent) {
    e.preventDefault();
    setCandError(null);
    setCandSuccess(false);

    if (!formCandNombre.trim() || !formCandEscuela.trim() || !formCandPropuesta.trim()) {
      setCandError('Por favor completa todos los campos requeridos (Nombre, Escuela y Propuesta).');
      return;
    }

    setSavingCandidate(true);
    try {
      const isEdit = Boolean(editingCandidate);
      const url = '/api/admin/candidatos';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        id: editingCandidate?.id,
        nombreCompleto: formCandNombre.trim(),
        estamento: formCandEstamento,
        escuelaEstablecimiento: formCandEscuela.trim(),
        biografia: formCandBiografia.trim(),
        propuestaPrincipal: formCandPropuesta.trim(),
        fotoPerfil: formCandFoto.trim() || undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });

      const data = (await res.json()) as { message?: string; success?: boolean };
      if (!res.ok) {
        setCandError(data.message || 'Error al guardar la candidatura.');
      } else {
        setCandSuccess(true);
        void fetchCandidatos();
        onRefresh();
        setTimeout(() => {
          setShowCandidateModal(false);
          setCandSuccess(false);
        }, 1000);
      }
    } catch (err) {
      setCandError(err instanceof Error ? err.message : 'Error de red al guardar.');
    } finally {
      setSavingCandidate(false);
    }
  }

  function handleOpenDeleteCandidate(c: Candidate) {
    setCandidateToDelete(c);
    setShowDeleteCandModal(true);
  }

  async function handleConfirmDeleteCandidate() {
    if (!candidateToDelete) return;
    setDeletingCandidate(true);

    try {
      const res = await fetch(`/api/admin/candidatos?id=${candidateToDelete.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });

      if (res.ok) {
        setShowDeleteCandModal(false);
        setCandidateToDelete(null);
        void fetchCandidatos();
        onRefresh();
      } else {
        const data = (await res.json()) as { message?: string };
        alert(data.message || 'Error al eliminar el candidato.');
      }
    } catch (err) {
      console.error('Error al eliminar candidato:', err);
    } finally {
      setDeletingCandidate(false);
    }
  }

  const generatedAzureScript = `# Script de Despliegue Automatizado en Azure App Service (Linux Web App)
# Generado dinámicamente para el Servicio Local de Educación Pública (SLEP)

# 1. Crear Grupo de Recursos en Azure
az group create --name rg-slep-elecciones --location chilecentral

# 2. Compilar Imagen de Contenedor en Azure Container Registry (ACR)
az acr create --resource-group rg-slep-elecciones --name acrslepvotaciones --sku Basic --admin-enabled true
az acr build --registry acrslepvotaciones --image votaciones-slep:latest .

# 3. Crear Plan de Servicio de Aplicación Linux (A5 M365 Spec)
az appservice plan create --name plan-slep-votaciones --resource-group rg-slep-elecciones --is-linux --sku B1

# 4. Crear la Aplicación Web en Azure App Service
az webapp create --resource-group rg-slep-elecciones --plan plan-slep-votaciones --name votaciones-slep-oficial --deployment-container-image-name acrslepvotaciones.azurecr.io/votaciones-slep:latest

# 5. Inyectar Variables de Entorno M365 & Azure AD
az webapp config appsettings set --resource-group rg-slep-elecciones --name votaciones-slep-oficial --settings \\
  AZURE_TENANT_ID="${azureTenantId}" \\
  AZURE_CLIENT_ID="${azureClientId}" \\
  AZURE_CLIENT_SECRET="${azureClientSecret}" \\
  CASILLA_SLEP_EMAIL="${casillaEmail}" \\
  NODE_ENV="production"
`;

  function copyAzureScript() {
    void navigator.clipboard.writeText(generatedAzureScript);
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 2000);
  }

  const rutValidation = cleanAndValidateRUT(newRutVotante);
  const studentRutValidation = newRutEstudiante ? cleanAndValidateRUT(newRutEstudiante) : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-16">
      {/* Top Navbar */}
      <header className="bg-[#0b5294] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏛️</span>
            <div>
              <h1 className="text-base font-extrabold tracking-tight leading-tight">
                Panel Electoral del Ministro de Fe
              </h1>
              <p className="text-[11px] text-blue-200 font-medium">
                Elección Consejo Local SLEP • Decreto N° 102
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-200 hidden sm:inline">
              Actualizado {relativeTime(metrics.lastUpdated)}
            </span>

            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700/80 hover:bg-blue-600 text-white text-xs font-semibold transition disabled:opacity-50"
            >
              <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
              {refreshing ? 'Actualizando...' : 'Refrescar'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowResetElectionModal(true);
                setResetError(null);
                setResetAdminPin('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-extrabold shadow-sm transition"
              title="Reiniciar proceso electoral y vaciar urnas"
            >
              <span>🔴</span>
              Reiniciar Votación
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white text-xs font-semibold transition"
            >
              🚪 Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Bar con Pestañas Principales */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 border-t border-white/10 overflow-x-auto">
          <button
            type="button"
            className={`py-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'padron'
                ? 'border-emerald-400 text-white bg-white/10'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
            }`}
            onClick={() => setActiveTab('padron')}
          >
            📋 1. Padrón Electoral
          </button>

          <button
            type="button"
            className={`py-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'candidaturas'
                ? 'border-emerald-400 text-white bg-white/10'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
            }`}
            onClick={() => setActiveTab('candidaturas')}
          >
            👤 2. Candidaturas
          </button>

          <button
            type="button"
            className={`py-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'metrics'
                ? 'border-emerald-400 text-white bg-white/10'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
            }`}
            onClick={() => setActiveTab('metrics')}
          >
            📊 3. Métricas y Participación
          </button>

          <button
            type="button"
            className={`py-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'registro'
                ? 'border-emerald-400 text-white bg-white/10'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
            }`}
            onClick={() => setActiveTab('registro')}
          >
            📋 4. Registro Votación (Folios)
          </button>

          <button
            type="button"
            className={`py-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-emerald-400 text-white bg-white/10'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
            }`}
            onClick={() => setActiveTab('audit')}
          >
            📜 5. Auditoría
          </button>

          <button
            type="button"
            className={`py-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'azure'
                ? 'border-emerald-400 text-white bg-white/10'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
            }`}
            onClick={() => setActiveTab('azure')}
          >
            ⚙️ 5. Variables Azure M365
          </button>

          <button
            type="button"
            className={`py-2.5 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'cloud'
                ? 'border-emerald-400 text-white bg-white/10'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
            }`}
            onClick={() => setActiveTab('cloud')}
          >
            ☁️ 6. Despliegue Nube
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 pt-6">
        {/* ==================================================================== */}
        {/* PESTAÑA 1: GESTIÓN DE PADRÓN ELECTORAL (DECRETO 102)                */}
        {/* ==================================================================== */}
        {activeTab === 'padron' && (
          <div className="space-y-6">
            {/* Banner Informativo y Quórum Cards */}
            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>📊 Estado de Quórum Inicial del 30% por Estamento</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Conforme al Artículo 15 del Decreto N° 102, cada estamento requiere al menos un 30% de participación para dar validez al proceso.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                    🟢 Ingesta Decreto 102 Activa
                  </span>
                </div>
              </div>

              {/* Grid de Quórums por Estamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {quorums.map((q) => (
                  <div
                    key={q.estamento}
                    className={`p-3.5 rounded-xl border transition ${
                      q.quorumAlcanzado
                        ? 'bg-emerald-50/50 border-emerald-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight truncate">
                        {q.label}
                      </span>
                      {q.quorumAlcanzado ? (
                        <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded">
                          ✓ ALCANZADO
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                          PENDIENTE
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-lg font-black text-slate-900">
                        {q.votosEmitidos} <span className="text-xs font-normal text-slate-500">votos</span>
                      </span>
                      <span className="text-xs font-bold text-slate-600">
                        Req 30%: {q.quorum30Requerido}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <ProgressBar
                        value={q.votosEmitidos}
                        max={q.padronTotal}
                        color={q.quorumAlcanzado ? '#10b981' : '#0b5294'}
                        height={6}
                      />
                      <span className="text-[10px] text-slate-500 font-medium block text-right">
                        {q.porcentajeParticipacion}% del padrón
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Barra de Controles y Acciones Masivas */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1 min-w-[200px]">
                  <input
                    type="text"
                    className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#0b5294] transition"
                    placeholder="Buscar por RUN, Estudiante o Nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
                </div>

                <select
                  className="h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-none"
                  value={selectedEstamentoFilter}
                  onChange={(e) => setSelectedEstamentoFilter(e.target.value)}
                >
                  <option value="ALL">Todos los Estamentos</option>
                  <option value="ESTUDIANTES">Estudiantes</option>
                  <option value="PADRES_APODERADOS">Padres y Apoderados</option>
                  <option value="DOCENTES">Docentes</option>
                  <option value="ASISTENTES">Asistentes de la Ed.</option>
                  <option value="DIRECTIVOS">Directivos</option>
                </select>

                <select
                  className="h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-none max-w-[220px] truncate"
                  value={selectedRbdFilter}
                  onChange={(e) => setSelectedRbdFilter(e.target.value)}
                >
                  <option value="ALL">Todos los Establecimientos</option>
                  {availableSchools.length > 0
                    ? availableSchools.map((s) => (
                        <option key={s.rbd} value={s.rbd}>
                          {s.nombre} (RBD {s.rbd})
                        </option>
                      ))
                    : metrics.schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shortName}
                        </option>
                      ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddVoterModal(true)}
                  className="h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>👤+</span> Agregar Votante
                </button>

                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="h-10 px-4 rounded-xl bg-[#0b5294] hover:bg-[#0a4278] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>📤</span> Cargar Padrón Excel (.xlsm / .xlsx)
                </button>
              </div>
            </div>

            {/* Tabla del Padrón Electoral */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Listado Oficial del Padrón ({padronRecords.length} registros cargados)
                </span>
                {loadingPadron && <span className="text-xs text-[#0b5294] font-semibold animate-pulse">Cargando...</span>}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">RUN Votante</th>
                      <th className="p-3">Nombre Completo</th>
                      <th className="p-3">Estamento</th>
                      <th className="p-3">RUN Estudiante Asociado</th>
                      <th className="p-3">Establecimiento (RBD)</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-center">Voto</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {padronRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                          No se encontraron registros en el padrón electoral con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      padronRecords.map((r) => {
                        const badge = ESTAMENTO_BADGES[r.estamento] || {
                          label: r.estamento,
                          bg: 'bg-slate-100',
                          text: 'text-slate-700',
                        };
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-mono font-bold text-slate-900">{r.formattedRutVotante}</td>
                            <td className="p-3 font-semibold text-slate-900">{r.nombreCompleto}</td>
                            <td className="p-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${badge.bg} ${badge.text}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-slate-600">
                              {r.formattedRutEstudiante ? (
                                <span className="inline-flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-amber-900 font-semibold">
                                  <span>👶</span> {r.formattedRutEstudiante}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">—</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-700">
                              <div className="font-semibold">{r.nombreEstablecimiento}</div>
                              <div className="text-[10px] text-slate-600 font-mono">RBD: {r.rbdEstablecimiento}</div>
                            </td>
                            <td className="p-3 text-center">
                              {r.habilitado ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  Habilitado
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                                  Inhabilitado
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {r.haVotado ? (
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                                  Emitido
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold">
                                  Pendiente
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right space-x-1">
                              <button
                                type="button"
                                onClick={() => handleToggleHabilitado(r.id)}
                                className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                                  r.habilitado
                                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                }`}
                              >
                                {r.habilitado ? 'Inhabilitar' : 'Habilitar'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteVoter(r.id)}
                                className="px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 text-[11px] font-bold transition"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* PESTAÑA 2: MÓDULO DE REGISTRO Y GESTIÓN DE CANDIDATURAS              */}
        {/* ==================================================================== */}
        {activeTab === 'candidaturas' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span>👤 Módulo de Registro y Gestión de Candidatos</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Inscripción, edición y administración de candidaturas para los 5 estamentos del Consejo Local.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenCreateCandidate}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md"
              >
                <span>➕</span> Inscribir Candidato
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1 min-w-[200px]">
                  <input
                    type="text"
                    className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#0b5294] transition"
                    placeholder="Buscar por nombre, escuela o propuesta..."
                    value={candidatoSearch}
                    onChange={(e) => setCandidatoSearch(e.target.value)}
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
                </div>

                <select
                  className="h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold focus:outline-none"
                  value={candidatoEstamentoFilter}
                  onChange={(e) => setCandidatoEstamentoFilter(e.target.value)}
                >
                  <option value="ALL">Todos los Estamentos ({candidatos.length})</option>
                  <option value="directivos">Directivos</option>
                  <option value="docentes">Docentes</option>
                  <option value="asistentes">Asistentes de la Ed.</option>
                  <option value="apoderados">Padres y Apoderados</option>
                  <option value="estudiantes">Estudiantes</option>
                </select>
              </div>

              {loadingCandidatos && <span className="text-xs text-[#0b5294] font-semibold animate-pulse">Cargando candidaturas...</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {candidatos.length === 0 ? (
                <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 font-medium space-y-2">
                  <span className="text-4xl block">👤</span>
                  <p>No hay candidaturas registradas con los filtros seleccionados.</p>
                </div>
              ) : (
                candidatos.map((c) => {
                  const badge = ESTAMENTO_BADGES[c.estamento] || {
                    label: c.estamento,
                    bg: 'bg-slate-100',
                    text: 'text-slate-700',
                  };
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between"
                      style={{ borderTop: `4px solid ${c.accentColor || '#0b5294'}` }}
                    >
                      <div className="p-5 space-y-3">
                        <div className="flex items-start gap-3">
                          {c.fotoPerfil ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.fotoPerfil}
                              alt={c.nombreCompleto || c.name}
                              className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 shrink-0 shadow-sm"
                            />
                          ) : (
                            <div
                              className="w-14 h-14 rounded-full text-white font-extrabold text-lg flex items-center justify-center shrink-0 shadow-sm"
                              style={{ backgroundColor: c.accentColor || '#0b5294' }}
                            >
                              {c.initials}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-extrabold text-slate-900 truncate">
                              {c.nombreCompleto || c.name}
                            </h3>
                            <p className="text-xs text-slate-600 font-semibold truncate">
                              🏫 {c.escuelaEstablecimiento || c.role}
                            </p>
                            <span
                              className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg} ${badge.text}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                          <span className="font-bold text-[11px] text-[#0b5294] block uppercase">
                            💡 Propuesta Principal:
                          </span>
                          <p className="italic font-medium leading-relaxed">
                            &ldquo;{c.propuestaPrincipal || c.slogan}&rdquo;
                          </p>
                        </div>

                        {c.biografia ? (
                          <div className="text-xs text-slate-600 line-clamp-3">
                            <span className="font-bold text-slate-800">Biografía: </span>
                            {c.biografia}
                          </div>
                        ) : null}
                      </div>

                      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditCandidate(c)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#0b5294] hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteCandidate(c)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition flex items-center gap-1"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* PESTAÑA 3: MÉTRICAS Y PARTICIPACIÓN ELECTORAL                        */}
        {/* ==================================================================== */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <SummaryCard
                label="Padrón Total Habilitado"
                value={metrics.padron.total.toLocaleString('es-CL')}
                sub="Decreto 102"
              />
              <SummaryCard
                label="Votos Totales Emitidos"
                value={metrics.votes.total.toLocaleString('es-CL')}
                accent="#047857"
                sub={`Participación ${pct(metrics.votes.total, metrics.padron.total)}%`}
              />
              <SummaryCard
                label="Escuelas Participantes"
                value={metrics.schools.length}
                accent="#6b21a8"
                sub="Servicio Local"
              />
              <SummaryCard
                label="Estamentos en Proceso"
                value={metrics.estamentos.length}
                accent="#b45309"
                sub="Directivos, Docentes, Asistentes, Apoderados, Estudiantes"
              />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-extrabold text-slate-900">
                📊 Resultados de Votación por Estamento
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.estamentos.map((e) => (
                  <div key={e.estamento} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-800 text-sm">{e.label}</span>
                      <span className="text-xs font-bold text-slate-500">
                        {e.votesCast} / {e.padronCount} votos ({pct(e.votesCast, e.padronCount)}%)
                      </span>
                    </div>
                    <ProgressBar value={e.votesCast} max={e.padronCount} color={e.color} height={8} />

                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      {e.candidates.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-xs font-medium">
                          <span className="text-slate-700">{c.name}</span>
                          <span className="font-bold text-slate-900">{c.votes} votos</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* PESTAÑA 4: REGISTRO OFICIAL DE VOTACIÓN (FOLIO ÚNICO & CSV)          */}
        {/* ==================================================================== */}
        {activeTab === 'registro' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2 m-0">
                  <span>📋 Registro Oficial de Votantes (Acta de Sufragio con Folio Único)</span>
                </h2>
                <p className="text-xs text-slate-500 m-0 mt-1">
                  Registra RUN, correo acreditado, fecha/hora, estamento y colegio. Garantiza el secreto del voto al no almacenar la opción emitida.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportRegistroCsv}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition"
              >
                <span>📥</span> Exportar Registro Oficial (CSV / Excel)
              </button>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
              <input
                type="text"
                className="flex-1 min-w-[220px] h-10 px-3.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#0b5294]"
                placeholder="Buscar por Folio, RUN o Correo..."
                value={registroSearch}
                onChange={(e) => setRegistroSearch(e.target.value)}
              />

              <select
                className="h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0b5294] bg-white"
                value={registroEstamentoFilter}
                onChange={(e) => setRegistroEstamentoFilter(e.target.value)}
              >
                <option value="ALL">Todos los Estamentos</option>
                <option value="PADRES_APODERADOS">Padres y Apoderados</option>
                <option value="DOCENTES">Docentes</option>
                <option value="ASISTENTES">Asistentes Educación</option>
                <option value="DIRECTIVOS">Directivos</option>
              </select>

              <select
                className="h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0b5294] bg-white max-w-xs"
                value={registroRbdFilter}
                onChange={(e) => setRegistroRbdFilter(e.target.value)}
              >
                <option value="ALL">Todos los Colegios (RBD)</option>
                {availableSchools.map((sch) => (
                  <option key={sch.rbd} value={sch.rbd}>
                    {sch.nombre} (RBD {sch.rbd})
                  </option>
                ))}
              </select>
            </div>

            {/* Tabla de Registros */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Folio Único</th>
                      <th className="py-3 px-4">RUN Votante</th>
                      <th className="py-3 px-4">Correo Acreditado</th>
                      <th className="py-3 px-4">Estamento</th>
                      <th className="py-3 px-4">Establecimiento Educacional</th>
                      <th className="py-3 px-4">Fecha / Hora Sufragio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {loadingRegistro ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                          Cargando registro oficial de sufragios...
                        </td>
                      </tr>
                    ) : registroRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                          No hay sufragios registrados bajo los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      registroRecords.map((r) => (
                        <tr key={r.folio} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-mono font-bold text-blue-900 whitespace-nowrap">
                            <span className="bg-blue-50 text-blue-800 px-2.5 py-1 rounded border border-blue-200">
                              {r.folio}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {r.formattedRutVotante}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">{r.emailRegistrado}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {r.estamento}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {r.nombreEstablecimiento}{' '}
                            <span className="text-[10px] text-slate-400 font-mono">(RBD {r.rbdEstablecimiento})</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono whitespace-nowrap">
                            {r.fechaHoraFormateada}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* PESTAÑA 4: AUDITORÍA DE SEGURIDAD Y LOGS                            */}
        {/* ==================================================================== */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                📜 Registro de Auditoría e Incidentes de Seguridad
              </h2>
            </div>
            <div className="divide-y divide-slate-100 font-mono text-xs">
              {auditLog.length === 0 ? (
                <div className="p-6 text-center text-slate-400">Sin eventos registrados.</div>
              ) : (
                auditLog.map((log, i) => (
                  <div key={i} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <span className="text-slate-500">{new Date(log.ts).toLocaleString('es-CL')}</span>
                    <span className="font-bold text-slate-800">{log.event}</span>
                    <span className="text-slate-600">{log.ip}</span>
                    <span className="text-slate-500 max-w-xs truncate">{log.detail || '—'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* PESTAÑA 5: VARIABLES Y DIAGNÓSTICO MICROSOFT AZURE AD / GRAPH M365   */}
        {/* ==================================================================== */}
        {activeTab === 'azure' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>⚙️ Módulo de Interacción Microsoft Azure AD & Graph API (M365)</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Configuración de credenciales de seguridad OAuth 2.0 Client Credentials Grant y prueba de latencia en tiempo real.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      useSimulation
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {useSimulation ? '🧪 Modo Simulación Local Activo' : '🌐 Modo Producción M365 Real'}
                  </span>
                </div>
              </div>

              {/* Conmutador Modo Simulación vs Producción */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Modo de Operación del Servicio M365</h3>
                  <p className="text-[11px] text-slate-500">
                    En Modo Simulación los tokens OTP y Enlaces Mágicos se generan localmente sin consumir la cuota de Azure AD.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setUseSimulation(!useSimulation)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition shadow-sm ${
                    useSimulation
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {useSimulation ? '⚡ Cambiar a Modo Producción Real' : '🧪 Cambiar a Modo Simulación'}
                </button>
              </div>

              {/* Formulario Credenciales Azure */}
              <form onSubmit={handleTestAzureConnection} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-1 font-bold text-slate-700">
                    <span>AZURE_TENANT_ID *</span>
                    <input
                      type="text"
                      className="h-10 px-3 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#0b5294]"
                      value={azureTenantId}
                      onChange={(e) => setAzureTenantId(e.target.value)}
                      placeholder="72f988bf-86f1-41af-91ab-2d7cd011db47"
                      required
                    />
                  </label>

                  <label className="grid gap-1 font-bold text-slate-700">
                    <span>AZURE_CLIENT_ID (App Registration) *</span>
                    <input
                      type="text"
                      className="h-10 px-3 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#0b5294]"
                      value={azureClientId}
                      onChange={(e) => setAzureClientId(e.target.value)}
                      placeholder="00000000-0000-0000-0000-000000000000"
                      required
                    />
                  </label>

                  <label className="grid gap-1 font-bold text-slate-700">
                    <span>AZURE_CLIENT_SECRET *</span>
                    <input
                      type="password"
                      className="h-10 px-3 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#0b5294]"
                      value={azureClientSecret}
                      onChange={(e) => setAzureClientSecret(e.target.value)}
                      placeholder="••••••••••••••••••••••••"
                      required
                    />
                  </label>

                  <label className="grid gap-1 font-bold text-slate-700">
                    <span>CASILLA_SLEP_EMAIL (Remitente Autorizado M365) *</span>
                    <input
                      type="email"
                      className="h-10 px-3 rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:border-[#0b5294]"
                      value={casillaEmail}
                      onChange={(e) => setCasillaEmail(e.target.value)}
                      placeholder="votaciones@sleppunillacordillera.cl"
                      required
                    />
                  </label>
                </div>

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTestSendMail}
                    disabled={sendingTestMail}
                    className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-2 shadow-md disabled:opacity-50"
                  >
                    <span>✉️</span>
                    {sendingTestMail ? 'Despachando Correo...' : 'Enviar Correo de Acreditación de Prueba'}
                  </button>

                  <button
                    type="submit"
                    disabled={testingConn}
                    className="h-10 px-5 rounded-xl bg-[#0b5294] hover:bg-[#0a4278] text-white font-bold transition flex items-center gap-2 shadow-md disabled:opacity-50"
                  >
                    <span className={testingConn ? 'animate-spin' : ''}>⚡</span>
                    {testingConn ? 'Probando Conexión Azure AD...' : 'Probar Conexión Microsoft Azure AD'}
                  </button>
                </div>
              </form>

              {/* Resultado Despacho Correo M365 */}
              {testMailResult ? (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 transition ${
                    testMailResult.success
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                      : 'bg-red-50/80 border-red-300 text-red-900'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between text-sm">
                    <span>{testMailResult.success ? '✅ Correo Despachado Exitosamente' : '⚠️ Error al Enviar Correo'}</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded border font-mono font-bold uppercase">
                      Modo: {testMailResult.mode || (useSimulation ? 'Simulación' : 'Producción')}
                    </span>
                  </div>
                  <p className="font-medium">{testMailResult.message}</p>
                  {testMailResult.otp ? (
                    <div className="bg-slate-900 text-white p-3 rounded-xl font-mono text-[11px] space-y-1">
                      <div>🔑 Código OTP generado: <strong className="text-amber-400 font-extrabold text-sm">{testMailResult.otp}</strong> (Válido por 10 min)</div>
                      <div>🔐 Magic Token: <span className="text-emerald-400">{testMailResult.magicToken}</span></div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Resultado Diagnóstico y Latencia */}
              {connTestResult ? (
                <div
                  className={`p-4 rounded-xl border text-xs space-y-2 transition ${
                    connTestResult.success
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                      : 'bg-red-50/80 border-red-300 text-red-900'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-sm">
                      {connTestResult.success ? '🟢 Conexión Exitosa' : '🔴 Fallo de Conexión'}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-white font-mono font-extrabold shadow-sm border">
                      ⏱️ Latencia: {connTestResult.latencyMs} ms
                    </span>
                  </div>

                  <p className="font-medium">{connTestResult.message}</p>

                  {connTestResult.accessTokenSample ? (
                    <div className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Bearer Token Access Sample (JWT):</span>
                      {connTestResult.accessTokenSample}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* PESTAÑA 6: DESPLIEGUE EN NUBE (AZURE APP SERVICE / DOCKER)           */}
        {/* ==================================================================== */}
        {activeTab === 'cloud' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>☁️ Generador de Scripts para Despliegue en Azure Nube</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Script oficial pre-configurado de Azure CLI para desplegar en Azure App Service o Azure Container Instances (ACI).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={copyAzureScript}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                >
                  <span>{scriptCopied ? '✅ Copiado' : '📋 Copiar Script Azure CLI'}</span>
                </button>
              </div>

              {/* Visor del Script de Azure CLI */}
              <div className="relative">
                <pre className="bg-slate-900 text-emerald-400 p-5 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                  <code>{generatedAzureScript}</code>
                </pre>
              </div>

              {/* Visor de Dockerfile */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  🐳 Dockerfile Multietapa (Producción Recomendada)
                </h3>
                <pre className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700">
                  {`FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALES ANTERIORES PRESERVADOS COMPLETO */}
      {showUploadModal ? (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>📤 Cargar Padrón Electoral (Excel .xlsm / .xlsx)</span>
              </h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 font-bold"
                onClick={() => setShowUploadModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadExcel} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-[#0b5294] rounded-2xl p-6 text-center transition bg-slate-50/50">
                <input
                  type="file"
                  accept=".xlsx,.xlsm,.xls"
                  className="hidden"
                  id="excel-file-input"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="excel-file-input" className="cursor-pointer space-y-2 block">
                  <span className="text-3xl block">📊</span>
                  <span className="text-xs font-bold text-slate-700 block">
                    {uploadFile ? uploadFile.name : 'Haz clic para seleccionar el archivo Excel'}
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Formatos soportados: Microsoft Excel (.xlsm o .xlsx)
                  </span>
                </label>
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                  ⚠️ {uploadError}
                </div>
              )}

              {uploadResult && (
                <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-xs space-y-2 border border-emerald-200">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <span>✅ Ingesta Finalizada Exitosamente</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-white p-2 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block">Filas Leídas</span>
                      <span className="font-extrabold text-slate-800">{uploadResult.totalFilas}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block">Insertadas</span>
                      <span className="font-extrabold text-emerald-700">{uploadResult.registrosInsertados}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-slate-500 block">Rechazadas</span>
                      <span className="font-extrabold text-red-600">{uploadResult.registrosRechazados}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || uploading}
                  className="px-5 py-2 rounded-xl bg-[#0b5294] text-white font-bold text-xs hover:bg-[#0a4278] transition disabled:opacity-50"
                >
                  {uploading ? 'Procesando...' : 'Iniciar Ingesta Masiva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showAddVoterModal ? (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                👤 Agregar Votante al Padrón
              </h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 font-bold"
                onClick={() => setShowAddVoterModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVoterManual} className="space-y-3 text-xs">
              <label className="grid gap-1 font-bold text-slate-700">
                <span>Estamento (Decreto 102)</span>
                <select
                  className="h-10 px-3 rounded-xl border border-slate-300 font-semibold"
                  value={newEstamento}
                  onChange={(e) => setNewEstamento(e.target.value as EstamentoDecreto102)}
                >
                  <option value="ESTUDIANTES">Estudiantes</option>
                  <option value="PADRES_APODERADOS">Padres y Apoderados</option>
                  <option value="DOCENTES">Docentes</option>
                  <option value="ASISTENTES">Asistentes de la Educación</option>
                  <option value="DIRECTIVOS">Directivos</option>
                </select>
              </label>

              <label className="grid gap-1 font-bold text-slate-700">
                <span>RUN del Votante</span>
                <input
                  type="text"
                  className="h-10 px-3 rounded-xl border border-slate-300 font-mono text-sm"
                  placeholder="12345678-9"
                  value={newRutVotante}
                  onChange={(e) => setNewRutVotante(e.target.value)}
                  required
                />
                {newRutVotante ? (
                  <span className={`text-[11px] font-normal ${rutValidation.valid ? 'text-emerald-600' : 'text-red-500'}`}>
                    {rutValidation.valid ? `✓ Validado: ${rutValidation.formattedRut}` : `⚠️ ${rutValidation.errorReason}`}
                  </span>
                ) : null}
              </label>

              {newEstamento === 'PADRES_APODERADOS' ? (
                <label className="grid gap-1 font-bold text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <span>RUN del Estudiante Asociado (Obligatorio)</span>
                  <input
                    type="text"
                    className="h-10 px-3 rounded-xl border border-amber-300 font-mono text-sm bg-white"
                    placeholder="23456789-2"
                    value={newRutEstudiante}
                    onChange={(e) => setNewRutEstudiante(e.target.value)}
                    required
                  />
                  {studentRutValidation ? (
                    <span className={`text-[11px] font-normal ${studentRutValidation.valid ? 'text-emerald-600' : 'text-red-500'}`}>
                      {studentRutValidation.valid ? `✓ Validado: ${studentRutValidation.formattedRut}` : `⚠️ ${studentRutValidation.errorReason}`}
                    </span>
                  ) : null}
                </label>
              ) : null}

              <label className="grid gap-1 font-bold text-slate-700">
                <span>Nombre Completo</span>
                <input
                  type="text"
                  className="h-10 px-3 rounded-xl border border-slate-300 font-sans"
                  placeholder="Ej: Juan Pérez Morales"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 font-bold text-slate-700">
                  <span>RBD Colegio</span>
                  <input
                    type="text"
                    className="h-10 px-3 rounded-xl border border-slate-300 font-mono"
                    placeholder="10202"
                    value={newRbd}
                    onChange={(e) => setNewRbd(e.target.value)}
                    required
                  />
                </label>

                <label className="grid gap-1 font-bold text-slate-700">
                  <span>Nombre Colegio</span>
                  <input
                    type="text"
                    className="h-10 px-3 rounded-xl border border-slate-300 font-sans"
                    placeholder="Escuela Martín Prado"
                    value={newNombreColegio}
                    onChange={(e) => setNewNombreColegio(e.target.value)}
                    required
                  />
                </label>
              </div>

              {addVoterError ? (
                <div className="p-2.5 rounded-xl bg-red-50 text-red-700 font-semibold border border-red-200">
                  ⚠️ {addVoterError}
                </div>
              ) : null}

              {addVoterSuccess ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  ✅ Votante agregado exitosamente al padrón.
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                  onClick={() => setShowAddVoterModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0b5294] text-white font-bold hover:bg-[#0a4278] transition"
                >
                  Guardar Votante
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showCandidateModal ? (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>{editingCandidate ? '✏️ Editar Candidatura' : '👤 Inscribir Nuevo Candidato'}</span>
              </h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 font-bold"
                onClick={() => setShowCandidateModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCandidate} className="space-y-3.5 text-xs">
              <label className="grid gap-1 font-bold text-slate-700">
                <span>Nombre Completo del Candidato *</span>
                <input
                  type="text"
                  className="h-10 px-3 rounded-xl border border-slate-300 font-sans"
                  placeholder="Ej: Pablo Reyes Castro"
                  value={formCandNombre}
                  onChange={(e) => setFormCandNombre(e.target.value)}
                  required
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="grid gap-1 font-bold text-slate-700">
                  <span>Estamento *</span>
                  <select
                    className="h-10 px-3 rounded-xl border border-slate-300 font-semibold"
                    value={formCandEstamento}
                    onChange={(e) => setFormCandEstamento(e.target.value as Estamento)}
                  >
                    <option value="directivos">Directivos</option>
                    <option value="docentes">Docentes</option>
                    <option value="asistentes">Asistentes de la Educación</option>
                    <option value="apoderados">Padres y Apoderados</option>
                    <option value="estudiantes">Estudiantes</option>
                  </select>
                </label>

                <label className="grid gap-1 font-bold text-slate-700">
                  <span>Escuela / Establecimiento *</span>
                  <input
                    type="text"
                    className="h-10 px-3 rounded-xl border border-slate-300 font-sans"
                    placeholder="Ej: Liceo Bicentenario"
                    value={formCandEscuela}
                    onChange={(e) => setFormCandEscuela(e.target.value)}
                    required
                  />
                </label>
              </div>

              <label className="grid gap-1 font-bold text-slate-700">
                <span>Propuesta Principal para el Consejo Local *</span>
                <textarea
                  rows={3}
                  className="p-3 rounded-xl border border-slate-300 font-sans focus:outline-none focus:border-[#0b5294]"
                  placeholder="Ej: Priorizar la conectividad digital e infraestructura sustentable..."
                  value={formCandPropuesta}
                  onChange={(e) => setFormCandPropuesta(e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1 font-bold text-slate-700">
                <span>Biografía / Trayectoria</span>
                <textarea
                  rows={3}
                  className="p-3 rounded-xl border border-slate-300 font-sans focus:outline-none focus:border-[#0b5294]"
                  placeholder="Breve reseña personal y profesional del candidato..."
                  value={formCandBiografia}
                  onChange={(e) => setFormCandBiografia(e.target.value)}
                />
              </label>

              <label className="grid gap-1 font-bold text-slate-700">
                <span>URL Foto de Perfil (Opcional)</span>
                <input
                  type="url"
                  className="h-10 px-3 rounded-xl border border-slate-300 font-mono text-xs"
                  placeholder="https://..."
                  value={formCandFoto}
                  onChange={(e) => setFormCandFoto(e.target.value)}
                />
              </label>

              {formCandFoto ? (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formCandFoto}
                    alt="Vista previa"
                    className="w-12 h-12 rounded-full object-cover border shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
                    }}
                  />
                  <span className="text-[11px] text-slate-500 font-medium">Vista previa de la foto de perfil</span>
                </div>
              ) : null}

              {candError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 font-semibold border border-red-200">
                  ⚠️ {candError}
                </div>
              )}

              {candSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  ✅ Candidatura guardada exitosamente.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                  onClick={() => setShowCandidateModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCandidate}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {savingCandidate ? 'Guardando...' : editingCandidate ? 'Actualizar Candidato' : 'Inscribir Candidato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showDeleteCandModal && candidateToDelete ? (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 text-2xl flex items-center justify-center mx-auto">
              🗑️
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">¿Eliminar Candidatura?</h3>
              <p className="text-xs text-slate-600">
                ¿Estás seguro de que deseas eliminar la candidatura de{' '}
                <strong className="text-slate-900">{candidateToDelete.nombreCompleto || candidateToDelete.name}</strong>?
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => setShowDeleteCandModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingCandidate}
                onClick={handleConfirmDeleteCandidate}
                className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition disabled:opacity-50"
              >
                {deletingCandidate ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Confirmación de Reinicio Electoral con Clave Administrador */}
      {showResetElectionModal ? (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200 grid gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 border-b pb-3 border-red-100">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="text-lg font-bold font-serif text-slate-900 m-0 leading-tight">
                  Reiniciar Proceso Electoral
                </h3>
                <p className="text-xs text-red-600 font-semibold m-0 mt-0.5">
                  Acción de alta seguridad de Ministro de Fe
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 leading-relaxed font-medium">
              🚨 <strong>ATENCIÓN CRÍTICA:</strong> Esta acción borrará todas las marcas de sufragio emitidas en el padrón electoral y reiniciará a cero la urna electrónica de votos. Esta operación es <strong>IRREVERSIBLE</strong>.
            </div>

            {resetError ? (
              <p className="m-0 p-2.5 rounded-lg text-xs font-bold text-red-700 bg-red-100 border border-red-200">
                {resetError}
              </p>
            ) : null}

            <form onSubmit={handleResetElection} className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Ingresa tu Clave de Administrador (PIN):
                </span>
                <input
                  type="password"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
                  placeholder="Clave Admin (ej: admin1234)"
                  value={resetAdminPin}
                  onChange={(e) => setResetAdminPin(e.target.value)}
                  autoFocus
                  required
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetElectionModal(false);
                    setResetAdminPin('');
                    setResetError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  disabled={resettingElection}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resettingElection || !resetAdminPin.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md transition disabled:opacity-50"
                >
                  {resettingElection ? 'Reiniciando...' : '🔥 Confirmar Reinicio Electoral'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
