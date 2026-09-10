import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { MaintenanceReplacement } from '../types';
import {
  fetchMaintenanceReplacementsCloud,
  saveMaintenanceReplacementCloud,
  updateMaintenanceReplacementCloud,
  deleteMaintenanceReplacementCloud,
  fetchMaintenanceSectorsCloud,
  addMaintenanceSectorCloud,
  renameMaintenanceSectorCloud,
  deleteMaintenanceSectorCloud,
} from '../lib/maintenanceCloudDb';

interface MaintenanceState {
  replacements: MaintenanceReplacement[];
  sectors: string[];
  deletedIds: string[];
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
      deletedIds: [],
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

        // Adiciona imediatamente ao estado local (UI instantânea)
        set((state) => ({
          replacements: [newRecord, ...state.replacements],
        }));

        // Envia para o banco de dados online na nuvem (API ou Neon direto)
        try {
          await saveMaintenanceReplacementCloud(newRecord);
          set((state) => ({
            cloudConnected: true,
            lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            replacements: state.replacements.map((r) =>
              r.id === id ? { ...r, syncStatus: 'synced' } : r
            ),
          }));
        } catch (e) {
          console.error('Erro de conexão ao salvar peça:', e);
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

        try {
          await updateMaintenanceReplacementCloud(id, updates);
          set((state) => ({
            cloudConnected: true,
            lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            replacements: state.replacements.map((r) =>
              r.id === id ? { ...r, syncStatus: 'synced' } : r
            ),
          }));
          return true;
        } catch (e) {
          console.error('Erro ao atualizar peça na nuvem:', e);
          set({ cloudConnected: false });
          return false;
        }
      },

      deleteReplacement: async (id) => {
        set((state) => {
          const currentDeleted = Array.isArray(state.deletedIds) ? state.deletedIds : [];
          return {
            replacements: state.replacements.filter((r) => r.id !== id),
            deletedIds: [...currentDeleted, id],
          };
        });

        try {
          await deleteMaintenanceReplacementCloud(id);
          set((state) => {
            return {
              cloudConnected: true,
              // Mantemos o id na lista de excluídos para garantir que fetchReplacements
              // não o traga de volta caso aconteça uma race condition com outro cliente
              // ou cache da API
              lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            };
          });
          return true;
        } catch (e) {
          console.error('Erro ao excluir peça na nuvem:', e);
          set({ cloudConnected: false });
          return false;
        }
      },

      fetchReplacements: async () => {
        set({ isSyncing: true });
        try {
          const cloudData = await fetchMaintenanceReplacementsCloud();
          if (Array.isArray(cloudData)) {
            set((state) => {
              // Preserva registros pendentes locais que ainda não foram persistidos
              const localPending = state.replacements.filter((r) => r.syncStatus === 'pending');
              const pendingMap = new Map(localPending.map((r) => [r.id, r]));
              const deletedSet = new Set(state.deletedIds || []);

              // Mescla os dados da nuvem, garantindo que itens deletados localmente (offline) não retornem
              const merged = cloudData
                .filter(cr => !deletedSet.has(cr.id))
                .map((cr: MaintenanceReplacement) => {
                  if (pendingMap.has(cr.id)) {
                    return pendingMap.get(cr.id)!;
                  }
                  return { ...cr, syncStatus: 'synced' as const };
                });

              // Adiciona locais pendentes que não estão no cloud
              const cloudIds = new Set(cloudData.map((cr: any) => cr.id));
              const newLocalOnly = localPending.filter((lr) => !cloudIds.has(lr.id));

              return {
                replacements: [...newLocalOnly, ...merged],
                cloudConnected: true,
                isSyncing: false,
                lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              };
            });

            // Se houver pendências locais (ou deleções), tenta sincronizar em segundo plano
            const hasPending = get().replacements.some((r) => r.syncStatus === 'pending') || (get().deletedIds || []).length > 0;
            if (hasPending) {
              get().syncPendingReplacements();
            }
            return;
          }
        } catch (e) {
          console.warn('Falha ao obter lista atualizada da nuvem:', e);
          set({ cloudConnected: false });
        }
        set({ isSyncing: false });
      },

      syncPendingReplacements: async () => {
        const pending = get().replacements.filter((r) => r.syncStatus === 'pending');
        const pendingDeletes = get().deletedIds || [];
        
        if (pending.length === 0 && pendingDeletes.length === 0) return true;

        set({ isSyncing: true });
        let hasError = false;
        
        // Sincroniza novos/editados
        for (const item of pending) {
          try {
            await saveMaintenanceReplacementCloud(item);
            set((state) => ({
              replacements: state.replacements.map((r) =>
                r.id === item.id ? { ...r, syncStatus: 'synced' } : r
              ),
            }));
          } catch (err) {
            console.error('Erro ao sincronizar item pendente:', item.id, err);
            hasError = true;
          }
        }

        // Sincroniza deleções pendentes (quando o usuário deletou estando offline)
        for (const delId of pendingDeletes) {
          try {
            await deleteMaintenanceReplacementCloud(delId);
            // Mantemos o id na lista para evitar race conditions com fetchReplacements
          } catch (err) {
            console.error('Erro ao sincronizar exclusão pendente:', delId, err);
            hasError = true;
          }
        }

        set({
          isSyncing: false,
          cloudConnected: !hasError,
          lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
        return !hasError;
      },

      fetchSectors: async () => {
        try {
          const cloudSectors = await fetchMaintenanceSectorsCloud();
          if (Array.isArray(cloudSectors) && cloudSectors.length > 0) {
            set({ sectors: cloudSectors });
          }
        } catch {
          // Mantém setores em cache
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
          await addMaintenanceSectorCloud(trimmed);
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

        // Atualiza a lista de setores E atualiza todos os componentes que tinham esse setor
        set((state) => ({
          sectors: state.sectors.map((s) => (s === oldName ? trimmedNew : s)),
          replacements: state.replacements.map((r) =>
            r.sector === oldName ? { ...r, sector: trimmedNew, syncStatus: 'pending' } : r
          ),
        }));

        try {
          await renameMaintenanceSectorCloud(oldName, trimmedNew);
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
          await deleteMaintenanceSectorCloud(name);
        } catch {
          // Offline
        }

        return { success: true };
      },
    }),
    {
      name: 'viva-maintenance-storage',
      partialize: (state) => ({
        replacements: state.replacements,
        sectors: state.sectors,
        deletedIds: state.deletedIds || [],
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.cloudConnected = true;
          state.isSyncing = false;
        }
      },
    }
  )
);
