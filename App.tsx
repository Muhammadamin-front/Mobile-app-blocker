import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AppShell} from './src/presentation/AppShell';
import {AppStoreProvider, useAppStore} from './src/state/AppStore';

function ThemedApp() {
  const systemScheme = useColorScheme();
  const {themePreference} = useAppStore();
  const isDark =
    themePreference === 'dark' ||
    (themePreference === 'system' && systemScheme === 'dark');

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />
      <AppShell isDark={isDark} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStoreProvider>
        <ThemedApp />
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}
