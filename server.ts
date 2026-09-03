import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initDatabase } from './init-db.js';
import { query } from './db.js';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Wait for DB initialization (only warning if no DATABASE_URL, won't crash so UI can still load)
  if (process.env.DATABASE_URL) {
    await initDatabase();
  } else {
    console.warn("WARNING: DATABASE_URL not set. Database not initialized.");
  }

  // --- API Routes ---
  
  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', dbConnected: !!process.env.DATABASE_URL });
  });

  // Authentication: Login
  app.post('/api/login', async (req, res) => {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Banco de dados não configurado.' });
    }
    
    try {
      const { username, password } = req.body;
      const result = await query('SELECT * FROM users WHERE email = $1', [username]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Usuário não encontrado.' });
      }
      
      const user = result.rows[0];
      const isValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isValid) {
        return res.status(401).json({ error: 'Senha incorreta.' });
      }
      
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
      
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Example API: Get Defects
  app.get('/api/defects', async (req, res) => {
    try {
      const result = await query('SELECT * FROM defects WHERE active = true ORDER BY code ASC');
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Helper to upsert a report in cloud database
  async function upsertReportInDb(report: any) {
    if (!report || !report.id) return null;

    const id = report.id;
    const reportDate = report.date || new Date().toISOString().split('T')[0];
    const shift = report.shift || 'A';
    const line = report.line || '';
    const leaderName = report.leaderName || '';
    const format = report.format || '';
    const reference = report.reference || '';
    const status = report.status || 'EM_ANDAMENTO';
    const obsText = Array.isArray(report.observations)
      ? report.observations.map((o: any) => `${o.time}: ${o.description}`).join('\n')
      : '';
    const finalizedAt = status === 'FINALIZADO' ? new Date() : null;

    // Check existing
    const existing = await query('SELECT id FROM reports WHERE id = $1', [id]);
    if (existing.rows.length > 0) {
      await query(`
        UPDATE reports
        SET report_date = $1, shift = $2, line = $3, leader_name = $4, format = $5, reference = $6,
            status = $7, observations = $8, data = $9, updated_at = CURRENT_TIMESTAMP,
            finalized_at = CASE WHEN $7 = 'FINALIZADO' AND finalized_at IS NULL THEN CURRENT_TIMESTAMP ELSE finalized_at END
        WHERE id = $10
      `, [reportDate, shift, line, leaderName, format, reference, status, obsText, JSON.stringify(report), id]);
    } else {
      await query(`
        INSERT INTO reports (id, report_date, shift, line, leader_name, format, reference, status, observations, data, finalized_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [id, reportDate, shift, line, leaderName, format, reference, status, obsText, JSON.stringify(report), finalizedAt]);
    }
    return id;
  }

  // Cloud API: Get all reports from PostgreSQL
  app.get('/api/reports', async (req, res) => {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Banco de dados não configurado.' });
    }
    try {
      const result = await query(`
        SELECT id, report_date, shift, line, leader_name, format, reference, status, data, updated_at, created_at, finalized_at
        FROM reports
        ORDER BY updated_at DESC
      `);

      const reports = result.rows.map(row => {
        const data = row.data || {};
        return {
          ...data,
          id: row.id,
          date: row.report_date ? new Date(row.report_date).toISOString().split('T')[0] : (data.date || ''),
          shift: row.shift || data.shift || 'A',
          line: row.line || data.line || '',
          leaderName: row.leader_name || data.leaderName || '',
          format: row.format || data.format || '',
          reference: row.reference || data.reference || '',
          status: row.status || data.status || 'EM_ANDAMENTO',
          thickness: data.thickness || [],
          warp: data.warp || [],
          centralCurvature: data.centralCurvature || [],
          lateralCurvature: data.lateralCurvature || [],
          boxWeights: data.boxWeights || [],
          processChecks: data.processChecks || [],
          defects: data.defects || [],
          observations: data.observations || [],
          changes: data.changes || [],
          processInfo: data.processInfo || {},
          syncStatus: 'synced',
          updatedAt: row.updated_at
        };
      });

      res.json(reports);
    } catch (e: any) {
      console.error('Error fetching reports from database:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Cloud API: Get single report
  app.get('/api/reports/:id', async (req, res) => {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Banco de dados não configurado.' });
    }
    try {
      const { id } = req.params;
      const result = await query('SELECT * FROM reports WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Relatório não encontrado' });
      }
      const row = result.rows[0];
      const data = row.data || {};
      res.json({
        ...data,
        id: row.id,
        date: row.report_date ? new Date(row.report_date).toISOString().split('T')[0] : (data.date || ''),
        shift: row.shift || data.shift || 'A',
        line: row.line || data.line || '',
        leaderName: row.leader_name || data.leaderName || '',
        format: row.format || data.format || '',
        reference: row.reference || data.reference || '',
        status: row.status || data.status || 'EM_ANDAMENTO',
        thickness: data.thickness || [],
        warp: data.warp || [],
        centralCurvature: data.centralCurvature || [],
        lateralCurvature: data.lateralCurvature || [],
        boxWeights: data.boxWeights || [],
        processChecks: data.processChecks || [],
        defects: data.defects || [],
        observations: data.observations || [],
        changes: data.changes || [],
        processInfo: data.processInfo || {},
        syncStatus: 'synced'
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Cloud API: Save / Upsert report in cloud database
  app.post('/api/reports', async (req, res) => {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Banco de dados não configurado.' });
    }
    try {
      const report = req.body;
      if (!report || !report.id) {
        return res.status(400).json({ error: 'ID do relatório é obrigatório.' });
      }

      await upsertReportInDb(report);
      res.json({ success: true, id: report.id, syncStatus: 'synced' });
    } catch (e: any) {
      console.error('Error saving report:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Cloud API: Batch synchronization (merges local reports with cloud database)
  app.post('/api/reports/batch-sync', async (req, res) => {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Banco de dados não configurado.' });
    }
    try {
      const { localReports } = req.body;
      if (Array.isArray(localReports)) {
        for (const r of localReports) {
          if (r && r.id && r.syncStatus === 'pending') {
            await upsertReportInDb(r);
          }
        }
      }

      // Return all cloud reports
      const result = await query(`
        SELECT id, report_date, shift, line, leader_name, format, reference, status, data, updated_at
        FROM reports
        ORDER BY updated_at DESC
      `);

      const allReports = result.rows.map(row => {
        const data = row.data || {};
        return {
          ...data,
          id: row.id,
          date: row.report_date ? new Date(row.report_date).toISOString().split('T')[0] : (data.date || ''),
          shift: row.shift || data.shift || 'A',
          line: row.line || data.line || '',
          leaderName: row.leader_name || data.leaderName || '',
          format: row.format || data.format || '',
          reference: row.reference || data.reference || '',
          status: row.status || data.status || 'EM_ANDAMENTO',
          thickness: data.thickness || [],
          warp: data.warp || [],
          centralCurvature: data.centralCurvature || [],
          lateralCurvature: data.lateralCurvature || [],
          boxWeights: data.boxWeights || [],
          processChecks: data.processChecks || [],
          defects: data.defects || [],
          observations: data.observations || [],
          changes: data.changes || [],
          processInfo: data.processInfo || {},
          syncStatus: 'synced',
          updatedAt: row.updated_at
        };
      });

      res.json({ success: true, reports: allReports });
    } catch (e: any) {
      console.error('Error in batch sync:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Cloud API: Delete report
  app.delete('/api/reports/:id', async (req, res) => {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: 'Banco de dados não configurado.' });
    }
    try {
      const { id } = req.params;
      await query('DELETE FROM reports WHERE id = $1', [id]);
      res.json({ success: true, message: 'Relatório excluído com sucesso.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    // Use express versions compat
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
