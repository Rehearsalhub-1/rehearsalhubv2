import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';

import { darkTheme } from '../constants/Colors';
import { ZONES, Zone, getZoneByInvitationCode, isHQGroup } from '../config/zones';
import { BiometricService } from '../lib/biometrics';
import { apiClient } from '../lib/apiClient';
import { reinitializeUserStore, useUserStore } from '../hooks/useUser';

WebBrowser.maybeCompleteAuthSession();

const DESIGNATIONS = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Backup Singer', 'Instrumentalist'];

function sanitizeError(error: string): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const lower = error.toLowerCase();
  if (
    lower.includes('invalid credential') ||
    lower.includes('invalid login') ||
    lower.includes('wrong password') ||
    lower.includes('invalid credentials')
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (lower.includes('user not found') || lower.includes('no account found')) {
    return 'No account found with this identifier. Please check your details or create an account.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Network connection issue. Please check your internet and try again.';
  }
  return error;
}

export default function LoginScreen({ route, navigation }: any) {
  const styles = useMemo(() => getStyles(), []);

  const [isLogin, setIsLogin] = useState(route?.params?.mode !== 'signup');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [zoneCode, setZoneCode] = useState('');
  const [designation, setDesignation] = useState('Soprano');
  const [kingschatId, setKingschatId] = useState('');

  // Biometrics
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<'FaceID' | 'Fingerprint' | 'Biometrics'>('Biometrics');

  // Zone Picker Modal
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [zoneModalTab, setZoneModalTab] = useState<'browse' | 'code'>('browse');
  const [zoneSearchQuery, setZoneSearchQuery] = useState('');
  const [invitationCodeInput, setInvitationCodeInput] = useState('');

  // Forgot Password Modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'password'>('email');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0); // seconds remaining before can resend
  const [dbZones, setDbZones] = useState<any[]>([]);

  useEffect(() => {
    checkRememberedCredentials();
    checkBiometrics();
    loadZones();
  }, []);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const loadZones = async () => {
    try {
      const res = await apiClient.get<any>('/organizations');
      if (res?.success && Array.isArray(res.data)) {
        setDbZones(res.data);
      }
    } catch {}
  };

  const checkRememberedCredentials = async () => {
    try {
      const enabled = await SecureStore.getItemAsync('remember_me_enabled');
      if (enabled === 'true') {
        const savedEmail = await SecureStore.getItemAsync('remembered_email');
        const savedPassword = await SecureStore.getItemAsync('remembered_password');
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
        if (savedPassword) {
          setPassword(savedPassword);
        }
      }
    } catch {}
  };

  const checkBiometrics = async () => {
    try {
      const isSupported = await BiometricService.isHardwareSupported();
      if (isSupported) {
        setBiometricsAvailable(true);
        const type = await BiometricService.getBiometricType();
        setBiometricType(type);

        const savedCreds = await BiometricService.getCredentials();
        if (savedCreds) {
          setBiometricsEnabled(true);
          setEmail(savedCreds.email);
          setPassword('••••••••••••');
        }
      }
    } catch {}
  };

  const handleBiometricAuth = async () => {
    try {
      setLoading(true);
      const creds = await BiometricService.getCredentials();
      if (!creds || !creds.email || !creds.password) {
        Alert.alert('Biometrics', 'No saved credentials found. Please sign in with your password first.');
        setLoading(false);
        return;
      }

      const res = await apiClient.post<{
        success: boolean;
        data?: { accessToken: string; refreshToken: string; user?: any };
        error?: string;
      }>('/auth/login', {
        identifier: creds.email,
        password: creds.password,
      });

      if (res.success && res.data) {
        const userId = res.data.user?.id || (res.data as any)?.userId || '';
        await apiClient.storeTokens(res.data.accessToken, res.data.refreshToken, userId);
        await useUserStore.getState().bootstrap();
        navigation.replace('Home');
      } else {
        Alert.alert('Authentication Failed', sanitizeError(res.error || 'Invalid credentials'));
      }
    } catch (err: any) {
      Alert.alert('Biometrics Error', err?.message || 'Biometric authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // Multi-Account Chooser State
  const [multipleAccounts, setMultipleAccounts] = useState<any[] | null>(null);
  const [savedKcToken, setSavedKcToken] = useState<string>('');
  const [accountSelectLoading, setAccountSelectLoading] = useState(false);

  const handleSelectAccount = async (targetEmail: string) => {
    if (!savedKcToken) return;
    setAccountSelectLoading(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data?: { accessToken: string; refreshToken: string; user?: any };
        error?: string;
      }>('/auth/kingschat-login', {
        accessToken: savedKcToken,
        selectedEmail: targetEmail,
        email: targetEmail,
      });

      if (res.success && res.data) {
        const userId = res.data.user?.id || (res.data as any)?.userId || '';
        await apiClient.storeTokens(res.data.accessToken, res.data.refreshToken, userId);
        await useUserStore.getState().bootstrap();
        setMultipleAccounts(null);
        navigation.replace('Home');
        return;
      }
      throw new Error(res.error || 'Failed to authenticate');
    } catch (err: any) {
      Alert.alert('Login Failed', sanitizeError(err?.message || 'Failed to sign into account'));
    } finally {
      setAccountSelectLoading(false);
    }
  };

  // 1-Tap KingsChat Authentication
  const handleKingsChatAuth = async () => {
    setLoading(true);
    try {
      const KINGSCHAT_CLIENT_ID =
        process.env.EXPO_PUBLIC_KINGSCHAT_CLIENT_ID || 'a1f444fa-ea50-47cf-ba2b-232d0b46d1f5';
      const authUrl = `https://accounts.kingschat.online/log-in?clientId=${KINGSCHAT_CLIENT_ID}&origin=mobile-flow`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'rehearsalhub://kingschat-callback');

      if (result.type === 'success' && result.url) {
        let accessToken = '';
        const tokenMatch = result.url.match(/(?:access_token|accessToken|token)=([^&#]+)/);
        if (tokenMatch && tokenMatch[1]) {
          accessToken = decodeURIComponent(tokenMatch[1]);
        } else {
          try {
            const cleanUrl = result.url.replace('#', '?');
            const urlObj = new URL(cleanUrl);
            accessToken =
              urlObj.searchParams.get('access_token') ||
              urlObj.searchParams.get('accessToken') ||
              urlObj.searchParams.get('token') ||
              '';
          } catch {}
        }

        if (!accessToken) {
          Alert.alert('Authentication Failed', 'Failed to retrieve access token from KingsChat.');
          setLoading(false);
          return;
        }

        const res = await apiClient.post<{
          success: boolean;
          data?: { accessToken: string; refreshToken: string; user?: any };
          code?: string;
          accounts?: any[];
          profile?: any;
          kingschatUserId?: string;
          error?: string;
        }>('/auth/kingschat-login', { accessToken });

        if (res.success && res.data) {
          const userId = res.data.user?.id || (res.data as any)?.userId || '';
          await apiClient.storeTokens(res.data.accessToken, res.data.refreshToken, userId);
          reinitializeUserStore();
          navigation.replace('Home');
          return;
        }

        // Multiple accounts linked to this KingsChat ID
        if (res.code === 'MULTIPLE_ACCOUNTS' && (res as any).accounts?.length > 1) {
          setMultipleAccounts((res as any).accounts);
          setSavedKcToken(accessToken);
          setLoading(false);
          return;
        }

        // New KingsChat User -> Auto-fill & Switch to Create Account
        if (res.code === 'NO_ACCOUNT' || res.code === 'NEW_USER') {
          const p = res.profile || {};
          setKingschatId(res.kingschatUserId || p.kingschatId || '');
          setFirstName(p.firstName || '');
          setLastName(p.lastName || '');
          setEmail(p.email || '');
          setPassword('KC-' + Math.random().toString(36).substring(2, 10) + '!');
          setIsLogin(false);
          Alert.alert('KingsChat Verified', 'Welcome! Please select your Choir Zone below to complete registration.');
          setLoading(false);
          return;
        }

        throw new Error(res.error || 'Authentication failed');
      }
    } catch (err: any) {
      if (!err?.message?.includes('cancel') && !err?.message?.includes('dismissed')) {
        Alert.alert('KingsChat Login Error', sanitizeError(err?.message || 'Failed to authenticate with KingsChat'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Submit Sign In or Sign Up
  const handleSubmit = async () => {
    if (isLogin) {
      if (!email.trim() || !password) {
        Alert.alert('Missing Fields', 'Please enter your email or username and password.');
        return;
      }

      setLoading(true);
      try {
        const res = await apiClient.post<{
          success: boolean;
          data?: { accessToken: string; refreshToken: string; user?: any };
          error?: string;
        }>('/auth/login', {
          identifier: email.trim(),
          password: password,
        });

        if (!res.success || !res.data) {
          Alert.alert('Sign In Failed', sanitizeError(res.error || 'Invalid credentials'));
          setLoading(false);
          return;
        }

        const userId = res.data.user?.id || (res.data as any)?.userId || '';
        await apiClient.storeTokens(res.data.accessToken, res.data.refreshToken, userId);

        if (rememberMe) {
          await SecureStore.setItemAsync('remember_me_enabled', 'true');
          await SecureStore.setItemAsync('remembered_email', email.trim());
          await SecureStore.setItemAsync('remembered_password', password);
        }

        await useUserStore.getState().bootstrap();

        if (biometricsAvailable && !biometricsEnabled) {
          Alert.alert(
            'Enable Biometrics',
            `Would you like to enable ${biometricType === 'FaceID' ? 'Face ID' : 'Fingerprint'} for faster sign in?`,
            [
              { text: 'No Thanks', onPress: () => navigation.replace('Home') },
              {
                text: 'Enable',
                onPress: async () => {
                  await BiometricService.saveCredentials(email.trim(), password);
                  navigation.replace('Home');
                },
              },
            ]
          );
        } else {
          navigation.replace('Home');
        }
      } catch (err: any) {
        Alert.alert('Sign In Error', sanitizeError(err?.message || 'Failed to sign in'));
      } finally {
        setLoading(false);
      }
    } else {
      if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
        Alert.alert('Missing Fields', 'Please complete all required fields.');
        return;
      }
      if (!zoneCode || zoneCode.length < 2) {
        Alert.alert('Select Zone', 'Please select your Choir Zone or enter a valid invitation code.');
        return;
      }
      if (password.length < 8) {
        Alert.alert('Weak Password', 'Password must be at least 8 characters.');
        return;
      }

      setLoading(true);
      try {
        const res = await apiClient.post<{
          success: boolean;
          data?: { accessToken: string; refreshToken: string; user?: any };
          pendingApproval?: boolean;
          error?: string;
        }>('/auth/register', {
          email: email.trim().toLowerCase(),
          password: password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          zone_code: zoneCode.trim().toUpperCase(),
          designation: designation,
          kingschat_id: kingschatId || undefined,
        });

        if (!res.success) {
          Alert.alert('Registration Failed', sanitizeError(res.error || 'Failed to create account'));
          setLoading(false);
          return;
        }

        if (res.pendingApproval) {
          Alert.alert(
            'Application Submitted',
            'Your application to join an HQ group has been submitted. You will be notified once approved.',
            [{ text: 'OK', onPress: () => setIsLogin(true) }]
          );
          setLoading(false);
          return;
        }

        if (res.data) {
          const userId = res.data.user?.id || (res.data as any)?.userId || '';
          await apiClient.storeTokens(res.data.accessToken, res.data.refreshToken, userId);
          reinitializeUserStore();
          navigation.replace('Home');
        }
      } catch (err: any) {
        Alert.alert('Registration Error', sanitizeError(err?.message || 'Registration failed'));
      } finally {
        setLoading(false);
      }
    }
  };

  const allZonesList = useMemo(() => {
    return dbZones.length > 0 ? dbZones : ZONES;
  }, [dbZones]);

  // Regional zones for "Browse" tab
  const filteredRegionalZones = useMemo(() => {
    const list = allZonesList.filter((z: any) => !z.isHq && z.id !== 'zone-boss');
    if (!zoneSearchQuery.trim()) return list;
    const q = zoneSearchQuery.toLowerCase().trim();
    return list.filter(
      (z: any) =>
        (z.name?.toLowerCase() || '').includes(q) ||
        (z.region?.toLowerCase() || '').includes(q) ||
        (z.code?.toLowerCase() || '').includes(q) ||
        (z.invitationCode?.toLowerCase() || '').includes(q)
    );
  }, [allZonesList, zoneSearchQuery]);

  // Invitation code lookup for "Invitation Code" tab
  const matchedInvitationZone = useMemo(() => {
    const code = invitationCodeInput.trim().toUpperCase();
    if (!code || code.length < 2) return null;
    return allZonesList.find((z: any) =>
      (z.invitationCode && z.invitationCode.toUpperCase() === code) ||
      (z.code && z.code.toUpperCase() === code) ||
      (z.id && z.id.toUpperCase() === code)
    ) || getZoneByInvitationCode(code);
  }, [allZonesList, invitationCodeInput]);

  const selectedZoneObj = useMemo(() => {
    if (!zoneCode) return null;
    const clean = zoneCode.trim().toUpperCase();
    return allZonesList.find((z: any) =>
      (z.invitationCode && z.invitationCode.toUpperCase() === clean) ||
      (z.code && z.code.toUpperCase() === clean) ||
      (z.id && z.id.toUpperCase() === clean)
    ) || getZoneByInvitationCode(zoneCode);
  }, [allZonesList, zoneCode]);

  // Forgot Password Actions
  const handleSendOtp = async () => {
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (otpCooldown > 0) return; // guard — button should be disabled but just in case

    setForgotLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; error?: string }>(
        '/auth/forgot-password/send-otp',
        { email: forgotEmail.trim().toLowerCase() },
        20000, // 20s — enough time even on cold start
      );

      if (res.success) {
        setOtpCooldown(60); // 60s cooldown after every successful send
        setForgotStep('otp');
      } else {
        const msg = res.error || '';
        const isRateLimited = msg.toLowerCase().includes('too many');
        if (isRateLimited) {
          setOtpCooldown(60);
          Alert.alert(
            '⏳ Slow Down',
            'You have requested too many codes. Please wait 60 seconds before trying again.',
          );
        } else {
          Alert.alert('Error', msg || 'Failed to send verification code');
        }
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('timed out') || msg.includes('AbortError')) {
        Alert.alert(
          'Server Busy',
          'The server is starting up. Please wait a moment and tap Send again.',
        );
      } else {
        Alert.alert('Error', msg || 'Failed to send code. Check your connection.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code sent to your email.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; error?: string }>('/auth/forgot-password/verify-otp', {
        email: forgotEmail.trim().toLowerCase(),
        otp: forgotOtp.trim(),
      });
      if (res.success) {
        setForgotStep('password');
      } else {
        Alert.alert('Error', res.error || 'Invalid verification code');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Verification failed');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter your registered email address.');
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; error?: string }>('/auth/reset-password', {
        email: forgotEmail.trim().toLowerCase(),
        newPassword: forgotNewPassword.trim(),
        password: forgotNewPassword.trim(),
      });
      if (res.success) {
        setEmail(forgotEmail.trim().toLowerCase());
        setPassword(forgotNewPassword);
        setShowForgotModal(false);
        setForgotEmail('');
        setForgotNewPassword('');
        Alert.alert(
          'Password Updated',
          'Your password has been successfully updated! We have pre-filled your credentials so you can log in immediately.',
          [{ text: 'Sign In', onPress: () => {} }]
        );
      } else {
        Alert.alert('Reset Failed', res.error || 'Failed to reset password');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Password reset failed');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      {/* Background Gradient & Ambient Glow Elements */}
      <LinearGradient
        colors={[darkTheme.colors.backgroundDark, darkTheme.colors.background, darkTheme.colors.backgroundDark]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.ambientGlowPink} />
      <View style={styles.ambientGlowPurple} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Brand Header with Logo & Typography */}
            <View style={styles.brandHeader}>
              <Image
                source={require('../../assets/logo/logo.png')}
                style={styles.brandLogo}
                contentFit="contain"
              />
              <Text style={styles.brandTitle}>LOVEWORLD SINGERS</Text>
              <Text style={styles.brandSubtitle}>REHEARSAL HUB PORTAL</Text>
            </View>

            {/* 1-Tap KingsChat Button */}
            <TouchableOpacity
              style={styles.kingschatButton}
              onPress={handleKingsChatAuth}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.kingschatButtonText}>Continue with KingsChat</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR WITH EMAIL</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Segmented Mode Switch Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, isLogin && styles.tabButtonActive]}
                onPress={() => setIsLogin(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, !isLogin && styles.tabButtonActive]}
                onPress={() => setIsLogin(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>Create Account</Text>
              </TouchableOpacity>
            </View>

            {/* Form Container */}
            <View style={styles.formContainer}>
              {!isLogin && (
                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>FIRST NAME</Text>
                    <View style={styles.inputField}>
                      <TextInput
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="John"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        style={styles.textInput}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.inputLabel}>LAST NAME</Text>
                    <View style={styles.inputField}>
                      <TextInput
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Doe"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        style={styles.textInput}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Email / Username */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{isLogin ? 'EMAIL OR USERNAME' : 'EMAIL ADDRESS'}</Text>
                <View style={styles.inputField}>
                  <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.4)" style={{ marginRight: 10 }} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder={isLogin ? 'singer@loveworld.org' : 'yourname@gmail.com'}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={styles.textInput}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  {isLogin && (
                    <TouchableOpacity onPress={() => setShowForgotModal(true)}>
                      <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.inputField}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="rgba(255,255,255,0.4)"
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    secureTextEntry={!showPassword}
                    style={styles.textInput}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="rgba(255,255,255,0.4)"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Create Account Extra Fields */}
              {!isLogin && (
                <>
                  {/* Zone Picker Button */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>CHOIR ZONE / GROUP</Text>
                    <TouchableOpacity
                      style={styles.zoneButton}
                      onPress={() => setShowZoneModal(true)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                        <View style={styles.zoneIconWrapper}>
                          <Ionicons name="business" size={16} color="#c084fc" />
                        </View>
                        <View style={{ flex: 1 }}>
                          {selectedZoneObj ? (
                            <>
                              <Text style={styles.zoneNameText} numberOfLines={1}>
                                {selectedZoneObj.name}
                              </Text>
                              <Text style={styles.zoneSubText}>
                                {selectedZoneObj.region} • {selectedZoneObj.invitationCode}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.zonePlaceholder}>Select your Choir Zone...</Text>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  </View>

                  {/* Designation Pills */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>VOCAL PART / ROLE</Text>
                    <View style={styles.designationGrid}>
                      {DESIGNATIONS.map((role) => (
                        <TouchableOpacity
                          key={role}
                          style={[styles.designationPill, designation === role && styles.designationPillActive]}
                          onPress={() => setDesignation(role)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.designationText, designation === role && styles.designationTextActive]}>
                            {role}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                {isLogin && biometricsAvailable && (
                  <TouchableOpacity
                    style={styles.biometricButton}
                    onPress={handleBiometricAuth}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={biometricType === 'FaceID' ? 'scan-outline' : 'finger-print-outline'}
                      size={24}
                      color={darkTheme.colors.accent}
                    />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.primaryButton, { flex: 1 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[darkTheme.colors.accent, darkTheme.colors.accentBright]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ========================================================================= */}
      {/* ZONE PICKER MODAL (CLEAN SEGMENTED TAB TOGGLE) */}
      {/* ========================================================================= */}
      <Modal
        visible={showZoneModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { Keyboard.dismiss(); setShowZoneModal(false); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowZoneModal(false); }}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.modalTitle}>Select Choir Zone</Text>
                <Text style={styles.modalSubtitle}>
                  {zoneModalTab === 'browse' ? 'Browse regional chapters' : 'Enter secret or HQ invitation code'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowZoneModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Clean Segmented Tab Switcher */}
            <View style={styles.modalTabContainer}>
              <TouchableOpacity
                style={[styles.modalTabBtn, zoneModalTab === 'browse' && styles.modalTabBtnActive]}
                onPress={() => setZoneModalTab('browse')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="earth-outline"
                  size={14}
                  color={zoneModalTab === 'browse' ? '#ffffff' : 'rgba(255,255,255,0.45)'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.modalTabText, zoneModalTab === 'browse' && styles.modalTabTextActive]}>
                  Regional Zones
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTabBtn, zoneModalTab === 'code' && styles.modalTabBtnActive]}
                onPress={() => setZoneModalTab('code')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="key-outline"
                  size={14}
                  color={zoneModalTab === 'code' ? '#ffffff' : 'rgba(255,255,255,0.45)'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.modalTabText, zoneModalTab === 'code' && styles.modalTabTextActive]}>
                  Invitation Code
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: BROWSE REGIONAL CHAPTERS */}
            {zoneModalTab === 'browse' && (
              <>
                <View style={styles.searchSection}>
                  <View style={styles.searchBarContainer}>
                    <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
                    <TextInput
                      value={zoneSearchQuery}
                      onChangeText={setZoneSearchQuery}
                      placeholder="Search by city or zone name (e.g. Lagos, UK)..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      style={styles.searchTextInput}
                      autoCapitalize="none"
                    />
                    {zoneSearchQuery ? (
                      <TouchableOpacity onPress={() => setZoneSearchQuery('')}>
                        <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                <FlatList
                  data={filteredRegionalZones}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isSelected = zoneCode === item.invitationCode;
                    return (
                      <TouchableOpacity
                        style={[styles.zoneListItem, isSelected && styles.zoneListItemSelected]}
                        onPress={() => {
                          setZoneCode(item.invitationCode || '');
                          setShowZoneModal(false);
                          setZoneSearchQuery('');
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={[styles.zoneListTitle, isSelected && styles.zoneListTitleSelected]}>
                            {item.name}
                          </Text>
                          <Text style={styles.zoneListSubtitle}>
                            {item.region} •{' '}
                            <Text
                              style={{
                                fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                                color: isSelected ? '#c084fc' : 'rgba(255,255,255,0.4)',
                              }}
                            >
                              {item.invitationCode}
                            </Text>
                          </Text>
                        </View>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={20} color={darkTheme.colors.accent} />
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            )}

            {/* TAB 2: INVITATION CODE ENTRY */}
            {zoneModalTab === 'code' && (
              <View style={styles.codeTabContainer}>
                <Text style={styles.codeTabDescription}>
                  Enter the secret invitation code provided by your coordinator or senior ministry leadership.
                </Text>

                <View style={styles.codeInputWrapper}>
                  <Ionicons name="key-outline" size={18} color="#c084fc" style={{ marginRight: 10 }} />
                  <TextInput
                    value={invitationCodeInput}
                    onChangeText={(val) => setInvitationCodeInput(val.toUpperCase())}
                    placeholder="e.g. ZONEPRES, ZONE001"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={styles.codeTextInput}
                    autoCapitalize="characters"
                    autoFocus
                  />
                </View>

                {matchedInvitationZone ? (
                  <View style={styles.matchedZoneCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 16 }}>👑</Text>
                      <Text style={styles.matchedZoneName} numberOfLines={1}>
                        {matchedInvitationZone.name}
                      </Text>
                    </View>
                    <Text style={styles.matchedZoneRegion}>
                      {matchedInvitationZone.region} • {matchedInvitationZone.invitationCode}
                      {isHQGroup(matchedInvitationZone.id) || matchedInvitationZone.region === 'Headquarters'
                        ? ' • Admin Approval Required'
                        : ''}
                    </Text>

                    <TouchableOpacity
                      style={styles.selectCodeBtn}
                      onPress={() => {
                        setZoneCode(matchedInvitationZone.invitationCode || '');
                        setShowZoneModal(false);
                        setInvitationCodeInput('');
                      }}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={[darkTheme.colors.accent, darkTheme.colors.accentBright]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.selectCodeBtnText}>Confirm & Select Zone</Text>
                    </TouchableOpacity>
                  </View>
                ) : invitationCodeInput.trim().length >= 4 ? (
                  <View style={styles.unmatchedZoneCard}>
                    <Ionicons name="alert-circle-outline" size={16} color="#f87171" style={{ marginRight: 6 }} />
                    <Text style={styles.unmatchedZoneText}>Code not recognized. Check with your coordinator.</Text>
                  </View>
                ) : null}
              </View>
            )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* FORGOT PASSWORD MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={showForgotModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { Keyboard.dismiss(); setShowForgotModal(false); setForgotStep('email'); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.forgotBackdrop}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.forgotCard}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>Reset Password</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowForgotModal(false);
                }}
              >
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 16 }}>
              Enter your registered account email and set your new password.
            </Text>

            <Text style={styles.inputLabel}>REGISTERED EMAIL</Text>
            <TextInput
              value={forgotEmail}
              onChangeText={setForgotEmail}
              placeholder="e.g. your-email@loveworld.org"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.forgotInput, { marginBottom: 14 }]}
            />

            <Text style={styles.inputLabel}>NEW PASSWORD</Text>
            <TextInput
              value={forgotNewPassword}
              onChangeText={setForgotNewPassword}
              placeholder="Min. 6 characters"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry
              style={[styles.forgotInput, { marginBottom: 20 }]}
            />

            <TouchableOpacity
              style={[styles.forgotButton, forgotLoading && { opacity: 0.6 }]}
              onPress={handleResetPassword}
              disabled={forgotLoading}
            >
              {forgotLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.forgotButtonText}>Set New Password</Text>
              )}
            </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* KingsChat Multi-Account Chooser Modal */}
      {multipleAccounts && (
        <Modal
          visible={!!multipleAccounts}
          transparent
          animationType="fade"
          onRequestClose={() => setMultipleAccounts(null)}
        >
          <View style={styles.forgotBackdrop}>
            <View style={[styles.forgotCard, { maxHeight: '80%' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="people-outline" size={20} color="#a855f7" />
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Select Account</Text>
                </View>
                <TouchableOpacity onPress={() => setMultipleAccounts(null)} hitSlop={10}>
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ paddingVertical: 4 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 17, marginBottom: 14 }}>
                  Multiple accounts are linked to this KingsChat profile. Choose which account to sign into:
                </Text>

                {multipleAccounts.map((acc, idx) => {
                  const fullName = `${acc.firstName || ''} ${acc.lastName || ''}`.trim() || 'Singer';
                  const roleBadge =
                    acc.role === 'super_admin' || acc.role === 'hq_admin' || acc.hasHqAccess
                      ? 'HQ Admin'
                      : acc.role === 'zone_coordinator'
                      ? 'Zonal Coordinator'
                      : acc.role === 'church_coordinator'
                      ? 'Church Coordinator'
                      : acc.role === 'subgroup_coordinator'
                      ? 'Group Coordinator'
                      : 'Choir Member';

                  return (
                    <TouchableOpacity
                      key={acc.id || idx}
                      disabled={accountSelectLoading}
                      onPress={() => handleSelectAccount(acc.email)}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        borderColor: 'rgba(168, 85, 247, 0.35)',
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{fullName}</Text>
                          <View style={{ backgroundColor: 'rgba(168, 85, 247, 0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: '#c084fc', fontSize: 10, fontWeight: '700' }}>{roleBadge}</Text>
                          </View>
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{acc.email}</Text>
                        {acc.zoneCode ? (
                          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                            Zone: {acc.zoneCode}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#a855f7" />
                    </TouchableOpacity>
                  );
                })}

                {accountSelectLoading && (
                  <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                    <ActivityIndicator color="#a855f7" size="small" />
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function getStyles() {
  return StyleSheet.create({
    mainContainer: {
      flex: 1,
      backgroundColor: darkTheme.colors.backgroundDark,
    },
    ambientGlowPink: {
      position: 'absolute',
      top: -100,
      right: -100,
      width: 350,
      height: 350,
      borderRadius: 175,
      backgroundColor: 'rgba(236, 72, 153, 0.12)',
    },
    ambientGlowPurple: {
      position: 'absolute',
      bottom: -50,
      left: -100,
      width: 400,
      height: 400,
      borderRadius: 200,
      backgroundColor: 'rgba(124, 58, 237, 0.12)',
    },
    scrollContainer: {
      flexGrow: 1,
      paddingHorizontal: 28,
      paddingVertical: 36,
      alignItems: 'center',
    },
    brandHeader: {
      alignItems: 'center',
      marginBottom: 28,
    },
    brandLogo: {
      width: 80,
      height: 80,
      marginBottom: 14,
    },
    brandTitle: {
      color: darkTheme.colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 4,
      textAlign: 'center',
    },
    brandSubtitle: {
      color: darkTheme.colors.accent,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2,
      marginTop: 4,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    kingschatButton: {
      width: '100%',
      height: 52,
      borderRadius: 16,
      backgroundColor: '#007AFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      shadowColor: '#007AFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    kingschatButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '800',
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      marginBottom: 18,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    dividerText: {
      color: 'rgba(255,255,255,0.3)',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.5,
      marginHorizontal: 12,
    },
    tabContainer: {
      flexDirection: 'row',
      width: '100%',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 14,
      padding: 3,
      marginBottom: 20,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 11,
    },
    tabButtonActive: {
      backgroundColor: darkTheme.colors.accent,
    },
    tabText: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 13,
      fontWeight: '700',
    },
    tabTextActive: {
      color: '#fff',
    },
    formContainer: {
      width: '100%',
    },
    rowInputs: {
      flexDirection: 'row',
    },
    inputGroup: {
      marginBottom: 14,
    },
    inputLabel: {
      color: 'rgba(167, 139, 250, 0.8)',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 6,
    },
    inputField: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 14,
      height: 48,
    },
    textInput: {
      flex: 1,
      color: darkTheme.colors.textPrimary,
      fontSize: 14,
    },
    forgotText: {
      color: darkTheme.colors.accentBright,
      fontSize: 11,
      fontWeight: '700',
    },
    zoneButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    zoneIconWrapper: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: 'rgba(147, 51, 234, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    zoneNameText: {
      color: darkTheme.colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    zoneSubText: {
      color: 'rgba(255,255,255,0.4)',
      fontSize: 11,
    },
    zonePlaceholder: {
      color: 'rgba(255,255,255,0.3)',
      fontSize: 13,
    },
    designationGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    designationPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    designationPillActive: {
      backgroundColor: darkTheme.colors.accent,
      borderColor: darkTheme.colors.accent,
    },
    designationText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 11,
      fontWeight: '700',
    },
    designationTextActive: {
      color: '#fff',
    },
    primaryButton: {
      height: 50,
      borderRadius: 16,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: darkTheme.colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '800',
    },
    biometricButton: {
      width: 50,
      height: 50,
      borderRadius: 16,
      backgroundColor: 'rgba(147, 51, 234, 0.15)',
      borderWidth: 1,
      borderColor: 'rgba(147, 51, 234, 0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 36,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '85%',
      backgroundColor: '#161324',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: 'rgba(167, 139, 250, 0.25)',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 10,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.08)',
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    modalTitle: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '800',
    },
    modalSubtitle: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: 11,
      marginTop: 2,
    },
    modalCloseBtn: {
      padding: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 16,
    },
    modalTabContainer: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 3,
    },
    modalTabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 9,
    },
    modalTabBtnActive: {
      backgroundColor: darkTheme.colors.accent,
    },
    modalTabText: {
      color: 'rgba(255, 255, 255, 0.45)',
      fontSize: 12,
      fontWeight: '700',
    },
    modalTabTextActive: {
      color: '#ffffff',
    },
    searchSection: {
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      paddingHorizontal: 12,
      height: 44,
    },
    searchTextInput: {
      flex: 1,
      color: '#ffffff',
      fontSize: 13,
    },
    codeTabContainer: {
      padding: 20,
    },
    codeTabDescription: {
      color: 'rgba(255, 255, 255, 0.55)',
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 16,
    },
    codeInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(147, 51, 234, 0.12)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(147, 51, 234, 0.35)',
      paddingHorizontal: 14,
      height: 50,
      marginBottom: 16,
    },
    codeTextInput: {
      flex: 1,
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    matchedZoneCard: {
      backgroundColor: 'rgba(147, 51, 234, 0.15)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(147, 51, 234, 0.4)',
      padding: 16,
    },
    matchedZoneName: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
      flex: 1,
    },
    matchedZoneRegion: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: 11,
      marginTop: 4,
      marginBottom: 14,
    },
    selectCodeBtn: {
      height: 44,
      borderRadius: 12,
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectCodeBtnText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
    },
    unmatchedZoneCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(248, 113, 113, 0.1)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(248, 113, 113, 0.25)',
      padding: 12,
    },
    unmatchedZoneText: {
      color: '#f87171',
      fontSize: 11,
      fontWeight: '600',
      flex: 1,
    },
    zoneListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
      marginBottom: 6,
    },
    zoneListItemSelected: {
      backgroundColor: 'rgba(147, 51, 234, 0.2)',
      borderColor: 'rgba(147, 51, 234, 0.5)',
    },
    zoneListItemHq: {
      backgroundColor: 'rgba(88, 28, 135, 0.25)',
      borderColor: 'rgba(192, 132, 252, 0.4)',
    },
    zoneListTitle: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
    zoneListTitleSelected: {
      color: '#e9d5ff',
    },
    zoneListSubtitle: {
      color: 'rgba(255, 255, 255, 0.45)',
      fontSize: 11,
      marginTop: 2,
    },
    forgotBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    forgotCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: '#13111c',
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    forgotInput: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: '#fff',
      fontSize: 13,
      marginBottom: 14,
    },
    forgotButton: {
      backgroundColor: darkTheme.colors.accent,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    forgotButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '800',
    },
  });
}
