import { neon } from '@neondatabase/serverless';
import { MaintenanceReplacement } from '../types';

export const getDatabaseUrl = () => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DATABASE_URL) {
    return (import.meta as any).env.VITE_DATABASE_URL;
  }
  if (typeof process !== 'undefined' && process.env?.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  return 'postgresql://neondb_owner:npg_hlvfeP93IQco@ep-hidden-star-a5vp6kau-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
};

let neonClient: ReturnType<typeof neon> | null = null;

export function getNeonSql() {
  if (!neonClient) {
    neonClient = neon(getDatabaseUrl());
  }
  return neonClient;
}

const formatSqlDate = (d: any): string => {
  if (!d) return new Date().toISOString().split('T')[0];
  if (typeof d === 'string') return d.substring(0, 10);
  if (d instanceof Date) return d.toISOString().substring(0, 10);
  return String(d).substring(0, 10);
};

/**
 * Busca todas as peças registradas da nuvem
 * (Tenta API primeiro; se indisponível, conecta diretamente ao Neon Serverless via HTTPS)
 */
export async function fetchMaintenanceReplacementsCloud(): Promise<MaintenanceReplacement[]> {
  try {
    const res = await fetch(`/api/maintenance/replacements?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        Accept: 'application/json',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((r: any) => ({
          ...r,
          replacement_date: formatSqlDate(r.replacement_date),
          lifespan_days: Number(r.lifespan_days) || 60,
          alert_lead_days: Number(r.alert_lead_days) || 7,
          syncStatus: 'synced' as const,
        }));
      }
    }
  } catch {
    console.info('API /api/maintenance/replacements indisponível, usando conexão direta Neon HTTPS...');
  }

  // Fallback 100% online via conexão direta Neon Serverless sobre HTTPS
  const sql = getNeonSql();
  const rows = await sql`
    SELECT id, sector, machine, component_name, replacement_date, mechanic_name, lifespan_days, alert_lead_days, notes, created_at
    FROM maintenance_replacements
    ORDER BY created_at DESC
  `;

  return (rows as any[]).map((r) => ({
    id: String(r.id),
    sector: r.sector || 'Prensas',
    machine: r.machine || '',
    component_name: r.component_name || '',
    replacement_date: formatSqlDate(r.replacement_date),
    mechanic_name: r.mechanic_name || 'Mecânico 1',
    lifespan_days: Number(r.lifespan_days) || 60,
    alert_lead_days: Number(r.alert_lead_days) || 7,
    notes: r.notes || '',
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    syncStatus: 'synced' as const,
  }));
}

/**
 * Salva ou atualiza uma peça no banco de dados na nuvem
 */
export async function saveMaintenanceReplacementCloud(item: MaintenanceReplacement): Promise<void> {
  const cleanDate = formatSqlDate(item.replacement_date);
  const cleanLifespan = Number(item.lifespan_days) || 60;
  const cleanAlert = Number(item.alert_lead_days) || 7;

  try {
    const res = await fetch('/api/maintenance/replacements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        id: item.id,
        sector: item.sector,
        machine: item.machine,
        component_name: item.component_name,
        replacement_date: cleanDate,
        mechanic_name: item.mechanic_name,
        lifespan_days: cleanLifespan,
        alert_lead_days: cleanAlert,
        notes: item.notes || '',
      }),
    });
    if (res.ok) {
      return;
    }
  } catch {
    console.info('API save indisponível, salvando diretamente na nuvem Neon...');
  }

  // Fallback direto Neon
  const sql = getNeonSql();
  await sql`
    INSERT INTO maintenance_replacements 
    (id, sector, machine, component_name, replacement_date, mechanic_name, lifespan_days, alert_lead_days, notes)
    VALUES (
      ${item.id},
      ${item.sector || 'Prensas'},
      ${item.machine || ''},
      ${item.component_name || ''},
      ${cleanDate},
      ${item.mechanic_name || 'Mecânico 1'},
      ${cleanLifespan},
      ${cleanAlert},
      ${item.notes || ''}
    )
    ON CONFLICT (id) DO UPDATE SET
      sector = EXCLUDED.sector,
      machine = EXCLUDED.machine,
      component_name = EXCLUDED.component_name,
      replacement_date = EXCLUDED.replacement_date,
      mechanic_name = EXCLUDED.mechanic_name,
      lifespan_days = EXCLUDED.lifespan_days,
      alert_lead_days = EXCLUDED.alert_lead_days,
      notes = EXCLUDED.notes
  `;
}

/**
 * Atualiza campos de uma peça no banco de dados na nuvem
 */
export async function updateMaintenanceReplacementCloud(id: string, updates: Partial<MaintenanceReplacement>): Promise<void> {
  const cleanDate = updates.replacement_date ? formatSqlDate(updates.replacement_date) : null;
  const cleanLifespan = updates.lifespan_days !== undefined ? (Number(updates.lifespan_days) || 60) : null;
  const cleanAlert = updates.alert_lead_days !== undefined ? (Number(updates.alert_lead_days) || 7) : null;

  try {
    const res = await fetch(`/api/maintenance/replacements/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...updates,
        replacement_date: cleanDate,
        lifespan_days: cleanLifespan,
        alert_lead_days: cleanAlert,
      }),
    });
    if (res.ok) {
      return;
    }
  } catch {
    console.info('API update indisponível, atualizando diretamente na nuvem Neon...');
  }

  // Fallback direto Neon
  const sql = getNeonSql();
  await sql`
    UPDATE maintenance_replacements SET
      sector = COALESCE(${updates.sector || null}, sector),
      machine = COALESCE(${updates.machine || null}, machine),
      component_name = COALESCE(${updates.component_name || null}, component_name),
      replacement_date = COALESCE(${cleanDate}, replacement_date),
      mechanic_name = COALESCE(${updates.mechanic_name || null}, mechanic_name),
      lifespan_days = COALESCE(${cleanLifespan}, lifespan_days),
      alert_lead_days = COALESCE(${cleanAlert}, alert_lead_days),
      notes = COALESCE(${updates.notes !== undefined ? updates.notes : null}, notes)
    WHERE id = ${id}
  `;
}

/**
 * Exclui uma peça no banco de dados na nuvem
 */
export async function deleteMaintenanceReplacementCloud(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/maintenance/replacements/${id}`, { method: 'DELETE' });
    if (res.ok) return;
  } catch {
    console.info('API delete indisponível, excluindo diretamente na nuvem Neon...');
  }

  const sql = getNeonSql();
  await sql`DELETE FROM maintenance_replacements WHERE id = ${id}`;
}

/**
 * Busca setores cadastrados no banco de dados na nuvem
 */
export async function fetchMaintenanceSectorsCloud(): Promise<string[]> {
  try {
    const res = await fetch(`/api/maintenance/sectors?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {
    console.info('API sectors indisponível, buscando diretamente no Neon...');
  }

  const sql = getNeonSql();
  const rows = (await sql`SELECT name FROM maintenance_sectors ORDER BY created_at ASC, name ASC`) as any[];
  if (rows && rows.length > 0) {
    return rows.map((r: any) => r.name);
  }
  return ['Prensas', 'Linha de Esmaltação', 'Forno', 'Retífica'];
}

/**
 * Cadastra novo setor na nuvem
 */
export async function addMaintenanceSectorCloud(name: string): Promise<void> {
  const trimmed = name.trim();
  try {
    const res = await fetch('/api/maintenance/sectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) return;
  } catch {}

  const sql = getNeonSql();
  await sql`INSERT INTO maintenance_sectors (name) VALUES (${trimmed}) ON CONFLICT (name) DO NOTHING`;
}

/**
 * Renomeia setor na nuvem
 */
export async function renameMaintenanceSectorCloud(oldName: string, newName: string): Promise<void> {
  const trimmedNew = newName.trim();
  try {
    const res = await fetch('/api/maintenance/sectors/rename', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName, newName: trimmedNew }),
    });
    if (res.ok) return;
  } catch {}

  const sql = getNeonSql();
  await sql`UPDATE maintenance_sectors SET name = ${trimmedNew} WHERE name = ${oldName}`;
  await sql`UPDATE maintenance_replacements SET sector = ${trimmedNew} WHERE sector = ${oldName}`;
}

/**
 * Exclui setor na nuvem
 */
export async function deleteMaintenanceSectorCloud(name: string): Promise<void> {
  try {
    const res = await fetch(`/api/maintenance/sectors/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (res.ok) return;
  } catch {}

  const sql = getNeonSql();
  await sql`DELETE FROM maintenance_sectors WHERE name = ${name}`;
}
