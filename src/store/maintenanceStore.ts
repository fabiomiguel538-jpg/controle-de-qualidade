import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { MaintenanceReplacement } from '../types';

interface MaintenanceState {
  replacements: MaintenanceReplacement[];
  sectors: string[];
  isSyncing: boolean;
  cloudConnected: boolean;
  lastSyncedAt: string | null;

  addReplacement: (data: Omit<MaintenanceReplacement, 'id' | 'created_at' | 'syncStatus'>) => Promise<string>;
  updateReplacement: (id: string, updates: Partial<MaintenanceReplacement>) => Promise<boolean>;
  deleteReplacement: (id: string) => Promise<boolean>;
  fetchReplacements: () => Promise<void>;
  syncPendingReplacements: () => Promise<boolean>;

  fetchSectors: () => Promise<void>;
  addSector: (name: string) => Promise<boolean>;
  editSector: (oldName: string, newName: string) => Promise<boolean>;
  deleteSector: (name: string) => Promise<{ success: boolean; message?: string }>;
}

// Helpers de cálculo de datas
const daysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

const INITIAL_REPLACEMENTS: MaintenanceReplacement[] = [
  {
    id: 'maint-seed-1',
    sector: 'Prensas',
    machine: 'Prensa 01',
    component_name: 'Correia B-75 Exaustor de Pó',
    replacement_date: daysAgo(54),
    mechanic_name: 'Mecânico 1',
    lifespan_days: 60,
    alert_lead_days: 7,
    notes: 'Correia trocada após vibração no exaustor de despoeiramento. Verificar tensão.',
    created_at: new Date().toISOString(),
    syncStatus: 'synced',
  },
  {
    id: 'maint-seed-2',
    sector: 'Prensas',
    machine: 'Prensa 02',
    component_name: 'Rolamento 6205 DDU Polia Principal',
    replacement_date: daysAgo(98),
    mechanic_name: 'Mecânico 1',
    lifespan_days: 90,
    alert_lead_days: 10,
    notes: 'Apresentou aquecimento na última inspeção térmica. Troca emergencial requerida.',
    created_at: new Date().toISOString(),
    syncStatus: 'synced',
  },
  {
    id: 'maint-seed-3',
    sector: 'Linha de Esmaltação',
    machine: 'Linha 02 - Esmaltação',
    component_name: 'Bomba Diafragma Graco 1.5"',
    replacement_date: daysAgo(15),
    mechanic_name: 'Mecânico 1',
    lifespan_days: 120,
    alert_lead_days: 15,
    notes: 'Substituição das esferas e diafragmas de PTFE. Pressão nominal 4.5 bar.',
    created_at: new Date().toISOString(),
    syncStatus: 'synced',
  },
  {
    id: 'maint-seed-4',
    sector: 'Forno',
    machine: 'Forno Contínuo 01',
    component_name: 'Roletes Cerâmicos Zona de Queima (Mód. 14)',
    replacement_date: daysAgo(176),
    mechanic_name: 'Mecânico 1',
    lifespan_days: 180,
    alert_lead_days: 14,
    notes: 'Roletes com acúmulo de esmalte e leve ovalização. Programar parada de turno.',
    created_at: new Date().toISOString(),
    syncStatus: 'synced',
  },
  {
    id: 'maint-seed-5',
    sector: 'Retífica',
    machine: 'Retificadora Linha 01',
    component_name: 'Rebolo Diamantado Bisotador Grana 120',
    replacement_date: daysAgo(35),
    mechanic_name: 'Mecânico 1',
    lifespan_days: 30,
    alert_lead_days: 5,
    notes: 'Rebolo atingiu espessura mínima de segurança. Necessário ajuste e troca imediata.',
    created_at: new Date().toISOString(),
    syncStatus: 'synced',
  },
  {
    id: 'maint-seed-6',
    sector: 'Linha de Esmaltação',
    machine: 'Campana 01',
    component_name: 'Correia Dentada T10 da Campana',
    replacement_date: daysAgo(8),
    mechanic_name: 'Mecânico 1',
    lifespan_days: 90,
    alert_lead_days: 10,
    notes: 'Alinhamento verificado com laser. Funcionamento perfeitamente suave.',
    created_at: new Date().toISOString(),
    syncStatus: 'synced',
  },
];

const DEFAULT_SECTORS = ['Prensas', 'Linha de Esmaltação', 'Forno', 'Retífica'];

export const useMaintenanceStore = create<MaintenanceState>()(
  persist(
    (set, get) => ({
      replacements: INITIAL_REPLACEMENTS,
      sectors: DEFAULT_SECTORS,
      isSyncing: false,
      cloudConnected: true,
      lastSyncedAt: null,

      addReplacement: async (data) => {
        const id = uuidv4();
        const newRecord: MaintenanceReplacement = {
          ...data,
          id,
          created_at: new Date().toISOString(),
          syncStatus: 'pending',
        };

        set((state) => ({
          replacements: [newRecord, ...state.replacements],
        }));

        // Tenta enviar para o backend (Neon DB via API)
        try {
          const res = await fetch('/api/maintenance/replacements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRecord),
          });

          if (res.ok) {
            set((state) => ({
              cloudConnected: true,
              lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              replacements: state.replacements.map((r) =>
                r.id === id ? { ...r, syncStatus: 'synced' } : r
              ),
            }));
          } else {
            set({ cloudConnected: false });
          }
        } catch (e) {
          // Offline seguro
          set({ cloudConnected: false });
        }

        return id;
      },

      updateReplacement: async (id, updates) => {
        set((state) => ({
          replacements: state.replacements.map((r) =>
            r.id === id ? { ...r, ...updates, syncStatus: 'pending' } : r
          ),
        }));

        const updated = get().replacements.find((r) => r.id === id);
        if (!updated) return false;

        try {
          const res = await fetch(`/api/maintenance/replacements/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
          });

          if (res.ok) {
            set((state) => ({
              cloudConnected: true,
              lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              replacements: state.replacements.map((r) =>
                r.id === id ? { ...r, syncStatus: 'synced' } : r
              ),
            }));
            return true;
          }
        } catch {
          set({ cloudConnected: false });
        }
        return false;
      },

      deleteReplacement: async (id) => {
        set((state) => ({
          replacements: state.replacements.filter((r) => r.id !== id),
        }));

        try {
          await fetch(`/api/maintenance/replacements/${id}`, { method: 'DELETE' });
          return true;
        } catch {
          return true;
        }
      },

      fetchReplacements: async () => {
        set({ isSyncing: true });
        try {
          const res = await fetch('/api/maintenance/replacements');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              set({
                replacements: data,
                cloudConnected: true,
                isSyncing: false,
                lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              });
              return;
            }
          }
        } catch {
          // Fallback para cache local
        }
        set({ isSyncing: false });
      },

      syncPendingReplacements: async () => {
        const pending = get().replacements.filter((r) => r.syncStatus === 'pending');
        if (pending.length === 0) return true;

        set({ isSyncing: true });
        try {
          for (const item of pending) {
            const res = await fetch('/api/maintenance/replacements', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item),
            });
            if (res.ok) {
              set((state) => ({
                replacements: state.replacements.map((r) =>
                  r.id === item.id ? { ...r, syncStatus: 'synced' } : r
                ),
              }));
            }
          }
          set({
            isSyncing: false,
            cloudConnected: true,
            lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
          return true;
        } catch {
          set({ isSyncing: false, cloudConnected: false });
          return false;
        }
      },

      fetchSectors: async () => {
        try {
          const res = await fetch('/api/maintenance/sectors');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              set({ sectors: data });
            }
          }
        } catch {
          // Usa os setores em cache
        }
      },

      addSector: async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return false;

        const current = get().sectors;
        if (current.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
          throw new Error('Já existe um setor com este nome.');
        }

        set((state) => ({
          sectors: [...state.sectors, trimmed],
        }));

        try {
          await fetch('/api/maintenance/sectors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmed }),
          });
          return true;
        } catch {
          return true;
        }
      },

      editSector: async (oldName: string, newName: string) => {
        const trimmedNew = newName.trim();
        if (!trimmedNew || trimmedNew === oldName) return false;

        const current = get().sectors;
        if (current.some((s) => s.toLowerCase() === trimmedNew.toLowerCase() && s.toLowerCase() !== oldName.toLowerCase())) {
          throw new Error('Já existe um setor com este nome.');
        }

        // Atualiza a lista de setores E atualiza todos os componentes que tinham esse setor!
        set((state) => ({
          sectors: state.sectors.map((s) => (s === oldName ? trimmedNew : s)),
          replacements: state.replacements.map((r) =>
            r.sector === oldName ? { ...r, sector: trimmedNew, syncStatus: 'pending' } : r
          ),
        }));

        try {
          await fetch('/api/maintenance/sectors/rename', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldName, newName: trimmedNew }),
          });
          return true;
        } catch {
          return true;
        }
      },

      deleteSector: async (name: string) => {
        const inUseCount = get().replacements.filter((r) => r.sector === name).length;
        if (inUseCount > 0) {
          return {
            success: false,
            message: `Não é possível excluir: existem ${inUseCount} peça(s) associada(s) ao setor "${name}". Reatribua-as antes de remover.`,
          };
        }

        set((state) => ({
          sectors: state.sectors.filter((s) => s !== name),
        }));

        try {
          await fetch(`/api/maintenance/sectors/${encodeURIComponent(name)}`, {
            method: 'DELETE',
          });
        } catch {
          // Offline
        }

        return { success: true };
      },
    }),
    {
      name: 'viva-maintenance-storage',
    }
  )
);
