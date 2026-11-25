import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Company {
  id: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  status?: string;
  accountStatus?: string;
}

export interface SubscriptionPlan {
  id: string;
  title: string;
  price: string;
  period?: string;
  features?: string[];
}

interface CompanyState {
  companies: Company[];
  requestCompanyNames: string[];
  plansList: SubscriptionPlan[];
  selectedPlanId: string | null;
  isLoading: boolean;
}

const initialState: CompanyState = {
  companies: [],
  requestCompanyNames: [''],
  plansList: [],
  selectedPlanId: null,
  isLoading: false,
};

export const companySlice = createSlice({
  name: 'company',
  initialState,
  reducers: {
    setCompanies: (state, action: PayloadAction<Company[]>) => {
      state.companies = action.payload;
    },
    setRequestCompanyNames: (state, action: PayloadAction<string[]>) => {
      state.requestCompanyNames = action.payload;
    },
    updateCompanyNameAt: (state, action: PayloadAction<{ index: number; name: string }>) => {
      const { index, name } = action.payload;
      if (index >= 0 && index < state.requestCompanyNames.length) {
        state.requestCompanyNames[index] = name;
      }
    },
    addCompanyNameField: (state) => {
      state.requestCompanyNames.push('');
    },
    removeCompanyNameField: (state, action: PayloadAction<number>) => {
      if (state.requestCompanyNames.length > 1) {
        state.requestCompanyNames.splice(action.payload, 1);
      }
    },
    setPlansList: (state, action: PayloadAction<SubscriptionPlan[]>) => {
      state.plansList = action.payload;
    },
    setSelectedPlanId: (state, action: PayloadAction<string | null>) => {
      state.selectedPlanId = action.payload;
    },
    setCompanyLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  setCompanies,
  setRequestCompanyNames,
  updateCompanyNameAt,
  addCompanyNameField,
  removeCompanyNameField,
  setPlansList,
  setSelectedPlanId,
  setCompanyLoading,
} = companySlice.actions;

export default companySlice.reducer;
