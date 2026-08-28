import { getZoneByInvitationCode } from '../config/zones';
import { apiClient } from './apiClient';

export async function joinZoneChatRoom(userId: string, zoneCode: string, userName: string, userAvatar: string = '') {
  try {
    const zone = getZoneByInvitationCode(zoneCode);
    if (!zone) {
      console.warn(`[joinZoneChatRoom] No zone found for invitation code: ${zoneCode}`);
      return;
    }

    const chatId = `group_zone_${zone.id}`;
    const chatRes = await apiClient.get<{ success: boolean; data: any }>(`/chats/${chatId}`).catch(() => null);

    if (chatRes?.success && chatRes.data) {
      const chatData = chatRes.data;
      const participants = chatData.participants || [];
      const isNew = !participants.includes(userId);

      if (isNew) {
        await apiClient.patch(`/chats/${chatId}`, {
          member_ids: [...participants, userId],
        }).catch(() => {});

        await apiClient.post(`/chats/${chatId}/messages`, {
          content: `${userName} joined the group`,
          type: 'system',
        }).catch(() => {});
      }
    } else {
      await apiClient.post('/chats', {
        name: zone.name,
        type: 'group',
        zone_id: zone.id,
        member_ids: [userId],
      }).catch(() => {});
    }
  } catch (error) {
    console.error(`[joinZoneChatRoom] Error joining zone chat room:`, error);
  }
}
