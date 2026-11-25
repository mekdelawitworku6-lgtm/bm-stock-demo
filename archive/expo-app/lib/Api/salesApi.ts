import { api } from "../api";

export const salesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createSales: builder.mutation({
      query: (body) => ({
        url: "/sales",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Sales", "Credit"], // Invalidate both Sales and Credit caches
    }),
    getCustomerByPhoneNumber: builder.query({
      query: () => `/api/v1/sales/search/customer-by-phone`,
      transformResponse: (response) => response.data, // Extract the 'data' array
    }),
    getSalesHistory: builder.query({
      query: ({ page = 1, limit = 10, search = "", status = "" }) => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (search) params.append('search', search);
        if (status && ['pending', 'completed', 'cancelled', 'refunded', 'partially_paid', 'returned', 'draft'].includes(status)) {
          params.append('status', status);
        }
        return {
          url: `sales?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["Sales"],
    }),
    getSaleById: builder.query({
      query: (id) => ({
        url: `sales/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: 'Sales', id }],
    }),
    updateSale: builder.mutation({
      query: ({ id, body }) => ({
        url: `sales/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Sales', id }, "Credit"], // Also invalidate Credit cache
    }),
    deleteSale: builder.mutation({
      query: (id) => ({
        url: `sales/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Sales", "Credit"], // Also invalidate Credit cache
    }),
    getSalesReports: builder.query({
      query: ({ startDate, endDate, type = "summary" }) => ({
        url: `sales/reports?startDate=${startDate}&endDate=${endDate}&type=${type}`,
        method: "GET",
      }),
      providesTags: ["Sales"],
    }),
  }),
});

export const { 
  useCreateSalesMutation, 
  useGetCustomerByPhoneNumberQuery,
  useGetSalesHistoryQuery,
  useGetSaleByIdQuery,
  useUpdateSaleMutation,
  useDeleteSaleMutation,
  useGetSalesReportsQuery,
} = salesApi;
