import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'LIDER' | 'ADMIN' | 'MECHANIC' | 'mechanic' | string;
  token: string;
  panel?: string;
}

interface AuthState {
  user: User | null;
  selectedPanel: string | null;
  setSelectedPanel: (panel: string | null) => void;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      selectedPanel: null,
      setSelectedPanel: (panel) => set({ selectedPanel: panel }),
      login: (user) => set({ user, selectedPanel: user.panel || (user.role?.toLowerCase() === 'mechanic' ? 'manutencao' : 'producao') }),
      logout: () => set({ user: null, selectedPanel: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
