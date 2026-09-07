import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_NEON_DB_URL = 'postgresql://neondb_owner:npg_hlvfeP93IQco@ep-hidden-star-a5vp6kau-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Create connection pool to Neon database
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.VITE_DATABASE_URL || DEFAULT_NEON_DB_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper for querying
export const query = (text: string, params?: any[]) => pool.query(text, params);
