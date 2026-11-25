import { api } from "../api";

export const employeesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getEmployees: builder.query({
      query: ({ page = 1, limit = 10, search = "" }) => `/employees`,
      transformResponse: (response) => response.data.data, // Extract the 'data' array
    }),
  }),
});

export const { useGetEmployeesQuery } = employeesApi;
