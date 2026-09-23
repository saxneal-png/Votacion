---
name: slep-m365-auth-mailer
description: Configuración, diagnóstico y envío de correos institucionales de autenticación (códigos OTP y magic links) mediante Microsoft 365 Graph API y Azure Entra ID.
triggers:
  - "enviar otp"
  - "configurar m365"
  - "azure entra id"
  - "graph api"
  - "magic link"
  - "test m365"
---

# SLEP M365 Auth & Mailer Skill

## Propósito
Administrar la autenticación de dos factores (2FA), emisión de códigos OTP, despacho de magic links y la comunicación con el tenant de Microsoft 365 del Servicio Local.

## 1. Parámetros de Configuración Azure Entra ID
Variables de entorno requeridas:
- `AZURE_TENANT_ID`: GUID del directorio Azure del SLEP.
- `AZURE_CLIENT_ID`: App Registration Client ID con permiso `Mail.Send`.
- `AZURE_CLIENT_SECRET`: Clave de cliente autorizada.
- `CASILLA_SLEP_EMAIL`: Dirección del buzón institucional emisor (ej. `contacto@slepvallediguillin.gob.cl`).

## 2. Modos de Operación
- **Modo Producción:** Invoca `https://graph.microsoft.com/v1.0/users/{casilla}/sendMail` obteniendo token OAuth2 vía Client Credentials Grant (`/oauth2/v2.0/token`).
- **Modo Simulación:** Cuando no hay credenciales o está activo el toggle de prueba, registra el OTP en la consola/logs y permite autenticación sin despachar emails reales.

## 3. Seguridad en Entrega de Credenciales
- Los códigos OTP numéricos deben expirar en un máximo de 10-15 minutos.
- Los Magic Links deben ser de uso único con token criptográfico temporal.
- Sanitizar los emails en logs para evitar fugas de información personal (PII).
