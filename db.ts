import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool to Neon database
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper for querying
export const query = (text: string, params?: any[]) => pool.query(text, params);
