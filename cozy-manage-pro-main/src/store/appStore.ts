import { create } from 'zustand';
import { UserRole } from '@/types';

interface AppState {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentRole: 'owner',
  setRole: (role) => set({ currentRole: role }),
}));
