import { api } from "../api";

export const customerApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCustomers: builder.query({
      query: ({ search = "" }) => `/customers?search=${search}`,
      transformResponse: (response) => response.data.data,
    }),
    createCustomer: builder.mutation({
      query: (body) => ({
        url: "/customers",
        method: "POST",
        body,
      }),
      invalidatesTags: ["User"],
    }),
  }),
});

export const { useGetCustomersQuery, useCreateCustomerMutation } = customerApi;
