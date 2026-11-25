import { api } from "../api";

export const warehouseApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getWarehouses: builder.query<any, { page?: number; limit?: number; search?: string }>({
      query: ({ page = 1, limit = 10, search }) => ({
        url: "warehouses",
        method: "GET",
        params: {
          page,
          limit,
          ...(search && { search }),
        },
      }),
      transformResponse: (response: any) => {
        console.log("Raw warehouses response:", response);
        // Handle different response structures
        if (response.success === false) {
          return response; // Return error response as-is
        }
        return response.data || response;
      },
      providesTags: ['Warehouse'],
    }),
    getWarehouseWithProducts: builder.query({
      query: ({ id, page = 1, limit = 10, search = "" }) => 
        `warehouses/${id}?page=${page}&limit=${limit}&search=${search}`,
      transformResponse: (response: any) => {
        console.log("Raw warehouse with products response:", response);
        // Handle different response structures
        if (response.success === false) {
          return response; // Return error response as-is
        }
        return response.data || response;
      },
    }),
    createWarehouse: builder.mutation({
      query: (body) => ({
        url: "warehouses",
        method: "POST",
        body,
      }),
    }),
  }),
});

export const {
  useGetWarehousesQuery,
  useCreateWarehouseMutation,
  useGetWarehouseWithProductsQuery,
} = warehouseApi;
