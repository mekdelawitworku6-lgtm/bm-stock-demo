import { api } from "../api";

// Dashboard summary response interface
export interface DashboardSummaryData {
  metadata: {
    generatedAt: string;
    periodStart: string;
    periodEnd: string;
    filters: {
      format: string;
      period: string;
    };
  };
  inventory: {
    totalProducts: number;
    totalStockValue: number;
    lowStockItems: number;
    expiredItems: number;
  };
  sales: {
    totalSales: number;
    totalRevenue: number;
    averageSaleAmount: number;
    totalCustomers: number;
  };
  expenses: {
    totalExpenses: number;
    totalAmount: number;
  };
}

export interface DashboardSummaryResponse {
  success: boolean;
  message: string;
  data: DashboardSummaryData;
  timestamp: string;
}

export const dashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<DashboardSummaryResponse, { 
      period?: string; 
      format?: string; 
      startDate?: string; 
      endDate?: string; 
    }>({
      query: ({ period = "today", format = "json", startDate, endDate }) => {
        const params: any = {
          format,
        };

        // If startDate and endDate are provided, use them
        if (startDate && endDate) {
          params.startDate = startDate;
          params.endDate = endDate;
        } else {
          // Otherwise use period parameter
          params.period = period;
        }

        return {
          url: "reports/dashboard/summary",
          method: "GET",
          params,
        };
      },
      providesTags: ['Dashboard'],
    }),
  }),
});

export const {
  useGetDashboardSummaryQuery,
} = dashboardApi;

// Utility functions for date ranges
export const getDateRange = {
  today: () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];
    // Backend design: startDate = yesterday, endDate = today for today's data
    return { startDate: yesterdayString, endDate: today };
  },
  
  yesterday: () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];
    const dayBeforeYesterday = new Date();
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    const dayBeforeYesterdayString = dayBeforeYesterday.toISOString().split('T')[0];
    // For yesterday's data: startDate = day before yesterday, endDate = yesterday
    return { startDate: dayBeforeYesterdayString, endDate: yesterdayString };
  },
  
  tomorrow: () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];
    // For extended data: startDate = yesterday, endDate = tomorrow
    return { startDate: yesterdayString, endDate: tomorrowString };
  },
  
  thisWeek: () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return {
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0]
    };
  },
  
  thisMonth: () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    return {
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: endOfMonth.toISOString().split('T')[0]
    };
  },
  
  custom: (startDate: string, endDate: string) => {
    return { startDate, endDate };
  }
};
