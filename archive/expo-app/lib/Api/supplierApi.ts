import { api } from "../api";

export const supplierApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Supplier endpoints
    getSuppliers: builder.query<any, { page?: number; limit?: number; search?: string }>({
      query: ({ page = 1, limit = 10, search }) => ({
        url: "suppliers",
        method: "GET",
        params: {
          page,
          limit,
          ...(search && { search }),
        },
      }),
      providesTags: ['Supplier'],
    }),
    
    getSupplierById: builder.query<any, string>({
      query: (id) => ({
        url: `suppliers/${id}`,
        method: "GET",
      }),
      providesTags: ['Supplier'],
    }),
    
    createSupplier: builder.mutation<any, any>({
      query: (supplierData) => ({
        url: "suppliers",
        method: "POST",
        body: supplierData,
      }),
      invalidatesTags: ['Supplier'],
    }),
    
    updateSupplier: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `suppliers/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ['Supplier'],
    }),
    
    deleteSupplier: builder.mutation<any, string>({
      query: (id) => ({
        url: `suppliers/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ['Supplier'],
    }),
  }),
});

export const {
  useGetSuppliersQuery,
  useGetSupplierByIdQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
} = supplierApi;
