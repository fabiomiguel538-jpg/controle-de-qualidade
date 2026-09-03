import { pool } from './db.js';
import bcrypt from 'bcryptjs';

const DEFECTS_SEED = [
  { code: 1, name: "Agulhado" },
  { code: 2, name: "Bolha de Campana" },
  { code: 3, name: "Bolhas (Peças com ar)" },
  { code: 4, name: "Calibrado" },
  { code: 5, name: "Calibrado Recalcado" },
  { code: 6, name: "Camada de esmalte baixa" },
  { code: 7, name: "Canto quebrado" },
  { code: 8, name: "Casca" },
  { code: 9, name: "Colaminação no esmalte" },
  { code: 10, name: "Descascado" },
  { code: 11, name: "Desperte Calibre" },
  { code: 12, name: "Descarte de bitola" },
  { code: 13, name: "Desenho fora de esquadro" },
  { code: 14, name: "Esmalte fora da linha" },
  { code: 15, name: "Empeno Negativo" },
  { code: 16, name: "Empeno Positivo" },
  { code: 17, name: "Esmalte" },
  { code: 18, name: "Pingo de Gota / Astro" },
  { code: 19, name: "Excesso Positivo (bado)" },
  { code: 20, name: "Falha de Decoração" },
  { code: 21, name: "Falha de Aplicação Astro" },
  { code: 22, name: "Falha de Retífica" },
  { code: 23, name: "Ferido" },
  { code: 24, name: "Fundo do esmalte" },
  { code: 25, name: "Guida de Punção" },
  { code: 26, name: "Guida de Tela" },
  { code: 27, name: "Grumos" },
  { code: 28, name: "Lascado" },
  { code: 29, name: "Lascamento do forno" },
  { code: 30, name: "Metalizado" },
  { code: 31, name: "Peça Estourada do Forno" },
  { code: 32, name: "Pingo de Água" },
  { code: 33, name: "Pingo de tinta" },
  { code: 34, name: "Pingo de Tinta Kerajet" },
  { code: 35, name: "Pinhito" },
  { code: 36, name: "Puxado do forno" },
  { code: 37, name: "Rachado do forno" },
  { code: 38, name: "Remontado do forno" },
  { code: 39, name: "Rebarba de prensa" },
  { code: 40, name: "Repingo de derrete murita" },
  { code: 41, name: "Risco de Campana" },
  { code: 42, name: "Risco de esmalte" },
  { code: 43, name: "Risco de Kerajet" },
  { code: 44, name: "Risco de tela" },
  { code: 45, name: "Sujeira de chama" },
  { code: 46, name: "Sujeira de linha" },
  { code: 47, name: "Sujeira do forno" },
  { code: 48, name: "Tonalidade diferente / mudança" },
  { code: 49, name: "Tonalidade misturada" },
  { code: 50, name: "Trinca" },
  { code: 51, name: "Verruga" }
];

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Enable UUID extension
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // 1. users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'LIDER',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. reports
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_date DATE NOT NULL,
        shift VARCHAR(10) NOT NULL,
        line VARCHAR(50),
        leader_id UUID REFERENCES users(id),
        format VARCHAR(50),
        reference VARCHAR(100),
        start_time VARCHAR(20),
        end_time VARCHAR(20),
        status VARCHAR(50) DEFAULT 'EM_ANDAMENTO',
        observations TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        finalized_at TIMESTAMP WITH TIME ZONE
      );
    `);

    // 3. thickness_measurements
    await client.query(`
      CREATE TABLE IF NOT EXISTS thickness_measurements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
        measurement_time VARCHAR(20),
        cv VARCHAR(20),
        l1 NUMERIC,
        l2 NUMERIC,
        l3 NUMERIC,
        l4 NUMERIC,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. warp_measurements (Empeno)
    await client.query(`
      CREATE TABLE IF NOT EXISTS warp_measurements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
        measurement_time VARCHAR(20),
        pc1 NUMERIC,
        pc2 NUMERIC,
        pc3 NUMERIC,
        pc4 NUMERIC,
        pc5 NUMERIC,
        pc6 NUMERIC,
        pc7 NUMERIC,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. central_curvature_measurements
    await client.query(`
      CREATE TABLE IF NOT EXISTS central_curvature_measurements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
        measurement_time VARCHAR(20),
        pc1 NUMERIC,
        pc2 NUMERIC,
        pc3 NUMERIC,
        pc4 NUMERIC,
        pc5 NUMERIC,
        pc6 NUMERIC,
        pc7 NUMERIC,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. lateral_curvature_measurements
    await client.query(`
      CREATE TABLE IF NOT EXISTS lateral_curvature_measurements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
        measurement_time VARCHAR(20),
        pc1 NUMERIC,
        pc2 NUMERIC,
        pc3 NUMERIC,
        pc4 NUMERIC,
        pc5 NUMERIC,
        pc6 NUMERIC,
        pc7 NUMERIC,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. defects
    await client.query(`
      CREATE TABLE IF NOT EXISTS defects (
        id SERIAL PRIMARY KEY,
        code INTEGER UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. report_defects
    await client.query(`
      CREATE TABLE IF NOT EXISTS report_defects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
        defect_id INTEGER REFERENCES defects(id),
        defect_time VARCHAR(20),
        quantity INTEGER DEFAULT 1,
        observation TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. report_observations
    await client.query(`
      CREATE TABLE IF NOT EXISTS report_observations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
        observation_time VARCHAR(20),
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. report_changes
    await client.query(`
      CREATE TABLE IF NOT EXISTS report_changes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
        change_time VARCHAR(20),
        initial_value VARCHAR(100),
        final_value VARCHAR(100),
        visual VARCHAR(100),
        observation TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11. process_information
    await client.query(`
      CREATE TABLE IF NOT EXISTS process_information (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_id UUID REFERENCES reports(id) ON DELETE CASCADE UNIQUE,
        gramatura NUMERIC,
        carga NUMERIC,
        pressao NUMERIC,
        caixa NUMERIC,
        peso_cx NUMERIC,
        taratura NUMERIC,
        corte NUMERIC,
        lascamento NUMERIC,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed Defects if empty
    const { rows: defectRows } = await client.query('SELECT count(*) FROM defects');
    if (parseInt(defectRows[0].count) === 0) {
      console.log('Seeding initial defects...');
      const insertQuery = `INSERT INTO defects (code, name) VALUES ($1, $2)`;
      for (const defect of DEFECTS_SEED) {
        await client.query(insertQuery, [defect.code, defect.name]);
      }
    }

    // Create an Admin user if users table is empty
    const { rows: userRows } = await client.query('SELECT count(*) FROM users');
    if (parseInt(userRows[0].count) === 0) {
      console.log('Seeding initial admin and lider user...');
      const adminHash = await bcrypt.hash('admin123', 10);
      await client.query(`INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)`, ['Administrador', 'admin@ceramica.com', adminHash, 'ADMIN']);
      
      const liderHash = await bcrypt.hash('lider123', 10);
      await client.query(`INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)`, ['Líder Turno A', 'lider@ceramica.com', liderHash, 'LIDER']);
    }

    await client.query('COMMIT');
    console.log('Database initialized successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed to initialize database:', e);
  } finally {
    client.release();
  }
}
