import { pgTable, text, timestamp, boolean, jsonb, serial, integer } from 'drizzle-orm/pg-core';

export const achievementTemplates = pgTable('achievement_templates', {
  id: text('id').primaryKey(),
  name: text('name'),
  createdAt: text('created_at'),
  description: text('description'),
  migratedAt: text('migrated_at'),
  migratedFromSupabase: boolean('migrated_from_supabase'),
  raw_data: jsonb('raw_data')
});

export const activityLogs = pgTable('activity_logs', {
  id: text('id').primaryKey(),
  type: text('type'),
  action: text('action'),
  zoneId: text('zoneId'),
  message: text('message'),
  section: text('section'),
  itemName: jsonb('itemName'),
  userName: text('userName'),
  zoneName: text('zoneName'),
  createdAt: text('createdAt'),
  timestamp: timestamp('timestamp'),
  raw_data: jsonb('raw_data')
});

export const adminPlaylists = pgTable('admin_playlists', {
  id: text('id').primaryKey(),
  name: text('name'),
  type: jsonb('type'),
  forHQ: boolean('forHQ'),
  isPublic: boolean('isPublic'),
  videoIds: jsonb('videoIds'),
  createdAt: timestamp('createdAt'),
  createdBy: text('createdBy'),
  thumbnail: text('thumbnail'),
  updatedAt: timestamp('updatedAt'),
  isFeatured: boolean('isFeatured'),
  description: text('description'),
  createdByName: text('createdByName'),
  raw_data: jsonb('raw_data')
});

export const analyticsEvents = pgTable('analytics_events', {
  id: text('id').primaryKey(),
  page: text('page'),
  type: text('type'),
  browser: text('browser'),
  metadata: jsonb('metadata'),
  referrer: text('referrer'),
  sessionId: text('sessionId'),
  timestamp: integer('timestamp'),
  userAgent: text('userAgent'),
  deviceType: text('deviceType'),
  raw_data: jsonb('raw_data')
});

export const analyticsMonthly = pgTable('analytics_monthly', {
  id: text('id').primaryKey(),
  year: integer('year'),
  month: integer('month'),
  cities: jsonb('cities'),
  userIds: jsonb('userIds'),
  browsers: jsonb('browsers'),
  countries: jsonb('countries'),
  createdAt: timestamp('createdAt'),
  pageViews: jsonb('pageViews'),
  updatedAt: timestamp('updatedAt'),
  totalEvents: integer('totalEvents'),
  uniqueUsers: integer('uniqueUsers'),
  totalSessions: integer('totalSessions'),
  mobileSessions: integer('mobileSessions'),
  tabletSessions: integer('tabletSessions'),
  totalPageViews: integer('totalPageViews'),
  desktopSessions: integer('desktopSessions'),
  raw_data: jsonb('raw_data')
});

export const analyticsSessions = pgTable('analytics_sessions', {
  id: text('id').primaryKey(),
  city: text('city'),
  pages: jsonb('pages'),
  browser: text('browser'),
  country: text('country'),
  endTime: integer('endTime'),
  duration: integer('duration'),
  pageViews: integer('pageViews'),
  sessionId: text('sessionId'),
  startTime: integer('startTime'),
  deviceType: text('deviceType'),
  raw_data: jsonb('raw_data')
});

export const appSettings = pgTable('app_settings', {
  id: text('id').primaryKey(),
  downloadUrl: text('downloadUrl'),
  releaseNotes: text('releaseNotes'),
  latestVersion: text('latestVersion'),
  minRequiredVersion: text('minRequiredVersion'),
  raw_data: jsonb('raw_data')
});

export const attendance = pgTable('attendance', {
  id: text('id').primaryKey(),
  qrCode: text('qrCode'),
  status: text('status'),
  userIdLegacy: text('userId'),
  zoneId: text('zoneId'),
  userId: text('user_id'),
  userNameLegacy: text('userName'),
  eventNameLegacy: text('eventName'),
  timestamp: timestamp('timestamp'),
  userName: text('user_name'),
  eventName: text('event_name'),
  checkInTime: text('check_in_time'),
  recordedByAdminId: text('recordedByAdminId'),
  raw_data: jsonb('raw_data')
});

export const audiolabPlaylists = pgTable('audiolab_playlists', {
  id: text('id').primaryKey(),
  title: text('title'),
  userId: text('userId'),
  zoneId: jsonb('zoneId'),
  songIds: jsonb('songIds'),
  isPublic: boolean('isPublic'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  description: text('description'),
  raw_data: jsonb('raw_data')
});

export const audiolabProgress = pgTable('audiolab_progress', {
  id: text('id').primaryKey(),
  xp: integer('xp'),
  level: integer('level'),
  userId: text('userId'),
  updatedAt: timestamp('updatedAt'),
  averageScore: integer('averageScore'),
  totalMinutes: integer('totalMinutes'),
  weeklyTarget: integer('weeklyTarget'),
  currentStreak: integer('currentStreak'),
  longestStreak: integer('longestStreak'),
  totalSessions: integer('totalSessions'),
  weeklyProgress: integer('weeklyProgress'),
  averageAccuracy: integer('averageAccuracy'),
  lastPracticeDate: text('lastPracticeDate'),
  raw_data: jsonb('raw_data')
});

export const audiolabProjects = pgTable('audiolab_projects', {
  id: text('id').primaryKey(),
  name: text('name'),
  tempo: integer('tempo'),
  tracks: jsonb('tracks'),
  zoneId: text('zoneId'),
  ownerId: text('ownerId'),
  duration: integer('duration'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  collaborators: jsonb('collaborators'),
  timeSignature: text('timeSignature'),
  referenceSongId: jsonb('referenceSongId'),
  raw_data: jsonb('raw_data')
});

export const audiolabSessions = pgTable('audiolab_sessions', {
  id: text('id').primaryKey(),
  mode: text('mode'),
  score: integer('score'),
  songId: text('songId'),
  streak: integer('streak'),
  userId: text('userId'),
  endedAt: jsonb('endedAt'),
  accuracy: integer('accuracy'),
  duration: integer('duration'),
  startedAt: timestamp('startedAt'),
  raw_data: jsonb('raw_data')
});

export const calendarEvents = pgTable('calendar_events', {
  id: text('id').primaryKey(),
  end: timestamp('end'),
  type: text('type'),
  color: text('color'),
  start: timestamp('start'),
  title: text('title'),
  allDay: boolean('allDay'),
  zoneId: text('zoneId'),
  location: text('location'),
  attendees: jsonb('attendees'),
  createdAt: timestamp('createdAt'),
  createdBy: text('createdBy'),
  reminders: jsonb('reminders'),
  updatedAt: timestamp('updatedAt'),
  description: text('description'),
  isRecurring: boolean('isRecurring'),
  createdByName: text('createdByName'),
  recurringPattern: jsonb('recurringPattern'),
  raw_data: jsonb('raw_data')
});

export const callsV2 = pgTable('calls_v2', {
  id: text('id').primaryKey(),
  type: text('type'),
  chatId: text('chatId'),
  status: text('status'),
  callerId: text('callerId'),
  timestamp: timestamp('timestamp'),
  callerName: text('callerName'),
  receiverId: text('receiverId'),
  isGroupCall: boolean('isGroupCall'),
  callerAvatar: text('callerAvatar'),
  participants: jsonb('participants'),
  receiverName: text('receiverName'),
  receiverAvatar: text('receiverAvatar'),
  raw_data: jsonb('raw_data')
});

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  icon: text('icon'),
  name: text('name'),
  color: text('color'),
  isActive: boolean('isActive'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  description: text('description'),
  raw_data: jsonb('raw_data')
});

export const chatUsers = pgTable('chat_users', {
  id: text('id').primaryKey(),
  email: text('email'),
  zoneId: text('zoneId'),
  fullName: text('fullName'),
  isOnline: boolean('isOnline'),
  lastName: text('lastName'),
  lastSeen: timestamp('lastSeen'),
  zoneName: text('zoneName'),
  firstName: text('firstName'),
  raw_data: jsonb('raw_data')
});

export const chats = pgTable('chats', {
  id: text('id').primaryKey(),
  type: text('type'),
  admins: jsonb('admins'),
  pinned: jsonb('pinned'),
  isActive: boolean('isActive'),
  createdAt: timestamp('createdAt'),
  createdBy: text('createdBy'),
  lastMessage: jsonb('lastMessage'),
  unreadCount: jsonb('unreadCount'),
  participants: jsonb('participants'),
  participantNames: jsonb('participantNames'),
  raw_data: jsonb('raw_data')
});

export const chatsV2 = pgTable('chats_v2', {
  id: text('id').primaryKey(),
  type: text('type'),
  createdAt: timestamp('createdAt'),
  createdBy: text('createdBy'),
  unreadCount: jsonb('unreadCount'),
  participants: jsonb('participants'),
  participantDetails: jsonb('participantDetails'),
  raw_data: jsonb('raw_data')
});

export const cloudinaryMedia = pgTable('cloudinary_media', {
  id: text('id').primaryKey(),
  url: text('url'),
  name: text('name'),
  size: integer('size'),
  type: text('type'),
  width: integer('width'),
  folder: text('folder'),
  format: text('format'),
  height: integer('height'),
  zoneId: text('zoneId'),
  duration: integer('duration'),
  publicId: text('publicId'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  resourceType: text('resourceType'),
  raw_data: jsonb('raw_data')
});

export const countdowns = pgTable('countdowns', {
  id: text('id').primaryKey(),
  createdAt: timestamp('createdAt'),
  targetDate: text('targetDate'),
  praiseNightId: text('praiseNightId'),
  raw_data: jsonb('raw_data')
});

export const fcmTokens = pgTable('fcm_tokens', {
  id: text('id').primaryKey(),
  token: text('token'),
  userId: text('userId'),
  lastUsed: timestamp('lastUsed'),
  platform: text('platform'),
  createdAt: timestamp('createdAt'),
  raw_data: jsonb('raw_data')
});

export const groupMessages = pgTable('group_messages', {
  id: text('id').primaryKey(),
  read: boolean('read'),
  content: text('content'),
  groupId: text('group_id'),
  senderId: text('sender_id'),
  timestamp: text('timestamp'),
  senderName: text('sender_name'),
  raw_data: jsonb('raw_data')
});

export const hqMembers = pgTable('hq_members', {
  id: text('id').primaryKey(),
  role: text('role'),
  status: text('status'),
  userId: text('userId'),
  joinedAt: timestamp('joinedAt'),
  userName: text('userName'),
  hqGroupId: text('hqGroupId'),
  invitedBy: jsonb('invitedBy'),
  userEmail: text('userEmail'),
  raw_data: jsonb('raw_data')
});

export const kingschatAuthSessions = pgTable('kingschat_auth_sessions', {
  id: text('id').primaryKey(),
  otp: text('otp'),
  message: text('message'),
  success: boolean('success'),
  authData: jsonb('authData'),
  verified: boolean('verified'),
  processed: boolean('processed'),
  timestamp: integer('timestamp'),
  raw_data: jsonb('raw_data')
});

export const masterPrograms = pgTable('master_programs', {
  id: text('id').primaryKey(),
  name: text('name'),
  songIds: jsonb('songIds'),
  createdAt: timestamp('createdAt'),
  sortOrder: integer('sortOrder'),
  updatedAt: timestamp('updatedAt'),
  description: text('description'),
  publishedBy: text('publishedBy'),
  publishedByName: text('publishedByName'),
  raw_data: jsonb('raw_data')
});

export const masterSongs = pgTable('master_songs', {
  id: text('id').primaryKey(),
  key: text('key'),
  solfa: text('solfa'),
  tempo: text('tempo'),
  title: text('title'),
  lyrics: text('lyrics'),
  writer: text('writer'),
  drummer: text('drummer'),
  category: text('category'),
  imageUrl: text('imageUrl'),
  audioFile: text('audioFile'),
  audioUrls: jsonb('audioUrls'),
  conductor: text('conductor'),
  updatedAt: timestamp('updatedAt'),
  categories: jsonb('categories'),
  leadSinger: text('leadSinger'),
  sourceType: text('sourceType'),
  customParts: jsonb('customParts'),
  importCount: integer('importCount'),
  publishedAt: timestamp('publishedAt'),
  publishedBy: text('publishedBy'),
  bassGuitarist: text('bassGuitarist'),
  leadKeyboardist: text('leadKeyboardist'),
  publishedByName: text('publishedByName'),
  raw_data: jsonb('raw_data')
});

export const media = pgTable('media', {
  id: text('id').primaryKey(),
  url: text('url'),
  name: text('name'),
  size: integer('size'),
  type: text('type'),
  folder: text('folder'),
  publicid: jsonb('publicid'),
  createdat: text('createdat'),
  updatedat: text('updatedat'),
  uploadedat: text('uploadedat'),
  migratedAt: text('migrated_at'),
  storagepath: text('storagepath'),
  cloudinaryPreset: text('cloudinary_preset'),
  raw_data: jsonb('raw_data')
});

export const mediaCategories = pgTable('media_categories', {
  id: text('id').primaryKey(),
  name: text('name'),
  slug: text('slug'),
  order: integer('order'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  raw_data: jsonb('raw_data')
});

export const mediaComments = pgTable('media_comments', {
  id: text('id').primaryKey(),
  likes: integer('likes'),
  userId: text('userId'),
  content: text('content'),
  likedBy: jsonb('likedBy'),
  mediaId: text('mediaId'),
  dislikes: integer('dislikes'),
  parentId: jsonb('parentId'),
  userName: text('userName'),
  createdAt: timestamp('createdAt'),
  userEmail: text('userEmail'),
  dislikedBy: jsonb('dislikedBy'),
  parentUserName: jsonb('parentUserName'),
  raw_data: jsonb('raw_data')
});

export const mediaDoodles = pgTable('media_doodles', {
  id: text('id').primaryKey(),
  strokes: jsonb('strokes'),
  raw_data: jsonb('raw_data')
});

export const mediaPlaylists = pgTable('media_playlists', {
  id: text('id').primaryKey(),
  name: text('name'),
  userId: text('userId'),
  isPublic: boolean('isPublic'),
  isSystem: boolean('isSystem'),
  videoIds: jsonb('videoIds'),
  createdAt: timestamp('createdAt'),
  thumbnail: jsonb('thumbnail'),
  updatedAt: timestamp('updatedAt'),
  systemType: text('systemType'),
  description: text('description'),
  raw_data: jsonb('raw_data')
});

export const mediaVideos = pgTable('media_videos', {
  id: text('id').primaryKey(),
  type: text('type'),
  forHQ: boolean('forHQ'),
  likes: integer('likes'),
  title: text('title'),
  views: integer('views'),
  hidden: boolean('hidden'),
  featured: boolean('featured'),
  videoUrl: text('videoUrl'),
  createdAt: timestamp('createdAt'),
  createdBy: text('createdBy'),
  isYouTube: boolean('isYouTube'),
  thumbnail: text('thumbnail'),
  updatedAt: timestamp('updatedAt'),
  description: text('description'),
  createdByName: text('createdByName'),
  raw_data: jsonb('raw_data')
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  text: text('text'),
  chatId: text('chatId'),
  edited: boolean('edited'),
  senderId: text('senderId'),
  reactions: jsonb('reactions'),
  timestamp: timestamp('timestamp'),
  senderName: text('senderName'),
  messageType: text('messageType'),
  raw_data: jsonb('raw_data')
});

export const messagesV2 = pgTable('messages_v2', {
  id: text('id').primaryKey(),
  text: text('text'),
  type: text('type'),
  callId: text('callId'),
  chatId: text('chatId'),
  edited: boolean('edited'),
  status: text('status'),
  callType: text('callType'),
  senderId: text('senderId'),
  reactions: jsonb('reactions'),
  timestamp: timestamp('timestamp'),
  senderName: text('senderName'),
  raw_data: jsonb('raw_data')
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  type: text('type'),
  title: text('title'),
  zoneId: text('zoneId'),
  isRead: boolean('is_read'),
  message: text('message'),
  category: text('category'),
  priority: text('priority'),
  senderId: text('sender_id'),
  actionUrl: text('action_url'),
  createdAt: text('created_at'),
  senderName: text('sender_name'),
  targetUserId: text('target_user_id'),
  targetAudience: text('target_audience'),
  raw_data: jsonb('raw_data')
});

export const pageCategories = pgTable('page_categories', {
  id: text('id').primaryKey(),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  description: text('description'),
  raw_data: jsonb('raw_data')
});

export const praiseNightSongs = pgTable('praise_night_songs', {
  id: text('id').primaryKey(),
  key: text('key'),
  tempo: text('tempo'),
  title: text('title'),
  lyrics: text('lyrics'),
  solfas: text('solfas'),
  status: text('status'),
  writer: text('writer'),
  zoneId: text('zoneId'),
  drummer: text('drummer'),
  history: jsonb('history'),
  mediaId: integer('mediaId'),
  category: text('category'),
  comments: jsonb('comments'),
  isActive: boolean('isActive'),
  notation: text('notation'),
  audioFile: text('audioFile'),
  audioUrls: jsonb('audioUrls'),
  conductor: text('conductor'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  categories: jsonb('categories'),
  leadSinger: text('leadSinger'),
  customParts: jsonb('customParts'),
  bassGuitarist: text('bassGuitarist'),
  leadGuitarist: text('leadGuitarist'),
  praiseNightId: text('praiseNightId'),
  availableParts: jsonb('availableParts'),
  rehearsalCount: integer('rehearsalCount'),
  leadKeyboardist: text('leadKeyboardist'),
  raw_data: jsonb('raw_data')
});

export const praiseNights = pgTable('praise_nights', {
  id: text('id').primaryKey(),
  date: text('date'),
  name: text('name'),
  scope: text('scope'),
  songs: jsonb('songs'),
  zoneId: text('zoneId'),
  category: text('category'),
  location: text('location'),
  countdown: jsonb('countdown'),
  createdAt: timestamp('createdAt'),
  updatedAt: text('updatedAt'),
  firebaseId: text('firebaseId'),
  bannerImage: text('bannerImage'),
  pageCategory: text('pageCategory'),
  raw_data: jsonb('raw_data')
});

export const presence = pgTable('presence', {
  id: text('id').primaryKey(),
  status: text('status'),
  lastSeen: text('lastSeen'),
  raw_data: jsonb('raw_data')
});

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  role: text('role'),
  email: text('email'),
  lastName: text('last_name'),
  createdAt: text('created_at'),
  firstName: text('first_name'),
  updatedAt: text('updated_at'),
  kingschatId: text('kingschat_id'),
  hasHqAccess: boolean('has_hq_access'),
  profileCompleted: boolean('profile_completed'),
  raw_data: jsonb('raw_data')
});

export const pushNotifications = pgTable('push_notifications', {
  id: text('id').primaryKey(),
  type: text('type'),
  title: text('title'),
  message: text('message'),
  category: text('category'),
  priority: text('priority'),
  broadcast: boolean('broadcast'),
  timestamp: integer('timestamp'),
  actionUrl: text('action_url'),
  createdAt: text('created_at'),
  expiresAt: text('expires_at'),
  updatedAt: text('updated_at'),
  notificationId: text('notificationId'),
  targetAudience: text('target_audience'),
  raw_data: jsonb('raw_data')
});

export const scheduleCategories = pgTable('schedule_categories', {
  id: text('id').primaryKey(),
  icon: text('icon'),
  color: text('color'),
  label: text('label'),
  order: integer('order'),
  zoneId: jsonb('zoneId'),
  isActive: boolean('isActive'),
  parentId: text('parentId'),
  createdAt: timestamp('createdAt'),
  createdBy: text('createdBy'),
  iconColor: text('iconColor'),
  updatedAt: timestamp('updatedAt'),
  description: text('description'),
  raw_data: jsonb('raw_data')
});

export const schedulePrograms = pgTable('schedule_programs', {
  id: text('id').primaryKey(),
  days: jsonb('days'),
  name: text('name'),
  weeks: jsonb('weeks'),
  zoneId: text('zoneId'),
  swapped: jsonb('swapped'),
  newSongs: jsonb('newSongs'),
  createdAt: text('createdAt'),
  updatedAt: text('updatedAt'),
  isArchived: boolean('isArchived'),
  submitters: jsonb('submitters'),
  carriedOver: jsonb('carriedOver'),
  nameChanges: jsonb('nameChanges'),
  invalidSongs: jsonb('invalidSongs'),
  dailySchedules: jsonb('dailySchedules'),
  raw_data: jsonb('raw_data')
});

export const scheduleSongs = pgTable('schedule_songs', {
  id: text('id').primaryKey(),
  order: integer('order'),
  title: text('title'),
  writer: text('writer'),
  zoneId: jsonb('zoneId'),
  createdAt: timestamp('createdAt'),
  createdBy: text('createdBy'),
  updatedAt: timestamp('updatedAt'),
  categoryId: text('categoryId'),
  leadSinger: text('leadSinger'),
  dateReceived: text('dateReceived'),
  rehearsalCount: integer('rehearsalCount'),
  raw_data: jsonb('raw_data')
});

export const settings = pgTable('settings', {
  id: text('id').primaryKey(),
  radius: integer('radius'),
  latitude: integer('latitude'),
  longitude: integer('longitude'),
  updatedAt: timestamp('updatedAt'),
  raw_data: jsonb('raw_data')
});

export const simplifiedAnalytics = pgTable('simplified_analytics', {
  id: text('id').primaryKey(),
  year: integer('year'),
  month: integer('month'),
  cities: jsonb('cities'),
  browsers: jsonb('browsers'),
  countries: jsonb('countries'),
  createdAt: timestamp('createdAt'),
  pageViews: jsonb('pageViews'),
  updatedAt: timestamp('updatedAt'),
  totalLogins: integer('totalLogins'),
  uniqueUsers: integer('uniqueUsers'),
  totalSignups: integer('totalSignups'),
  songMinistries: jsonb('songMinistries'),
  featureEngagements: jsonb('featureEngagements'),
  totalSongMinistries: integer('totalSongMinistries'),
  totalFeatureEngagements: integer('totalFeatureEngagements'),
  raw_data: jsonb('raw_data')
});

export const songHistory = pgTable('song_history', {
  id: text('id').primaryKey(),
  type: text('type'),
  title: text('title'),
  songId: integer('song_id'),
  newValue: text('new_value'),
  oldValue: text('old_value'),
  createdAt: text('created_at'),
  createdBy: text('created_by'),
  updatedAt: text('updated_at'),
  description: text('description'),
  migratedAt: text('migrated_at'),
  migratedFromSupabase: boolean('migrated_from_supabase'),
  raw_data: jsonb('raw_data')
});

export const songNotifications = pgTable('song_notifications', {
  id: text('id').primaryKey(),
  read: boolean('read'),
  type: text('type'),
  songId: text('songId'),
  zoneId: text('zoneId'),
  message: text('message'),
  zoneName: text('zoneName'),
  createdAt: text('createdAt'),
  songTitle: text('songTitle'),
  timestamp: timestamp('timestamp'),
  submittedBy: text('submittedBy'),
  submittedByEmail: text('submittedByEmail'),
  raw_data: jsonb('raw_data')
});

export const songs = pgTable('songs', {
  id: text('id').primaryKey(),
  key: text('key'),
  tempo: text('tempo'),
  title: text('title'),
  lyrics: text('lyrics'),
  solfas: text('solfas'),
  status: text('status'),
  writer: text('writer'),
  drummer: text('drummer'),
  audioUrl: text('audioUrl'),
  category: text('category'),
  conductor: text('conductor'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  leadSinger: text('leadSinger'),
  leadGuitarist: text('leadGuitarist'),
  rehearsalCount: integer('rehearsalCount'),
  leadKeyboardist: text('leadKeyboardist'),
  raw_data: jsonb('raw_data')
});

export const statusesV2 = pgTable('statuses_v2', {
  id: text('id').primaryKey(),
  type: text('type'),
  likes: jsonb('likes'),
  userId: text('userId'),
  zoneId: text('zoneId'),
  caption: text('caption'),
  viewers: jsonb('viewers'),
  mediaUrl: text('mediaUrl'),
  userName: text('userName'),
  timestamp: timestamp('timestamp'),
  userAvatar: text('userAvatar'),
  raw_data: jsonb('raw_data')
});

export const subgroupPraiseNights = pgTable('subgroup_praise_nights', {
  id: text('id').primaryKey(),
  date: text('date'),
  name: text('name'),
  scope: text('scope'),
  zoneId: text('zoneId'),
  songIds: jsonb('songIds'),
  category: text('category'),
  location: text('location'),
  createdAt: timestamp('createdAt'),
  createdBy: text('createdBy'),
  updatedAt: timestamp('updatedAt'),
  subGroupId: text('subGroupId'),
  description: text('description'),
  subGroupName: text('subGroupName'),
  raw_data: jsonb('raw_data')
});

export const subgroupSongs = pgTable('subgroup_songs', {
  id: text('id').primaryKey(),
  key: text('key'),
  solfa: text('solfa'),
  tempo: text('tempo'),
  title: text('title'),
  lyrics: text('lyrics'),
  status: text('status'),
  writer: text('writer'),
  zoneId: text('zoneId'),
  category: text('category'),
  isActive: boolean('isActive'),
  audioFile: text('audioFile'),
  audioUrls: jsonb('audioUrls'),
  createdAt: timestamp('createdAt'),
  createdBy: text('createdBy'),
  updatedAt: timestamp('updatedAt'),
  importedAt: timestamp('importedAt'),
  leadSinger: text('leadSinger'),
  subGroupId: text('subGroupId'),
  importedFrom: text('importedFrom'),
  originalSongId: text('originalSongId'),
  raw_data: jsonb('raw_data')
});

export const subgroups = pgTable('subgroups', {
  id: text('id').primaryKey(),
  name: text('name'),
  type: text('type'),
  status: text('status'),
  zoneId: text('zoneId'),
  createdAt: text('createdAt'),
  memberIds: jsonb('memberIds'),
  description: text('description'),
  coordinatorId: text('coordinatorId'),
  coordinatorName: text('coordinatorName'),
  coordinatorEmail: text('coordinatorEmail'),
  estimatedMembers: integer('estimatedMembers'),
  raw_data: jsonb('raw_data')
});

export const submittedSongs = pgTable('submitted_songs', {
  id: text('id').primaryKey(),
  key: text('key'),
  notes: text('notes'),
  tempo: text('tempo'),
  title: text('title'),
  lyrics: text('lyrics'),
  solfas: text('solfas'),
  status: text('status'),
  writer: text('writer'),
  zoneId: text('zoneId'),
  drummer: text('drummer'),
  audioUrl: text('audioUrl'),
  category: text('category'),
  zoneName: text('zoneName'),
  conductor: text('conductor'),
  createdAt: text('createdAt'),
  isUpdated: boolean('isUpdated'),
  updatedAt: text('updatedAt'),
  leadSinger: text('leadSinger'),
  reviewedBy: jsonb('reviewedBy'),
  reviewNotes: text('reviewNotes'),
  submittedBy: jsonb('submittedBy'),
  leadGuitarist: text('leadGuitarist'),
  hasNewUserReply: boolean('hasNewUserReply'),
  leadKeyboardist: text('leadKeyboardist'),
  raw_data: jsonb('raw_data')
});

export const supportMessages = pgTable('support_messages', {
  id: text('id').primaryKey(),
  text: text('text'),
  chatId: text('chatId'),
  status: text('status'),
  senderId: text('senderId'),
  timestamp: timestamp('timestamp'),
  senderName: text('senderName'),
  senderType: text('senderType'),
  raw_data: jsonb('raw_data')
});

export const sysMetadata = pgTable('sys_metadata', {
  id: text('id').primaryKey(),
  type: text('type'),
  zoneId: text('zoneId'),
  lastUpdated: timestamp('lastUpdated'),
  raw_data: jsonb('raw_data')
});

export const upcomingEvents = pgTable('upcoming_events', {
  id: text('id').primaryKey(),
  date: text('date'),
  time: text('time'),
  type: text('type'),
  image: text('image'),
  title: text('title'),
  location: text('location'),
  createdAt: text('createdAt'),
  updatedAt: text('updatedAt'),
  showInCarousel: boolean('showInCarousel'),
  raw_data: jsonb('raw_data')
});

export const userFavorites = pgTable('user_favorites', {
  id: text('id').primaryKey(),
  songs: jsonb('songs'),
  raw_data: jsonb('raw_data')
});

export const userGroups = pgTable('user_groups', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  groupName: text('group_name'),
  raw_data: jsonb('raw_data')
});

export const userNotifications = pgTable('user_notifications', {
  id: text('id').primaryKey(),
  read: boolean('read'),
  type: text('type'),
  title: text('title'),
  userId: text('userId'),
  message: text('message'),
  createdAt: text('createdAt'),
  subGroupName: text('subGroupName'),
  raw_data: jsonb('raw_data')
});

export const userPlaylists = pgTable('user_playlists', {
  id: text('id').primaryKey(),
  name: text('name'),
  songs: jsonb('songs'),
  userId: text('userId'),
  createdAt: timestamp('createdAt'),
  raw_data: jsonb('raw_data')
});

export const userSessions = pgTable('user_sessions', {
  id: text('id').primaryKey(),
  osInfo: text('osInfo'),
  userId: text('userId'),
  deviceId: text('deviceId'),
  isActive: boolean('isActive'),
  sessions: jsonb('sessions'),
  loginTime: timestamp('loginTime'),
  sessionId: text('sessionId'),
  deviceInfo: text('deviceInfo'),
  browserInfo: text('browserInfo'),
  deviceModel: text('deviceModel'),
  lastUpdated: jsonb('lastUpdated'),
  lastActivity: timestamp('lastActivity'),
  raw_data: jsonb('raw_data')
});

export const userSongNotes = pgTable('user_song_notes', {
  id: text('id').primaryKey(),
  note: text('note'),
  strokes: jsonb('strokes'),
  updatedAt: timestamp('updatedAt'),
  raw_data: jsonb('raw_data')
});

export const watchHistory = pgTable('watch_history', {
  id: text('id').primaryKey(),
  userId: text('userId'),
  mediaId: text('mediaId'),
  progress: integer('progress'),
  lastWatched: timestamp('lastWatched'),
  raw_data: jsonb('raw_data')
});

export const whatsappUsers = pgTable('whatsapp_users', {
  id: text('id').primaryKey(),
  about: text('about'),
  email: text('email'),
  zoneId: text('zoneId'),
  privacy: jsonb('privacy'),
  fullName: text('fullName'),
  isOnline: boolean('isOnline'),
  lastName: text('lastName'),
  lastSeen: timestamp('lastSeen'),
  zoneName: text('zoneName'),
  firstName: text('firstName'),
  profilePic: text('profilePic'),
  blockedUsers: jsonb('blockedUsers'),
  raw_data: jsonb('raw_data')
});

export const zoneAdminMessages = pgTable('zone_admin_messages', {
  id: text('id').primaryKey(),
  title: text('title'),
  sentAt: text('sentAt'),
  sentBy: text('sentBy'),
  zoneId: text('zoneId'),
  message: text('message'),
  createdAt: timestamp('createdAt'),
  raw_data: jsonb('raw_data')
});

export const zoneCategories = pgTable('zone_categories', {
  id: text('id').primaryKey(),
  icon: text('icon'),
  name: text('name'),
  color: text('color'),
  zoneId: text('zoneId'),
  isActive: boolean('isActive'),
  createdAt: text('createdAt'),
  updatedAt: text('updatedAt'),
  description: text('description'),
  raw_data: jsonb('raw_data')
});

export const zoneCloudinaryMedia = pgTable('zone_cloudinary_media', {
  id: text('id').primaryKey(),
  url: text('url'),
  name: text('name'),
  size: integer('size'),
  type: text('type'),
  width: integer('width'),
  folder: text('folder'),
  format: text('format'),
  height: integer('height'),
  zoneId: text('zoneId'),
  duration: integer('duration'),
  publicId: text('publicId'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  resourceType: text('resourceType'),
  raw_data: jsonb('raw_data')
});

export const zoneMembers = pgTable('zone_members', {
  id: text('id').primaryKey(),
  role: text('role'),
  status: text('status'),
  userId: text('userId'),
  zoneId: text('zoneId'),
  joinedAt: timestamp('joinedAt'),
  userName: text('userName'),
  userEmail: text('userEmail'),
  raw_data: jsonb('raw_data')
});

export const zoneNotifications = pgTable('zone_notifications', {
  id: text('id').primaryKey(),
  read: boolean('read'),
  type: text('type'),
  title: text('title'),
  zoneId: text('zoneId'),
  message: text('message'),
  createdAt: text('createdAt'),
  raw_data: jsonb('raw_data')
});

export const zonePageCategories = pgTable('zone_page_categories', {
  id: text('id').primaryKey(),
  name: text('name'),
  image: text('image'),
  zoneId: text('zoneId'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  description: text('description'),
  raw_data: jsonb('raw_data')
});

export const zonePraiseNights = pgTable('zone_praise_nights', {
  id: text('id').primaryKey(),
  date: text('date'),
  name: text('name'),
  scope: text('scope'),
  songs: jsonb('songs'),
  zoneId: text('zoneId'),
  category: text('category'),
  location: text('location'),
  countdown: jsonb('countdown'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  firebaseId: text('firebaseId'),
  bannerImage: text('bannerImage'),
  raw_data: jsonb('raw_data')
});

export const zoneSongs = pgTable('zone_songs', {
  id: text('id').primaryKey(),
  key: text('key'),
  tempo: text('tempo'),
  title: text('title'),
  lyrics: text('lyrics'),
  solfas: text('solfas'),
  status: text('status'),
  writer: text('writer'),
  zoneId: text('zoneId'),
  drummer: text('drummer'),
  history: jsonb('history'),
  mediaId: integer('mediaId'),
  category: text('category'),
  comments: jsonb('comments'),
  isActive: boolean('isActive'),
  notation: text('notation'),
  audioFile: text('audioFile'),
  audioUrls: jsonb('audioUrls'),
  conductor: text('conductor'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  categories: jsonb('categories'),
  leadSinger: text('leadSinger'),
  customParts: jsonb('customParts'),
  bassGuitarist: text('bassGuitarist'),
  leadGuitarist: text('leadGuitarist'),
  praiseNightId: text('praiseNightId'),
  availableParts: jsonb('availableParts'),
  rehearsalCount: integer('rehearsalCount'),
  leadKeyboardist: text('leadKeyboardist'),
  raw_data: jsonb('raw_data')
});

export const zones = pgTable('zones', {
  id: text('id').primaryKey(),
  name: text('name'),
  slug: text('slug'),
  region: text('region'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  maxMembers: integer('maxMembers'),
  themeColor: text('themeColor'),
  memberCount: integer('memberCount'),
  invitationCode: text('invitationCode'),
  subscriptionTier: text('subscriptionTier'),
  subscriptionStatus: text('subscriptionStatus'),
  raw_data: jsonb('raw_data')
});

export const firestoreExport = pgTable('firestore_export', {
  id: serial('id').primaryKey(),
  collection_path: text('collection_path').notNull(),
  firestore_id: text('firestore_id').notNull(),
  data: jsonb('data').notNull(),
  migrated_at: timestamp('migrated_at').defaultNow()
});
