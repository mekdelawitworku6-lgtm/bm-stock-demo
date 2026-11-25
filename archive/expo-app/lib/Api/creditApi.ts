import { api } from "../api";

export const creditApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Credit endpoints (updated to use correct backend endpoints)
    getCreditAccounts: builder.query<any, { page: number; limit: number; search?: string }>({
      query: ({ page, limit, search }) => ({
        url: "credits",
        method: "GET",
        params: {
          page,
          limit,
          ...(search && { search }),
        },
      }),
      providesTags: ['Credit'],
    }),
    getCreditAccountById: builder.query<any, string>({
      query: (id) => ({
        url: `credits/${id}`,
        method: "GET",
      }),
      providesTags: ['Credit'],
    }),
    createCreditAccount: builder.mutation<any, any>({
      query: (creditData) => ({
        url: "credits",
        method: "POST",
        body: creditData,
      }),
      invalidatesTags: ['Credit'],
    }),
    updateCreditAccount: builder.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({
        url: `credits/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ['Credit'],
    }),
    deleteCreditAccount: builder.mutation<any, string>({
      query: (id) => ({
        url: `credits/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ['Credit'],
    }),
    getCreditPayments: builder.query<any, { creditAccountId: string; page: number; limit: number }>({
      query: ({ creditAccountId, page, limit }) => ({
        url: `credits/${creditAccountId}/payments`,
        method: "GET",
        params: {
          page,
          limit,
        },
      }),
      providesTags: ['Credit'],
    }),
    createCreditPayment: builder.mutation<any, { creditAccountId: string; data: any }>({
      query: ({ creditAccountId, data }) => ({
        url: `credits/${creditAccountId}/payments`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ['Credit'],
    }),
    getCreditTransactions: builder.query<any, { creditAccountId: string; page: number; limit: number; startDate?: string; endDate?: string }>({
      query: ({ creditAccountId, page, limit, startDate, endDate }) => ({
        url: `credits/${creditAccountId}/transactions`,
        method: "GET",
        params: {
          page,
          limit,
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
        },
      }),
      providesTags: ['Credit'],
    }),
    getCreditReports: builder.query<any, { startDate: string; endDate: string; type?: string }>({
      query: ({ startDate, endDate, type = "summary" }) => ({
        url: "credits/stats",
        method: "GET",
        params: {
          startDate,
          endDate,
          type,
        },
      }),
      providesTags: ['Credit'],
    }),
    // PDF Export endpoints
    downloadCreditStatementPDF: builder.query<Blob, string>({
      query: (creditId) => ({
        url: `credits/${creditId}/statement/pdf`,
        method: "GET",
        responseType: 'blob',
      }),
      providesTags: ['Credit'],
    }),
    downloadPaymentReceiptPDF: builder.query<Blob, { creditId: string; paymentId: string }>({
      query: ({ creditId, paymentId }) => ({
        url: `credits/${creditId}/payments/${paymentId}/receipt/pdf`,
        method: "GET",
        responseType: 'blob',
      }),
      providesTags: ['Credit'],
    }),
    // Additional credit endpoints
    getOverdueCredits: builder.query<any, void>({
      query: () => ({
        url: "credits/overdue",
        method: "GET",
      }),
      providesTags: ['Credit'],
    }),
    getCustomerCredits: builder.query<any, string>({
      query: (customerId) => ({
        url: `credits/customer/${customerId}`,
        method: "GET",
      }),
      providesTags: ['Credit'],
    }),
    calculateInterest: builder.mutation<any, void>({
      query: () => ({
        url: "credits/calculate-interest",
        method: "POST",
      }),
      invalidatesTags: ['Credit'],
    }),
  }),
});

export const {
  useGetCreditAccountsQuery,
  useGetCreditAccountByIdQuery,
  useCreateCreditAccountMutation,
  useUpdateCreditAccountMutation,
  useDeleteCreditAccountMutation,
  useGetCreditPaymentsQuery,
  useCreateCreditPaymentMutation,
  useGetCreditTransactionsQuery,
  useGetCreditReportsQuery,
  useGetOverdueCreditsQuery,
  useGetCustomerCreditsQuery,
  useCalculateInterestMutation,
  useDownloadCreditStatementPDFQuery,
  useDownloadPaymentReceiptPDFQuery,
} = creditApi;
