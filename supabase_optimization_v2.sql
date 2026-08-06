-- ============================================================================
-- SCRIPT DE MIGRACIÓN Y OPTIMIZACIÓN V2 PARA SUPABASE / POSTGRESQL
-- Sistema de Votación del Consejo Local SLEP
-- Archivo: supabase_optimization_v2.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ESTRUCTURA DE TABLAS PRINCIPALES (Creación idempotente)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bd_establecimientos_maestro (
    rbd VARCHAR(20) PRIMARY KEY,
    nombre_oficial TEXT NOT NULL,
    comuna TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bd_padron (
  rut_votante TEXT NOT NULL,
  formatted_rut_votante TEXT,
  rut_estudiante_asociado TEXT,
  formatted_rut_estudiante TEXT,
  nombre_completo TEXT NOT NULL,
  estamento TEXT NOT NULL,
  rbd_establecimiento TEXT NOT NULL,
  nombre_establecimiento TEXT NOT NULL,
  slep_id TEXT DEFAULT 'slep-valle-diguillin',
  habilitado BOOLEAN DEFAULT TRUE,
  ha_votado BOOLEAN DEFAULT FALSE,
  fecha_voto TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT pk_bd_padron PRIMARY KEY (rut_votante, estamento)
);

CREATE TABLE IF NOT EXISTS candidatos (
  id TEXT PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  cargo_role TEXT,
  slogan_propuesta TEXT,
  iniciales TEXT,
  color_acento TEXT DEFAULT '#0b5294',
  estamento TEXT NOT NULL,
  biografia TEXT DEFAULT '',
  foto_perfil TEXT,
  votos_acumulados INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS votos_anonimos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id TEXT NOT NULL,
  estamento TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS acta_sufragio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL,
  rut_votante TEXT NOT NULL,
  formatted_rut_votante TEXT,
  email_registrado TEXT NOT NULL,
  fecha_hora TIMESTAMPTZ DEFAULT NOW(),
  estamento TEXT NOT NULL,
  rbd_establecimiento TEXT NOT NULL,
  nombre_establecimiento TEXT NOT NULL,
  CONSTRAINT unique_acta_rut_estamento UNIQUE (rut_votante, estamento)
);

CREATE TABLE IF NOT EXISTS bd_configuracion_eleccion (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'config_principal',
    titulo_proceso TEXT NOT NULL DEFAULT 'Elección de Representantes del Consejo Local SLEP',
    estamentos_habilitados JSONB NOT NULL DEFAULT '["ESTUDIANTES","PADRES_APODERADOS","DOCENTES","ASISTENTES","DIRECTIVOS"]'::jsonb,
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_fin TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    estado_eleccion TEXT NOT NULL DEFAULT 'ABIERTA',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. ÍNDICES B-TREE Y GIN ESTRATÉGICOS DE ALTO RENDIMIENTO
-- ----------------------------------------------------------------------------

-- Índices en bd_padron
CREATE INDEX IF NOT EXISTS idx_padron_rut_clean ON bd_padron(rut_votante);
CREATE INDEX IF NOT EXISTS idx_padron_formatted_rut ON bd_padron(formatted_rut_votante);
CREATE INDEX IF NOT EXISTS idx_padron_rbd_estamento_voted ON bd_padron(rbd_establecimiento, estamento, ha_votado);
CREATE INDEX IF NOT EXISTS idx_padron_estamento ON bd_padron(estamento);
CREATE INDEX IF NOT EXISTS idx_padron_rbd ON bd_padron(rbd_establecimiento);

-- Búsquedas de texto rápido usando pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_padron_nombre_trgm ON bd_padron USING gin (nombre_completo gin_trgm_ops);

-- Índices en votos_anonimos
CREATE INDEX IF NOT EXISTS idx_votos_candidate_estamento ON votos_anonimos(candidate_id, estamento);
CREATE INDEX IF NOT EXISTS idx_votos_created_at_desc ON votos_anonimos(created_at DESC);

-- Índices en acta_sufragio
CREATE INDEX IF NOT EXISTS idx_acta_fecha_hora_desc ON acta_sufragio(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_acta_rut_estamento ON acta_sufragio(rut_votante, estamento);

-- Índice en catálogo maestro
CREATE INDEX IF NOT EXISTS idx_establecimientos_maestro_rbd ON bd_establecimientos_maestro(rbd);

-- ----------------------------------------------------------------------------
-- 3. VISTA PARA DASHBOARD DE ESCUELAS (GARANTIZA 131 ESTABLECIMIENTOS)
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS vista_dashboard_escuelas CASCADE;

CREATE OR REPLACE VIEW vista_dashboard_escuelas AS
SELECT 
    m.rbd,
    m.nombre_oficial,
    m.comuna,
    COUNT(DISTINCT p.rut_votante) AS total_padron_unicos,
    COUNT(DISTINCT CASE WHEN p.ha_votado = TRUE THEN p.rut_votante END) AS total_votos_emitidos_unicos,
    CASE 
        WHEN COUNT(DISTINCT p.rut_votante) > 0 
        THEN ROUND((COUNT(DISTINCT CASE WHEN p.ha_votado = TRUE THEN p.rut_votante END)::NUMERIC / COUNT(DISTINCT p.rut_votante)::NUMERIC) * 100, 1)
        ELSE 0 
    END AS porcentaje_participacion
FROM bd_establecimientos_maestro m
LEFT JOIN bd_padron p ON TRIM(m.rbd) = TRIM(p.rbd_establecimiento) AND p.habilitado = TRUE
GROUP BY m.rbd, m.nombre_oficial, m.comuna
ORDER BY m.rbd ASC;

-- Función RPC para conteo de electores únicos del territorio
CREATE OR REPLACE FUNCTION obtener_resumen_padron_unico()
RETURNS TABLE (
  total_electores_unicos BIGINT,
  total_votaron_unicos BIGINT,
  porcentaje_participacion NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT rut_votante) AS total_electores_unicos,
    COUNT(DISTINCT CASE WHEN ha_votado = TRUE THEN rut_votante END) AS total_votaron_unicos,
    ROUND(
      (COUNT(DISTINCT CASE WHEN ha_votado = TRUE THEN rut_votante END)::DECIMAL / 
      NULLIF(COUNT(DISTINCT rut_votante), 0)) * 100, 1
    ) AS porcentaje_participacion
  FROM bd_padron
  WHERE habilitado = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. PROCEDIMIENTO ALMACENADO ATÓMICO (RPC): EMISIÓN DE VOTO MULTIRROL
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION emitir_voto_atomico(
  p_rut TEXT,
  p_candidate_id TEXT,
  p_estamento TEXT,
  p_rbd TEXT DEFAULT NULL,
  p_nombre_establecimiento TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_already_voted_acta BOOLEAN;
  v_already_voted_padron BOOLEAN;
  v_habilitado BOOLEAN;
  v_folio TEXT;
  v_receipt_code TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_clean_rut TEXT := LOWER(TRIM(REGEXP_REPLACE(p_rut, '[^0-9kK]', '', 'g')));
  v_clean_estamento TEXT := UPPER(TRIM(p_estamento));
BEGIN
  -- 1. Verificar si ya existe un registro en el acta para esta dupla (RUT_LIMPIO, ESTAMENTO) [Bloqueo Multirrol / Multiescuela]
  SELECT EXISTS (
    SELECT 1 FROM acta_sufragio
    WHERE LOWER(TRIM(REGEXP_REPLACE(rut_votante, '[^0-9kK]', '', 'g'))) = v_clean_rut
      AND UPPER(TRIM(estamento)) = v_clean_estamento
  ) INTO v_already_voted_acta;

  IF v_already_voted_acta IS TRUE THEN
    RAISE EXCEPTION 'ALREADY_VOTED: El elector ya ha registrado su voto en esta elección para el estamento %.', p_estamento;
  END IF;

  -- 2. Verificar y bloquear las filas del padrón correspondientes a (RUT_LIMPIO, ESTAMENTO)
  SELECT 
    EXISTS (
      SELECT 1 FROM bd_padron
      WHERE LOWER(TRIM(REGEXP_REPLACE(rut_votante, '[^0-9kK]', '', 'g'))) = v_clean_rut
        AND UPPER(TRIM(estamento)) = v_clean_estamento
        AND ha_votado = TRUE
    ),
    COALESCE(BOOL_OR(habilitado), TRUE)
  INTO v_already_voted_padron, v_habilitado
  FROM bd_padron
  WHERE LOWER(TRIM(REGEXP_REPLACE(rut_votante, '[^0-9kK]', '', 'g'))) = v_clean_rut
    AND UPPER(TRIM(estamento)) = v_clean_estamento;

  IF v_already_voted_padron IS TRUE THEN
    RAISE EXCEPTION 'ALREADY_VOTED: El elector ya figura como habiendo votado en este estamento.';
  END IF;

  IF v_habilitado IS FALSE THEN
    RAISE EXCEPTION 'VOTANTE_INHABILITADO: El votante se encuentra inhabilitado para participar en este estamento.';
  END IF;

  -- Generar Folio y Código de Comprobante Único
  v_receipt_code := 'SLEP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  v_folio := 'FOLIO-' || TO_CHAR(v_now AT TIME ZONE 'America/Santiago', 'YYYYMMDD-HH24MISS') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

  -- 3. Marcar ha_votado = TRUE en TODAS las filas de bd_padron para este RUT y estamento (Multiescuela)
  UPDATE bd_padron
  SET 
    ha_votado = TRUE,
    fecha_voto = v_now
  WHERE LOWER(TRIM(REGEXP_REPLACE(rut_votante, '[^0-9kK]', '', 'g'))) = v_clean_rut
    AND UPPER(TRIM(estamento)) = v_clean_estamento;

  -- 4. Depositar voto en la urna anónima
  INSERT INTO votos_anonimos (
    candidate_id,
    estamento,
    created_at
  ) VALUES (
    p_candidate_id,
    p_estamento,
    v_now
  );

  -- 5. Incrementar votos acumulados en la tabla candidatos si existe
  UPDATE candidatos
  SET votos_acumulados = COALESCE(votos_acumulados, 0) + 1
  WHERE id = p_candidate_id;

  -- 6. Registrar en el Acta de Sufragio Oficial con clave compuesta (rut_votante, estamento)
  INSERT INTO acta_sufragio (
    folio,
    rut_votante,
    formatted_rut_votante,
    email_registrado,
    fecha_hora,
    estamento,
    rbd_establecimiento,
    nombre_establecimiento
  ) VALUES (
    v_folio,
    v_clean_rut,
    p_rut,
    COALESCE(p_email, 'sin-correo@slep.cl'),
    v_now,
    p_estamento,
    COALESCE(p_rbd, '10101'),
    COALESCE(p_nombre_establecimiento, 'Establecimiento SLEP')
  )
  ON CONFLICT (rut_votante, estamento) DO NOTHING;

  -- Retornar comprobante exitoso en JSON
  RETURN jsonb_build_object(
    'success', true,
    'receiptCode', v_receipt_code,
    'folio', v_folio,
    'timestamp', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aliasing o alias de función por si la aplicación invoca registrar_voto_atomico
CREATE OR REPLACE FUNCTION registrar_voto_atomico(
  p_candidate_id TEXT,
  p_estamento TEXT,
  p_rut_votante TEXT,
  p_folio TEXT DEFAULT NULL,
  p_rbd TEXT DEFAULT NULL,
  p_nombre_establecimiento TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  RETURN emitir_voto_atomico(
    p_rut_votante,
    p_candidate_id,
    p_estamento,
    p_rbd,
    p_nombre_establecimiento,
    p_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 5. POLÍTICAS RLS (ROW LEVEL SECURITY) Y SEGURIDAD
-- ----------------------------------------------------------------------------

-- Otorga permisos de lectura explícitos a los roles anónimo, autenticado y público
GRANT SELECT ON bd_establecimientos_maestro TO anon, authenticated, service_role, public;
GRANT SELECT ON bd_padron TO anon, authenticated, service_role, public;
GRANT SELECT ON candidatos TO anon, authenticated, service_role, public;
GRANT SELECT ON bd_configuracion_eleccion TO anon, authenticated, service_role, public;
GRANT SELECT ON vista_dashboard_escuelas TO anon, authenticated, service_role, public;

ALTER TABLE bd_padron ENABLE ROW LEVEL SECURITY;
ALTER TABLE votos_anonimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acta_sufragio ENABLE ROW LEVEL SECURITY;
ALTER TABLE bd_establecimientos_maestro ENABLE ROW LEVEL SECURITY;
ALTER TABLE bd_configuracion_eleccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;

-- Lectura pública para la UI de consulta de votantes y catálogo
DROP POLICY IF EXISTS "Lectura pública de padrón" ON bd_padron;
CREATE POLICY "Lectura pública de padrón" ON bd_padron FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Lectura pública de catálogo maestro" ON bd_establecimientos_maestro;
CREATE POLICY "Lectura pública de catálogo maestro" ON bd_establecimientos_maestro FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Lectura pública de candidatos" ON candidatos;
CREATE POLICY "Lectura pública de candidatos" ON candidatos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lectura pública de configuración electoral" ON bd_configuracion_eleccion;
CREATE POLICY "Lectura pública de configuración electoral" ON bd_configuracion_eleccion FOR SELECT USING (true);

-- Bloqueo de RLS estricto para las urnas y actas sufragio
DROP POLICY IF EXISTS deny_public_votos_anonimos ON votos_anonimos;
CREATE POLICY deny_public_votos_anonimos ON votos_anonimos FOR ALL TO anon, authenticated USING (false);

DROP POLICY IF EXISTS deny_public_acta_sufragio ON acta_sufragio;
CREATE POLICY deny_public_acta_sufragio ON acta_sufragio FOR ALL TO anon, authenticated USING (false);

-- Permitir todo el acceso al rol service_role (Backend Next.js API Routes)
DROP POLICY IF EXISTS service_role_all_padron ON bd_padron;
CREATE POLICY service_role_all_padron ON bd_padron FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS service_role_all_acta ON acta_sufragio;
CREATE POLICY service_role_all_acta ON acta_sufragio FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS service_role_all_votos ON votos_anonimos;
CREATE POLICY service_role_all_votos ON votos_anonimos FOR ALL TO service_role USING (true);
