import React, { useEffect, useRef } from 'react';
import { Animated, View, Text } from 'react-native';
import { SyncAvatar } from '../SyncAvatar';

interface TypingUser {
  userId: string;
  userName: string;
}

interface TypingBubbleProps {
  typingUsers: TypingUser[];
  isGroup: boolean;
  theme?: any;
  APP_THEME: {
    incomingBubble: string;
    primaryAccent: string;
  };
}

export const TypingBubble = React.memo(({ typingUsers, isGroup, APP_THEME }: TypingBubbleProps) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const isVisible = typingUsers && typingUsers.length > 0;

  useEffect(() => {
    if (!isVisible) return;
    const animateDot = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -5, duration: 250, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 350, useNativeDriver: true }),
        ])
      );
    };
    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 120);
    const a3 = animateDot(dot3, 240);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [isVisible, dot1, dot2, dot3]);

  if (!isVisible) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginLeft: 8, marginVertical: 6, gap: 8 }}>
      {isGroup && (
        <View style={{ marginRight: 2, marginBottom: 2 }}>
          <SyncAvatar userId={typingUsers[0].userId} fallbackName={typingUsers[0].userName} size={28} isGroup={false} />
        </View>
      )}
      <View style={{
        backgroundColor: APP_THEME.incomingBubble,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        maxWidth: 120,
      }}>
        {isGroup && (
          <Text style={{ fontSize: 11, fontWeight: '600', color: APP_THEME.primaryAccent, marginBottom: 4 }}>
            {typingUsers[0].userName}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 8, gap: 4, paddingHorizontal: 2 }}>
          <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: APP_THEME.primaryAccent, transform: [{ translateY: dot1 }] }} />
          <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: APP_THEME.primaryAccent, transform: [{ translateY: dot2 }] }} />
          <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: APP_THEME.primaryAccent, transform: [{ translateY: dot3 }] }} />
        </View>
      </View>
    </View>
  );
});
