import { api } from "../api";

export const expenseApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createExpense: builder.mutation({
      query: (body) => ({
        url: "/expenses",
        method: "POST",
        body,
      }),
    }),
    getExpenses: builder.query({
      query: ({ 
        page = 1, 
        limit = 10, 
        search = "", 
        status, 
        type, 
        category, 
        paymentMethod,
        submittedBy,
        branchId,
        expenseNumber,
        vendor,
        startDate,
        endDate
      }) => {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });
        
        if (search) params.append('search', search);
        if (status) params.append('status', status);
        if (type) params.append('type', type);
        if (category) params.append('category', category);
        if (paymentMethod) params.append('paymentMethod', paymentMethod);
        if (submittedBy) params.append('submittedBy', submittedBy);
        if (branchId) params.append('branchId', branchId);
        if (expenseNumber) params.append('expenseNumber', expenseNumber);
        if (vendor) params.append('vendor', vendor);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        return `/expenses?${params.toString()}`;
      },
      providesTags: ['Expense'],
    }),
    getExpenseById: builder.query({
      query: (id) => ({
        url: `expenses/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: 'Expense', id }],
    }),
    updateExpense: builder.mutation({
      query: ({ id, body }) => ({
        url: `expenses/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Expense', id }],
    }),
    deleteExpense: builder.mutation({
      query: (id) => ({
        url: `expenses/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Expense"],
    }),
  }),
});

export const { 
  useCreateExpenseMutation, 
  useGetExpensesQuery,
  useGetExpenseByIdQuery,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation
} = expenseApi;
