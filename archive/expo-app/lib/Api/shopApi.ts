import { api } from "../api";

export const shopApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getShops: builder.query<any, { page?: number; limit?: number; search?: string }>({
      query: ({ page = 1, limit = 10, search }) => ({
        url: "shops",
        method: "GET",
        params: {
          page,
          limit,
          ...(search && { search }),
        },
      }),
      transformResponse: (response: any) => {
        console.log("Raw shops response:", response);
        // Handle different response structures
        if (response.success === false) {
          return response; // Return error response as-is
        }
        return response.data || response;
      },
      providesTags: ['Shop'],
    }),
    getShopWithProducts: builder.query({
      query: ({ id, page = 1, limit = 10, search = "" }) => 
        `shops/${id}?page=${page}&limit=${limit}&search=${search}`,
      transformResponse: (response: any) => {
        console.log("Raw shop with products response:", response);
        // Handle different response structures
        if (response.success === false) {
          return response; // Return error response as-is
        }
        return response.data || response;
      },
    }),
    createShop: builder.mutation({
      query: (body) => ({
        url: "/shops",
        method: "POST",
        body,
      }),
      invalidatesTags: ['Shop'],
    }),
    updateShop: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/shops/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ['Shop'],
    }),
    deleteShop: builder.mutation({
      query: (id) => ({
        url: `/shops/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ['Shop'],
    }),
  }),
});

export const {
  useGetShopsQuery,
  useGetShopWithProductsQuery,
  useCreateShopMutation,
  useUpdateShopMutation,
  useDeleteShopMutation,
} = shopApi;