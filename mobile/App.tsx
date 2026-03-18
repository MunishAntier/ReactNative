import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { initDeviceIdentity } from './src/services/deviceIdentity';

const App: React.FC = () => {
  useEffect(() => {
    // Fetch hardware device ID and store in Keychain/Keystore on launch
    initDeviceIdentity().catch((err) =>
      console.warn('[App] Failed to initialise device identity:', err),
    );
  }, []);

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
};

export default App;
