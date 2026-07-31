CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS bd_padron (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rut_votante VARCHAR(15) NOT NULL,
    formatted_rut_votante VARCHAR(20) NOT NULL,
    rut_estudiante_asociado VARCHAR(15),
    formatted_rut_estudiante VARCHAR(20),
    nombre_completo VARCHAR(255) NOT NULL,
    estamento VARCHAR(50) NOT NULL,
    rbd_establecimiento VARCHAR(20) NOT NULL,
    nombre_establecimiento VARCHAR(255) NOT NULL,
    habilitado BOOLEAN DEFAULT TRUE,
    ha_votado BOOLEAN DEFAULT FALSE,
    fecha_voto TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_padron_rut_votante ON bd_padron(rut_votante);
CREATE INDEX IF NOT EXISTS idx_padron_apoderado_estudiante ON bd_padron(rut_votante, rut_estudiante_asociado);
CREATE INDEX IF NOT EXISTS idx_padron_estamento ON bd_padron(estamento);

CREATE TABLE IF NOT EXISTS acta_sufragio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio VARCHAR(50) UNIQUE NOT NULL,
    rut_votante VARCHAR(15) NOT NULL,
    formatted_rut_votante VARCHAR(20) NOT NULL,
    email_registrado VARCHAR(255) NOT NULL,
    estamento VARCHAR(50) NOT NULL,
    rbd_establecimiento VARCHAR(20) NOT NULL,
    nombre_establecimiento VARCHAR(255) NOT NULL,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acta_folio ON acta_sufragio(folio);
CREATE INDEX IF NOT EXISTS idx_acta_rut ON acta_sufragio(rut_votante);

CREATE TABLE IF NOT EXISTS votos_anonimos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estamento VARCHAR(50) NOT NULL,
    candidate_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS registro_participacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rut VARCHAR(15) NOT NULL,
    comprobante_id VARCHAR(100) NOT NULL,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidatos (
    id VARCHAR(100) PRIMARY KEY,
    nombre_completo VARCHAR(255) NOT NULL,
    cargo_role VARCHAR(255) NOT NULL,
    slogan_propuesta TEXT NOT NULL,
    iniciales VARCHAR(10) NOT NULL,
    color_acento VARCHAR(20) DEFAULT '#0b5294',
    estamento VARCHAR(50) NOT NULL,
    biografia TEXT DEFAULT '',
    foto_perfil TEXT,
    votos_acumulados INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bitacora_auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp BIGINT NOT NULL,
    ip_origen VARCHAR(45) NOT NULL,
    evento VARCHAR(100) NOT NULL,
    detalle TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO candidatos (id, nombre_completo, cargo_role, slogan_propuesta, iniciales, color_acento, estamento)
VALUES
('pablo-reyes', 'Pablo Reyes', 'Director establecimiento zona norte', 'Liderazgo pedagógico centrado en resultados colectivos.', 'PR', '#1a4a7a', 'directivos'),
('claudia-fuentes', 'Claudia Fuentes', 'Directora establecimiento zona sur', 'Gestión participativa para comunidades escolares fuertes.', 'CF', '#4a1a5a', 'directivos'),
('marisol-huerta', 'Marisol Huerta', 'Escuela Martin Prado', 'Participacion informada con foco en continuidad pedagogica.', 'MH', '#8c4f2f', 'docentes'),
('vianka-mejias', 'Vianka Mejias', 'Colegio República de Costa Rica', 'Coordinacion intersectorial para escuelas mas conectadas.', 'VM', '#355c7d', 'docentes'),
('carmen-lagos', 'Carmen Lagos', 'Colegio República de Costa Rica', 'Reconocimiento y valoración del trabajo asistencial.', 'CL', '#7a3a1a', 'asistentes'),
('miguel-torres', 'Miguel Torres', 'Colegio de Aplicación Artística y Cultural', 'Coordinación efectiva entre equipos de apoyo escolar.', 'MT', '#1a6a6a', 'asistentes'),
('gonzalo-silva', 'Gonzalo Silva', 'Centro General de Padres y Apoderados', 'Voz activa de las familias en las decisiones de la comunidad escolar.', 'GS', '#2a4a1a', 'apoderados')
ON CONFLICT (id) DO NOTHING;
