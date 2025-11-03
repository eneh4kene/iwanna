import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { colors, typography, spacing } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { usePodStore } from '../store/podStore';
import { socketService } from '../services/socketService';

// Type imports
import type {
  RootStackParamList,
  MainTabsParamList,
  HomeStackParamList,
  PodsStackParamList,
} from './types';

// Auth screens
import { AgeGateScreen } from '../screens/AgeGateScreen';
import { RecoveryPhraseScreen } from '../screens/RecoveryPhraseScreen';
import { AccountRecoveryScreen } from '../screens/AccountRecoveryScreen';

// Main screens
import { HomeScreen } from '../screens/HomeScreen';
import { MatchingScreen } from '../screens/MatchingScreen';
import { PodsListScreen } from '../screens/PodsListScreen';
import { PodDetailScreen } from '../screens/PodDetailScreen';
import { PodMatchedScreen } from '../screens/PodMatchedScreen';

// Create navigators
const RootStack = createNativeStackNavigator<RootStackParamList>();
const MainTabs = createBottomTabNavigator<MainTabsParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const PodsStack = createNativeStackNavigator<PodsStackParamList>();

/**
 * Home Stack Navigator
 */
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Matching" component={MatchingScreen} />
    </HomeStack.Navigator>
  );
}

/**
 * Pods Stack Navigator
 */
function PodsStackNavigator() {
  return (
    <PodsStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <PodsStack.Screen name="PodsList" component={PodsListScreen} />
      <PodsStack.Screen name="PodDetail" component={PodDetailScreen} />
    </PodsStack.Navigator>
  );
}

/**
 * Main Tabs Navigator
 */
function MainTabsNavigator() {
  const activePods = usePodStore((state) => state.activePods);

  return (
    <MainTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: {
          fontSize: typography.fontSize.xs,
          fontWeight: typography.fontWeight.semibold,
        },
      }}
    >
      <MainTabs.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24, color }}>🏠</Text>
          ),
        }}
      />
      <MainTabs.Screen
        name="PodsTab"
        component={PodsStackNavigator}
        options={{
          tabBarLabel: 'Pods',
          tabBarBadge: activePods.length > 0 ? activePods.length : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: colors.text.primary,
            fontSize: typography.fontSize.xs,
            fontWeight: typography.fontWeight.bold,
          },
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24, color }}>👥</Text>
          ),
        }}
      />
    </MainTabs.Navigator>
  );
}

/**
 * App Navigator
 * Main navigation component with WebSocket integration and auth flow
 */
export function AppNavigator() {
  const navigationRef = useNavigationContainerRef();
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string>('AgeGate');

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const recoveryPhrase = useAuthStore((state) => state.recoveryPhrase);
  const loadUser = useAuthStore((state) => state.loadUser);
  const connectSocket = usePodStore((state) => state.connectSocket);

  // Initialize app
  useEffect(() => {
    const init = async () => {
      try {
        await loadUser();

        // Determine initial route
        if (isAuthenticated) {
          if (recoveryPhrase) {
            setInitialRoute('RecoveryPhrase');
          } else {
            setInitialRoute('MainTabs');
          }
        } else {
          setInitialRoute('AgeGate');
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        setInitialRoute('AgeGate');
      } finally {
        setIsReady(true);
      }
    };

    init();

    return () => {
      // Cleanup WebSocket on unmount
      socketService.disconnect();
    };
  }, []);

  // Handle auth state changes after initialization
  useEffect(() => {
    if (!isReady || !navigationRef.isReady()) return;

    if (isAuthenticated) {
      if (recoveryPhrase) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'RecoveryPhrase' }],
        });
      } else {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
        // Connect to WebSocket
        connectSocket();
      }
    } else {
      const currentRoute = navigationRef.getCurrentRoute()?.name;
      if (currentRoute !== 'AgeGate' && currentRoute !== 'AccountRecovery') {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'AgeGate' }],
        });
      }
    }
  }, [isAuthenticated, recoveryPhrase, isReady]);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: true,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.text.primary,
          border: colors.text.disabled,
          notification: colors.accent,
        },
        fonts: {
          regular: {
            fontFamily: 'System',
            fontWeight: typography.fontWeight.regular,
          },
          medium: {
            fontFamily: 'System',
            fontWeight: typography.fontWeight.medium,
          },
          bold: {
            fontFamily: 'System',
            fontWeight: typography.fontWeight.bold,
          },
          heavy: {
            fontFamily: 'System',
            fontWeight: typography.fontWeight.bold,
          },
        },
      }}
    >
      <RootStack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <RootStack.Screen name="AgeGate" component={AgeGateScreen} />
        <RootStack.Screen name="RecoveryPhrase" component={RecoveryPhraseScreen} />
        <RootStack.Screen name="AccountRecovery" component={AccountRecoveryScreen} />
        <RootStack.Screen name="MainTabs" component={MainTabsNavigator} />

        {/* Modal screens */}
        <RootStack.Screen
          name="PodMatched"
          component={PodMatchedScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
