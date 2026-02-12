import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AccessibilitySettings, MapViewport } from '@/app/types';

// Accessibility Store
interface AccessibilityState extends AccessibilitySettings {
  toggleHighContrast: () => void;
  toggleBigMode: () => void;
  toggleHaptics: () => void;
  toggleVoice: () => void;
  toggleReducedMotion: () => void;
}

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set) => ({
      highContrast: false,
      bigMode: false,
      haptics: true,
      voiceEnabled: true,
      reducedMotion: false,
      
      toggleHighContrast: () => set((state) => {
        const newValue = !state.highContrast;
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('high-contrast', newValue);
        }
        return { highContrast: newValue };
      }),
      
      toggleBigMode: () => set((state) => {
        const newValue = !state.bigMode;
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('big-mode', newValue);
        }
        return { bigMode: newValue };
      }),
      
      toggleHaptics: () => set((state) => ({ haptics: !state.haptics })),
      toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),
      toggleReducedMotion: () => set((state) => ({ reducedMotion: !state.reducedMotion })),
    }),
    {
      name: 'accessibility-settings',
      onRehydrateStorage: () => (state) => {
        // Apply stored classes on hydration
        if (typeof document !== 'undefined' && state) {
          document.documentElement.classList.toggle('high-contrast', state.highContrast);
          document.documentElement.classList.toggle('big-mode', state.bigMode);
        }
      },
    }
  )
);

// UI Store
interface UIState {
  sidebarOpen: boolean;
  activeModal: string | null;
  modalData: unknown;
  isLoading: boolean;
  loadingMessage: string;
  
  toggleSidebar: () => void;
  openModal: (modal: string, data?: unknown) => void;
  closeModal: () => void;
  setLoading: (loading: boolean, message?: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: false,
  activeModal: null,
  modalData: null,
  isLoading: false,
  loadingMessage: '',
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  openModal: (modal, data = null) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
  setLoading: (loading, message = '') => set({ isLoading: loading, loadingMessage: message }),
}));

// Map Store
interface MapState extends MapViewport {
  selectedTerritory: string | null;
  selectedHouse: string | null;
  isEditing: boolean;
  showLabels: boolean;
  
  setViewport: (viewport: Partial<MapViewport>) => void;
  selectTerritory: (id: string | null) => void;
  selectHouse: (id: string | null) => void;
  setEditing: (editing: boolean) => void;
  toggleLabels: () => void;
  resetViewport: () => void;
}

const defaultViewport: MapViewport = {
  longitude: -74.006,
  latitude: 40.7128,
  zoom: 12,
  bearing: 0,
  pitch: 0,
};

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      ...defaultViewport,
      selectedTerritory: null,
      selectedHouse: null,
      isEditing: false,
      showLabels: true,
      
      setViewport: (viewport) => set((state) => ({ ...state, ...viewport })),
      selectTerritory: (id) => set({ selectedTerritory: id }),
      selectHouse: (id) => set({ selectedHouse: id }),
      setEditing: (editing) => set({ isEditing: editing }),
      toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
      resetViewport: () => set(defaultViewport),
    }),
    {
      name: 'map-settings',
      partialize: (state) => ({
        longitude: state.longitude,
        latitude: state.latitude,
        zoom: state.zoom,
        showLabels: state.showLabels,
      }),
    }
  )
);

// Sync Store
interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: string | null;
  pendingChanges: number;
  syncError: string | null;
  
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSync: (time: string) => void;
  setPendingChanges: (count: number) => void;
  setSyncError: (error: string | null) => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  isOnline: true,
  isSyncing: false,
  lastSync: null,
  pendingChanges: 0,
  syncError: null,
  
  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setLastSync: (time) => set({ lastSync: time }),
  setPendingChanges: (count) => set({ pendingChanges: count }),
  setSyncError: (error) => set({ syncError: error }),
}));
