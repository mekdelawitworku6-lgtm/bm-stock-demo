import { api } from "../api";

// Commission types based on the provided data structure
export interface Commission {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  amount: string;
  commissionDate: string;
  commissionRate: string;
  commissionAmount: string;
  isApproved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  employee: {
    id: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    name: string;
    phoneNumber: string;
    baseCommissionRate: string;
    jobTitle: string | null;
  };
  product: {
    id: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    type: string;
    name: string;
    description: string;
    sku: string;
    barcode: string;
    category: string;
    unit: string;
    price: string;
    commissionRate: string;
    cost: string;
    expiryDate: string;
    status: string;
    metadata: {
      brand: string;
      model?: string;
    };
    imageUrl: string;
    taxRate: string;
    trackStock: boolean;
    stockQuantity: number;
    minStockLevel: number;
    companyId: string;
  };
  sale: {
    id: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    totalAmount: string;
    taxAmount: string;
    advancePayment: string;
    remainingBalance: string;
    saleDate: string;
    paymentType: string;
    status: string;
    note: string;
    discountAmount: string;
    discountType: string | null;
    discountRate: string;
    subtotal: string;
    invoiceNumber: string;
    referenceNumber: string | null;
    dueDate: string | null;
    terms: string | null;
  };
}

export interface CommissionResponse {
  success: boolean;
  message: string;
  data: Commission[];
  timestamp: string;
}

export interface CommissionFilters {
  page?: number;
  limit?: number;
  search?: string;
  employeeId?: string;
  isApproved?: boolean;
  startDate?: string;
  endDate?: string;
  commissionDate?: string;
}

export const commissionApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCommissions: builder.query<CommissionResponse, CommissionFilters>({
      query: ({ 
        page = 1, 
        limit = 10, 
        search = "", 
        employeeId = "",
        isApproved,
        startDate = "",
        endDate = "",
        commissionDate = ""
      }) => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (search) params.append('search', search);
        if (employeeId) params.append('employeeId', employeeId);
        if (isApproved !== undefined) params.append('isApproved', isApproved.toString());
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (commissionDate) params.append('commissionDate', commissionDate);
        
        return {
          url: `commissions?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["Commission"],
    }),
    getCommissionById: builder.query<Commission, string>({
      query: (id) => ({
        url: `commissions/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: 'Commission', id }],
    }),
    approveCommission: builder.mutation<Commission, string>({
      query: (id) => ({
        url: `commissions/approve`,
        method: "POST",
        body: {
          commissionIds: [id]
        },
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Commission', id }, "Commission"],
    }),
    rejectCommission: builder.mutation<Commission, string>({
      query: (id) => ({
        url: `commissions/reject`,
        method: "PATCH",
        body: {
          commissionIds: [id]
        },
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Commission', id }, "Commission"],
    }),
    bulkApproveCommissions: builder.mutation<Commission[], string[]>({
      query: (ids) => ({
        url: `commissions/approve`,
        method: "PATCH",
        body: {
          commissionIds: ids
        },
      }),
      invalidatesTags: (result, error, ids) => [
        ...ids.map(id => ({ type: 'Commission', id })),
        "Commission"
      ],
    }),
    bulkRejectCommissions: builder.mutation<Commission[], string[]>({
      query: (ids) => ({
        url: `commissions/reject`,
        method: "PATCH",
        body: {
          commissionIds: ids
        },
      }),
      invalidatesTags: (result, error, ids) => [
        ...ids.map(id => ({ type: 'Commission', id })),
        "Commission"
      ],
    }),
    getCommissionReports: builder.query({
      query: ({ startDate, endDate, employeeId, type = "summary" }) => {
        const params = new URLSearchParams();
        params.append('startDate', startDate);
        params.append('endDate', endDate);
        params.append('type', type);
        if (employeeId) params.append('employeeId', employeeId);
        
        return {
          url: `commissions/reports?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["Commission"],
    }),
    getEmployeeCommissions: builder.query<CommissionResponse, { employeeId: string; filters?: CommissionFilters }>({
      query: ({ employeeId, filters = {} }) => {
        const params = new URLSearchParams();
        params.append('employeeId', employeeId);
        params.append('page', (filters.page || 1).toString());
        params.append('limit', (filters.limit || 10).toString());
        if (filters.search) params.append('search', filters.search);
        if (filters.isApproved !== undefined) params.append('isApproved', filters.isApproved.toString());
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        
        return {
          url: `commissions/employee?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: (result, error, { employeeId }) => [{ type: 'Commission', id: `employee-${employeeId}` }],
    }),
  }),
});

export const { 
  useGetCommissionsQuery,
  useGetCommissionByIdQuery,
  useApproveCommissionMutation,
  useRejectCommissionMutation,
  useBulkApproveCommissionsMutation,
  useBulkRejectCommissionsMutation,
  useGetCommissionReportsQuery,
  useGetEmployeeCommissionsQuery,
} = commissionApi;
