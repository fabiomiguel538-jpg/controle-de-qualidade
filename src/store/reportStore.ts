import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

localforage.config({
  name: 'CeramicaDefeitosApp',
  storeName: 'reports_offline_store',
});

// Utility for mapping localforage to Zustand persist
const storage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await localforage.getItem(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await localforage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await localforage.removeItem(name);
  },
};

export type ReportStatus = 'EM_ANDAMENTO' | 'FINALIZADO';

export interface Defect {
  code: number;
  name: string;
}

export interface Report {
  id: string;
  date: string;
  shift: string;
  line: string;
  leaderName: string;
  format: string;
  reference: string;
  status: ReportStatus;
  
  thickness: { time: string, cv: string, l1: number, l2: number, l3: number, l4: number }[];
  warp: { time: string, pc1: number, pc1_s?: number[], pc2: number, pc2_s?: number[], pc3: number, pc3_s?: number[], pc4: number, pc4_s?: number[], pc5: number, pc5_s?: number[], pc6: number, pc6_s?: number[], pc7: number, pc7_s?: number[] }[];
  centralCurvature: { time: string, pc1: number, pc1_s?: number[], pc2: number, pc2_s?: number[], pc3: number, pc3_s?: number[], pc4: number, pc4_s?: number[], pc5: number, pc5_s?: number[], pc6: number, pc6_s?: number[], pc7: number, pc7_s?: number[] }[];
  lateralCurvature: { time: string, pc1: number, pc1_s?: number[], pc2: number, pc2_s?: number[], pc3: number, pc3_s?: number[], pc4: number, pc4_s?: number[], pc5: number, pc5_s?: number[], pc6: number, pc6_s?: number[], pc7: number, pc7_s?: number[] }[];
  
  boxWeights: { time: string, weight: number }[];
  processChecks: { time: string, taratura: 'OK' | 'Ruim' | '-', corte: 'OK' | 'Ruim' | '-', lascamento: 'OK' | 'Ruim' | '-' }[];

  defects: { defectId: number, name: string, time: string, quantity: number, observation?: string }[];
  observations: { time: string, description: string }[];
  changes: { time: string, initial: string, final: string, visual: string, observation: string }[];
  
  processInfo: {
    gramatura?: number;
    carga?: number;
    pressao?: number;
    caixa?: number;
    peso_cx?: number;
    taratura?: 'OK' | 'Ruim';
    corte?: 'OK' | 'Ruim';
    lascamento?: 'OK' | 'Ruim';
  };

  syncStatus: 'synced' | 'pending';
}

interface ReportState {
  reports: Report[];
  currentReportId: string | null;
  isSyncing: boolean;
  cloudConnected: boolean;
  lastSyncedAt: string | null;
  
  setCurrentReport: (id: string | null) => void;
  createNewReport: (info: Partial<Report>) => string;
  updateCurrentReport: (updates: Partial<Report>) => void;
  finalizeReport: (id: string) => Promise<void>;
  markSynced: (id: string) => void;
  deleteReport: (id: string) => Promise<void>;
  fetchFromCloud: () => Promise<void>;
  syncPendingReports: () => Promise<void>;
  saveReportNow: (id?: string) => Promise<void>;
}

let syncTimeout: any = null;

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: [],
      currentReportId: null,
      isSyncing: false,
      cloudConnected: true,
      lastSyncedAt: null,

      setCurrentReport: (id) => set({ currentReportId: id }),

      createNewReport: (info) => {
        const id = uuidv4();
        const newReport: Report = {
          id,
          date: info.date || new Date().toISOString().split('T')[0],
          shift: info.shift || 'A',
          line: info.line || '',
          leaderName: info.leaderName || '',
          format: info.format || '',
          reference: info.reference || '',
          status: 'EM_ANDAMENTO',
          thickness: [],
          warp: [],
          centralCurvature: [],
          lateralCurvature: [],
          boxWeights: [],
          processChecks: [],
          defects: [],
          observations: [],
          changes: [],
          processInfo: {},
          syncStatus: 'pending',
          ...info,
        };

        set((state) => ({
          reports: [newReport, ...state.reports.filter(r => r.id !== id)],
          currentReportId: id,
        }));

        // Immediately push new report to cloud
        setTimeout(() => {
          get().saveReportNow(id);
        }, 100);

        return id;
      },

      updateCurrentReport: (updates) => {
        const currentId = get().currentReportId;
        if (!currentId) return;

        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === currentId
              ? { ...r, ...updates, syncStatus: 'pending' }
              : r
          ),
        }));

        // Debounce cloud sync to avoid spamming on every keystroke
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
          get().saveReportNow(currentId);
        }, 800);
      },

      saveReportNow: async (idToSave?: string) => {
        const targetId = idToSave || get().currentReportId;
        if (!targetId) return;

        const targetReport = get().reports.find(r => r.id === targetId);
        if (!targetReport) return;

        set({ isSyncing: true });
        try {
          const res = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(targetReport),
          });

          if (res.ok) {
            set((state) => ({
              isSyncing: false,
              cloudConnected: true,
              lastSyncedAt: new Date().toLocaleTimeString(),
              reports: state.reports.map((r) =>
                r.id === targetId ? { ...r, syncStatus: 'synced' } : r
              ),
            }));
          } else {
            set({ isSyncing: false });
          }
        } catch (e) {
          console.warn('Could not sync report to cloud (working offline):', e);
          set({ isSyncing: false, cloudConnected: false });
        }
      },

      finalizeReport: async (id) => {
        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === id ? { ...r, status: 'FINALIZADO', syncStatus: 'pending' } : r
          ),
          currentReportId: state.currentReportId === id ? null : state.currentReportId
        }));

        await get().saveReportNow(id);
      },

      deleteReport: async (id) => {
        set((state) => ({
          reports: state.reports.filter(r => r.id !== id),
          currentReportId: state.currentReportId === id ? null : state.currentReportId
        }));

        try {
          await fetch(`/api/reports/${id}`, { method: 'DELETE' });
        } catch (e) {
          console.warn('Failed to delete report on cloud:', e);
        }
      },

      fetchFromCloud: async () => {
        set({ isSyncing: true });
        try {
          const res = await fetch('/api/reports');
          if (!res.ok) throw new Error('Failed to fetch reports from cloud');
          const cloudReports: Report[] = await res.json();

          set((state) => {
            // Keep local reports that have pending changes and haven't synced yet
            const localPending = state.reports.filter(r => r.syncStatus === 'pending');
            const pendingMap = new Map(localPending.map(r => [r.id, r]));

            // Merge cloud reports, preferring local un-synced edits
            const merged = cloudReports.map(cr => {
              if (pendingMap.has(cr.id)) {
                return pendingMap.get(cr.id)!;
              }
              return { ...cr, syncStatus: 'synced' as const };
            });

            // Include any brand new local reports not yet present on cloud
            const cloudIds = new Set(cloudReports.map(cr => cr.id));
            const newLocalOnly = localPending.filter(lr => !cloudIds.has(lr.id));

            return {
              reports: [...newLocalOnly, ...merged],
              isSyncing: false,
              cloudConnected: true,
              lastSyncedAt: new Date().toLocaleTimeString(),
            };
          });

          // Sync any pending items in background
          get().syncPendingReports();
        } catch (e) {
          console.warn('Error connecting to cloud reports (using offline cache):', e);
          set({ isSyncing: false, cloudConnected: false });
        }
      },

      syncPendingReports: async () => {
        const pending = get().reports.filter(r => r.syncStatus === 'pending');
        if (pending.length === 0) return;

        set({ isSyncing: true });
        try {
          const res = await fetch('/api/reports/batch-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ localReports: pending }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.reports) {
              set({
                reports: data.reports,
                isSyncing: false,
                cloudConnected: true,
                lastSyncedAt: new Date().toLocaleTimeString(),
              });
            }
          }
        } catch (e) {
          console.warn('Batch sync failed (will retry later):', e);
          set({ isSyncing: false, cloudConnected: false });
        }
      },

      markSynced: (id) => {
        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === id ? { ...r, syncStatus: 'synced' } : r
          ),
        }));
      }
    }),
    {
      name: 'reports-storage',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        reports: state.reports,
        currentReportId: state.currentReportId
      }),
    }
  )
);
