import { api } from "../api";

export const userApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query({
      query: () => ({
        url: "users/me",
        method: "GET",
      }),
      providesTags: ["User"],
    }),
    updateProfile: builder.mutation({
      query: (body) => ({
        url: "users/profile",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["User"],
    }),
    updateSettings: builder.mutation({
      query: (body) => ({
        url: "users/settings",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["User"],
    }),
    getSettings: builder.query({
      query: () => ({
        url: "users/settings",
        method: "GET",
      }),
      providesTags: ["User"],
    }),
    uploadAvatar: builder.mutation({
      query: (body) => ({
        url: "users/avatar",
        method: "POST",
        body,
      }),
      invalidatesTags: ["User"],
    }),
    deleteAccount: builder.mutation({
      query: (body) => ({
        url: "users/delete-account",
        method: "DELETE",
        body,
      }),
    }),
    createUser: builder.mutation({
      query: (body) => ({
        url: "users",
        method: "POST",
        body,
      }),
      invalidatesTags: ["User"],
    }),
  }),
});

export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useUpdateSettingsMutation,
  useGetSettingsQuery,
  useUploadAvatarMutation,
  useDeleteAccountMutation,
  useCreateUserMutation,
} = userApi;