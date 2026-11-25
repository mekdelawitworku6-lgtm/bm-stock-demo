import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface User {
  id: string;
  email?: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  companyId?: string;
  companyName?: string;
  role?: string;
  permissions?: any;
  shopId?: string;
  warehouseId?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('bm_token') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('bm_token') : false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setToken: (state, action: PayloadAction<string | null>) => {
      state.token = action.payload;
      if (action.payload) {
        localStorage.setItem('bm_token', action.payload);
        state.isAuthenticated = true;
      } else {
        localStorage.removeItem('bm_token');
        state.isAuthenticated = false;
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('bm_token');
    },
  },
});

export const { setUser, setToken, logout } = authSlice.actions;
export default authSlice.reducer;
