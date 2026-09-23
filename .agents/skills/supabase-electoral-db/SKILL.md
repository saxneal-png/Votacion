---
name: supabase-electoral-db
description: Gestión de esquemas PostgreSQL en Supabase, optimización de consultas B-Tree y GIN con pg_trgm, políticas RLS, transacciones atómicas de sufragio y bitácora de auditoría.
triggers:
  - "supabase schema"
  - "migracion sql"
  - "indices postgres"
  - "rls supabase"
  - "voto atomico"
  - "bitacora auditoria"
---

# Supabase Electoral DB Skill

## Propósito
Diseñar, mantener y optimizar la capa de persistencia relacional en Supabase/PostgreSQL para el sistema de votaciones del Consejo Local SLEP.

## 1. Tablas Principales
- `bd_padron`: Llave compuesta `(rut_votante, estamento)`, índices en `(rbd_establecimiento, estamento, ha_votado)` y GIN trigram en `nombre_completo`.
- `acta_sufragio`: Folio único, registro nominal del sufragio (`unique(rut_votante, estamento)`).
- `votos_anonimos`: Depósito de votos anonimizados (`candidate_id`, `estamento`).
- `candidatos`: Catálogo de postulantes con bio, foto y conteo acumulado.
- `bd_establecimientos_maestro`: Catálogo de colegios (RBD, nombre, comuna).
- `bd_configuracion_eleccion`: Control del estado global del proceso electoral.
- `bitacora_auditoria`: Registro inmutable de eventos sensibles con IP y timestamp.

## 2. Garantía de Atomicidad y Concurrencia
- Durante el sufragio (`POST /api/votes`):
  1. Verificar que `bd_padron.ha_votado` sea `false`.
  2. Insertar `acta_sufragio` con folio único.
  3. Marcar `bd_padron.ha_votado = true` con timestamp de voto.
  4. Insertar `votos_anonimos` de forma independiente.
  5. Incrementar `candidatos.votos_acumulados`.

## 3. Seguridad y RLS
- Solo `service_role` / backend (`supabaseAdmin`) tiene privilegios de escritura en padrón, votos y actas.
- El cliente público (`supabaseClient` anónimo) tiene restringido el acceso directo a datos electorales.
