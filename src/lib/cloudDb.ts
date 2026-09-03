import { neon } from '@neondatabase/serverless';
import { Report } from '../types';

// Fallback to direct Neon Serverless if running in static environment (like Netlify without server.ts)
const getDatabaseUrl = () => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DATABASE_URL) {
    return (import.meta as any).env.VITE_DATABASE_URL;
  }
  if (typeof process !== 'undefined' && process.env?.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  return 'postgresql://neondb_owner:npg_hlvfeP93IQco@ep-hidden-star-a5vp6kau-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
};

let neonClient: ReturnType<typeof neon> | null = null;

function getNeonSql() {
  if (!neonClient) {
    neonClient = neon(getDatabaseUrl());
  }
  return neonClient;
}

function normalizeReportFromRow(row: any): Report {
  const data = (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) || {};
  return {
    ...data,
    id: String(row.id),
    date: row.report_date
      ? (typeof row.report_date === 'string'
          ? row.report_date.split('T')[0]
          : new Date(row.report_date).toISOString().split('T')[0])
      : (data.date || ''),
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
}

/**
 * Fetch all reports from cloud (API first, direct Neon serverless fallback)
 */
export async function fetchReportsCloud(): Promise<Report[]> {
  try {
    const res = await fetch('/api/reports', { headers: { Accept: 'application/json' } });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (e) {
    console.info('API /api/reports not reachable, attempting direct Neon cloud fallback...');
  }

  // Fallback: Direct Neon connection over HTTPS (works on Netlify, mobile, any browser)
  const sql = getNeonSql();
  const rows = await sql`
    SELECT id, report_date, shift, line, leader_name, format, reference, status, data, updated_at
    FROM reports
    ORDER BY updated_at DESC
  `;
  return (rows as any[]).map(normalizeReportFromRow);
}

/**
 * Save / Upsert report in cloud database
 */
export async function saveReportCloud(report: Report): Promise<void> {
  const payload = JSON.stringify(report);

  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: payload
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return;
    }
  } catch (e) {
    console.info('API /api/reports save failed, falling back to direct Neon cloud...');
  }

  // Fallback: Direct Neon serverless upsert
  const sql = getNeonSql();
  const id = String(report.id);
  let reportDate: string | null = report.date || null;
  if (reportDate && !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    try {
      reportDate = new Date(reportDate).toISOString().split('T')[0];
    } catch {
      reportDate = new Date().toISOString().split('T')[0];
    }
  }
  if (!reportDate) {
    reportDate = new Date().toISOString().split('T')[0];
  }

  const shift = report.shift || 'A';
  const line = report.line || '';
  const leaderName = report.leaderName || '';
  const format = report.format || '';
  const reference = report.reference || '';
  const status = report.status || 'EM_ANDAMENTO';
  const obsText = Array.isArray(report.observations)
    ? report.observations.map((o: any) => `${o.time}: ${o.description}`).join('\n')
    : '';
  const finalizedAt = status === 'FINALIZADO' ? new Date().toISOString() : null;

  await sql`
    INSERT INTO reports (id, report_date, shift, line, leader_name, format, reference, status, observations, data, finalized_at)
    VALUES (${id}, ${reportDate}, ${shift}, ${line}, ${leaderName}, ${format}, ${reference}, ${status}, ${obsText}, ${payload}, ${finalizedAt})
    ON CONFLICT (id) DO UPDATE SET
      report_date = EXCLUDED.report_date,
      shift = EXCLUDED.shift,
      line = EXCLUDED.line,
      leader_name = EXCLUDED.leader_name,
      format = EXCLUDED.format,
      reference = EXCLUDED.reference,
      status = EXCLUDED.status,
      observations = EXCLUDED.observations,
      data = EXCLUDED.data,
      updated_at = CURRENT_TIMESTAMP,
      finalized_at = CASE WHEN EXCLUDED.status = 'FINALIZADO' AND reports.finalized_at IS NULL THEN CURRENT_TIMESTAMP ELSE reports.finalized_at END
  `;
}

/**
 * Batch sync pending local reports with cloud database
 */
export async function batchSyncReportsCloud(pendingReports: Report[]): Promise<Report[]> {
  if (pendingReports.length === 0) {
    return fetchReportsCloud();
  }

  try {
    const res = await fetch('/api/reports/batch-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ localReports: pendingReports })
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && Array.isArray(data.reports)) {
        return data.reports;
      }
    }
  } catch (e) {
    console.info('API /api/reports/batch-sync failed, using direct Neon cloud sync...');
  }

  // Fallback: Upsert each pending report directly to Neon
  for (const r of pendingReports) {
    await saveReportCloud(r);
  }

  return fetchReportsCloud();
}

/**
 * Delete report from cloud database
 */
export async function deleteReportCloud(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/reports/${id}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    });
    if (res.ok) return;
  } catch (e) {
    console.info('API DELETE failed, falling back to direct Neon cloud...');
  }

  const sql = getNeonSql();
  await sql`DELETE FROM reports WHERE id = ${id}`;
}

/**
 * Check if cloud database is reachable
 */
export async function pingCloud(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.status === 'ok') return true;
    }
  } catch {
    // try direct neon
  }

  try {
    const sql = getNeonSql();
    await sql`SELECT 1 as ping`;
    return true;
  } catch {
    return false;
  }
}
