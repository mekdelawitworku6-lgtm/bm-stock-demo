import { Alert } from 'react-native';

export interface ApiError {
  status?: number;
  data?: {
    message?: string | string[];
    error?: string;
    details?: string;
  };
  message?: string;
}

export const getErrorMessage = (error: ApiError): string => {
  // Handle different error formats
  if (error.data?.message) {
    if (Array.isArray(error.data.message)) {
      return error.data.message.join(', ');
    }
    return error.data.message;
  }

  if (error.data?.error) {
    return error.data.error;
  }

  if (error.data?.details) {
    return error.data.details;
  }

  if (error.message) {
    return error.message;
  }

  // Handle HTTP status codes
  switch (error.status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Authentication failed. Please login again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This action conflicts with existing data.';
    case 422:
      return 'Invalid data provided. Please check your input.';
    case 429:
      return 'Too many requests. Please try again later.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

export const showApiError = (error: ApiError, customMessage?: string) => {
  const message = customMessage || getErrorMessage(error);
  
  Alert.alert(
    'Error',
    message,
    [
      {
        text: 'OK',
        style: 'default',
      },
    ]
  );
};

export const showApiSuccess = (message: string, title: string = 'Success') => {
  Alert.alert(
    title,
    message,
    [
      {
        text: 'OK',
        style: 'default',
      },
    ]
  );
};

export const showConfirmation = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  Alert.alert(
    title,
    message,
    [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: onConfirm,
      },
    ]
  );
};

export const isNetworkError = (error: ApiError): boolean => {
  return !error.status || error.status >= 500;
};

export const isAuthError = (error: ApiError): boolean => {
  return error.status === 401 || error.status === 403;
};

export const shouldRetry = (error: ApiError): boolean => {
  return isNetworkError(error) || error.status === 429;
};
