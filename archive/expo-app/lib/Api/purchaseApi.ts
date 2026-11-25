import { api } from "../api";

export const purchaseApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Purchase Order endpoints
    getPurchaseOrders: builder.query<any, { page?: number; limit?: number; status?: string; supplierId?: string; warehouseId?: string }>({
      query: ({ page = 1, limit = 10, status, supplierId, warehouseId }) => ({
        url: "purchase/orders",
        method: "GET",
        params: {
          page,
          limit,
          ...(status && { status }),
          ...(supplierId && { supplierId }),
          ...(warehouseId && { warehouseId }),
        },
      }),
      providesTags: ['Purchase'],
    }),
    
    getPurchaseOrderById: builder.query<any, string>({
      query: (id) => ({
        url: `purchase/orders/${id}`,
        method: "GET",
      }),
      providesTags: ['Purchase'],
    }),
    
    createPurchaseOrder: builder.mutation<any, any>({
      query: (purchaseData) => ({
        url: "purchase/orders",
        method: "POST",
        body: purchaseData,
      }),
      invalidatesTags: ['Purchase'],
    }),
    
    createPurchaseOrderWithNewProduct: builder.mutation<any, any>({
      query: (purchaseData) => ({
        url: "purchase/orders/new-product",
        method: "POST",
        body: purchaseData,
      }),
      invalidatesTags: ['Purchase'],
    }),
    
    approvePurchaseOrder: builder.mutation<any, { id: string; approvalNotes?: string }>({
      query: ({ id, approvalNotes }) => ({
        url: `purchase/orders/${id}/approve`,
        method: "PATCH",
        body: { approvalNotes },
      }),
      invalidatesTags: ['Purchase'],
    }),
    
    rejectPurchaseOrder: builder.mutation<any, { id: string; rejectionReason: string }>({
      query: ({ id, rejectionReason }) => ({
        url: `purchase/orders/${id}/reject`,
        method: "PATCH",
        body: { rejectionReason },
      }),
      invalidatesTags: ['Purchase'],
    }),
    
    // Receiving endpoints
    createReceiving: builder.mutation<any, any>({
      query: (receivingData) => ({
        url: "purchase/receiving",
        method: "POST",
        body: receivingData,
      }),
      invalidatesTags: ['Purchase'],
    }),
    
    getReceivingStats: builder.query<any, void>({
      query: () => ({
        url: "purchase/receiving/stats",
        method: "GET",
      }),
      providesTags: ['Purchase'],
    }),
    
    // Payment endpoints
    createPurchasePayment: builder.mutation<any, any>({
      query: (paymentData) => ({
        url: "purchase/payments",
        method: "POST",
        body: paymentData,
      }),
      invalidatesTags: ['Purchase'],
    }),
    
    // Dashboard stats
    getPurchaseDashboardStats: builder.query<any, { startDate?: string; endDate?: string }>({
      query: ({ startDate, endDate }) => ({
        url: "purchase/dashboard/stats",
        method: "GET",
        params: {
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
        },
      }),
      providesTags: ['Purchase'],
    }),
  }),
});

export const {
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrderByIdQuery,
  useCreatePurchaseOrderMutation,
  useCreatePurchaseOrderWithNewProductMutation,
  useApprovePurchaseOrderMutation,
  useRejectPurchaseOrderMutation,
  useCreateReceivingMutation,
  useGetReceivingStatsQuery,
  useCreatePurchasePaymentMutation,
  useGetPurchaseDashboardStatsQuery,
} = purchaseApi;

