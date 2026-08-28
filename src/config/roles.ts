import { UserProfile } from '../hooks/useUser';

/**
 * Helper to check if an email belongs to an HQ administrator (derived from claims/role)
 */
export function isHQAdminEmail(_email: string | null | undefined): boolean {
  return false;
}

/**
 * Checks if the user has full HQ Administrative privileges
 */
export function isHQAdmin(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;

  if (profile.hasHqAccess === true || (profile as any)?.raw?.hasHqAccess === true) return true;

  const role = (profile.role || (profile as any)?.raw?.role || '').toLowerCase();
  if (['hq_admin', 'super_admin', 'admin', 'boss'].includes(role)) return true;

  const adminField = ((profile as any)?.administration || (profile as any)?.raw?.administration || '').toLowerCase();
  if (['boss', 'hq admin', 'admin'].includes(adminField)) return true;

  return false;
}

/**
 * Checks if the user is authorized to view song and rehearsal archives
 */
export function canAccessArchive(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isHQAdmin(profile)) return true;

  const raw = (profile as any)?.raw || {};
  return !!(
    profile.canAccessArchive ||
    (profile as any)?.canSeeArchive ||
    (profile as any)?.canAccessArchive ||
    raw.canSeeArchive ||
    raw.canAccessArchive ||
    raw.can_access_archive
  );
}

/**
 * Checks if the user is authorized to view pre-rehearsals
 */
export function canAccessPreRehearsal(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isHQAdmin(profile)) return true;
  if (isZoneCoordinator(profile)) return true;

  const raw = (profile as any)?.raw || {};
  return !!(
    profile.canAccessPreRehearsal ||
    raw.can_access_pre_rehearsal ||
    raw.canAccessPreRehearsal
  );
}

/**
 * Checks if the user is a Zone Coordinator or Admin
 */
export function isZoneCoordinator(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (isHQAdmin(profile)) return true;

  const role = (profile.role || (profile as any)?.raw?.role || '').toLowerCase();
  return ['zone_admin', 'coordinator', 'admin', 'hq_admin', 'boss'].includes(role);
}

/**
 * Extracts hiddenFeatures dictionary from profile
 */
export function getHiddenFeatures(profile: UserProfile | null | undefined): Record<string, boolean> {
  if (!profile) return {};
  const raw = (profile as any)?.raw || {};
  return (
    profile.hiddenFeatures ||
    (profile as any)?.hidden_features ||
    raw.hidden_features ||
    raw.hiddenFeatures ||
    {}
  );
}

/**
 * Checks if a specific feature key is hidden for the user
 */
export function isFeatureHidden(profile: UserProfile | null | undefined, featureKey: string): boolean {
  const hidden = getHiddenFeatures(profile);
  return !!hidden[featureKey];
}

/**
 * Checks if the user is permitted to use annotations (pen/doodle on songs).
 * Respects both the explicit canAnnotate flag and the hideAnnotations feature metric.
 */
export function canUseAnnotations(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  // Feature metric toggle: if hideAnnotations is set, deny access
  const hf = getHiddenFeatures(profile);
  if (hf.hideAnnotations) return false;
  // Check explicit permission fields
  const raw = (profile as any)?.raw || {};
  return !!(
    raw.canAnnotate === true ||
    raw.canUseBrush === true ||
    raw.canUseAnnotation === true ||
    (profile as any).canAnnotate === true
  );
}
