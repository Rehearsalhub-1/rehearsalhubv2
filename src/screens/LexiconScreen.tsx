import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  UIManager,
  ActivityIndicator,
  Keyboard,
  Animated,
  ScrollView,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useUserStore } from '../hooks/useUser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../lib/apiClient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const QUICK_CHIPS = [
  { label: 'Lexicon', message: 'Show me the complete Kingdom Lexicon — list all the words with their meanings, scriptures, and quotes.' },
  { label: 'Compose', message: 'Help me compose a worship song using Kingdom Lexicon words like Zoe, Rhema, and Agape. Make it singable with a verse and chorus structure.' },
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Welcome to the **Kingdom Lexicon**!\n\nI am a musical assistant trained exclusively on Pastor Chris Oyakhilome's teachings to help you understand the deep truths of our worship.\n\nAsk me to explain any Kingdom word — such as Zoe, Rhema, Agape, or Epignosis — and I will provide definitions, scriptures, and quotes to inspire your music.\n\nTap a shortcut below or type your question!`,
  timestamp: Date.now(),
};

export default function LexiconScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const s = styles;
  const user = useUserStore(s => s.user);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.85)).current;

  const flatListRef = useRef<FlatList>(null);
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const dotAnim3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isSidebarOpen ? 0 : -SCREEN_WIDTH * 0.85,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isSidebarOpen]);
  useEffect(() => {
    const loadSessions = async () => {
      if (!user) return;
      try {
        const history = await AsyncStorage.getItem(`lexicon_sessions_${user.uid}`);
        if (history) {
          const parsed: ChatSession[] = JSON.parse(history);
          if (parsed && parsed.length > 0) {
            setSessions(parsed);
            const mostRecent = parsed.reduce((prev, current) => (prev.updatedAt > current.updatedAt) ? prev : current);
            setActiveSessionId(mostRecent.id);
            setMessages(mostRecent.messages);
            setTimeout(() => {
               flatListRef.current?.scrollToEnd({ animated: false });
            }, 500);
          }
        }
      } catch (e) {
        console.error('Failed to load lexicon sessions', e);
      }
    };
    loadSessions();
  }, []);
  useEffect(() => {
    if (!user) return;
    if (sessions.length === 0) return;
    
    AsyncStorage.setItem(`lexicon_sessions_${user.uid}`, JSON.stringify(sessions))
      .catch(e => console.error('Failed to save lexicon sessions', e));
  }, [sessions]);
  useEffect(() => {
    if (!isTyping) return;

    const createDotAnimation = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );

    const a1 = createDotAnimation(dotAnim1, 0);
    const a2 = createDotAnimation(dotAnim2, 200);
    const a3 = createDotAnimation(dotAnim3, 400);

    a1.start();
    a2.start();
    a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [isTyping]);
  useEffect(() => {
    if (!activeSessionId || messages.length <= 1) return;
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages, updatedAt: Date.now() };
      }
      return s;
    }));
  }, [messages, activeSessionId]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      currentSessionId = `session-${Date.now()}`;
      setActiveSessionId(currentSessionId);
      const title = text.trim().split(' ').slice(0, 4).join(' ') + '...';
      const newSession: ChatSession = {
        id: currentSessionId,
        title,
        messages: [WELCOME_MESSAGE],
        updatedAt: Date.now(),
      };
      setSessions(prev => [newSession, ...prev]);
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);
    Keyboard.dismiss();
    scrollToEnd();

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const apiMessages = [
        ...history,
        { role: 'user', content: text.trim() }
      ];

      const response = (await apiClient.post('/lexicon/chat', { messages: apiMessages })) as any;

      if (!response.success || !response.reply) {
        throw new Error(response.error || 'Failed to get AI response');
      }

      const reply = response.reply;

      if (!reply) {
        throw new Error('No reply from AI service.');
      }

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('Lexicon AI error:', error);

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ${error.message || 'Something went wrong. Please try again.'}`,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      scrollToEnd();
    }
  }, [messages, isTyping, scrollToEnd, activeSessionId]);

  const handleChipPress = useCallback((chipMessage: string) => {
    sendMessage(chipMessage);
  }, [sendMessage]);

  const handleSend = useCallback(() => {
    sendMessage(inputText);
  }, [inputText, sendMessage]);
  const formatContent = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={i} style={{ fontWeight: '800', color: theme.colors.textPrimary }}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return <Text key={i}>{part}</Text>;
    });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {

    const isUser = item.role === 'user';

    return (
      <View style={[styles.messageBubbleRow, isUser && styles.messageBubbleRowUser]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={16} color={theme.colors.accent} />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
        ]}>
          <Text style={[
            styles.messageText,
            isUser && styles.userMessageText,
          ]}>
            {formatContent(item.content)}
          </Text>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {

    if (!isTyping) return null;

    return (
      <View style={[styles.messageBubbleRow]}>
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={16} color={theme.colors.accent} />
        </View>
        <View style={[styles.messageBubble, styles.aiBubble, styles.typingBubble]}>
          {[dotAnim1, dotAnim2, dotAnim3].map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.typingDot,
                { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Image
        source={require('../../assets/video/cloud3_min.webp')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['rgba(0, 8, 20, 0.7)', 'rgba(0, 8, 20, 0.95)']}
          style={StyleSheet.absoluteFill}
        />
      </BlurView>
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.sidebarSafeArea} edges={['top', 'bottom']}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Chat History</Text>
            <TouchableOpacity onPress={() => setIsSidebarOpen(false)} style={styles.sidebarCloseBtn}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.newChatBtn}
            onPress={() => {
              setActiveSessionId(null);
              setMessages([WELCOME_MESSAGE]);
              setIsSidebarOpen(false);
            }}
          >
            <Ionicons name="add" size={20} color={theme.colors.textPrimary} />
            <Text style={styles.newChatText}>New Chat</Text>
          </TouchableOpacity>

          <ScrollView style={styles.sessionList}>
            {sessions.map(session => (
              <View key={session.id} style={styles.sessionRow}>
                <TouchableOpacity 
                  style={[styles.sessionItem, activeSessionId === session.id && styles.activeSessionItem]}
                  onPress={() => {
                    setActiveSessionId(session.id);
                    setMessages(session.messages);
                    setIsSidebarOpen(false);
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={18} color={activeSessionId === session.id ? theme.colors.textPrimary : '#888'} />
                  <Text style={[styles.sessionText, activeSessionId === session.id && styles.activeSessionText]} numberOfLines={1}>
                    {session.title}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteSessionBtn}
                  onPress={() => {
                    const newSessions = sessions.filter(s => s.id !== session.id);
                    setSessions(newSessions);
                    if (activeSessionId === session.id) {
                      setActiveSessionId(null);
                      setMessages([WELCOME_MESSAGE]);
                    }
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <BlurView intensity={30} tint="light" style={styles.backButtonBlur}>
                <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
              </BlurView>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Kingdom Lexicon</Text>
              <View style={styles.headerBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.headerBadgeText}>Online</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={styles.backButton}>
              <BlurView intensity={30} tint="light" style={styles.backButtonBlur}>
                <Ionicons name="menu" size={24} color={theme.colors.textPrimary} />
              </BlurView>
            </TouchableOpacity>
          </View>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.chatContent}
            style={styles.flatList}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={renderTypingIndicator}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
          />
          <View style={styles.chipsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              {QUICK_CHIPS.map((chip, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.chip}
                  activeOpacity={0.7}
                  onPress={() => handleChipPress(chip.message)}
                  disabled={isTyping}
                >
                  <BlurView intensity={20} tint="light" style={styles.chipBlur}>
                    <Text style={styles.chipText}>{chip.label}</Text>
                  </BlurView>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={styles.inputBarOuter}>
            <BlurView intensity={40} tint="dark" style={styles.inputBarBlur}>
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ask about any word..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={inputText}
                  onChangeText={setInputText}
                  selectionColor={theme.colors.accent}
                  multiline
                  maxLength={2000}
                  editable={!isTyping}
                  onSubmitEditing={handleSend}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!inputText.trim() || isTyping) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || isTyping}
                  activeOpacity={0.7}
                >
                  {isTyping ? (
                    <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                  ) : (
                    <Ionicons name="send" size={18} color={theme.colors.textPrimary} />
                  )}
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.background,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
  },
  backButtonBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  headerBadgeText: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: T.backgroundDark,
    borderRightWidth: 1,
    borderRightColor: theme.colors.cardBackgroundLight,
    zIndex: 100,
    shadowColor: theme.colors.background,
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 15,
  },
  sidebarSafeArea: {
    flex: 1,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder,
  },
  sidebarTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  sidebarCloseBtn: {
    padding: 5,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    padding: 15,
    margin: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  newChatText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  sessionList: {
    flex: 1,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  sessionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
  },
  activeSessionItem: {
    backgroundColor: theme.colors.cardBackgroundLight,
  },
  sessionText: {
    color: '#888',
    fontSize: 15,
    flex: 1,
  },
  activeSessionText: {
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  deleteSessionBtn: {
    padding: 10,
  },
  chipsContainer: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bottomTabBorder,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.bottomTabBorder,
  },
  chipBlur: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  messageBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    maxWidth: '88%',
  },
  messageBubbleRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  messageBubble: {
    borderRadius: 18,
    padding: 14,
    maxWidth: SCREEN_WIDTH * 0.72,
  },
  aiBubble: {
    backgroundColor: theme.colors.cardBackgroundLight,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: 'rgba(139, 92, 246, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.45)',
    borderBottomRightRadius: 4,
  },
  messageText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14.5,
    lineHeight: 22,
    fontWeight: '400',
  },
  userMessageText: {
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(139, 92, 246, 0.6)',
  },
  inputBarOuter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  inputBarBlur: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  textInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    backgroundColor: theme.colors.cardBackgroundLight,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    shadowOpacity: 0,
    elevation: 0,
  },
  flatList: {
    flex: 1,
  },
});
};
