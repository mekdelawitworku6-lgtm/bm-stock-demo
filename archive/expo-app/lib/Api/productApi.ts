import { api } from "../api";

export const productsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createProduct: builder.mutation({
      query: (body) => ({
        url: "/products",
        method: "POST",
        body,
      }),
    }),
    getProducts: builder.query({
      query: ({ 
        page = 1, 
        limit = 10, 
        search = "", 
        type, 
        category, 
        status, 
        lowStock, 
        expired, 
        minPrice, 
        maxPrice 
      }) => {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          search,
        });
        
        if (type) params.append('type', type);
        if (category) params.append('category', category);
        if (status) params.append('status', status);
        if (lowStock !== undefined) params.append('lowStock', lowStock.toString());
        if (expired !== undefined) params.append('expired', expired.toString());
        if (minPrice !== undefined) params.append('minPrice', minPrice.toString());
        if (maxPrice !== undefined) params.append('maxPrice', maxPrice.toString());
        
        return `/products?${params.toString()}`;
      },
      transformResponse: (response) => response.data, // Extract the full paginated response
    }),
    getProductsByWarehouse: builder.query({
      query: ({ warehouseId, page = 1, limit = 10, search = "", lowStock, expired }) => {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          search,
        });
        
        if (lowStock !== undefined) params.append('lowStock', lowStock.toString());
        if (expired !== undefined) params.append('expired', expired.toString());
        
        return `/products/warehouse/${warehouseId}?${params.toString()}`;
      },
      transformResponse: (response) => response.data,
    }),
    getProductsByShop: builder.query({
      query: ({ shopId, page = 1, limit = 10, search = "", lowStock, expired }) => {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          search,
        });
        
        if (lowStock !== undefined) params.append('lowStock', lowStock.toString());
        if (expired !== undefined) params.append('expired', expired.toString());
        
        return `/products/shop/${shopId}?${params.toString()}`;
      },
      transformResponse: (response) => response.data,
    }),
    getExpiredProducts: builder.query({
      query: ({ search = "" }) => `/products/expired?search=${search}`,
      transformResponse: (response) => response.data, // Extract the 'data' array
    }),
    getLowStockProducts: builder.query({
      query: ({ search = "" }) => `/products/low-stock?search=${search}`,
      transformResponse: (response) => response.data, // Extract the 'data' array
    }),
  }),
});

export const {
  useCreateProductMutation,
  useGetProductsQuery,
  useGetProductsByWarehouseQuery,
  useGetProductsByShopQuery,
  useGetExpiredProductsQuery,
  useGetLowStockProductsQuery,
} = productsApi;
