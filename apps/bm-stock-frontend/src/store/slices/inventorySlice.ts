import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
  cost?: number;
  stockQuantity: number;
  minStockLevel?: number;
  category?: string;
  unit?: string;
  description?: string;
  isExpired?: boolean;
  commissionRate?: number;
  metadata?: any;
}

export interface Warehouse {
  id: string;
  name: string;
  address?: string;
  managerName?: string;
}

export interface Shop {
  id: string;
  name: string;
  address?: string;
  shopCode?: string;
}

interface InventoryState {
  products: Product[];
  warehouses: Warehouse[];
  shops: Shop[];
  stats: {
    todaySales: number;
    todayInvoices: number;
    productsCredit: number;
    creditCustomers: number;
    stockRemainderStatus: string;
    expiredCount: number;
  };
  isLoading: boolean;
}

const initialState: InventoryState = {
  products: [],
  warehouses: [],
  shops: [],
  stats: {
    todaySales: 0,
    todayInvoices: 0,
    productsCredit: 0,
    creditCustomers: 0,
    stockRemainderStatus: 'Sufficient',
    expiredCount: 0,
  },
  isLoading: false,
};

export const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setProducts: (state, action: PayloadAction<Product[]>) => {
      state.products = action.payload;
    },
    setWarehouses: (state, action: PayloadAction<Warehouse[]>) => {
      state.warehouses = action.payload;
    },
    setShops: (state, action: PayloadAction<Shop[]>) => {
      state.shops = action.payload;
    },
    setStats: (state, action: PayloadAction<InventoryState['stats']>) => {
      state.stats = action.payload;
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    updateProductStock: (state, action: PayloadAction<{ id: string; delta: number }>) => {
      const prod = state.products.find((p) => p.id === action.payload.id);
      if (prod) {
        prod.stockQuantity += action.payload.delta;
      }
    },
  },
});

export const { setProducts, setWarehouses, setShops, setStats, setIsLoading, updateProductStock } = inventorySlice.actions;
export default inventorySlice.reducer;
