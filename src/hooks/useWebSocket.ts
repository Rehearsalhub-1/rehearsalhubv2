import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useUserStore } from './useUser';
import { apiClient } from '../lib/apiClient';

function getWsUrl(): string {
  const base = (apiClient.getBaseUrl() || process.env.EXPO_PUBLIC_BACKEND_URL || '')
    .replace(/\/api\/?$/, '')
    .replace(/\/+$/, '');

  if (!base) return '';

  if (base.startsWith('https://')) {
    return base.replace('https://', 'wss://');
  } else if (base.startsWith('http://')) {
    return base.replace('http://', 'ws://');
  }
  return `ws://${base}`;
}

type EventHandler = (data: unknown) => void;

interface Subscription {
  resource: string;
  id: string;
  handler: EventHandler;
}

let socket: WebSocket | null = null;
let subscriptions: Subscription[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let reconnectDelay = 1000;
let isConnecting = false;
const eventCursors = new Map<string, number>();

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function clearPingInterval() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    const storeToken = (useUserStore.getState() as any)?.user?.token || (useUserStore.getState() as any)?.token;
    if (storeToken) return storeToken;
    const secureToken = await SecureStore.getItemAsync('jwt');
    if (secureToken) return secureToken;
    const fallbackToken = await SecureStore.getItemAsync('auth_token');
    return fallbackToken || null;
  } catch {
    return null;
  }
}

// Map aliases so mobile screens subscribing to 'chats' receive 'messages', 'chat', etc.
const RESOURCE_ALIASES: Record<string, string[]> = {
  chat: ['chats', 'messages', 'chat_deleted', 'chat_cleared', 'message_reaction', 'message_receipt'],
  chats: ['chat', 'messages', 'chat_deleted', 'chat_cleared', 'message_reaction', 'message_receipt'],
  messages: ['chat', 'chats', 'message_reaction', 'message_receipt'],
  call: ['calls', 'incoming_call', 'call_status', 'call_signal'],
  calls: ['call'],
  song: ['songs'],
  songs: ['song'],
};

function matchesResource(subscribedResource: string, incomingResource: string): boolean {
  if (subscribedResource === incomingResource) return true;
  const aliases = RESOURCE_ALIASES[subscribedResource];
  return !!aliases && aliases.includes(incomingResource);
}

export async function connect() {
  if (isConnecting || socket?.readyState === WebSocket.OPEN) return;
  isConnecting = true;

  const token = await getAuthToken();
  if (!token) {
    isConnecting = false;
    return;
  }

  const wsUrl = getWsUrl();
  if (!wsUrl) {
    isConnecting = false;
    return;
  }
  try {
    const ws = new WebSocket(`${wsUrl}/ws?token=${encodeURIComponent(token)}`);
    socket = ws;

    ws.onopen = () => {
      if (socket !== ws) return;
      reconnectDelay = 1000;
      isConnecting = false;

      // Start ping heartbeat
      clearPingInterval();
      pingInterval = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);

      // Re-subscribe all active subscriptions with server
      const subscribedKeys = new Set<string>();
      subscriptions.forEach(({ resource, id }) => {
        const key = `${resource}:${id}`;
        if (!subscribedKeys.has(key) && socket?.readyState === WebSocket.OPEN) {
          subscribedKeys.add(key);
          socket.send(JSON.stringify({ type: 'subscribe', resource, id, since: eventCursors.get(`${resource}:${id}`) || 0 }));
        }

        // Also subscribe to singular/plural aliases if defined
        const aliases = RESOURCE_ALIASES[resource] || [];
        aliases.forEach(alias => {
          const aliasKey = `${alias}:${id}`;
          if (!subscribedKeys.has(aliasKey) && socket?.readyState === WebSocket.OPEN) {
            subscribedKeys.add(aliasKey);
            socket.send(JSON.stringify({ type: 'subscribe', resource: alias, id, since: eventCursors.get(`${alias}:${id}`) || 0 }));
          }
        });
      });
    };

    ws.onmessage = (e) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (msg.type === 'pong') return;
      if (msg.type !== 'event') return;
      if (Number.isFinite(msg.sequence)) eventCursors.set(`${msg.resource}:${msg.id}`, Number(msg.sequence));

      subscriptions.forEach(({ resource, id, handler }) => {
        const resourceMatch = matchesResource(resource, msg.resource);
        const idMatch = id === msg.id || id === 'all' || msg.id === 'all';
        if (resourceMatch && idMatch) {
          handler(msg.data);
        }
      });
    };

    ws.onclose = () => {
      if (socket === ws) {
        socket = null;
        isConnecting = false;
        clearPingInterval();
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      if (socket === ws) {
        isConnecting = false;
      }
    };
  } catch (err) {
    isConnecting = false;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connect();
  }, reconnectDelay);
}

export function subscribe(resource: string, id: string, handler: EventHandler): () => void {
  const alreadyExists = subscriptions.some(
    s => s.resource === resource && s.id === id && s.handler === handler
  );
  if (!alreadyExists) {
    subscriptions.push({ resource, id, handler });
  }

  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'subscribe', resource, id, since: eventCursors.get(`${resource}:${id}`) || 0 }));
    const aliases = RESOURCE_ALIASES[resource] || [];
    aliases.forEach(alias => {
      socket?.send(JSON.stringify({ type: 'subscribe', resource: alias, id, since: eventCursors.get(`${alias}:${id}`) || 0 }));
    });
  } else {
    connect();
  }

  return () => {
    subscriptions = subscriptions.filter(
      s => !(s.resource === resource && s.id === id && s.handler === handler)
    );
    const stillNeeded = subscriptions.some(s => s.resource === resource && s.id === id);
    if (!stillNeeded && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'unsubscribe', resource, id }));
      const aliases = RESOURCE_ALIASES[resource] || [];
      aliases.forEach(alias => {
        socket?.send(JSON.stringify({ type: 'unsubscribe', resource: alias, id }));
      });
    }
  };
}

export function sendWsMessage(msg: Record<string, any>): boolean {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
    return true;
  }
  connect();
  return false;
}

export function sendCallSignal(targetUserId: string, signal: Record<string, any>): boolean {
  return sendWsMessage({
    type: 'call:signal',
    targetUserId,
    signal,
  });
}

export function disconnect() {
  clearReconnectTimer();
  clearPingInterval();
  subscriptions = [];
  socket?.close();
  socket = null;
  reconnectDelay = 1000;
}

export function useWebSocket(
  resource: string,
  id: string,
  handler: EventHandler,
  enabled = true
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const stableHandler = useCallback((data: unknown) => {
    handlerRef.current(data);
  }, []);

  useEffect(() => {
    if (!enabled || !resource || !id) return;
    const unsub = subscribe(resource, id, stableHandler);
    return unsub;
  }, [resource, id, enabled, stableHandler]);
}

// Auto-reconnect when app returns to foreground
if (typeof AppState !== 'undefined') {
  AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        connect();
      }
    }
  });
}
