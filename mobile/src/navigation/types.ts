/**
 * Navigation type definitions
 */

export type RootStackParamList = {
  AgeGate: undefined;
  RecoveryPhrase: undefined;
  AccountRecovery: undefined;
  MainTabs: undefined;
  PodMatched: { podId: string };
};

export type MainTabsParamList = {
  HomeTab: undefined;
  PodsTab: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Matching: undefined;
};

export type PodsStackParamList = {
  PodsList: undefined;
  PodDetail: { podId: string };
};
