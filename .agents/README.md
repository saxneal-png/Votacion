# Configuración de Agentes y Skills del Proyecto Votación SLEP

Este directorio contiene las definiciones locales de habilidades (Skills) y directrices para los agentes de desarrollo en Google Antigravity.

## Skills Disponibles (`.agents/skills/`)
1. **`slep-voting-core`**: Reglas de negocio del flujo de sufragio, secreto del voto, estamentos del Decreto N° 102 y cálculo de quórums.
2. **`padron-data-pipeline`**: Procesamiento e ingesta masiva de planillas Excel/CSV, chunking de lotes, validación de RUT chileno (módulo 11) y mapeo de RBDs.
3. **`slep-m365-auth-mailer`**: Entrega de credenciales OTP y magic links mediante Microsoft 365 Graph API / Azure Entra ID.
4. **`supabase-electoral-db`**: Persistencia relacional, índices de alto rendimiento (`pg_trgm`, B-Tree), transacciones atómicas de voto y bitácora inmutable.

## Subagentes Especializados
- **`electoral_auditor`**: Garantía de secreto del voto, integridad de actas y validación de doble emisión.
- **`padron_engineer`**: Ingesta masiva, limpieza y validación de padrones de comunidades educativas.
- **`m365_security_lead`**: Integración segura con Microsoft Graph API y hardening de autenticación.
- **`supabase_db_specialist`**: Diseño de esquemas PostgreSQL, optimización de queries y seguridad con RLS.
