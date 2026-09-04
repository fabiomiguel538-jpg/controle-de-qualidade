import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import {
  fetchReportsCloud,
  saveReportCloud,
  batchSyncReportsCloud,
  deleteReportCloud
} from '../lib/cloudDb';
import { Report, ReportStatus, Defect } from '../types';

export type { Report, ReportStatus, Defect };

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
  reopenReport: (id: string) => Promise<void>;
  markSynced: (id: string) => void;
  deleteReport: (id: string) => Promise<void>;
  fetchFromCloud: (user?: any) => Promise<void>;
  syncPendingReports: (user?: any) => Promise<boolean>;
  saveReportNow: (id?: string) => Promise<boolean>;
}

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
          productChange: {
            hasChange: false,
            time: '',
            newReference: '',
            newFormat: '',
            observation: ''
          },
          productionLosses: {
            granel: 0,
            granelUnit: 'paletes',
            caixasRasgadas: 0,
            repasses: 0,
            cacambaCaco: 0,
            notes: '',
            entries: []
          },
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
      },

      saveReportNow: async (idToSave?: string): Promise<boolean> => {
        const targetId = idToSave || get().currentReportId;
        if (!targetId) return false;

        const targetReport = get().reports.find(r => r.id === targetId);
        if (!targetReport) return false;

        set({ isSyncing: true });
        try {
          await saveReportCloud(targetReport);

          set((state) => ({
            isSyncing: false,
            cloudConnected: true,
            lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            reports: state.reports.map((r) =>
              r.id === targetId ? { ...r, syncStatus: 'synced' } : r
            ),
          }));
          return true;
        } catch (e) {
          console.warn('Could not sync report to cloud (working offline):', e);
          set({ isSyncing: false, cloudConnected: false });
          return false;
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

      reopenReport: async (id) => {
        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === id ? { ...r, status: 'EM_ANDAMENTO', syncStatus: 'pending' } : r
          ),
          currentReportId: id,
        }));

        await get().saveReportNow(id);
      },

      deleteReport: async (id) => {
        set((state) => ({
          reports: state.reports.filter(r => r.id !== id),
          currentReportId: state.currentReportId === id ? null : state.currentReportId
        }));

        try {
          await deleteReportCloud(id);
        } catch (e) {
          console.warn('Failed to delete report on cloud:', e);
        }
      },

      fetchFromCloud: async (user?: any) => {
        set({ isSyncing: true });
        try {
          const cloudReports = await fetchReportsCloud(user);

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
              lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
          });
        } catch (e) {
          console.warn('Error connecting to cloud reports (using offline cache):', e);
          set({ isSyncing: false, cloudConnected: false });
        }
      },

      syncPendingReports: async (user?: any): Promise<boolean> => {
        const pending = get().reports.filter(r => r.syncStatus === 'pending');
        if (pending.length === 0) {
          // If none pending, just fetch latest from cloud to ensure sync
          await get().fetchFromCloud(user);
          return true;
        }

        set({ isSyncing: true });
        try {
          const updatedReports = await batchSyncReportsCloud(pending, user);
          set({
            reports: updatedReports,
            isSyncing: false,
            cloudConnected: true,
            lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
          return true;
        } catch (e) {
          console.warn('Batch sync failed (will retry later):', e);
          set({ isSyncing: false, cloudConnected: false });
          return false;
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
