import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { apiClient } from '../lib/apiClient';
import { SafeNotifee as notifee } from '../lib/safeNativeModules';

const { width, height } = Dimensions.get('window');

export default function IncomingCallScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  
  const { callId, callerName, callerAvatar, roomId, callType, notificationId } = route.params || {};

  useEffect(() => {
    
    Vibration.vibrate([1000, 1000, 1000, 1000], true);

    const timeout = setTimeout(() => {
      handleDecline();
    }, 60000);

    return () => {
      Vibration.cancel();
      clearTimeout(timeout);
    };
  }, []);

  const handleDecline = async () => {
    Vibration.cancel();
    if (callId) {
      apiClient.patch(`/calls/${callId}`, { status: 'declined' }).catch(console.warn);
    }
    
    if (notificationId) {
      await notifee.cancelNotification(notificationId);
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  };

  const handleAnswer = async () => {
    Vibration.cancel();
    if (notificationId) {
      await notifee.cancelNotification(notificationId);
    }
    navigation.replace('Call', {
      callId,
      callType: callType || 'voice',
      isIncoming: true,
      contactName: callerName || 'Unknown',
      contactAvatar: callerAvatar || '',
      roomId,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.title}>Incoming {callType === 'video' ? 'Video' : 'Voice'} Call</Text>
        
        {callerAvatar ? (
          <Image source={{ uri: callerAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <Ionicons name="person" size={60} color="#fff" />
          </View>
        )}
        
        <Text style={styles.name}>{callerName || 'Unknown Caller'}</Text>
        <Text style={styles.status}>RehearsalHub</Text>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.actionButton, styles.declineButton]} onPress={handleDecline} activeOpacity={0.8}>
            <Ionicons name="close" size={40} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.buttonText}>Decline</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.actionButton, styles.answerButton]} onPress={handleAnswer} activeOpacity={0.8}>
            <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={32} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.buttonText}>Answer</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginBottom: 40,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 24,
  },
  placeholderAvatar: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
    marginBottom: 8,
  },
  status: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  buttonContainer: {
    alignItems: 'center',
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  answerButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
