import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEYCHAIN_EMAIL_KEY = 'lws_rh_email';
const KEYCHAIN_PASSWORD_KEY = 'lws_rh_password';
const BIOMETRIC_ENABLED_KEY = 'lws_rh_biometric_enabled';

export class BiometricService {

  static async isHardwareSupported(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch {
      return false;
    }
  }

  static async getBiometricType(): Promise<'FaceID' | 'Fingerprint' | 'Biometrics'> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'FaceID';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'Fingerprint';
      }
      return types.length > 0 ? 'Biometrics' : 'Biometrics';
    } catch {
      return 'Biometrics';
    }
  }

  static async authenticate(promptMessage: string = 'Scan your face or fingerprint to sign in'): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false
      });
      return result.success;
    } catch {
      return false;
    }
  }

  static async saveCredentials(email: string, password: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYCHAIN_EMAIL_KEY, email);
      await SecureStore.setItemAsync(KEYCHAIN_PASSWORD_KEY, password);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
    } catch (e) {
      console.error('Failed to save secure credentials', e);
    }
  }

  static async getCredentials(): Promise<{email: string;password: string;} | null> {
    try {
      const email = await SecureStore.getItemAsync(KEYCHAIN_EMAIL_KEY);
      const password = await SecureStore.getItemAsync(KEYCHAIN_PASSWORD_KEY);
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);

      if (email && password && enabled === 'true') {
        return { email, password };
      }
      return null;
    } catch {
      return null;
    }
  }

  static async clearCredentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYCHAIN_EMAIL_KEY);
      await SecureStore.deleteItemAsync(KEYCHAIN_PASSWORD_KEY);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');
    } catch (e) {
      console.error('Failed to clear secure credentials', e);
    }
  }

  static async isBiometricEnabled(): Promise<boolean> {
    try {
      const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }
}
