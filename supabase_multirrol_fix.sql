-- =============================================================================
-- SCRIPT: Corrección de Constraint UNIQUE para Voto Multirrol por Estamento
-- Sistema de Votación Electoral
-- Fecha: 2026-08-04
-- =============================================================================
-- 
-- PROBLEMA: Si el constraint de unicidad en acta_sufragio es solo (rut_votante),
--           un usuario Docente+Apoderado queda bloqueado tras emitir su primer voto.
--
-- SOLUCIÓN: Cambiar el constraint a (rut_votante, estamento) para permitir que
--           un votante emita un voto por cada estamento al que pertenezca.
--
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase como usuario admin.
-- =============================================================================

-- 1. Verificar el constraint actual
SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'acta_sufragio'::regclass
  AND contype = 'u';

-- 2. Eliminar el constraint único existente (si existe solo por rut_votante)
--    NOTA: Reemplazar el nombre si difiere en tu instalación.
ALTER TABLE acta_sufragio
  DROP CONSTRAINT IF EXISTS acta_sufragio_rut_votante_key;

ALTER TABLE acta_sufragio
  DROP CONSTRAINT IF EXISTS acta_sufragio_rut_votante_unique;

-- 3. Crear el nuevo constraint compuesto (rut_votante, estamento)
--    Permite 1 voto por estamento por votante, bloqueando duplicados del mismo estamento.
ALTER TABLE acta_sufragio
  ADD CONSTRAINT acta_sufragio_rut_estamento_unique
  UNIQUE (rut_votante, estamento);

-- 4. Actualizar la función RPC emitir_voto_atomico para clave compuesta
CREATE OR REPLACE FUNCTION emitir_voto_atomico(
  p_rut TEXT,
  p_candidate_id TEXT,
  p_estamento TEXT,
  p_rbd TEXT DEFAULT NULL,
  p_nombre_establecimiento TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_padron_record RECORD;
  v_folio TEXT;
  v_receipt_code TEXT;
BEGIN
  -- Verificar que el votante exista y no haya votado en este estamento
  SELECT * INTO v_padron_record
  FROM bd_padron
  WHERE LOWER(TRIM(rut_votante)) = LOWER(TRIM(p_rut))
    AND UPPER(TRIM(estamento)) = UPPER(TRIM(p_estamento))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VOTANTE_NO_ENCONTRADO: El votante no fue encontrado en el padrón para el estamento indicado.';
  END IF;

  IF NOT v_padron_record.habilitado THEN
    RAISE EXCEPTION 'VOTANTE_INHABILITADO: El votante se encuentra inhabilitado para participar.';
  END IF;

  IF v_padron_record.ha_votado THEN
    RAISE EXCEPTION 'ALREADY_VOTED: El votante ya ha emitido su voto para este estamento.';
  END IF;

  -- Generar folio único
  v_folio := 'FOL-' || TO_CHAR(NOW(), 'YYYY') || '-'
             || LPAD(CAST(EXTRACT(EPOCH FROM NOW())::BIGINT % 100000 AS TEXT), 5, '0')
             || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4));
  v_receipt_code := v_folio;

  -- Registrar voto anónimo (sin RUT ni candidato identificable en conjunto)
  INSERT INTO votos_anonimos (estamento, candidate_id, created_at)
  VALUES (p_estamento, p_candidate_id, NOW());

  -- Registrar acta de sufragio con constraint (rut, estamento) para multirrol
  INSERT INTO acta_sufragio (
    folio, rut_votante, email_registrado, estamento,
    rbd_establecimiento, nombre_establecimiento, fecha_hora
  )
  VALUES (
    v_folio, LOWER(TRIM(p_rut)), p_email, p_estamento,
    p_rbd, p_nombre_establecimiento, NOW()
  )
  ON CONFLICT (rut_votante, estamento) DO NOTHING;

  -- Marcar ha_votado = true SOLO para el estamento votado (no afecta otros estamentos del RUT)
  UPDATE bd_padron
  SET ha_votado = true,
      fecha_voto = NOW()
  WHERE LOWER(TRIM(rut_votante)) = LOWER(TRIM(p_rut))
    AND UPPER(TRIM(estamento)) = UPPER(TRIM(p_estamento));

  RETURN json_build_object(
    'success', true,
    'folio', v_folio,
    'receiptCode', v_receipt_code
  );
END;
$$;

-- =============================================================================
-- VERIFICACIÓN FINAL
-- =============================================================================
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'acta_sufragio'::regclass
  AND contype IN ('u', 'p');
