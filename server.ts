import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
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

  // Example API: Get Defects
  app.get('/api/defects', async (req, res) => {
    try {
      const result = await query('SELECT * FROM defects WHERE active = true ORDER BY code ASC');
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // TODO: Add more API routes (auth, reports, etc.)

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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
