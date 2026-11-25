import { api } from "../api";

export const requestApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getRequests: builder.query({
      query: ({ page = 1, limit = 10, search = "", status = "" }) => ({
        url: `requests?page=${page}&limit=${limit}&search=${search}&status=${status}`,
        method: "GET",
      }),
      providesTags: ["Request"],
    }),
    getRequestById: builder.query({
      query: (id) => ({
        url: `requests/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: 'Request', id }],
    }),
    createRequest: builder.mutation({
      query: (body) => ({
        url: "requests",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Request"],
    }),
    updateRequest: builder.mutation({
      query: ({ id, body }) => ({
        url: `requests/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Request', id }],
    }),
    deleteRequest: builder.mutation({
      query: (id) => ({
        url: `requests/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Request"],
    }),
    approveRequest: builder.mutation({
      query: (id) => ({
        url: `requests/${id}/approve`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Request', id }],
    }),
    rejectRequest: builder.mutation({
      query: ({ id, reason }) => ({
        url: `requests/${id}/reject`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Request', id }],
    }),
    fulfillRequest: builder.mutation({
      query: (id) => ({
        url: `requests/${id}/fulfill`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Request', id }],
    }),
    getMyRequests: builder.query({
      query: ({ page = 1, limit = 10, status = "" }) => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (status) params.append('status', status);
        return {
          url: `requests?${params.toString()}`,
          method: "GET",
        };
      },
      providesTags: ["Request"],
    }),
  }),
});

export const {
  useGetRequestsQuery,
  useGetRequestByIdQuery,
  useCreateRequestMutation,
  useUpdateRequestMutation,
  useDeleteRequestMutation,
  useApproveRequestMutation,
  useRejectRequestMutation,
  useFulfillRequestMutation,
  useGetMyRequestsQuery,
} = requestApi;
