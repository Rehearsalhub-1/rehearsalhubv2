import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from './ChatTypes';

interface ChatInputDeckProps {
  inputText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isRecording: boolean;
  liveBars: number[];
  recDuration: number;
  startRecording: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
  pickDocument: () => void;
  openAttachMenu: () => void;
  pickImage: (fromCamera: boolean) => void | Promise<void>;
  isUploading: boolean;
  replyingTo: ChatMessage | null;
  editingMsg: ChatMessage | null;
  onCancelReplyOrEdit: () => void;
  mentionQuery: string | null;
  mentionSuggestions: any[];
  onInsertMention: (user: any) => void;
  isDirectRequest: boolean;
  hasAccepted: boolean;
  roomTitle: string;
  onAcceptRequest: () => void;
  onDeclineRequest: () => void;
  onBlockUser: () => void;
  theme: any;
  APP_THEME: any;
  styles: any;
}

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${s % 60 < 10 ? '0' : ''}${s % 60}`;

export const ChatInputDeck: React.FC<ChatInputDeckProps> = ({
  inputText,
  onChangeText,
  onSend,
  isRecording,
  liveBars,
  recDuration,
  startRecording,
  stopRecording,
  cancelRecording,
  pickDocument,
  openAttachMenu,
  pickImage,
  isUploading,
  replyingTo,
  editingMsg,
  onCancelReplyOrEdit,
  mentionQuery,
  mentionSuggestions,
  onInsertMention,
  isDirectRequest,
  hasAccepted,
  roomTitle,
  onAcceptRequest,
  onDeclineRequest,
  onBlockUser,
  theme,
  APP_THEME,
  styles,
}) => {
  return (
    <>
      {(replyingTo || editingMsg) && (
        <View
          style={[
            styles.contextBar,
            { backgroundColor: APP_THEME.cardBg, borderLeftColor: APP_THEME.primaryAccent },
          ]}
        >
          <Ionicons
            name={editingMsg ? 'pencil' : 'arrow-undo'}
            size={18}
            color={APP_THEME.primaryAccent}
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.contextName, { color: APP_THEME.primaryAccent }]}>
              {editingMsg ? 'Editing' : replyingTo?.sender}
            </Text>
            <Text
              style={[styles.contextText, { color: APP_THEME.secondaryText }]}
              numberOfLines={1}
            >
              {editingMsg
                ? editingMsg.text
                : replyingTo?.isVoiceNote
                ? '🎤 Voice note'
                : replyingTo?.imageUrl
                ? '📷 Photo'
                : replyingTo?.text}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReplyOrEdit} style={{ padding: 6 }}>
            <Ionicons name="close-circle" size={20} color={APP_THEME.secondaryText} />
          </TouchableOpacity>
        </View>
      )}

      {mentionQuery !== null && mentionSuggestions.length > 0 && (
        <View
          style={{
            backgroundColor: APP_THEME.cardBg,
            borderRadius: 8,
            marginHorizontal: 16,
            marginBottom: 8,
            elevation: 4,
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 4,
            maxHeight: 150,
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {mentionSuggestions.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={{
                  padding: 12,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: APP_THEME.inputBg,
                }}
                onPress={() => onInsertMention(user)}
              >
                <Text style={{ color: APP_THEME.primaryText, fontWeight: '500' }}>
                  {user.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {isDirectRequest && !hasAccepted && (
        <View
          style={{
            backgroundColor: theme.colors.cardBackgroundLight,
            padding: 16,
            marginHorizontal: 10,
            marginBottom: 8,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: APP_THEME.border,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: APP_THEME.primaryText,
              fontSize: 14,
              fontWeight: '700',
              marginBottom: 4,
            }}
          >
            {roomTitle} sent you a message request
          </Text>
          <Text
            style={{
              color: APP_THEME.secondaryText,
              fontSize: 12,
              marginBottom: 14,
              textAlign: 'center',
            }}
          >
            You can preview this message safely. They will not know you have seen it until you accept.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: APP_THEME.primaryAccent,
                paddingVertical: 10,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={onAcceptRequest}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.08)',
                paddingVertical: 10,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={onDeclineRequest}
            >
              <Text style={{ color: APP_THEME.primaryText, fontWeight: '600', fontSize: 14 }}>
                Decline
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(239,68,68,0.15)',
                paddingVertical: 10,
                borderRadius: 8,
                alignItems: 'center',
              }}
              onPress={onBlockUser}
            >
              <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 14 }}>Block</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.inputDeck, { backgroundColor: 'transparent' }]}>
        <TouchableOpacity
          style={styles.plusBtn}
          onPress={pickDocument}
          onLongPress={openAttachMenu}
          activeOpacity={0.75}
        >
          <Ionicons name="document-text-outline" size={24} color={APP_THEME.secondaryText} />
        </TouchableOpacity>

        <View style={[styles.inputBox, { backgroundColor: APP_THEME.inputBg }]}>
          {isRecording ? (
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#ef4444',
                }}
              />
              <View style={styles.liveWaveContainer}>
                {liveBars.map((amp, i) => {
                  const barH = amp < 0.02 ? 2 : Math.max(3, amp * 26);
                  return (
                    <View
                      key={i}
                      style={[
                        styles.liveWaveBar,
                        {
                          height: barH,
                          opacity: 0.4 + 0.6 * (i / liveBars.length),
                        },
                      ]}
                    />
                  );
                })}
              </View>
              <Text
                style={{
                  color: '#ef4444',
                  fontWeight: '700',
                  fontSize: 13,
                  minWidth: 36,
                }}
              >
                {fmtDur(recDuration)}
              </Text>
              <TouchableOpacity onPress={cancelRecording} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={20} color={APP_THEME.secondaryText} />
              </TouchableOpacity>
            </View>
          ) : (
            <TextInput
              style={[styles.inputField, { color: APP_THEME.primaryText }]}
              placeholder="Message"
              placeholderTextColor={APP_THEME.secondaryText}
              value={inputText}
              onChangeText={onChangeText}
              multiline
            />
          )}
        </View>

        <View style={styles.rightBtns}>
          {!isRecording && !inputText.trim() && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => pickImage(false)}>
              <Ionicons name="camera-outline" size={26} color={APP_THEME.secondaryText} />
            </TouchableOpacity>
          )}
          {inputText.trim() ? (
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: APP_THEME.primaryAccent }]}
              onPress={onSend}
              disabled={isUploading}
            >
              <Ionicons
                name="send"
                size={18}
                color={theme.colors.textPrimary}
                style={{ marginLeft: 2 }}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={isUploading}
            >
              <Ionicons
                name={isRecording ? 'send' : 'mic-outline'}
                size={26}
                color={isRecording ? APP_THEME.primaryAccent : APP_THEME.secondaryText}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
};

export default ChatInputDeck;
