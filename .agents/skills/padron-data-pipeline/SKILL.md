---
name: padron-data-pipeline
description: Ingesta, parseo de planillas Excel/CSV, procesamiento por lotes (chunking), validación estricta de RUT (módulo 11) y normalización de establecimientos educacionales (RBD) para el padrón electoral escolar.
triggers:
  - "cargar padron"
  - "importar excel"
  - "normalizar rut"
  - "chunking padron"
  - "validar estamentos"
  - "schools master"
---

# Padrón Data Pipeline Skill

## Propósito
Guiar la manipulación, procesamiento masivo y resolución de discrepancias en las nóminas y padrones electorales de establecimientos educacionales pertenecientes a un Servicio Local de Educación Pública.

## 1. Mapeo de Columnas Aceptadas en Excel
El parser (`src/lib/padron-parser.ts` y `src/lib/padron-store.ts`) soporta variantes de nombres de columnas:
- **RUT Votante:** `RUT`, `RUN`, `RUT_VOTANTE`, `RUT_TITULAR`, `DOCUMENTO`.
- **Nombre Completo:** `NOMBRE`, `NOMBRES`, `NOMBRE_COMPLETO`, `NOMBRE_APODERADO`, `FUNCIONARIO`.
- **Estamento:** `ESTAMENTO`, `TIPO`, `ROL`, `CARGO`, `CATEGORIA`. Normalizar siempre con `normalizeEstamentoDecreto102()`.
- **Establecimiento:** `RBD`, `COLEGIO`, `ESTABLECIMIENTO`, `ESCUELA`, `LICEO`.
- **RUT Estudiante (Sólo Apoderados):** `RUT_ESTUDIANTE`, `RUT_ALUMNO`, `RUN_ESTUDIANTE`, `RUT_PUPILO`.

## 2. Ingesta por Lotes (Chunking)
- Para nóminas grandes (> 5,000 registros), utilizar la API `upload-chunk` (`processPadronChunkAsync`) en bloques de 500 a 1,000 filas.
- Previene timeouts en funciones serverless y reduce el uso de memoria en Node.js.

## 3. Limpieza y Validación de RUT
- Siempre utilizar `cleanAndValidateRUT(rut)` de `src/lib/rut-validator.ts`.
- Descartar puntos, guiones y caracteres de control.
- Validar dígito verificador mediante algoritmo de Módulo 11 oficial de Chile.

## 4. Cruce con Catálogo Maestro de Colegios (`bd_establecimientos_maestro`)
- Si el Excel trae RBD, verificar existencia o registrar en el maestro para evitar discrepancias en reportes consolidados por colegio.
