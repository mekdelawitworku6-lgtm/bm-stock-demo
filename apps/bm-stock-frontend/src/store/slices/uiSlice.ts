import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface UiState {
  activeTab: string;
  searchQuery: string;
  toasts: Toast[];
  modals: {
    isPaymentModalOpen: boolean;
    isCommissionConfigOpen: boolean;
    isAddProdOpen: boolean;
    isAddWarehouseOpen: boolean;
    isAddShopOpen: boolean;
    isAddStaffOpen: boolean;
  };
}

const initialState: UiState = {
  activeTab: 'Overview',
  searchQuery: '',
  toasts: [],
  modals: {
    isPaymentModalOpen: false,
    isCommissionConfigOpen: false,
    isAddProdOpen: false,
    isAddWarehouseOpen: false,
    isAddShopOpen: false,
    isAddStaffOpen: false,
  },
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.activeTab = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    openModal: (state, action: PayloadAction<keyof UiState['modals']>) => {
      state.modals[action.payload] = true;
    },
    closeModal: (state, action: PayloadAction<keyof UiState['modals']>) => {
      state.modals[action.payload] = false;
    },
    addToast: (state, action: PayloadAction<{ message: string; type: Toast['type'] }>) => {
      const id = Date.now().toString();
      state.toasts.push({ id, ...action.payload });
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const {
  setActiveTab,
  setSearchQuery,
  openModal,
  closeModal,
  addToast,
  removeToast,
} = uiSlice.actions;

export default uiSlice.reducer;
