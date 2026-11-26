-- ============================================================================
-- MIGRACIÓN DE ESTANDARIZACIÓN ELECTORAL (OTP EMAIL + PÁGINA DE INGRESO)
-- Permite adaptar la plataforma a cualquier proceso electoral sin código fijo.
-- ============================================================================

-- Plantilla de Correo OTP / Acreditación
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS email_otp_subject TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS email_otp_header_title TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS email_otp_header_subtitle TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS email_otp_greeting TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS email_otp_body_text TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS email_otp_show_code BOOLEAN DEFAULT true;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS email_otp_show_magic_link BOOLEAN DEFAULT true;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS email_otp_button_text TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS email_otp_footer_text TEXT;

-- Personalización de Página de Ingreso a la Votación
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_title TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_subtitle TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_show_instructions BOOLEAN DEFAULT true;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_instructions_title TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_step1_title TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_step1_detail TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_step2_title TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_step2_detail TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_step3_title TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_step3_detail TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_show_apoderado_mode BOOLEAN DEFAULT true;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_show_funcionario_mode BOOLEAN DEFAULT true;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_apoderado_tab_label TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_funcionario_tab_label TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_rut_label TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_student_rut_label TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_email_label TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_email_placeholder TEXT;
ALTER TABLE bd_configuracion_eleccion ADD COLUMN IF NOT EXISTS login_allowed_domains TEXT;
