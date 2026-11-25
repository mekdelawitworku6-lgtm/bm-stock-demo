import { api } from "../api";

export const companiesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCompanies: builder.query({
      query: ({ page = 1, limit = 10, search = "" }) =>
        // `companies?page=${page}&limit=${limit}&search=${search}`,
        `companies`,
      transformResponse: (response) => ({
        companies: response.data.data,
        total: response.data.total,
        page: response.data.page,
        totalPages: response.data.totalPages,
      }),
      providesTags: ["Company"],
    }),
    createCompanies: builder.mutation({
      query: (body) => ({
        url: "companies",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Company"],
    }),
  }),
});

export const { useGetCompaniesQuery, useCreateCompaniesMutation } =
  companiesApi;
