import { useNavigation as useRNNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { Alert, BackHandler } from 'react-native';

interface NavigationOptions {
  canGoBack?: boolean;
  showExitConfirmation?: boolean;
  exitMessage?: string;
  exitTitle?: string;
}

export const useAppNavigation = (options: NavigationOptions = {}) => {
  const navigation = useRNNavigation();
  const {
    canGoBack = true,
    showExitConfirmation = false,
    exitMessage = 'Are you sure you want to exit?',
    exitTitle = 'Exit App'
  } = options;

  const goBack = useCallback(() => {
    if (canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    } else if (showExitConfirmation) {
      Alert.alert(
        exitTitle,
        exitMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Exit',
            style: 'destructive',
            onPress: () => BackHandler.exitApp(),
          },
        ]
      );
    }
  }, [navigation, canGoBack, showExitConfirmation, exitMessage, exitTitle]);

  const navigate = useCallback((screen: string, params?: any) => {
    navigation.navigate(screen as never, params as never);
  }, [navigation]);

  const reset = useCallback((screen: string, params?: any) => {
    navigation.reset({
      index: 0,
      routes: [{ name: screen, params }],
    });
  }, [navigation]);

  const replace = useCallback((screen: string, params?: any) => {
    navigation.replace(screen as never, params as never);
  }, [navigation]);

  return {
    goBack,
    navigate,
    reset,
    replace,
    canGoBack: navigation.canGoBack(),
    navigation,
  };
};
