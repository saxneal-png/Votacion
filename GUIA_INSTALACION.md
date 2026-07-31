# Guía de Instalación y Documentación Técnica
## Portal de Votación — Consejo Local SLEP

**Desarrollado por:** Servicio Local de Educación Pública Colchagua — Subdirección de Gestión Territorial

---

## Antes de leer esta guía

Este repositorio es **código libre institucional**. Puede ser adoptado, modificado y personalizado por cualquier Servicio Local de Educación Pública sin restricciones.

Lo que se entrega es:

- **Frontend blindado** — la capa de interfaz y experiencia de usuario es la parte cuidada y garantizada de este proyecto. Incluye controles de seguridad web, validaciones, flujo de pasos y diseño institucional.
- **Contrato de integración** — un contrato técnico claro (`BACKEND_CONTRACT.md`) que define qué debe responder el backend para que el frontend funcione correctamente.
- **Backend simulado para demo** — un mock de desarrollo (`mock-api.ts`) que permite ver el sistema funcionar sin necesidad de un backend real. Este mock se ejecuta únicamente en el servidor; el navegador nunca lo ve.

Lo que **cada SLEP decide por su cuenta**:

- Cómo implementa su backend real (autenticación, OTP, padrón, votación, auditoría).
- Qué base de datos, proveedor de correo o infraestructura usa.
- Cómo despliega y opera el sistema en su entorno.

> El frontend no impone ni restringe ninguna de esas decisiones. Solo exige que el backend respete el contrato de API definido en `BACKEND_CONTRACT.md`.

> `BACKEND_CONTRACT.md` es la fuente principal de verdad para todo lo que depende del backend: endpoints, sesion, OTP, voto, admin, persistencia, seguridad y cambios obligatorios antes de produccion.

---

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Instalación para demo local](#2-instalación-para-demo-local)
3. [Credenciales de prueba](#3-credenciales-de-prueba)
4. [Verificación de la instalación](#4-verificación-de-la-instalación)
5. [Build de producción](#5-build-de-producción)
6. [Qué garantiza el frontend](#6-qué-garantiza-el-frontend)
7. [Arquitectura del sistema](#7-arquitectura-del-sistema)
8. [Estructura de archivos](#8-estructura-de-archivos)
9. [Flujo de la aplicación](#9-flujo-de-la-aplicación)
10. [API interna — contrato de integración](#10-api-interna--contrato-de-integración)
11. [Personalización para otro SLEP](#11-personalización-para-otro-slep)
12. [Cómo conectar el backend real](#12-cómo-conectar-el-backend-real)
13. [Tests](#13-tests)
14. [Limitaciones del mock de demo](#14-limitaciones-del-mock-de-demo)
15. [Solución de problemas frecuentes](#15-solución-de-problemas-frecuentes)

---

## 1. Requisitos previos

### Software obligatorio

| Herramienta | Versión mínima | Verificación |
|---|---|---|
| **Node.js** | 18.17.0 o superior | `node --version` |
| **npm** | 9.x o superior (incluido con Node.js) | `npm --version` |
| **Git** | Cualquier versión reciente | `git --version` |

> **Recomendado:** Node.js LTS 20.x o 22.x. Descargar desde [nodejs.org](https://nodejs.org).

### Sistema operativo compatible

- Windows 10/11
- macOS 12 o superior
- Ubuntu 20.04 o superior

### Puerto requerido

| Puerto | Uso |
|---|---|
| `3000` | Servidor de desarrollo (por defecto, configurable) |

---

## 2. Instalación para demo local

### Paso 1 — Obtener el repositorio

Si se recibe como archivo comprimido:
```bash
# Descomprimir y entrar a la carpeta
cd VOTACIONES
```

Si se clona desde repositorio Git:
```bash
git clone <URL-del-repositorio>
cd VOTACIONES
```

### Paso 2 — Instalar dependencias

```bash
npm install
```

Instala Next.js 15, React 19, TypeScript 5, Tailwind CSS 4 y todas las herramientas de testing. Demora entre 1 y 3 minutos según la velocidad de red.

### Paso 3 — Iniciar el servidor de desarrollo

```bash
npm run dev
```

Salida esperada:
```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
- Ready in X.Xs
```

### Paso 4 — Abrir en el navegador

Ingresar a: **http://localhost:3000**

La demo es completamente funcional desde el primer momento, sin configuración adicional.

---

## 3. Credenciales de prueba

El mock de desarrollo incluye tres usuarios, uno por estamento. Cada usuario ve únicamente los candidatos de su padrón.

### Estamento — Directivos

| Campo | Valor |
|---|---|
| RUT | `12345678-5` |
| Correo | `director@slep.cl` |
| OTP | `111111` |
| Nombre | Carlos Muñoz Reyes |

### Estamento — Docentes

| Campo | Valor |
|---|---|
| RUT | `16940271-k` |
| Correo | `docente@slep.cl` |
| OTP | `222222` |
| Nombre | María González Pérez |

### Estamento — Asistentes de la Educación

| Campo | Valor |
|---|---|
| RUT | `19876543-0` |
| Correo | `asistente@slep.cl` |
| OTP | `333333` |
| Nombre | Ana Soto Vidal |

> El OTP se ingresa en seis casillas separadas. Soporta pegado directo desde el portapapeles.

---

## 4. Verificación de la instalación

### Tests unitarios

```bash
npm test
```

Resultado esperado:
```
Test Files  5 passed (5)
Tests       38 passed (38)
```

Todos los tests deben pasar antes de cualquier modificación. Si alguno falla, hay un problema con la instalación o con cambios previos realizados al código.

### Tests E2E

```bash
# Instalar el navegador de Playwright (solo la primera vez)
npx playwright install chromium

# Ejecutar
npm run test:e2e
```

### Cobertura

```bash
npm run test:coverage
```

---

## 5. Build de producción

```bash
# Generar build optimizado
npm run build

# Ejecutar en modo producción
npm run start
```

En producción se activan automáticamente todos los headers de seguridad declarados en `next.config.mjs` (HSTS, X-Frame-Options, CSP con nonce, etc.).

### Despliegue en servidor Linux

```bash
# En el servidor de destino
npm install --omit=dev
npm run build
npm run start         # Puerto 3000 por defecto
```

Para cambiar el puerto:
```bash
PORT=8080 npm run start
```

Se recomienda colocar un proxy inverso (nginx o Apache) delante de la aplicación para gestionar HTTPS y certificados TLS.

---

## 6. Qué garantiza el frontend

Esta es la parte que se entrega blindada. El SLEP que adopte este repositorio recibe las siguientes garantías sobre la capa de frontend, independientemente del backend que implemente.

### Seguridad web

**El navegador nunca recibe información sensible del votante.**
RUT, correo electrónico y código OTP quedan en el servidor. El cliente solo recibe nombre para mostrar, organización y estamento.

**Headers de seguridad HTTP activos:**

| Header | Protección |
|---|---|
| `Content-Security-Policy` (nonce-based, por request) | Bloquea inyección de scripts — XSS |
| `Strict-Transport-Security` (preload, max-age 1 año) | Fuerza HTTPS — previene downgrade |
| `X-Frame-Options: DENY` | Bloquea carga en iframes — previene clickjacking |
| `X-Content-Type-Options: nosniff` | Previene MIME sniffing |
| `Referrer-Policy: strict-origin-when-cross-origin` | Evita fuga de URL en headers Referer |
| `Permissions-Policy` | Bloquea cámara, micrófono, geolocalización y APIs de hardware |
| `Cross-Origin-Opener-Policy: same-origin` | Aísla el contexto de navegación — mitiga Spectre |

**Rate limiting por IP:**
El middleware Edge intercepta todas las rutas API. Máximo 20 solicitudes por minuto por dirección IP. Responde `429 Too Many Requests` con `Retry-After: 60`.

**CSP con nonce por request:**
Cada respuesta HTTP lleva un nonce criptográfico único generado en el middleware. Solo los scripts con ese nonce pueden ejecutarse. En producción no se usa `unsafe-inline` ni `unsafe-eval`.

**Límites de intentos en el flujo:**
- Login: máximo 5 intentos fallidos → formulario bloqueado
- OTP: máximo 3 intentos fallidos → regreso forzado a login

**Sesión httpOnly:**
La cookie de sesión lleva los flags `HttpOnly`, `SameSite=Lax` y `Secure` (en producción). No es accesible por JavaScript del navegador.

**Expiración de sesión:**
5 minutos de inactividad en los pasos OTP o papeleta → reset automático al login y destrucción de la sesión en servidor.

**Filtrado de candidatos en servidor:**
El estamento del votante se lee desde la sesión servidor. El cliente no puede solicitar candidatos de un padrón diferente al suyo.

**Validación de elegibilidad al votar:**
El endpoint `POST /api/votes` verifica que el `candidateId` recibido pertenezca al estamento del votante autenticado. El cliente no puede manipular el padrón.

---

### Validaciones de UI

- Validador de RUT en tiempo real con algoritmo módulo 11 — verde si válido, rojo si no
- Formato automático RUT con puntos y guion
- OTP de 6 casillas con auto-avance, backspace inteligente y soporte de pegado
- Campos requeridos con feedback visual inmediato
- Spinners en botones durante operaciones asíncronas — previene doble envío
- Modal de confirmación antes de emitir el voto — cancelable

### Experiencia de usuario

- Flujo lineal guiado de 4 pasos — no hay navegación libre entre pasos
- Barra de progreso con checkmarks animados y línea conectora
- Transiciones suaves entre pasos (slide)
- Timer con indicadores de urgencia (amber ≤ 30s, rojo ≤ 10s)
- Skeleton loaders con geometría exacta de cada paso
- Badge de estamento activo en la papeleta
- Comprobante de voto con código único (`SLEP-XX-XXXXXXXX`)
- Diseño institucional completamente responsivo — funciona en móvil y escritorio

### Calidad de código

- TypeScript estricto — sin `any` implícitos
- 38 tests unitarios y E2E pasando
- La interfaz pública `User` no contiene campos sensibles (`rut`, `email`, `otp`)
- Sin dependencias de UI externas — el diseño es propio y portable

### Controles server-side implementados en código

- **Límite OTP servidor:** contador de intentos en `SessionRecord`; la sesión se destruye al llegar a 3 fallos independientemente de la UI
- **Voto atómico:** `hasUserVoted()` y `markUserAsVoted()` se ejecutan sin `await` entre ellos — no hay ventana de race condition en el event loop de Node.js
- **Sesión destruida post-voto:** `destroySession()` + `maxAge: 0` en la cookie inmediatamente tras `submitVote` exitoso
- **Validación formato OTP servidor:** rechaza con `400` cualquier valor que no sea exactamente 6 dígitos numéricos antes de consumir un intento
- **Validación formato RUT servidor:** rechaza con mensaje genérico cualquier formato inválido antes de consultar el padrón
- **Sesión persistente en Hot Reload:** el store vive en `globalThis` para sobrevivir recargas de módulos en desarrollo

---

## 7. Arquitectura del sistema

### Patrón BFF (Backend for Frontend)

La UI no tiene acceso directo al padrón ni a datos sensibles. Todo pasa por rutas servidor de Next.js.

```
Navegador (cliente)
    │
    │  solo ve: nombre, estamento, candidatos filtrados, comprobante
    │
    ├─── page.tsx  ──►  api-client.ts  ──►  /api/* (Route Handlers)
                                                 │
                                                 ├─► server-session.ts   (sesión httpOnly)
                                                 └─► mock-api.ts         (backend demo — REEMPLAZABLE)
```

**El único archivo que debe reemplazarse** para conectar un backend real es `src/lib/mock-api.ts`. Los Route Handlers, la UI y la gestión de sesión no cambian.

### Qué hace cada capa

| Capa | Responsabilidad | ¿Puede modificarse? |
|---|---|---|
| Componentes + `page.tsx` | Estado visual, pasos, animaciones | Sí — personalización libre |
| `api-client.ts` | Llamadas HTTP al propio servidor | No recomendado |
| `/api/**` Route Handlers | Recibir llamadas de la UI, delegar al backend | Solo si cambia el contrato |
| `mock-api.ts` | Backend de demo | **Sí — reemplazar por backend real** |
| `server-session.ts` | Sesión httpOnly temporal | Sí — reemplazar por Redis/BD en producción |
| `middleware.ts` | CSP y rate limiting | Ajustar según infraestructura propia |

---

## 8. Estructura de archivos

```
VOTACIONES/
├── package.json                        # Dependencias y scripts npm
├── tsconfig.json                       # TypeScript estricto con alias @/*
├── next.config.mjs                     # Headers HTTP de seguridad estáticos
├── BACKEND_CONTRACT.md                 # Contrato de API para el equipo de backend
├── GUIA_INSTALACION.md                 # Este documento
├── README.md                           # Resumen y guía de adopción
├── context.md                          # Contexto técnico del proyecto
├── public/
│   └── fondo.webp                      # Imagen de fondo institucional
└── src/
    ├── middleware.ts                    # Rate limiting + CSP nonce (Edge Runtime)
    ├── app/
    │   ├── globals.css                 # Paleta institucional y variables CSS
    │   ├── layout.tsx                  # Root layout — inyección de nonce
    │   ├── page.tsx                    # Orquestador del flujo (Client Component)
    │   └── api/
    │       ├── auth/
    │       │   ├── verify-credentials/ # POST — validar RUT + email
    │       │   └── verify-otp/         # POST — validar OTP
    │       ├── candidates/             # GET  — papeleta filtrada por estamento
    │       ├── votes/                  # POST — emitir voto
    │       └── session/               # DELETE — cerrar sesión
    ├── components/views/
    │   ├── LoginView.tsx               # Paso 1: RUT + email
    │   ├── OtpView.tsx                 # Paso 2: OTP 6 dígitos
    │   ├── VotingView.tsx              # Paso 3: papeleta + timer + confirmación
    │   └── SuccessView.tsx             # Paso 4: comprobante
    ├── lib/
    │   ├── api-client.ts               # Cliente HTTP para la UI
    │   ├── mock-api.ts                 # ← REEMPLAZAR por backend real
    │   └── server-session.ts           # ← REEMPLAZAR por Redis/BD en producción
    ├── tests/
    │   ├── e2e/voting-flow.spec.ts     # Test E2E completo del flujo
    │   └── unit/                       # Tests unitarios por componente
    └── types/index.ts                  # User, Candidate, AppState, Estamento
```

---

## 9. Flujo de la aplicación

```
login  →  otp  →  vote  →  success
            ↑                  ↓
            └──────────────────┘
               (reiniciar flujo)
```

### Paso 1 — Login

- Ingreso de RUT (validado con módulo 11 en tiempo real) y correo electrónico
- `POST /api/auth/verify-credentials` → el servidor valida contra el padrón
- Máximo 5 intentos fallidos → formulario bloqueado

### Paso 2 — OTP

- Se muestra tarjeta con nombre y estamento del usuario
- Ingreso de OTP en 6 casillas separadas
- `POST /api/auth/verify-otp` → el servidor valida el OTP contra la sesión activa
- Máximo 3 intentos fallidos → regreso forzado a login

### Paso 3 — Papeleta

- `GET /api/candidates` → el servidor retorna solo los candidatos del estamento del votante
- Temporizador de 120 segundos con alertas visuales
- Modal de confirmación antes de emitir
- `POST /api/votes` → el servidor verifica voto único y elegibilidad

### Paso 4 — Comprobante

- Animación institucional de confirmación
- Nombre del candidato elegido y código `SLEP-XX-XXXXXXXX`
- El usuario puede reiniciar el flujo para una nueva sesión

---

## 10. API interna — contrato de integración

Todo lo relacionado con integracion real, persistencia, seguridad operativa y responsabilidades del backend se centraliza en `BACKEND_CONTRACT.md`. Esta guia no duplica ese detalle para evitar que la documentacion se desincronice.

Estos son los endpoints que la UI llama. El backend real del SLEP debe implementarlos con las mismas respuestas.

### `POST /api/auth/verify-credentials`

```json
// Request
{ "rut": "12345678-5", "email": "director@slep.cl" }

// 200 OK
{ "user": { "fullName": "Carlos Muñoz Reyes", "organization": "SLEP Colchagua", "estamento": "directivos" } }

// 401
{ "message": "No encontramos una coincidencia valida para el RUT y correo ingresados." }
```

> El mensaje de error nunca debe indicar qué campo falló. RUT y correo deben fallar juntos.

### `POST /api/auth/verify-otp`

```json
// Request
{ "otp": "111111" }

// 200 OK
{ "ok": true }

// 401
{ "message": "El codigo OTP no es valido o ha expirado." }
```

### `GET /api/candidates`

Requiere sesión válida con OTP ya verificado.

```json
// 200 OK
[
  {
    "id": "pablo-reyes",
    "name": "Pablo Reyes",
    "role": "Director establecimiento zona norte",
    "slogan": "Liderazgo pedagógico centrado en resultados colectivos.",
    "initials": "PR",
    "accentColor": "#1a4a7a"
  }
]
```

### `POST /api/votes`

```json
// Request
{ "candidateId": "pablo-reyes" }

// 200 OK
{ "receiptCode": "SLEP-PR-a1b2c3d4", "candidate": { "id": "pablo-reyes", "name": "Pablo Reyes" } }

// 409 Conflict — voto duplicado
{ "message": "Ya has emitido tu voto en esta eleccion." }
```

### `DELETE /api/session`

Sin cuerpo. Responde `204 No Content`.

> El detalle completo del contrato, con notas de seguridad y checklist para el equipo de backend, está en `BACKEND_CONTRACT.md`.

---

## 11. Personalización para otro SLEP

### Nombre y organización

| Archivo | Qué cambiar |
|---|---|
| `src/lib/mock-api.ts` | Campo `organization` en los 3 usuarios de demo |
| `src/app/page.tsx` | Texto del footer institucional |
| `src/app/layout.tsx` | `<title>` y `<meta name="description">` |

### Candidatos

Editar el array `candidates` en `src/lib/mock-api.ts`:

```typescript
{
  id: 'slug-unico',         // identificador usado al votar
  name: 'Nombre Completo',
  role: 'Cargo o establecimiento',
  slogan: 'Frase de campaña.',
  initials: 'NC',           // 2 letras para el avatar
  accentColor: '#1a4a7a',   // color del avatar en hex
  estamento: 'directivos',  // 'directivos' | 'docentes' | 'asistentes'
}
```

### Usuarios del padrón de prueba

Editar el array `VALID_USERS` en `src/lib/mock-api.ts`:

```typescript
{
  rut: '12345678-5',           // con guion y dígito verificador
  email: 'usuario@slep.cl',
  otp: '123456',               // 6 dígitos — en producción se genera dinámicamente
  fullName: 'Nombre Completo',
  organization: 'SLEP Nombre',
  estamento: 'docentes',
}
```

### Paleta de colores

Editar las variables CSS en `src/app/globals.css`. Las variables `--color-primary` y similares controlan toda la identidad visual.

### Imagen de fondo

Reemplazar `public/fondo.webp` con la imagen institucional del SLEP. Mantener el nombre del archivo o actualizar la referencia en `src/app/globals.css`.

---

## 12. Cómo conectar el backend real

Cuando el SLEP implemente su backend, el reemplazo se hace en la capa servidor de Next.js. **La UI no cambia.**

### Archivos a reemplazar

**`src/lib/mock-api.ts` → adaptador al backend real**

```typescript
// src/lib/real-api.ts  (reemplaza mock-api.ts)
export async function verifyUserCredentials(rut: string, email: string) {
  const res = await fetch('https://api.slep-colchagua.cl/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rut, email }),
  });
  if (!res.ok) return null;
  return res.json(); // debe retornar objeto compatible con MockUserRecord
}

export async function verifyOtpCode(input: string, expected: string) {
  // con backend real: delegar al sistema OTP del SLEP
  return input === expected;
}
// ... resto de funciones con el mismo contrato de firma
```

**`src/lib/server-session.ts` → sesión persistente**

```typescript
// Ejemplo con Redis
import { createClient } from 'redis';
const redis = createClient({ url: process.env.REDIS_URL });

export async function createSession(userId: string) {
  const token = crypto.randomUUID();
  await redis.setEx(`session:${token}`, 600, JSON.stringify({ userId }));
  return token;
}
// ... mismo contrato de funciones
```

Los Route Handlers en `src/app/api/**` no necesitan cambios. Solo cambia de dónde importan los datos.

### Responsabilidades que quedan en el SLEP

- Autenticación real de RUT y correo contra su padrón oficial
- Generación y envío de OTP con expiración real (correo o SMS)
- Voto único garantizado con transacción en base de datos
- Auditoría de eventos sin exponer la preferencia del votante en logs
- Infraestructura, despliegue, respaldos y certificaciones legales

---

## 13. Tests

### Unitarios — Vitest + React Testing Library

```bash
npm test                 # Ejecución única
npm run test:watch       # Modo observación
npm run test:coverage    # Con reporte HTML de cobertura
```

Estado actual: **38 tests, 5 archivos, todos pasando**.

| Archivo | Qué verifica |
|---|---|
| `LoginView.test.tsx` | Formulario, validador RUT módulo 11, bloqueo por intentos |
| `OtpView.test.tsx` | 6 cajas OTP, auto-avance, pegado, límite de intentos |
| `VotingView.test.tsx` | Papeleta por estamento, modal de confirmación, timer |
| `SuccessView.test.tsx` | Animación, comprobante, botón reiniciar |
| `mock-api.test.ts` | Funciones de padrón, candidatos y validación OTP |

### E2E — Playwright

```bash
npx playwright install chromium   # Solo la primera vez
npm run test:e2e
npm run test:e2e:ui               # Con interfaz visual interactiva
```

### Al personalizar el proyecto

Cuando se cambien credenciales o candidatos en `mock-api.ts`, actualizar:
- `src/tests/unit/mock-api.test.ts`
- `src/tests/e2e/voting-flow.spec.ts`

---

## 14. Limitaciones del mock de demo

La lista completa de limitaciones del mock y de reemplazos requeridos por cada Servicio Local se mantiene en `BACKEND_CONTRACT.md`.

Intencionales para simplificar la demo. **No deben existir en producción real.**

| Limitación | Descripción | Estado | Solución en producción |
|---|---|---|---|
| Sesión en memoria | El `Map` de sesiones vive en el proceso Node.js y se pierde al reiniciar el servidor | Demo | Reemplazar `server-session.ts` por Redis o BD |
| OTP estático en código | OTP fijo por usuario en `mock-api.ts` | Demo | OTP dinámico generado y enviado por correo o SMS |
| Sin CSRF explícito | Mutaciones POST con cookie sin token adicional | Demo | Header `X-Requested-With` o token doble-submit |
| ~~Voto no atómico~~ | `hasUserVoted()` y `markUserAsVoted()` sin await entre ellos — atómico en Node.js | ✅ Resuelto | Transacción BD en producción multi-instancia |
| ~~Sin límite OTP en servidor~~ | Contador de intentos implementado en `SessionRecord` — sesión destruida al límite | ✅ Resuelto | Ya cumplido; con backend real delegar al proveedor OTP |
| ~~Sesión activa post-voto~~ | `destroySession()` llamado inmediatamente tras `submitVote` exitoso | ✅ Resuelto | — |

---

## 15. Solución de problemas frecuentes

### `npm install` falla en Windows

Abrir la terminal como **Administrador** o:
```bash
npm install --legacy-peer-deps
```

### Puerto 3000 ocupado

```bash
npx next dev -p 3001
```

### Error `Cannot find module '@/...'`

```bash
rmdir /s /q .next node_modules
npm install
npm run dev
```

### Tests fallan después de cambiar credenciales

Actualizar también:
- `src/tests/unit/mock-api.test.ts`
- `src/tests/e2e/voting-flow.spec.ts`

### El OTP no funciona en la demo

| Estamento | OTP |
|---|---|
| Directivos | `111111` |
| Docentes | `222222` |
| Asistentes | `333333` |

### El OTP falla después de un Fast Refresh del servidor

En desarrollo, Next.js puede recargar los módulos del servidor durante un Hot Reload. El store de sesiones sobrevive gracias a `globalThis`, pero si el servidor fue **reiniciado completamente** (Ctrl+C + `npm run dev`), las sesiones se pierden. Simplemente vuelve a hacer login desde el inicio.

### Error de hidratación React

```bash
rmdir /s /q .next
npm run dev
```

---

## Scripts de referencia rápida

```bash
npm run dev              # Desarrollo — localhost:3000
npm run build            # Build de producción
npm run start            # Ejecutar build de producción
npm test                 # Tests unitarios
npm run test:watch       # Tests en modo watch
npm run test:coverage    # Cobertura de tests
npm run test:e2e         # Tests E2E (Playwright)
npm run test:e2e:ui      # Tests E2E con UI interactiva
```

---

*Portal de Votación — Consejo Local SLEP | Código libre institucional*
*Servicio Local de Educación Pública Colchagua — Subdirección de Gestión Territorial*
