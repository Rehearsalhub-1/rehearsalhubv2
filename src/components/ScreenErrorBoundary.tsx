import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { debugSessionLog } from '../lib/debugSessionLog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ErrorBoundaryProps {
  children: React.ReactNode;
  screenName?: string;
  onGoBack?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
export class ScreenErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const screenName = this.props.screenName || 'Unknown';
    console.error(
      `[ScreenErrorBoundary] ${screenName} crashed:`,
      error?.message || error,
      info?.componentStack?.slice(0, 500)
    );
    Sentry.withScope((scope) => {
      scope.setTag('screen', screenName);
      scope.setExtra('componentStack', info?.componentStack);
      Sentry.captureException(error);
    });

    debugSessionLog('H1', 'src/components/ScreenErrorBoundary.tsx:componentDidCatch', 'Screen crashed (render error boundary)', {
      screenName: this.props.screenName || 'Unknown',
      errorMessage: (error as any)?.message,
      errorName: (error as any)?.name,
      componentStackHead: info?.componentStack ? info.componentStack.slice(0, 500) : null,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="sparkles-outline" size={48} color="#9333EA" />
            </View>

            <Text style={styles.title}>
              {this.props.screenName || 'Rehearsal Hub'}
            </Text>
            <Text style={styles.subtitle}>
              This view is taking a moment to connect. Tap below to refresh.
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.handleRetry}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.retryText}>Refresh</Text>
            </TouchableOpacity>

            {this.props.onGoBack && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={this.props.onGoBack}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={18} color="#aaa" />
                <Text style={styles.backText}>Go Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.15)',
  },
  errorText: {
    fontSize: 11,
    color: '#ff6b6b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  } as any,
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9333EA',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    marginBottom: 12,
  },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  backText: {
    color: '#aaa',
    fontSize: 14,
  },
});
import { Platform } from 'react-native';
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string
) {
  const WithErrorBoundary = React.forwardRef<any, P & { navigation?: any }>((props, ref) => (
    <ScreenErrorBoundary
      screenName={screenName}
      onGoBack={props.navigation?.canGoBack?.() ? () => props.navigation.goBack() : undefined}
    >
      <WrappedComponent {...(props as P)} ref={ref} />
    </ScreenErrorBoundary>
  ));
  WithErrorBoundary.displayName = `withErrorBoundary(${screenName})`;
  return WithErrorBoundary;
}
