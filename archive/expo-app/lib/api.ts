import {
    BaseQueryFn,
    createApi,
    FetchArgs,
    fetchBaseQuery,
    FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { RootState } from "./store";

const customBaseQuery = fetchBaseQuery({
  // baseUrl: "http://196.190.220.46/api/v1",cd 
// baseUrl:"http://localhost:5000/api/v1",
baseUrl:"http://192.168.43.160:5000/api/v1",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    console.log("Preparing headers with token:", token ? "Token present" : "No token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      console.warn("No token found in state");
    }
    return headers;
  },
});

const loggingBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // Log request details
  console.log("=== API Request ===");
  console.log("URL:", typeof args === "string" ? args : args.url);
  console.log(
    "Method:",
    typeof args === "string" ? "GET" : args.method || "GET"
  );
  if (typeof args !== "string" && args.body) {
    console.log("Body:", JSON.stringify(args.body, null, 2));
  }

  console.log(
    "headers:",
    api.getState().auth.token
      ? { Authorization: `Bearer ${api.getState().auth.token}` }
      : "No Authorization header"
  );
  console.log("==================");

  try {
    // Execute the request
    const result = await customBaseQuery(args, api, extraOptions);

    // Log response details
    console.log("=== API Response ===");
    console.log("Status:", result.meta?.response?.status);
    if (result.data) {
      console.log("Data:", JSON.stringify(result.data, null, 2));
    } else {
      console.log("Data: None");
    }
    if (result.error) {
      console.log("Error:");
      console.log("  Status:", result.error.status);
      if (result.error.data) {
        const errorData = result.error.data as any;
        console.log(
          "  Message:",
          errorData.message
            ? Array.isArray(errorData.message)
              ? errorData.message.join(", ")
              : errorData.message
            : "No message provided"
        );
        console.log("  Path:", errorData.path || "Unknown");
        console.log("  Method:", errorData.method || "Unknown");
        console.log("  Success:", errorData.success ?? "Unknown");
        console.log("  Timestamp:", errorData.timestamp || "Unknown");
      } else {
        console.log("  Details: Unknown error");
      }
    } else {
      console.log("Error: None");
    }
    console.log("==================");

    return result;
  } catch (error) {
    console.error("=== API Request Failed ===");
    console.error("Error:", error);
    console.error("Args:", args);
    console.error("==================");
    
    // Return a structured error response that matches FetchBaseQueryError
    return {
      error: {
        status: 'FETCH_ERROR' as const,
        error: error instanceof Error ? error.message : 'Network request failed',
        data: {
          message: error instanceof Error ? error.message : 'Network request failed',
          error: 'Network Error',
          details: 'Unable to connect to the server. Please check your internet connection.'
        }
      }
    };
  }
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: loggingBaseQuery,
  tagTypes: ["User", "Posts", "Credit", "Shop", "Branch", "Sales", "Transfer", "Request", "Commission", "Purchase", "Expense", "Company", "Notification"],
  endpoints: () => ({}),
});
