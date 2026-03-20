import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from './src/store/store';
import AppNavigator from './src/navigation/AppNavigator';
import { initDeviceIdentity } from './src/services/deviceIdentity';
import { removeSession } from './src/hooks/api';

const FRESH_INSTALL_KEY = 'app_has_launched';

/**
 * iOS Keychain persists across uninstall/reinstall.
 * Detect a fresh install by checking an AsyncStorage flag
 * (which IS deleted on uninstall) and clear stale Keychain data.
 */
const clearKeychainOnFreshInstall = async () => {
  try {
    const hasLaunched = await AsyncStorage.getItem(FRESH_INSTALL_KEY);
    if (!hasLaunched) {
      console.log('[App] Fresh install detected — clearing stale Keychain data');
      await removeSession();
      await AsyncStorage.setItem(FRESH_INSTALL_KEY, 'true');
    }
  } catch (e) {
    console.warn('[App] Fresh install check failed:', e);
  }
};

const App: React.FC = () => {
  useEffect(() => {
    // Clear leftover Keychain on iOS fresh install
    if (Platform.OS === 'ios') {
      clearKeychainOnFreshInstall();
    }

    // Fetch hardware device ID and store in Keychain/Keystore on launch
    initDeviceIdentity().catch((err) =>
      console.warn('[App] Failed to initialise device identity:', err),
    );
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </Provider>
  );
};

export default App;
