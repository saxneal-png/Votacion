# Portal de Votación — SLEP COLCHAGUA

Portal web institucional para la emision de votos del Consejo Local del Servicio Local de Educacion Publica (SLEP) COLCHAGUA. Construido con **Next.js 15**, **React 19** y **TypeScript**.

Este repositorio esta pensado como un esqueleto compartible de frontend. La arquitectura visual, la experiencia de usuario y el contrato de integracion se reutilizan entre Servicios Locales, mientras que cada Servicio Local implementa, opera y audita su propio backend segun su padron, su infraestructura y sus controles internos.

---

## Inicio rápido

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # build de producción
```

> **Mock de desarrollo:** las credenciales de prueba viven en `src/lib/mock-api.ts`, pero ahora se consumen desde rutas servidor de Next.js. El cliente ya no importa directamente usuarios, OTP ni reglas de padrón. Antes de un despliegue real, cada Servicio Local debe sustituir ese mock por su backend propio o por un adaptador conectado a su backend.

---

## Modelo de adopcion

- Este proyecto entrega el frontend, la UX y el contrato de integracion.
- Cada Servicio Local debe construir su propio backend de autenticacion, OTP, padron, emision de voto y auditoria.
- Todo lo que depende del backend, de la persistencia, de la seguridad operativa o de la integracion productiva se documenta en `BACKEND_CONTRACT.md`.
- El frontend debe integrarse manteniendo los endpoints y respuestas definidos en `BACKEND_CONTRACT.md`, o bien incorporando un adaptador compatible.
- El mock actual existe solo para validacion funcional del frontend y no representa una implementacion electoral segura.

## Guia de entrega a otros SLEP

Este repositorio puede compartirse como maqueta institucional y base tecnica comun para otros Servicios Locales, siempre que se entregue con el alcance correcto.

### Que si se entrega

- Experiencia de usuario completa del flujo de votacion.
- Arquitectura visual y componentes reutilizables.
- BFF de referencia en Next.js para aislar la UI de la logica sensible.
- Contrato de integracion para conectar un backend real.
- Demo funcional local para validacion de flujo y presentaciones.

### Que no se entrega como solucion final

- Backend productivo.
- Persistencia real de sesiones.
- OTP real por correo, SMS o proveedor institucional.
- Voto unico transaccional en base de datos.
- Auditoria legal o trazabilidad operativa final.

### Responsabilidad de cada Servicio Local

- Implementar o conectar su backend real de autenticacion, OTP, padron y emision de voto.
- Reemplazar `src/lib/mock-api.ts` por un adaptador servidor conectado a su infraestructura.
- Sustituir `src/lib/server-session.ts` por Redis, KV o base de datos segun su arquitectura.
- Definir sus controles de auditoria, despliegue, respaldo y cumplimiento.
- Seguir `BACKEND_CONTRACT.md` como documento principal para entender que hace hoy la maqueta, que parte debe respetarse y que parte debe reemplazarse antes de un uso real.

### Checklist minimo de adopcion

1. Mantener la UI consumiendo las rutas internas de Next.js y no exponer logica sensible al cliente.
2. Implementar `POST /api/auth/verify-credentials`, `POST /api/auth/verify-otp`, `GET /api/candidates`, `POST /api/votes` y `DELETE /api/session` con el contrato vigente.
3. Reemplazar el store en memoria por una capa persistente y distribuida.
4. Incorporar OTP real con expiracion, un solo uso y rate limiting server-side.
5. Garantizar voto unico atomico por elector y auditoria de eventos sin exponer la preferencia en logs.
6. Incorporar CSRF si se mantiene sesion con cookie httpOnly.

### Mensaje recomendado de handoff

"Este repositorio entrega una maqueta funcional y una arquitectura base de frontend para votacion digital. La UI, el flujo y el contrato de integracion estan listos para demo y adopcion tecnica. Cada Servicio Local debe implementar su backend real y sus controles de seguridad, auditoria y persistencia antes de cualquier uso productivo."

## Arquitectura recomendada en Next.js

Para que la logica sensible no quede expuesta en el cliente, este frontend debe operar con una capa servidor dentro de Next.js:

- La UI React solo debe manejar estado visual, validaciones de experiencia y renderizado.
- Las verificaciones de identidad, OTP, padron y emision de voto deben ejecutarse en Route Handlers o Server Actions.
- El navegador no debe importar usuarios de prueba, OTP, reglas de elegibilidad ni consultas de voto.
- Si se usa este repositorio como base comun, la forma mas estable es mantener un BFF en Next.js que reciba las llamadas del cliente y delegue al backend real del Servicio Local.

En esta arquitectura, el cliente llama a `/api/auth/verify-credentials`, `/api/auth/verify-otp`, `/api/candidates`, `/api/votes` y `/api/session`, mientras que la implementacion real permanece del lado servidor.

---

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (puerto 3000) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run test` | Tests unitarios — Vitest + React Testing Library |
| `npm run test:e2e` | Tests E2E — Playwright |
| `npm run test:coverage` | Cobertura de tests |

---

## Stack

| Tecnología | Versión | Rol |
|---|---|---|
| Next.js | 15.x | Framework — App Router |
| React | 19.x | UI — Client Components |
| TypeScript | 5.x | Tipado estricto |
| Tailwind CSS | 4.x | Estilos + design tokens |

Sin librerías de UI externas (no MUI, no shadcn). El sistema de diseño institucional está en `src/app/globals.css`.

---

## Estructura del proyecto

```
src/
├── middleware.ts           # Rate limiting por IP + CSP nonce por request (Edge Runtime)
├── app/
│   ├── layout.tsx          # Root layout — fuerza renderizado dinámico para inyección de nonce
│   ├── page.tsx            # Orquestador cliente — intro, estado visual, guardas y navegación del flujo
│   └── api/                # BFF interno de Next.js para auth, OTP, papeleta, voto y sesión
│   └── globals.css         # Variables CSS, animaciones, componentes utilitarios y modo contraste alto
├── components/
│   ├── AccessibilityPanel.tsx # Botón flotante de accesibilidad + panel compacto por iconos
│   ├── HelpTooltip.tsx     # Tooltip reutilizable para ayuda contextual y sellos explicables
│   └── views/
│       ├── IntroView.tsx   # Pantalla inicial — orientación, simulación y acceso a ajustes desde el botón flotante
│       ├── LoginView.tsx   # Paso 1: RUT (validador módulo 11 en tiempo real) + email con autofill endurecido
│       ├── OtpView.tsx     # Paso 2: OTP en 6 cajas separadas con auto-avance, pegado y privacidad reforzada
│       ├── VotingView.tsx  # Paso 3: papeleta + timer + CTA sticky + modal + sello de flujo verificado
│       └── SuccessView.tsx # Paso 4: check animado + comprobante imprimible + estado demo
├── lib/
│   ├── api-client.ts       # Cliente HTTP interno consumido por la UI
│   ├── mock-api.ts         # Simulación de backend para desarrollo local, usada solo en servidor
│   └── server-session.ts   # Sesión httpOnly y estado temporal del flujo en servidor
└── types/
    └── index.ts            # Interfaces: User, Candidate, AppState
```

---

## Flujo de la aplicación

```
intro → login → otp → vote → success
          ↑              ↓
          └──────────────┘  (reiniciar demo)
```

Cada transición se produce solo si la llamada a las rutas API del servidor resuelve sin error. El cliente mantiene el estado visual del flujo, impide transiciones inválidas y el servidor ejecuta la lógica sensible.

**Límites de intentos:**
- Login: máximo 5 fallidos → formulario bloqueado
- OTP: máximo 3 fallidos → regreso forzado a login

**Expiración por inactividad:** 5 minutos sin interacción en estados `otp` o `vote` → reseteo automático a login.

**Advertencia previa por inactividad:** 60 segundos antes del vencimiento, la UI muestra un aviso y permite mantener la sesión activa.

---

## UI / Experiencia

| Funcionalidad | Descripción |
|---|---|
| IntroView | Pantalla previa con "qué necesitarás", soporte visible, simulación guiada y referencia al botón flotante de accesibilidad |
| Validador RUT en tiempo real | Algoritmo módulo 11 inline — ✓ verde si válido, ✗ rojo si no |
| Formato RUT con puntos | `12345678` → `12.345.678-9` en el indicador (estado interno sin puntos) |
| OTP 6 cajas | Auto-avance, backspace inteligente, flechas ← →, pegado distribuido y autofill desactivado |
| Tarjeta de usuario en OTP | Avatar con iniciales, nombre parcialmente anonimizado, organización y badge de estamento |
| Modal de confirmación | Muestra candidatura antes de emitir — cancelable |
| Transiciones entre pasos | Slide derecha al avanzar, slide izquierda al retroceder |
| Skeleton loaders exactos | Placeholders con la geometría real de VotingView, incluyendo badges superiores y CTA |
| Barra de progreso | 3 pasos con checkmarks SVG animados y línea conectora |
| Ayuda contextual por etapa | Franja breve con el paso actual y la siguiente acción esperada |
| Timer con urgencia | Neutro → amber (≤30s) → rojo (≤10s) |
| Aviso previo de expiración | Banner con countdown de 60 segundos antes del cierre por inactividad |
| Spinners en botones | Feedback inmediato en cada acción asíncrona |
| SuccessView | Check SVG animado + comprobante imprimible + fecha de emisión + sellos de confianza |
| Escudo SVG institucional | Header de banda azul con tres capas y checkmark interno |
| Padrones por estamento | Cada votante ve únicamente los candidatos de su padrón (directivos / docentes / asistentes) |
| Badge de padrón | VotingView muestra el nombre del padrón activo con color propio |
| Modo simulación guiada | Etiquetas visuales de demo para capacitación sin confundir el flujo con operación real |
| Contraste alto institucional | Overrides visuales reforzados para mejorar legibilidad en jornadas presenciales |
| Privacy mode | Reduce datos visibles en OTP, papeleta y comprobante para puestos compartidos |
| Lectura simplificada | Reduce densidad verbal y ajusta ritmo de lectura en el flujo |
| Accesibilidad flotante | Botón discreto abajo a la derecha con panel compacto por iconos para contraste, lectura simplificada, privacidad, movimiento reducido y tamaño de texto |
| Tooltip explicable de seguridad | El sello "Sesión segura verificada" muestra una explicación contextual de qué protege la UI y qué depende del backend del SLEP |
| Sellos de confianza | La UI muestra "Sesión segura verificada" y "Flujo verificado" en puntos clave |
| CTA sticky en papeleta | En móvil, el botón principal queda más accesible y reduce scroll innecesario |
| Detección de múltiples pestañas | Advertencia visual para continuar en una sola pestaña del portal |
| Soporte visible | Franja persistente recordando la mesa de ayuda o canal del establecimiento |
| Pantalla protegida por foco | Si la pestaña pierde foco durante OTP o voto, la UI puede ocultar temporalmente datos sensibles hasta reanudar la vista |

---

## Flujo tecnico actual

1. `page.tsx` recibe las acciones del usuario y llama a `src/lib/api-client.ts`.
2. `api-client.ts` consume las rutas internas de Next.js bajo `src/app/api`.
3. Los Route Handlers validan credenciales, OTP, sesion y elegibilidad del voto en el servidor.
4. `server-session.ts` mantiene una sesion temporal por cookie httpOnly para la demo local.
5. `mock-api.ts` actua como backend de desarrollo del lado servidor y puede reemplazarse por un backend real sin cambiar la UI.

---

## Alcance de seguridad

Este repositorio entrega el frontend blindado. Los controles implementados son verificables directamente en el código.

**Controles en el cliente** (navegador nunca recibe): RUT, correo, OTP ni reglas de elegibilidad. El modelo público `User` solo contiene `fullName`, `organization` y `estamento`.

**Controles en servidor implementados y activos:**

| Control | Archivo | Detalle |
|---|---|---|
| Límite OTP server-side | `server-session.ts` | Contador `otpAttempts` en `SessionRecord` — sesión destruida al llegar a 3 fallos |
| Validación formato OTP | `verify-otp/route.ts` | Rechaza con `400` si no es exactamente 6 dígitos antes de consumir un intento |
| Validación formato RUT | `verify-credentials/route.ts` | Rechaza con mensaje genérico si el formato no es `\d{7,8}-[\dkK]` |
| Voto atómico | `votes/route.ts` | `hasUserVoted()` + `markUserAsVoted()` sin `await` entre ellos |
| Sesión destruida post-voto | `votes/route.ts` | `destroySession()` + `maxAge: 0` inmediatamente tras votar |
| Filtrado de padrón | `candidates/route.ts` | Estamento se lee desde la sesión servidor, no del cliente |
| Rate limiting por IP | `middleware.ts` | 20 req/min por IP — `429` con `Retry-After: 60` |
| CSP nonce por request | `middleware.ts` | Nonce criptográfico único; en producción sin `unsafe-inline` ni `unsafe-eval` |
| Sesión httpOnly | Todos los routes | Flags `HttpOnly`, `SameSite=Lax`, `Secure` (producción), `maxAge=600s` |

**Controles que quedan en el SLEP al integrar backend real:**
- OTP dinámico con expiración real (correo o SMS)
- Voto único con transacción atomica en BD
- Persistencia de sesión (Redis o equivalente)
- Protección CSRF en mutaciones POST con cookie
- Auditoría de eventos sin exponer la preferencia del votante en logs

El detalle completo de responsabilidades, endpoints esperados, decisiones que cada Servicio Local debe tomar y componentes que deben reemplazarse antes de producción vive en `BACKEND_CONTRACT.md`.

## Seguridad

### Headers HTTP

| Header | Valor | Protección |
|---|---|---|
| `Content-Security-Policy` | nonce-based + strict-dynamic + report-uri | XSS, inyección de scripts |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Downgrade HTTPS |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Fuga de URL |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), display-capture=()` | APIs de hardware |
| `Cross-Origin-Opener-Policy` | `same-origin` | Spectre / window.opener |
| `Cross-Origin-Resource-Policy` | `same-origin` | Embebido de recursos entre orígenes |

### Rate limiting

- **Por IP (middleware Edge):** 20 requests / 60 segundos → `429 Too Many Requests`
- **Login:** 5 intentos fallidos → formulario bloqueado
- **OTP:** 3 intentos fallidos → regreso forzado a login

### Guardas del cliente

- El flujo inicia en `intro` y no permite saltos arbitrarios entre estados.
- El cliente intenta limpiar sesión al cerrar, recargar o abandonar la página con `DELETE /api/session` usando `keepalive`.
- Si el navegador restaura la página desde caché, la UI reinicia el flujo para evitar datos visuales obsoletos.
- Si se detecta otra pestaña activa, la interfaz avisa al usuario para continuar en una sola.
- OTP y correo se muestran parcialmente enmascarados cuando aparecen como referencia visual.
- El acceso a accesibilidad vive en un botón flotante único, con panel compacto de iconos para no invadir el flujo principal.
- El sello `Sesión segura verificada` incluye tooltip contextual visible por encima del contenido para explicar el alcance de protección de la UI.
- Login, OTP y correo desactivan `autoComplete`, `autoCorrect` y `spellCheck` donde resulta riesgoso en puestos compartidos.
- El comprobante final puede imprimirse con una hoja limpia orientada a verificación visual, no a auditoría electoral final.

### Sesion servidor

- **Cookie httpOnly:** `voting_session`
- **Ambito:** autenticacion, OTP, consulta de papeleta y emision del voto
- **Store actual:** memoria en `server-session.ts` solo para demo local
- **Migracion recomendada:** Redis, KV o base de datos del Servicio Local para entornos reales

### Inputs

- RUT número: allowlist `[0-9]` + `pattern="[0-9]*"` + `inputMode="numeric"`
- RUT dígito: allowlist `[0-9kK]` + `inputMode="text"`
- OTP: allowlist `[0-9]` por caja + `pattern="[0-9]*"` + `autoComplete="off"`
- Email: `type="email"` + `maxLength={254}`

---

## Cosas que NO hacer

- **No mover la CSP a `next.config.mjs`** — pierde el nonce y bloquea los chunks en producción.
- **No hacer `layout.tsx` estático** — debe llamar `await headers()` para que Next.js inyecte el nonce en los scripts.
- **No usar `setInterval` para el timer** — usar `setTimeout` recursivo para evitar drift y doble-disparo en StrictMode.
- **No llamar `getCandidates()` en el mount inicial** — solo tras OTP exitoso.
- **No exponer credenciales en la UI** — ni hints, ni placeholders con valores reales.
- **No guardar el RUT con puntos en el estado** — el formato con puntos es solo visual en el indicador.
- **No consumir `mock-api.ts` desde componentes cliente** — toda llamada sensible debe pasar por `src/app/api`.
- **No usar el store en memoria de `server-session.ts` en produccion** — reemplazarlo por infraestructura persistente o distribuida.
- **No romper el contrato del BFF** — si un Servicio Local cambia la implementacion interna, debe mantener compatibles las respuestas del cliente.
- **No declarar `idleTimer` como `ReturnType<typeof window.setTimeout>`** — en el build de Next.js `@types/node` interfiere; usar `let idleTimer: number` explícitamente.

---

## Estado del proyecto

| Fase | Descripción | Estado |
|---|---|---|
| Fase 1 | Frontend con mock data — UX y diseño | ✅ |
| Fase 1b | Seguridad frontend: CSP nonce, HSTS, rate limiting, receiptCode | ✅ |
| Fase 2 | Testing: Vitest + RTL + Playwright E2E | ✅ |
| Fase 2b | Mejoras visuales: progress bar, skeletons, spinners, animaciones, SuccessView | ✅ |
| Fase 2c | UX avanzado: validador RUT, OTP 6 cajas, modal confirmación, transiciones slide, fix CSP Vercel | ✅ |
| Fase 2d | Seguridad avanzada: rate limiting IP, report-uri, COOP/CORP, Permissions-Policy extendida, allowlist inputs, expiración por inactividad | ✅ |
| Fase 2e | Padrones por estamento: 3 usuarios ficticios, candidatos por padrón, OtpView con tarjeta de usuario, VotingView con badge de padrón, filtro dinámico de papeleta | ✅ |
| Fase 2f | Pulido frontend: IntroView, simulación guiada, contraste alto, soporte visible, guardas del flujo y advertencias multi-pestaña | ✅ |
| Fase 3 | Integracion real: backend del Servicio Local o adaptador BFF conectado a backend existente | ⬜ |
| Fase 4 | Despliegue producción: Vercel + BD serverless | ⬜ |

Ver [`context.md`](./context.md) para documentación técnica completa.

---

## Repositorio

[https://github.com/kmilomore/VOTACIONES](https://github.com/kmilomore/VOTACIONES)
