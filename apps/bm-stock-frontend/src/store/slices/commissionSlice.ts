import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CommissionItem {
  id: string;
  staffId?: string;
  staffName?: string;
  productId?: string;
  productName?: string;
  commissionRate: number;
  commissionAmount: number;
  isApproved: boolean;
  saleDate?: string;
  product?: { id: string; name: string };
}

interface CommissionState {
  items: CommissionItem[];
  period: 'Week' | 'Month' | 'Quarter';
  activeTab: 'Staff Earnings' | 'Commission Report' | 'Commission Rules';
  selectedProdFilter: string | null;
  isLoading: boolean;
}

const initialState: CommissionState = {
  items: [],
  period: 'Week',
  activeTab: 'Staff Earnings',
  selectedProdFilter: null,
  isLoading: false,
};

export const commissionSlice = createSlice({
  name: 'commission',
  initialState,
  reducers: {
    setCommissions: (state, action: PayloadAction<CommissionItem[]>) => {
      state.items = action.payload;
    },
    setCommissionPeriod: (state, action: PayloadAction<'Week' | 'Month' | 'Quarter'>) => {
      state.period = action.payload;
    },
    setCommissionActiveTab: (state, action: PayloadAction<'Staff Earnings' | 'Commission Report' | 'Commission Rules'>) => {
      state.activeTab = action.payload;
    },
    setCommissionProdFilter: (state, action: PayloadAction<string | null>) => {
      state.selectedProdFilter = action.payload;
    },
    setCommissionLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  setCommissions,
  setCommissionPeriod,
  setCommissionActiveTab,
  setCommissionProdFilter,
  setCommissionLoading,
} = commissionSlice.actions;

export default commissionSlice.reducer;
