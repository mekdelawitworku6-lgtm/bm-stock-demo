import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { logout } from '../lib/authSlice';
import {
    ApiError,
    getErrorMessage,
    isAuthError,
    shouldRetry,
    showApiError,
    showApiSuccess,
    showConfirmation
} from '../utils/apiErrorHandler';

export const useApiError = () => {
  const dispatch = useDispatch();

  const handleError = useCallback((error: ApiError, customMessage?: string) => {
    console.error('API Error:', error);
    
    // Handle authentication errors
    if (isAuthError(error)) {
      dispatch(logout());
      showApiError(error, 'Your session has expired. Please login again.');
      return;
    }

    // Show error message
    showApiError(error, customMessage);
  }, [dispatch]);

  const handleSuccess = useCallback((message: string, title?: string) => {
    showApiSuccess(message, title);
  }, []);

  const handleConfirmation = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => {
    showConfirmation(title, message, onConfirm, onCancel);
  }, []);

  const getErrorText = useCallback((error: ApiError): string => {
    return getErrorMessage(error);
  }, []);

  const canRetry = useCallback((error: ApiError): boolean => {
    return shouldRetry(error);
  }, []);

  return {
    handleError,
    handleSuccess,
    handleConfirmation,
    getErrorText,
    canRetry,
  };
};
