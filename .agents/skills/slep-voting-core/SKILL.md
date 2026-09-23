---
name: slep-voting-core
description: Reglas de negocio y arquitectura del flujo electoral escolar SLEP. Garantiza el secreto del sufragio (desvinculación acta/voto), cálculo de quórum Decreto 102, estados de elección y validación de doble emisión.
triggers:
  - "flujo de votacion"
  - "papeleta"
  - "voto secreto"
  - "quorum decreto 102"
  - "acta sufragio"
  - "candidatos"
---

# SLEP Voting Core Skill

## Propósito y Alcance
Este skill proporciona las directrices y estándares para desarrollar, modificar y auditar el flujo de sufragio digital del Consejo Local SLEP.

## 1. Principio Fundamental: Secreto del Voto y Desvinculación
En toda modificación que involucre el registro del voto:
- **`acta_sufragio`**: Registra que el elector (RUT, estamento, RBD, fecha/hora, folio) ejerció su derecho a voto. NUNCA debe contener la opción o candidato elegido.
- **`votos_anonimos`**: Registra únicamente el `estamento`, `candidate_id` y `created_at` (o UUID aleatorio). NUNCA debe vincularse por clave foránea, correlación temporal exacta o metadatos de sesión con el `acta_sufragio` ni con el RUT.
- **`registro_participacion` / `bd_padron.ha_votado`**: Flag booleano de un solo sentido para impedir sufragios duplicados.

## 2. Estamentos Oficiales (Decreto N° 102)
Los 5 estamentos canónicos obligatorios son:
1. `ESTUDIANTES`
2. `PADRES_APODERADOS`
3. `DOCENTES`
4. `ASISTENTES`
5. `DIRECTIVOS`

## 3. Reglas de Quórum y Cálculo de Participación
- Cada estamento tiene un umbral mínimo de participación (por defecto 30% del padrón habilitado para validez del proceso según normativa de Consejos Locales).
- Cálculo: `(votosEmitidos / padronTotal) * 100 >= 30%`.
- El estamento de apoderados puede tener asociación con RUT de estudiante escolar.

## 4. Máquina de Estados del Frontend
Flujo unidireccional:
`intro` -> `login` -> `otp` -> `vote` -> `success`
- Las guardas de estado en `src/app/page.tsx` deben prevenir saltos directos sin sesión válida (`server-session.ts`).
- Límites de tolerancia: 5 intentos fallidos en Login, 3 en OTP.
