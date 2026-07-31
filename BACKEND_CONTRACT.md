# Contrato de integracion backend ↔ frontend

Documento principal para cualquier equipo que adopte esta maqueta.

Este repositorio entrega una base de frontend funcional, una UX completa y un BFF de referencia en Next.js. No entrega un backend productivo. Todo lo que dependa de autenticacion real, OTP real, padron real, persistencia, voto unico, auditoria, operacion o seguridad productiva debe ser implementado por cada Servicio Local.

Si un SLEP usa este proyecto como punto de partida, debe leer este archivo como contrato tecnico y como checklist de reemplazo del mock.

---

## Objetivo del repositorio

Este proyecto existe para que distintos Servicios Locales puedan:

- Reutilizar la experiencia de usuario del portal de votacion.
- Reutilizar componentes, layout, estados de pantalla y flujo de navegacion.
- Integrar su propio backend sin reescribir el frontend.
- Entender con claridad que parte ya funciona en la maqueta y que parte debe reemplazarse antes de cualquier uso real.

En otras palabras:

- El frontend y la UX son compartidos.
- El backend y la operacion son responsabilidad de cada SLEP.

---

## Alcance: que si entrega esta maqueta

- Pantalla de login con RUT y correo.
- Paso OTP con UI completa.
- Papeleta digital con temporizador, seleccion y confirmacion.
- Vista de exito con comprobante visual.
- Panel administrativo demo con login, metricas y auditoria de ejemplo.
- Rutas internas de Next.js que sirven como BFF de referencia.
- Contratos TypeScript y estructura de integracion.
- Mock funcional para desarrollo local y demostraciones.

## Alcance: que NO entrega esta maqueta

- Backend electoral productivo.
- Integracion con padron institucional real.
- Envio real de OTP por correo, SMS o proveedor corporativo.
- Persistencia distribuida de sesiones o de votos.
- Garantia legal de voto unico productivo.
- Auditoria operativa o cumplimiento normativo final.
- Observabilidad, monitoreo, respaldo o continuidad operacional.

---

## Arquitectura esperada

La arquitectura recomendada para adopcion es esta:

```text
Navegador React
  -> rutas internas /api/* del proyecto Next.js
  -> adaptador servidor / BFF
  -> backend real del Servicio Local
  -> BD / Redis / proveedor OTP / auditoria / servicios internos
```

La UI no deberia hablar directamente con el backend electoral real si eso obliga a exponer secretos, tokens sensibles o logica de elegibilidad al navegador.

---

## Flujo funcional esperado

```text
[1] POST /api/auth/verify-credentials
    valida identidad, inicia sesion y dispara OTP

[2] POST /api/auth/verify-otp
    valida OTP sobre la sesion ya iniciada

[3] GET /api/candidates
    devuelve solo la papeleta correspondiente al padron del votante

[4] POST /api/votes
    registra el voto y devuelve comprobante

[5] DELETE /api/session
    destruye la sesion del flujo de votacion

[6] POST /api/admin/login
    autentica acceso administrativo

[7] GET /api/admin/metrics
    devuelve metricas para dashboard administrativo

[8] GET /api/admin/audit
    devuelve eventos de auditoria

[9] DELETE /api/admin/logout
    cierra la sesion administrativa
```

---

## Que depende del backend y debe cambiar cada SLEP

Esta es la parte central del documento. Todo lo siguiente es responsabilidad del Servicio Local que adopta la maqueta.

### 1. Identidad del votante

Cada SLEP debe decidir:

- Como valida RUT + correo contra su padron.
- Si usa correo institucional, correo personal o ambos.
- Que reglas de elegibilidad aplica.
- Como maneja votantes no encontrados, bloqueados o ya sufragados.

La maqueta hoy solo simula esa validacion.

### 2. OTP

Cada SLEP debe decidir:

- Proveedor de OTP: correo, SMS, proveedor corporativo o sistema interno.
- Tiempo de expiracion del codigo.
- Politica de reenvio.
- Politica de intentos fallidos.
- Registro de auditoria del envio y la validacion.

La maqueta usa OTP fijo en memoria. Eso solo sirve para demo.

### 3. Sesion del flujo de votacion

Cada SLEP debe decidir:

- Si usa cookie httpOnly, sesion opaca en BFF o token interno equivalente.
- Donde persiste la sesion: Redis, KV, BD u otra capa.
- Como invalida la sesion por expiracion, cierre manual, error o voto emitido.
- Como protege las mutaciones frente a CSRF si usa cookie.

La maqueta hoy guarda la sesion en memoria del proceso.

### 4. Padron y candidatos

Cada SLEP debe decidir:

- Como obtiene el padron real.
- Como segmenta por estamento.
- Como administra candidatos, vigencia y metadatos.
- Como versiona elecciones o procesos distintos.

La maqueta usa datos estaticos en archivos TS.

### 5. Registro del voto

Cada SLEP debe decidir:

- Como garantiza voto unico a nivel de BD.
- Como resuelve concurrencia real.
- Como registra comprobante o folio.
- Como evita exponer la preferencia del votante en logs.
- Como modela cierres de proceso, aperturas y estados de eleccion.

La maqueta no reemplaza una transaccion real ni un modelo electoral productivo.

### 6. Panel administrativo

Cada SLEP debe decidir:

- Como autentica administradores.
- Si usa PIN, SSO, LDAP, IdP institucional o MFA.
- Donde persiste auditoria y metricas.
- Que roles pueden ver que informacion.
- Como limita acceso, IPs, sesiones y trazabilidad.

La maqueta usa un admin demo para mostrar la experiencia, no para operar en productivo.

### 7. Seguridad operativa y despliegue

Cada SLEP debe decidir:

- Infraestructura de despliegue.
- Observabilidad, logs y alertas.
- Cifrado en transito y en reposo.
- Politicas de respaldo.
- Continuidad operacional.
- Cumplimiento normativo y legal.

---

## Componentes del repositorio que son solo referencia y deben reemplazarse

| Componente | Archivo | Estado en la maqueta | Que debe hacer el SLEP |
|---|---|---|---|
| Mock de usuarios, OTP y candidatos | `src/lib/mock-api.ts` | Demo local | Sustituir por integracion real o adaptador servidor |
| Sesion del flujo de voto | `src/lib/server-session.ts` | Memoria de proceso | Reemplazar por Redis, KV o BD |
| Sesion admin | `src/lib/admin-session.ts` | Memoria de proceso | Reemplazar por store persistente y politica real de autenticacion |
| Metricas admin | `src/lib/metrics-store.ts` | Memoria de proceso | Reemplazar por consulta real a origen persistente |
| Validacion de identidad | `src/app/api/auth/verify-credentials/route.ts` | Demo con mock | Conectar a padron y backend real |
| OTP | `src/app/api/auth/verify-otp/route.ts` | Demo con mock | Conectar a validador OTP real |
| Papeleta | `src/app/api/candidates/route.ts` | Demo con datos estaticos | Consultar backend real segun sesion |
| Emision de voto | `src/app/api/votes/route.ts` | Demo local | Persistir voto real y garantizar atomicidad |
| Login admin | `src/app/api/admin/login/route.ts` | Demo local | Integrar autenticacion administrativa real |
| Auditoria admin | `src/app/api/admin/audit/route.ts` | Demo local | Leer desde auditoria real |
| Metricas admin | `src/app/api/admin/metrics/route.ts` | Demo local | Leer desde fuente real |

---

## Contrato minimo que el frontend espera

El frontend puede mantenerse igual si el BFF o el backend del SLEP conserva estas respuestas.

### 1. `POST /api/auth/verify-credentials`

Solicitud:

```json
{
  "rut": "12345678-9",
  "email": "usuario@slep.cl"
}
```

Respuesta `200`:

```json
{
  "user": {
    "fullName": "Nombre completo del votante",
    "organization": "Nombre del Servicio Local",
    "estamento": "docentes"
  }
}
```

Respuesta `401`:

```json
{
  "message": "No encontramos una coincidencia valida para el RUT y correo ingresados."
}
```

Notas:

- No revelar si fallo el RUT o el correo por separado.
- Debe iniciar sesion del flujo.
- Debe disparar o preparar el OTP real.

### 2. `POST /api/auth/verify-otp`

Solicitud:

```json
{
  "otp": "123456"
}
```

Respuesta `200`:

```json
{
  "ok": true
}
```

Respuesta `401`:

```json
{
  "message": "El codigo OTP no es valido o ha expirado."
}
```

Notas:

- El OTP depende de la sesion ya abierta.
- El frontend no reenvia identidad junto al OTP.
- La validez real del OTP siempre es server-side.

### 3. `GET /api/candidates`

Respuesta `200`:

```json
[
  {
    "id": "marisol-huerta",
    "name": "Marisol Huerta",
    "role": "Representante de estamento docente",
    "slogan": "Participacion informada con foco en continuidad pedagogica.",
    "initials": "MH",
    "accentColor": "#8c4f2f",
    "estamento": "docentes"
  }
]
```

Notas:

- Debe devolver solo candidatos del padron habilitado.
- La fuente del padron no puede ser el cliente.

### 4. `POST /api/votes`

Solicitud:

```json
{
  "candidateId": "marisol-huerta"
}
```

Respuesta `200`:

```json
{
  "receiptCode": "SLEP-MH-AB12CD34",
  "candidate": {
    "id": "marisol-huerta",
    "name": "Marisol Huerta"
  }
}
```

Respuesta `409`:

```json
{
  "message": "Ya has emitido tu voto en esta eleccion."
}
```

Notas:

- La proteccion contra doble voto debe ser server-side.
- La sesion debe invalidarse despues de votar.

### 5. `DELETE /api/session`

Respuesta `204` sin cuerpo.

Uso:

- Reinicio manual del flujo.
- Expiracion por inactividad.
- Vuelta al login.

### 6. `POST /api/admin/login`

Solicitud:

```json
{
  "pin": "1234"
}
```

Respuesta `200`:

```json
{
  "ok": true
}
```

Notas:

- El mecanismo real puede no ser PIN, pero el BFF debe adaptar la respuesta a la UI o esta UI debe ajustarse si cambia el flujo.

### 7. `GET /api/admin/metrics`

Respuesta `200`:

```json
{
  "lastUpdated": 1710000000000,
  "padron": {
    "total": 336,
    "directivos": 22,
    "docentes": 190,
    "asistentes": 124
  },
  "votes": {
    "directivos": 0,
    "docentes": 0,
    "asistentes": 0,
    "total": 0
  },
  "estamentos": [],
  "schools": []
}
```

### 8. `GET /api/admin/audit`

Respuesta `200`:

```json
{
  "log": []
}
```

### 9. `DELETE /api/admin/logout`

Respuesta `200`:

```json
{
  "ok": true
}
```

---

## Modelos TypeScript que el frontend ya usa

Si el backend del SLEP entrega este shape, el frontend no necesita cambios estructurales.

```ts
type Estamento = 'directivos' | 'docentes' | 'asistentes';

interface User {
  fullName: string;
  organization: string;
  estamento: Estamento;
}

interface Candidate {
  id: string;
  name: string;
  role: string;
  slogan: string;
  initials: string;
  accentColor: string;
  estamento: Estamento;
}
```

---

## Que hace hoy la maqueta y como debe leerse

### Lo que si esta resuelto en esta base

- La experiencia de usuario del flujo.
- La navegacion entre estados.
- La capa visual institucional.
- La separacion entre cliente y logica sensible a traves de `/api/*`.
- Accesibilidad base del login, modal de confirmacion y tabla admin.
- Un contrato estable que cada Servicio Local puede adoptar.

### Lo que no debe interpretarse como solucion productiva

- OTP fijo o predecible.
- Store en memoria para sesiones.
- Store en memoria para metricas.
- Auditoria en memoria.
- Login admin demo.
- Candidatos y escuelas embebidos en archivos TS.

---

## Cambios obligatorios antes de cualquier uso real

Cada Servicio Local debe revisar y resolver al menos esto:

1. Reemplazar todos los mocks por integracion real.
2. Persistir sesiones y votos fuera de memoria local.
3. Garantizar voto unico con atomicidad real en BD.
4. Implementar OTP real con expiracion y trazabilidad.
5. Implementar autenticacion administrativa real.
6. Agregar observabilidad y auditoria persistente.
7. Revisar CSRF si se usa cookie httpOnly para mutaciones.
8. Ajustar CORS, dominios, despliegue y secretos segun su infraestructura.
9. Revisar privacidad y cumplimiento normativo local.

---

## Checklist de adopcion por Servicio Local

### Personalizacion institucional

- Cambiar nombre del Servicio Local.
- Cambiar logo, fondos y textos institucionales.
- Cambiar establecimientos y padrones de ejemplo.
- Cambiar candidatos de ejemplo.

### Integracion tecnica

- Mantener el frontend consumiendo rutas internas de Next.js o adaptar la UI de forma consistente.
- Conectar cada ruta `/api/*` a backend real.
- Mantener shapes de respuesta compatibles con la UI.
- Proteger las mutaciones del flujo.

### Produccion real

- Reemplazar stores en memoria.
- Implementar secretos y variables de entorno.
- Endurecer auditoria y monitoreo.
- Validar recuperacion ante errores y reinicios.
- Ejecutar pruebas funcionales y de seguridad antes de despliegue.

---

## Recomendacion de implementacion

La forma mas estable de reutilizar esta maqueta es:

1. Conservar la UI y los componentes tal como estan.
2. Conservar las rutas internas de Next.js como BFF.
3. Reemplazar adentro de esas rutas la logica mock por llamadas al backend real del SLEP.
4. Mantener las respuestas del contrato para no tener que reescribir el frontend.

---

## Resumen ejecutivo para handoff

Este repositorio es una maqueta funcional y una base comun de frontend. No es una solucion electoral productiva completa. Cada Servicio Local debe implementar su propio backend y reemplazar los componentes mock o en memoria descritos en este documento. Mientras se respete este contrato, la UI puede reutilizarse con cambios minimos.
