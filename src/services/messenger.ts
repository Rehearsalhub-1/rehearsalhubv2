import { api } from './api';
import { sendWsMessage } from '../hooks/useWebSocket';

/**
 * ============================================================================
 * Unified Messenger Service (The Single Router for Realtime & Messaging)
 * Screens do not manage sockets or raw HTTP endpoints.
 * They call messenger.* to send messages, load history, and listen for events.
 * ============================================================================
 */

export interface MessagePayload {
  content: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'file';
  replyToId?: string;
  metadata?: Record<string, any>;
}

export const messenger = {
  /**
   * Fetch paginated messages for a chat room
   */
  getMessages: async (chatId: string, limit = 50) => {
    return api.chats.getMessages(chatId, limit);
  },

  /**
   * Send a message to a chat room (routes via API with realtime socket notification)
   */
  sendMessage: async (chatId: string, payload: MessagePayload) => {
    const res = await api.chats.sendMessage(chatId, {
      content: payload.content,
      type: payload.type || 'text',
      replyToId: payload.replyToId,
      metadata: payload.metadata,
    });

    // Realtime hint over WebSocket for instant delivery to connected peers
    try {
      sendWsMessage({
        action: 'chat_message',
        chatId,
        message: res.data,
      });
    } catch {}

    return res;
  },

  /**
   * Broadcast typing status to peers in the room
   */
  sendTyping: (chatId: string, isTyping: boolean) => {
    try {
      sendWsMessage({
        action: 'typing',
        chatId,
        isTyping,
      });
    } catch {}
  },

  /**
   * Mark all messages in a chat room as read
   */
  markRead: async (chatId: string) => {
    return api.chats.markRead(chatId);
  },

  /**
   * Clear messages in a chat room
   */
  clearMessages: async (chatId: string) => {
    return api.chats.clearMessages(chatId);
  },
};

export default messenger;
