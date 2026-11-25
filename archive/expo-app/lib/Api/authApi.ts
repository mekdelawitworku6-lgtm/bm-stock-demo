import { api } from "../api";
import { setCredentials } from "../authSlice";
// import { AuthResponse, LoginCredentials, RegisterCredentials } from "./types";
import { RootState } from "../store";

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<
      { token: string; user: any },
      { email: string; password: string }
    >({
      query: (credentials) => ({
        url: "auth/login",
        method: "POST",
        body: credentials,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          console.log("Login successful, setting credentials:", data);
          dispatch(
            setCredentials({
              token: data.data.accessToken,
              refreshToken: data.data.refreshToken,
              user: data.data.user,
            })
          );
        } catch (error) {
          console.error("Login failed:", error);
        }
      },
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/logout",
        method: "POST",
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          console.log("Logout successful, clearing credentials");
          dispatch(setCredentials({ token: null, user: null }));
        } catch (error) {
          console.error("Logout failed:", error);
        }
      },
    }),
    sendVerifyEmail: builder.mutation<void, { email: string }>({
      query: ({ email }) => ({
        url: "/auth/email/send-verification",
        method: "POST",
        body: { email },
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch (error) {
          console.error("Send verification email failed:", error);
        }
      },
    }),
    verifyEmail: builder.mutation<void, { email: string; otp: string }>({
      query: ({ email, otp }) => ({
        url: "/auth/email/verify",
        method: "POST",
        body: { email, otp },
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch (error) {
          console.error("Verify email failed:", error);
        }
      },
    }),
    forgotPassword: builder.mutation<void, { email: string }>({
      query: ({ email }) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body: { email },
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled;
          console.log("Forgot password email sent successfully");
        } catch (error) {
          console.error("Forgot password request failed:", error);
        }
      },
    }),
    resetPassword: builder.mutation<
      void,
      { email: string; otp: string; newPassword: string }
    >({
      query: ({ email, otp, newPassword }) => ({
        url: "/auth/reset-password",
        method: "POST",
        body: { email, otp, newPassword },
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled;
          console.log("Password reset successfully");
        } catch (error) {
          console.error("Password reset failed:", error);
        }
      },
    }),
    changePassword: builder.mutation<
      { message: string },
      { oldPassword: string; newPassword: string }
    >({
      query: ({ oldPassword, newPassword }) => ({
        url: "/users/change-password",
        method: "PATCH",
        body: { oldPassword, newPassword },
      }),
      transformResponse: (response, meta) => {
        // console.log("Raw response:", response, "Meta:", meta); // Debug logging
        if (meta?.response?.status === 200) {
          return {
            message:
              typeof response === "string"
                ? response
                : "Password changed successfully",
          };
        }
        throw new Error("Unexpected response");
      },
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          console.log("Password changed successfully:", data.message);
        } catch (error) {
          console.error("Change password failed:", error);
        }
      },
    }),
    getUserDetails: builder.query<any, void>({
      query: () => ({
        url: "/users/me",
        method: "GET",
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled, getState }) {
        try {
          const { data } = await queryFulfilled;
          const currentState = getState() as RootState;
          const currentToken = currentState.auth.token;
          console.log("Get user details, current token:", currentToken);
          dispatch(
            setCredentials({
              token: currentToken,
              user: data,
            })
          );
          console.log(
            "Get user details successful, token preserved:",
            currentToken
          );
        } catch (error) {
          console.error("Get user details failed:", error);
        }
      },
    }),
    updateUserDetails: builder.mutation<any, Partial<any>>({
      query: (updates) => ({
        url: `/users`,
        method: "PATCH",
        body: updates,
      }),
      async onQueryStarted(updates, { dispatch, queryFulfilled, getState }) {
        try {
          const { data } = await queryFulfilled;
          const currentState = getState() as RootState;
          const currentToken = currentState.auth.token;
          console.log("Update user details, current token:", currentToken);
          dispatch(
            setCredentials({
              token: currentToken,
              user: data,
            })
          );
          console.log("Update successful, token preserved:", currentToken);
        } catch (error) {
          console.error("Update user details failed:", error);
        }
      },
    }),
  }),
});

export const {
  //   useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useSendVerifyEmailMutation,
  useVerifyEmailMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useGetUserDetailsQuery,
  useUpdateUserDetailsMutation,
} = authApi;
