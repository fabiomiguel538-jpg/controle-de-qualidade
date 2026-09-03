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
  setCurrentReport: (id: string | null) => void;
  createNewReport: (info: Partial<Report>) => string;
  updateCurrentReport: (updates: Partial<Report>) => void;
  finalizeReport: (id: string) => void;
  markSynced: (id: string) => void;
}

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: [],
      currentReportId: null,

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
          reports: [...state.reports, newReport],
          currentReportId: id,
        }));
        return id;
      },

      updateCurrentReport: (updates) => {
        set((state) => {
          if (!state.currentReportId) return state;
          return {
            reports: state.reports.map((r) =>
              r.id === state.currentReportId
                ? { ...r, ...updates, syncStatus: 'pending' }
                : r
            ),
          };
        });
      },

      finalizeReport: (id) => {
        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === id ? { ...r, status: 'FINALIZADO', syncStatus: 'pending' } : r
          ),
          currentReportId: state.currentReportId === id ? null : state.currentReportId
        }));
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
    }
  )
);
