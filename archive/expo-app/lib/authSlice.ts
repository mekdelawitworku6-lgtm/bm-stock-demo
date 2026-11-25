import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  companyId?: string;
  company?: {
    id: string;
    name: string;
  };
  // Add other fields based on your API response
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPinSetup: boolean;
  needsPinSetup: boolean;
}

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isPinSetup: false,
  needsPinSetup: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ token: string; refreshToken?: string; user: User }>
    ) {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken || null;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.isLoading = false;
      
      // Save to AsyncStorage for persistence
      const authData = {
        token: action.payload.token,
        refreshToken: action.payload.refreshToken || null,
        user: action.payload.user,
      };
      AsyncStorage.setItem("authData", JSON.stringify(authData));
    },
    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.isPinSetup = false;
      state.needsPinSetup = false;
      // Clear AsyncStorage
      AsyncStorage.removeItem("authData");
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    restoreAuth(state, action: PayloadAction<{ token: string; refreshToken?: string; user: User }>) {
      console.log("Restoring auth state:", action.payload);
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken || null;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.isLoading = false;
      
      // Ensure AsyncStorage is up to date
      const authData = {
        token: action.payload.token,
        refreshToken: action.payload.refreshToken || null,
        user: action.payload.user,
      };
      AsyncStorage.setItem("authData", JSON.stringify(authData));
      
      console.log("Auth state restored:", state);
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    setPinSetup(state, action: PayloadAction<boolean>) {
      console.log("Setting PIN setup:", action.payload);
      state.isPinSetup = action.payload;
    },
    setNeedsPinSetup(state, action: PayloadAction<boolean>) {
      console.log("Setting needs PIN setup:", action.payload);
      state.needsPinSetup = action.payload;
    },
    completePinSetup(state) {
      console.log("Completing PIN setup");
      state.isPinSetup = true;
      state.needsPinSetup = false;
    },
  },
});

export const { setCredentials, logout, setLoading, restoreAuth, setUser, setPinSetup, setNeedsPinSetup, completePinSetup } = authSlice.actions;
export default authSlice.reducer;
