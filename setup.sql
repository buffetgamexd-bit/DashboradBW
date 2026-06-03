-- ============================================
-- Cronograma Jurídico — Setup SQL
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Eliminar tabla si existe (para re-crear limpio)
DROP TABLE IF EXISTS clientes;

-- Crear tabla
CREATE TABLE clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  sector TEXT DEFAULT '',
  responsable TEXT NOT NULL,
  notas_count INTEGER DEFAULT 0,

  -- E1: OC Presentada
  e1_status TEXT DEFAULT 'empty',
  e1_monto NUMERIC DEFAULT 0,
  e1_dias INTEGER DEFAULT NULL,

  -- E2: OC Aceptada
  e2_status TEXT DEFAULT 'empty',
  e2_monto NUMERIC DEFAULT 0,
  e2_diff NUMERIC DEFAULT NULL,
  e2_dias INTEGER DEFAULT NULL,

  -- E3: Proc. Admin
  e3_status TEXT DEFAULT 'empty',
  e3_dias INTEGER DEFAULT NULL,

  -- Alta en Portal (opcional)
  alta_portal_status TEXT DEFAULT 'empty',
  alta_portal_dias INTEGER DEFAULT NULL,

  -- E4: Docs Recibidos
  e4_status TEXT DEFAULT 'empty',
  e4_dias INTEGER DEFAULT NULL,

  -- NDA Enviado
  nda_enviado_status TEXT DEFAULT 'empty',
  nda_enviado_dias INTEGER DEFAULT NULL,

  -- NDA Firmado
  nda_firmado_status TEXT DEFAULT 'empty',
  nda_firmado_dias INTEGER DEFAULT NULL,

  -- CTO Enviado
  cto_enviado_status TEXT DEFAULT 'empty',
  cto_enviado_dias INTEGER DEFAULT NULL,

  -- E6A / E6B Sub-estado
  e6_sub_type TEXT DEFAULT NULL,
  e6_sub_desc TEXT DEFAULT NULL,
  e6_dias INTEGER DEFAULT NULL,

  -- Tipo de Pago
  tipo_pago TEXT DEFAULT 'Pago único',

  -- Detalles de Contrato
  fecha_inicio TEXT DEFAULT NULL,
  vigencia TEXT DEFAULT NULL,
  descripcion TEXT DEFAULT NULL,

  -- CTO Firmado
  cto_firmado_status TEXT DEFAULT 'empty',
  cto_firmado_dias INTEGER DEFAULT NULL,

  -- Fechas de etapas para cálculo automático de días
  e1_date TIMESTAMPTZ DEFAULT NULL,
  e2_date TIMESTAMPTZ DEFAULT NULL,
  e3_date TIMESTAMPTZ DEFAULT NULL,
  e4_date TIMESTAMPTZ DEFAULT NULL,
  nda_enviado_date TIMESTAMPTZ DEFAULT NULL,
  nda_firmado_date TIMESTAMPTZ DEFAULT NULL,
  cto_enviado_date TIMESTAMPTZ DEFAULT NULL,
  e6_date TIMESTAMPTZ DEFAULT NULL,
  cto_firmado_date TIMESTAMPTZ DEFAULT NULL,
  alta_portal_date TIMESTAMPTZ DEFAULT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Política: permitir todas las operaciones (público)
CREATE POLICY "Allow all operations" ON clientes
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Datos iniciales (del cronograma de referencia)
-- ============================================

INSERT INTO clientes (nombre, sector, responsable, notas_count,
  e1_status, e1_monto, e2_status, e2_monto,
  e3_status, e3_dias,
  alta_portal_status, e4_status, nda_enviado_status, nda_firmado_status,
  cto_enviado_status, cto_firmado_status)
VALUES ('GICSA', 'Proyectos Inmob.', 'MAJA', 3,
  'closed', 180000, 'closed', 180000,
  'current_verde', 2,
  'empty', 'empty', 'empty', 'empty',
  'empty', 'empty');

INSERT INTO clientes (nombre, sector, responsable, notas_count,
  e1_status, e1_monto, e2_status, e2_monto, e2_diff,
  e3_status, e3_dias,
  alta_portal_status, alta_portal_dias,
  e4_status, nda_enviado_status, nda_firmado_status,
  cto_enviado_status, cto_firmado_status)
VALUES ('Total Play', 'Telecomunicaciones', 'CHUY', 3,
  'closed', 100000, 'closed', 60000, -40000,
  'current_amber', 5,
  'pending', 5,
  'empty', 'empty', 'empty',
  'empty', 'empty');

INSERT INTO clientes (nombre, sector, responsable, notas_count,
  e1_status, e1_monto, e2_status, e2_monto,
  e3_status, alta_portal_status, e4_status,
  nda_enviado_status, nda_firmado_status, nda_firmado_dias,
  cto_enviado_status, cto_firmado_status)
VALUES ('Coast Oil', 'Energía', 'ALONSO', 0,
  'closed', 138000, 'closed', 138000,
  'closed', 'closed', 'closed',
  'closed', 'current_critico', 9,
  'empty', 'empty');

INSERT INTO clientes (nombre, sector, responsable, notas_count,
  e1_status, e1_monto, e2_status, e2_monto,
  e3_status, alta_portal_status, e4_status,
  nda_enviado_status, nda_firmado_status, nda_firmado_dias,
  cto_enviado_status, cto_enviado_dias,
  e6_sub_type, e6_sub_desc, cto_firmado_status)
VALUES ('MTV', 'Media', 'JESÚS', 1,
  'closed', 180000, 'closed', 180000,
  'closed', 'closed', 'closed',
  'closed', 'current_rojo_cli', 4,
  'current_rojo_int', 3,
  'e6b', 'con comentarios', 'empty');

INSERT INTO clientes (nombre, sector, responsable, notas_count,
  e1_status, e1_monto, e2_status, e2_monto,
  e3_status, alta_portal_status, e4_status,
  nda_enviado_status, nda_firmado_status,
  cto_enviado_status, e6_sub_type, e6_sub_desc,
  cto_firmado_status, cto_firmado_dias)
VALUES ('Nuvoil', 'Energía', 'ALONSO', 0,
  'closed', 160000, 'closed', 160000,
  'closed', 'empty', 'empty',
  'empty', 'empty',
  'empty', 'e6a', 'sin comentarios',
  'current_verde', 1);

INSERT INTO clientes (nombre, sector, responsable, notas_count,
  e1_status, e1_monto,
  e2_status,
  e3_status, alta_portal_status, e4_status,
  nda_enviado_status, nda_firmado_status,
  cto_enviado_status, cto_firmado_status)
VALUES ('Apollo', 'Consultoría', 'MAJA', 1,
  'closed', 150000,
  'pending',
  'empty', 'empty', 'empty',
  'empty', 'empty',
  'empty', 'empty');

INSERT INTO clientes (nombre, sector, responsable, notas_count,
  e1_status, e1_monto, e1_dias,
  e2_status, e3_status, alta_portal_status, e4_status,
  nda_enviado_status, nda_firmado_status,
  cto_enviado_status, cto_firmado_status)
VALUES ('Karpowership', 'Energía', 'CEO', 0,
  'current_critico', 235000, 12,
  'empty', 'empty', 'empty', 'empty',
  'empty', 'empty',
  'empty', 'empty');

INSERT INTO clientes (nombre, sector, responsable, notas_count,
  e1_status, e1_monto, e2_status, e2_monto,
  e3_status, alta_portal_status,
  e4_status, e4_dias,
  nda_enviado_status, nda_firmado_status,
  cto_enviado_status, cto_firmado_status)
VALUES ('P.P.A', 'Industrial', 'JESÚS', 0,
  'closed', 235000, 'closed', 235000,
  'closed', 'closed',
  'current_rojo_cli', 4,
  'empty', 'empty',
  'empty', 'empty');
