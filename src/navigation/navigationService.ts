import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(screen: string, params?: any, retries = 60) {
  if (navigationRef.isReady()) {
    (navigationRef as any).navigate(screen, params);
  } else if (retries > 0) {
    setTimeout(() => navigate(screen, params, retries - 1), 200);
  }
}

export function reset(state: any) {
  if (navigationRef.isReady()) {
    navigationRef.reset(state);
  }
}

export function getCurrentRoute() {
  return navigationRef.getCurrentRoute();
}
