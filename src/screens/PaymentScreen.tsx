import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { apiClient } from '../lib/apiClient';
import { useUserStore } from '../hooks/useUser';
import { useTheme } from '../context/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');
const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '');

export default function PaymentScreen({ navigation }: any) {
  const { theme } = useTheme();
  const T = theme.colors;
  const s = getStyles(T, theme);

  const currentUser = useUserStore((s) => s.user);
  const isPremium = useUserStore((s) => s.isPremium);
  const subscription = useUserStore((s) => s.subscription);

  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isPremium) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [isPremium]);
  const handlePay = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Please log in to continue.');
      return;
    }

    setLoading(true);
    setPaymentInitiated(true);

    try {
      const data: any = await apiClient.post('/kingspay/initialize', {
        amount: 100,
        userId: currentUser.uid,
        userEmail: currentUser.email || `${currentUser.uid}@lwsrh.org`,
        type: 'individual_subscription',
        duration: 'monthly',
      });

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to initialize payment.');
      }

      const paymentUrl = `https://kingspay-gs.com/payment?id=${data.payment_id}`;
      const result = await WebBrowser.openBrowserAsync(paymentUrl);
      if (!isPremium) {
        Alert.alert(
          'Checking Status',
          'We are verifying your transaction. If it has gone through, your account will upgrade automatically in a few moments.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Payment Error:', error);
      Alert.alert(
        'Payment Failed',
        error.message || 'Could not connect to payment gateway. Please try again.'
      );
      setPaymentInitiated(false);
    } finally {
      setLoading(false);
    }
  };
  const handleCancelSub = () => {
    if (!currentUser) return;
    Alert.alert(
      'Cancel Premium',
      'Are you sure you want to cancel your Premium subscription? You will lose access to AudioLab, Multi-track stem playing, and custom song submissions.',
      [
        { text: 'Keep Premium', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await apiClient.patch(`/subscriptions/${currentUser.uid}`, {
                status: 'inactive',
              });
              Alert.alert('Subscription Cancelled', 'Your premium status has been revoked.');
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to cancel subscription.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const renderPremiumActive = () => {
    return (
      <View style={s.activeContainer}>
        <Animated.View style={[s.crownWrap, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            style={s.crownGradient}
          >
            <Ionicons name="star" size={54} color="#FFF" />
          </LinearGradient>
        </Animated.View>

        <Text style={s.activeTitle}>You are a Premium Member!</Text>
        <Text style={s.activeSubtitle}>
          Thank you for supporting Loveworld Singers Rehearsal Hub Portal. All premium features are unlocked on your account.
        </Text>

        <View style={s.detailsCard}>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Subscription Tier</Text>
            <Text style={s.detailValue}>Premium Individual</Text>
          </View>
          <View style={s.detailDivider} />
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Status</Text>
            <Text style={[s.detailValue, { color: T.success }]}>Active ✓</Text>
          </View>
          {subscription?.expiresAt && (
            <>
              <View style={s.detailDivider} />
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Expires/Renews</Text>
                <Text style={s.detailValue}>
                  {new Date(subscription.expiresAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            </>
          )}
        </View>

        {subscription && (
          <TouchableOpacity
            style={s.cancelBtn}
            onPress={handleCancelSub}
            disabled={cancelling}
            activeOpacity={0.8}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={T.danger} />
            ) : (
              <Text style={s.cancelBtnTxt}>Cancel Subscription</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={s.homeBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}
        >
          <Text style={s.homeBtnTxt}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSuccessScreen = () => {
    return (
      <View style={s.successContainer}>
        <View style={s.successIconWrap}>
          <Ionicons name="checkmark-circle" size={80} color={T.success} />
        </View>
        <Text style={s.successTitle}>Subscription Successful!</Text>
        <Text style={s.successSubtitle}>
          Your account is now premium! Explore all unlocked features immediately.
        </Text>

        <TouchableOpacity
          style={s.successHomeBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}
        >
          <Text style={s.successHomeBtnTxt}>Get Started</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={T.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {isPremium ? (
            paymentInitiated ? renderSuccessScreen() : renderPremiumActive()
          ) : (
            <View style={s.upgradeWrapper}>
              <Text style={s.upgradeTitle}>Experience LWSRH Premium</Text>
              <Text style={s.upgradeSubtitle}>
                Unlock the ultimate tools built for Loveworld Singers rehearsals, audio practice, and custom song requests.
              </Text>
              <View style={s.featuresContainer}>
                <View style={s.featureItem}>
                  <View style={[s.featureIconBg, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                    <Ionicons name="options" size={20} color={T.accent} />
                  </View>
                  <View style={s.featureTextWrap}>
                    <Text style={s.featureTitle}>Full AudioLab Access</Text>
                    <Text style={s.featureDesc}>Rehearse with multi-track stems, mute/solo instruments, and fine-tune your mix.</Text>
                  </View>
                </View>

                <View style={s.featureItem}>
                  <View style={[s.featureIconBg, { backgroundColor: 'rgba(236,72,153,0.12)' }]}>
                    <Ionicons name="cloud-download" size={20} color="#EC4899" />
                  </View>
                  <View style={s.featureTextWrap}>
                    <Text style={s.featureTitle}>Unlimited Account Access</Text>
                    <Text style={s.featureDesc}>No restrictions on downloading sheets, solfa music sheets, or learning guides.</Text>
                  </View>
                </View>

                <View style={s.featureItem}>
                  <View style={[s.featureIconBg, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                    <Ionicons name="cloud-upload" size={20} color="#3B82F6" />
                  </View>
                  <View style={s.featureTextWrap}>
                    <Text style={s.featureTitle}>Custom Song Submissions</Text>
                    <Text style={s.featureDesc}>Submit new song proposals and lyrics directly to zonal and central coordinators.</Text>
                  </View>
                </View>

                <View style={s.featureItem}>
                  <View style={[s.featureIconBg, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                    <Ionicons name="bar-chart" size={20} color="#10B981" />
                  </View>
                  <View style={s.featureTextWrap}>
                    <Text style={s.featureTitle}>Advanced Insights & Stems</Text>
                    <Text style={s.featureDesc}>Gain access to performance metrics, learning resources, and coordinator feedback.</Text>
                  </View>
                </View>
              </View>
              <View style={s.pricingCard}>
                <LinearGradient
                  colors={['rgba(168,85,247,0.15)', 'rgba(109,40,217,0.05)']}
                  style={s.pricingGradient}
                >
                  <Text style={s.planName}>Premium Individual</Text>
                  <View style={s.priceRow}>
                    <Text style={s.priceValue}>1 Espee</Text>
                    <Text style={s.pricePeriod}>/ month</Text>
                  </View>
                  <Text style={s.planHint}>Billed monthly via KingsPay. Cancel anytime.</Text>
                </LinearGradient>
              </View>
              <TouchableOpacity
                style={[s.payBtn, loading && { opacity: 0.8 }]}
                onPress={handlePay}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="wallet-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={s.payBtnTxt}>Pay with KingsPay</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <Text style={s.secureNote}>
                Transactions are processed securely via KingsPay.
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (T: any, theme: any) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.divider,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.cardBackgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: T.textPrimary,
  },
  content: {
    padding: 24,
    alignItems: 'center',
    flex: 1,
  },
  activeContainer: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 30,
  },
  crownWrap: {
    marginBottom: 24,
  },
  crownGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  activeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: T.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  activeSubtitle: {
    fontSize: 15,
    color: T.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 30,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: T.cardBackground,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: T.surfaceBorder,
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: T.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 15,
    color: T.textPrimary,
    fontWeight: '700',
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.divider,
    marginVertical: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.danger + '33',
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  cancelBtnTxt: {
    color: T.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  homeBtn: {
    backgroundColor: T.cardBackgroundLight,
    paddingVertical: 14,
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
  },
  homeBtnTxt: {
    color: T.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 40,
  },
  successIconWrap: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: T.textPrimary,
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 15,
    color: T.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  successHomeBtn: {
    backgroundColor: T.accent,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  successHomeBtnTxt: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  upgradeWrapper: {
    width: '100%',
  },
  upgradeTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: T.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  upgradeSubtitle: {
    fontSize: 14,
    color: T.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  featuresContainer: {
    gap: 20,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: T.textPrimary,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    color: T.textSecondary,
    lineHeight: 18,
  },
  pricingCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.accent + '33',
    marginBottom: 24,
  },
  pricingGradient: {
    padding: 24,
    alignItems: 'center',
  },
  planName: {
    fontSize: 14,
    fontWeight: '600',
    color: T.accentBright,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 36,
    fontWeight: '800',
    color: T.textPrimary,
  },
  pricePeriod: {
    fontSize: 16,
    color: T.textSecondary,
    fontWeight: '500',
    marginLeft: 4,
  },
  planHint: {
    fontSize: 13,
    color: T.textMuted,
  },
  payBtn: {
    backgroundColor: T.accent,
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  payBtnTxt: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secureNote: {
    fontSize: 12,
    color: T.textMuted,
    textAlign: 'center',
  },
});
