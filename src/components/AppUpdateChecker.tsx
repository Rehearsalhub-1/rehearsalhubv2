import { apiClient } from '../lib/apiClient';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

interface AppUpdateConfig {
  latestVersion: string;
  minRequiredVersion: string;
  downloadUrl: string;
  releaseNotes: string;
}
const compareVersions = (v1: string, v2: string) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

export const AppUpdateChecker = () => {
  const [updateConfig, setUpdateConfig] = useState<AppUpdateConfig | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isForceUpdate, setIsForceUpdate] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  useEffect(() => {
    let isMounted = true;

    const checkUpdate = async () => {
      try {
        const resData: any = await apiClient.get('/settings/version-control').catch(() => null);
        const data = (resData?.data || resData) as AppUpdateConfig;

        if (isMounted && data && data.latestVersion) {
          const isLatestGreater = compareVersions(data.latestVersion, currentVersion) === 1;
          const isMinRequiredGreater = data.minRequiredVersion ? compareVersions(data.minRequiredVersion, currentVersion) === 1 : false;

          if (isLatestGreater) {
            setUpdateConfig(data);
            setIsForceUpdate(isMinRequiredGreater);
            setIsVisible(true);
          } else {
            setIsVisible(false);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('AppUpdateChecker fetch error:', err);
          setDebugError(err.message || 'Fetch failed');
        }
      }
    };

    checkUpdate();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkUpdate();
      }
    });

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, [currentVersion]);

  const handleUpdate = () => {
    if (updateConfig?.downloadUrl) {
      Linking.openURL(updateConfig.downloadUrl).catch((err) => {
        console.warn('Failed to open download URL', err);
      });
    }
  };

  const handleDismiss = () => {
    if (!isForceUpdate) {
      setIsVisible(false);
    }
  };

  if (!isVisible || !updateConfig) return null;

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={[styles.overlay, { zIndex: 9999 }]}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-download-outline" size={48} color="#8b5cf6" />
          </View>
          
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.versionText}>
            Version {updateConfig.latestVersion} is now available!
          </Text>
          
          {updateConfig.releaseNotes ? (
            <View style={styles.releaseNotesContainer}>
              <Text style={styles.releaseNotesTitle}>What's new:</Text>
              <Text style={styles.releaseNotesText}>{updateConfig.releaseNotes}</Text>
            </View>
          ) : null}

          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
              <Text style={styles.updateButtonText}>Download Update</Text>
            </TouchableOpacity>

            {!isForceUpdate && (
              <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
                <Text style={styles.dismissButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {isForceUpdate && (
            <Text style={styles.forceUpdateText}>
              This is a mandatory update to continue using the app.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 16,
    color: '#cbd5e1',
    marginBottom: 20,
    textAlign: 'center',
  },
  releaseNotesContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  releaseNotesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 8,
  },
  releaseNotesText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
  },
  updateButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dismissButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  dismissButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  forceUpdateText: {
    marginTop: 16,
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
  },
});
