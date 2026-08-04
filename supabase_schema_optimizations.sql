-- ============================================================================
-- OPTIMIZACIONES DE BASE DE DATOS SUPABASE / POSTGRESQL PARA ALTA CONCURRENCIA
-- Sistema de Votación del Consejo Local SLEP
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLAS PRINCIPALES (Creación idempotente con IF NOT EXISTS)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bd_padron (
  rut_votante TEXT PRIMARY KEY,
  formatted_rut_votante TEXT,
  rut_estudiante_asociado TEXT,
  formatted_rut_estudiante TEXT,
  nombre_completo TEXT NOT NULL,
  estamento TEXT NOT NULL,
  rbd_establecimiento TEXT NOT NULL,
  nombre_establecimiento TEXT NOT NULL,
  habilitado BOOLEAN DEFAULT TRUE,
  ha_votado BOOLEAN DEFAULT FALSE,
  fecha_voto TIMESTAMPTZ,
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
  folio TEXT UNIQUE NOT NULL,
  rut_votante TEXT NOT NULL,
  formatted_rut_votante TEXT,
  email_registrado TEXT NOT NULL,
  fecha_hora TIMESTAMPTZ DEFAULT NOW(),
  estamento TEXT NOT NULL,
  rbd_establecimiento TEXT NOT NULL,
  nombre_establecimiento TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. ÍNDICES ESTRATÉGICOS DE ALTO RENDIMIENTO (B-TREE Y GIN TRIGRAM)
-- ----------------------------------------------------------------------------

-- Acelera la autenticación, búsqueda e identificación de votantes por RUT y Filtros
CREATE INDEX IF NOT EXISTS idx_padron_rut_clean ON bd_padron(rut_votante);
CREATE INDEX IF NOT EXISTS idx_padron_estamento ON bd_padron(estamento);
CREATE INDEX IF NOT EXISTS idx_padron_rbd ON bd_padron(rbd_establecimiento);
CREATE INDEX IF NOT EXISTS idx_padron_rbd_estamento ON bd_padron(rbd_establecimiento, estamento);
CREATE INDEX IF NOT EXISTS idx_padron_ha_votado ON bd_padron(ha_votado);

-- Búsquedas de texto ultra rápidas por nombre o RUT usando pg_trgm (GIN)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_padron_nombre_trgm ON bd_padron USING gin (nombre_completo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_padron_rut_trgm ON bd_padron USING gin (rut_votante gin_trgm_ops);

-- Acelera el conteo del escrutinio y la auditoría de urnas anónimas
CREATE INDEX IF NOT EXISTS idx_votos_candidate ON votos_anonimos(candidate_id);
CREATE INDEX IF NOT EXISTS idx_votos_estamento ON votos_anonimos(estamento);

-- Acelera las búsquedas en el registro oficial de sufragio
CREATE INDEX IF NOT EXISTS idx_acta_rut ON acta_sufragio(rut_votante);
CREATE INDEX IF NOT EXISTS idx_acta_folio ON acta_sufragio(folio);
CREATE INDEX IF NOT EXISTS idx_acta_estamento ON acta_sufragio(estamento);

-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS (ROW LEVEL SECURITY) Y SEGURIDAD ESTRUCTURAL
-- ----------------------------------------------------------------------------

ALTER TABLE bd_padron ENABLE ROW LEVEL SECURITY;
ALTER TABLE votos_anonimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acta_sufragio ENABLE ROW LEVEL SECURITY;

-- Denegar lecturas y escrituras directas desde la API Pública (anon / authenticated) a la Urna Anónima
DROP POLICY IF EXISTS deny_public_access_votos_anonimos ON votos_anonimos;
CREATE POLICY deny_public_access_votos_anonimos ON votos_anonimos
  FOR ALL
  TO anon, authenticated
  USING (false);

-- Denegar lecturas públicas a las actas nominativas
DROP POLICY IF EXISTS deny_public_access_acta_sufragio ON acta_sufragio;
CREATE POLICY deny_public_access_acta_sufragio ON acta_sufragio
  FOR ALL
  TO anon, authenticated
  USING (false);

-- Permitir lecturas del padrón solo para consulta de habilitación propia
DROP POLICY IF EXISTS allow_read_padron_by_service_role ON bd_padron;
CREATE POLICY allow_read_padron_by_service_role ON bd_padron
  FOR ALL
  TO service_role
  USING (true);

-- ----------------------------------------------------------------------------
-- 4. PROCEDIMIENTO ALMACENADO ATÓMICO (RPC): EMISIÓN DE VOTO SEGURO
-- Garantiza ACID, previene doble voto con SELECT ... FOR UPDATE y registra el sufragio
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION emitir_voto_atomico(
  p_rut TEXT,
  p_candidate_id TEXT,
  p_estamento TEXT,
  p_rbd TEXT,
  p_nombre_establecimiento TEXT,
  p_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_already_voted BOOLEAN;
  v_habilitado BOOLEAN;
  v_folio TEXT;
  v_receipt_code TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Bloquear y verificar la fila del votante (FOR UPDATE previene condiciones de carrera)
  SELECT ha_votado, habilitado INTO v_already_voted, v_habilitado
  FROM bd_padron
  WHERE LOWER(rut_votante) = LOWER(p_rut)
  FOR UPDATE;

  -- Validaciones
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Votante con RUT % no fue encontrado en el padrón electoral.', p_rut;
  END IF;

  IF v_habilitado IS FALSE THEN
    RAISE EXCEPTION 'El votante se encuentra inhabilitado para participar en este proceso.';
  END IF;

  IF v_already_voted IS TRUE THEN
    RAISE EXCEPTION 'El elector ya ha emitido su voto en esta elección.';
  END IF;

  -- Generar Folio y Código de Comprobante Único (Hora Oficial Chile Continental America/Santiago)
  v_receipt_code := 'SLEP-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  v_folio := 'FOLIO-' || TO_CHAR(v_now AT TIME ZONE 'America/Santiago', 'YYYYMMDD-HH24MISS') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

  -- 2. Marcar al votante como "ha votado"
  UPDATE bd_padron
  SET 
    ha_votado = TRUE,
    fecha_voto = v_now
  WHERE LOWER(rut_votante) = LOWER(p_rut);

  -- 3. Depositar en la urna anónima
  INSERT INTO votos_anonimos (
    candidate_id,
    estamento,
    created_at
  ) VALUES (
    p_candidate_id,
    p_estamento,
    v_now
  );

  -- 4. Registrar en el Acta de Sufragio Oficial (participación auditable sin sentido del voto)
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
    p_rut,
    p_rut,
    p_email,
    v_now,
    p_estamento,
    p_rbd,
    p_nombre_establecimiento
  );

  -- Retornar comprobante exitoso en JSON
  RETURN jsonb_build_object(
    'success', true,
    'receiptCode', v_receipt_code,
    'folio', v_folio,
    'timestamp', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- TABLA MAESTRO DE ESTABLECIMIENTOS EDUCACIONALES OFICIALES (BASE TEÓRICA POR RBD)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bd_establecimientos_maestro (
    rbd VARCHAR(20) PRIMARY KEY,
    nombre_oficial TEXT NOT NULL,
    comuna TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_establecimientos_maestro_rbd ON bd_establecimientos_maestro(rbd);

ALTER TABLE bd_establecimientos_maestro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de catálogo maestro" ON bd_establecimientos_maestro
    FOR SELECT USING (true);

CREATE POLICY "Administración total de catálogo maestro" ON bd_establecimientos_maestro
    FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- TABLA DE CONFIGURACIÓN Y PROGRAMACIÓN ELECTORAL (ESTAMENTOS Y VENTANA DE HORARIO)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bd_configuracion_eleccion (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'config_principal',
    titulo_proceso TEXT NOT NULL DEFAULT 'Elección de Representantes del Consejo Local SLEP',
    estamentos_habilitados JSONB NOT NULL DEFAULT '["ESTUDIANTES","PADRES_APODERADOS","DOCENTES","ASISTENTES","DIRECTIVOS"]'::jsonb,
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_fin TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    estado_eleccion TEXT NOT NULL DEFAULT 'ABIERTA',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bd_configuracion_eleccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de configuración electoral" ON bd_configuracion_eleccion
    FOR SELECT USING (true);

CREATE POLICY "Administración total de configuración electoral" ON bd_configuracion_eleccion
    FOR ALL USING (auth.role() = 'service_role');


