import { getZoneByInvitationCode } from '../config/zones';
import { apiClient } from './apiClient';

/**
 * joinZoneChatRoom has been retired.
 * Group chat membership is now 100% explicit admin-controlled (zero automatic joins).
 */
export async function joinZoneChatRoom(_userId: string, _zoneCode: string, _userName: string, _userAvatar: string = '') {
  // Automatic addition is disabled per security & admin policy.
  return;
}
