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

type RouteListener = (name: string | null) => void;
const routeListeners = new Set<RouteListener>();

export function subscribeToRoute(listener: RouteListener) {
  routeListeners.add(listener);
  if (navigationRef.isReady()) {
    listener(navigationRef.getCurrentRoute()?.name || null);
  }
  return () => {
    routeListeners.delete(listener);
  };
}

export function notifyRouteChanged() {
  if (navigationRef.isReady()) {
    const current = navigationRef.getCurrentRoute()?.name || null;
    routeListeners.forEach((fn) => {
      try {
        fn(current);
      } catch {}
    });
  }
}
