const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 60000,
  max: 3
});

// For each collection, run a SQL INSERT...SELECT directly from firestore_export.
// This keeps all data server-side and avoids transferring large blobs over the wire.
const SQL_MIGRATIONS = [
  {
    collection: 'profiles',
    sql: `
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY, role TEXT, email TEXT, last_name TEXT, first_name TEXT,
        created_at TEXT, updated_at TEXT, kingschat_id TEXT,
        has_hq_access BOOLEAN, profile_completed BOOLEAN, raw_data JSONB
      );
      INSERT INTO profiles (id, role, email, last_name, first_name, created_at, updated_at,
        kingschat_id, has_hq_access, profile_completed, raw_data)
      SELECT
        firestore_id,
        data->>'role',
        data->>'email',
        COALESCE(data->>'last_name', data->>'lastName'),
        COALESCE(data->>'first_name', data->>'firstName'),
        data->>'created_at',
        data->>'updated_at',
        COALESCE(data->>'kingschat_id', data->>'kingschatId'),
        (data->>'has_hq_access')::boolean,
        (data->>'profile_completed')::boolean,
        data
      FROM firestore_export WHERE collection_path = 'profiles'
      ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role, email = EXCLUDED.email,
        last_name = EXCLUDED.last_name, first_name = EXCLUDED.first_name,
        raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'master_songs',
    sql: `
      CREATE TABLE IF NOT EXISTS master_songs (
        id TEXT PRIMARY KEY, title TEXT, key TEXT, tempo TEXT, lyrics TEXT,
        writer TEXT, solfa TEXT, category TEXT, image_url TEXT, audio_file TEXT,
        audio_urls JSONB, conductor TEXT, lead_singer TEXT, drummer TEXT,
        bass_guitarist TEXT, lead_keyboardist TEXT, categories JSONB,
        custom_parts JSONB, import_count INTEGER, published_at TIMESTAMPTZ,
        published_by TEXT, published_by_name TEXT, updated_at TIMESTAMPTZ,
        source_type TEXT, is_hq_only BOOLEAN, raw_data JSONB
      );
      INSERT INTO master_songs (id, title, key, tempo, lyrics, writer, solfa, category,
        image_url, audio_file, audio_urls, conductor, lead_singer, drummer,
        bass_guitarist, lead_keyboardist, categories, custom_parts,
        published_by, published_by_name, source_type, raw_data)
      SELECT
        firestore_id,
        data->>'title', data->>'key', data->>'tempo', data->>'lyrics',
        data->>'writer', data->>'solfa', data->>'category',
        data->>'imageUrl', data->>'audioFile',
        data->'audioUrls', data->>'conductor', data->>'leadSinger',
        data->>'drummer', data->>'bassGuitarist', data->>'leadKeyboardist',
        data->'categories', data->'customParts',
        data->>'publishedBy', data->>'publishedByName', data->>'sourceType', data
      FROM firestore_export WHERE collection_path = 'master_songs'
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'song_history',
    sql: `
      CREATE TABLE IF NOT EXISTS song_history (
        id TEXT PRIMARY KEY, type TEXT, title TEXT, song_id TEXT,
        new_value TEXT, old_value TEXT, created_at TEXT, created_by TEXT,
        description TEXT, raw_data JSONB
      );
      INSERT INTO song_history (id, type, title, song_id, new_value, old_value, created_at, created_by, description, raw_data)
      SELECT firestore_id, data->>'type', data->>'title',
        COALESCE(data->>'song_id', data->>'songId'),
        COALESCE(data->>'new_value', data->>'newValue'),
        COALESCE(data->>'old_value', data->>'oldValue'),
        data->>'created_at',
        COALESCE(data->>'created_by', data->>'createdBy'),
        data->>'description', data
      FROM firestore_export WHERE collection_path = 'song_history'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'attendance',
    sql: `
      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY, status TEXT, user_id TEXT, zone_id TEXT,
        user_name TEXT, event_name TEXT, qr_code TEXT, check_in_time TEXT,
        recorded_by_admin_id TEXT, raw_data JSONB
      );
      INSERT INTO attendance (id, status, user_id, zone_id, user_name, event_name, qr_code, check_in_time, recorded_by_admin_id, raw_data)
      SELECT firestore_id, data->>'status',
        COALESCE(data->>'userId', data->>'user_id'),
        data->>'zoneId',
        COALESCE(data->>'userName', data->>'user_name'),
        COALESCE(data->>'eventName', data->>'event_name'),
        data->>'qrCode',
        COALESCE(data->>'check_in_time', data->>'checkInTime'),
        data->>'recordedByAdminId', data
      FROM firestore_export WHERE collection_path = 'attendance'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'zones',
    sql: `
      CREATE TABLE IF NOT EXISTS zones (
        id TEXT PRIMARY KEY, name TEXT, code TEXT, country TEXT, region TEXT,
        is_active BOOLEAN, raw_data JSONB
      );
      INSERT INTO zones (id, name, code, country, region, is_active, raw_data)
      SELECT firestore_id, data->>'name', data->>'code', data->>'country',
        data->>'region', (data->>'isActive')::boolean, data
      FROM firestore_export WHERE collection_path = 'zones'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'zone_members',
    sql: `
      CREATE TABLE IF NOT EXISTS zone_members (
        id TEXT PRIMARY KEY, user_id TEXT, zone_id TEXT, role TEXT,
        status TEXT, raw_data JSONB
      );
      INSERT INTO zone_members (id, user_id, zone_id, role, status, raw_data)
      SELECT firestore_id, data->>'userId', data->>'zoneId',
        data->>'role', data->>'status', data
      FROM firestore_export WHERE collection_path = 'zone_members'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'hq_members',
    sql: `
      CREATE TABLE IF NOT EXISTS hq_members (
        id TEXT PRIMARY KEY, role TEXT, status TEXT, user_id TEXT,
        user_name TEXT, hq_group_id TEXT, user_email TEXT, raw_data JSONB
      );
      INSERT INTO hq_members (id, role, status, user_id, user_name, hq_group_id, user_email, raw_data)
      SELECT firestore_id, data->>'role', data->>'status', data->>'userId',
        data->>'userName', data->>'hqGroupId', data->>'userEmail', data
      FROM firestore_export WHERE collection_path = 'hq_members'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'praise_nights',
    sql: `
      CREATE TABLE IF NOT EXISTS praise_nights (
        id TEXT PRIMARY KEY, name TEXT, date TEXT, scope TEXT, zone_id TEXT,
        category TEXT, location TEXT, banner_image TEXT, songs JSONB, raw_data JSONB
      );
      INSERT INTO praise_nights (id, name, date, scope, zone_id, category, location, banner_image, songs, raw_data)
      SELECT firestore_id, data->>'name', data->>'date', data->>'scope',
        data->>'zoneId', data->>'category', data->>'location',
        data->>'bannerImage', data->'songs', data
      FROM firestore_export WHERE collection_path = 'praise_nights'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'praise_night_songs',
    sql: `
      CREATE TABLE IF NOT EXISTS praise_night_songs (
        id TEXT PRIMARY KEY, title TEXT, key TEXT, tempo TEXT, lyrics TEXT,
        writer TEXT, zone_id TEXT, praise_night_id TEXT, status TEXT,
        audio_file TEXT, conductor TEXT, lead_singer TEXT, drummer TEXT,
        categories JSONB, is_active BOOLEAN, raw_data JSONB
      );
      INSERT INTO praise_night_songs (id, title, key, tempo, lyrics, writer, zone_id,
        praise_night_id, status, audio_file, conductor, lead_singer, drummer, categories, is_active, raw_data)
      SELECT firestore_id, data->>'title', data->>'key', data->>'tempo',
        data->>'lyrics', data->>'writer', data->>'zoneId', data->>'praiseNightId',
        data->>'status', data->>'audioFile', data->>'conductor', data->>'leadSinger',
        data->>'drummer', data->'categories', (data->>'isActive')::boolean, data
      FROM firestore_export WHERE collection_path = 'praise_night_songs'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'zone_songs',
    sql: `
      CREATE TABLE IF NOT EXISTS zone_songs (
        id TEXT PRIMARY KEY, title TEXT, key TEXT, tempo TEXT, zone_id TEXT,
        status TEXT, audio_file TEXT, categories JSONB, raw_data JSONB
      );
      INSERT INTO zone_songs (id, title, key, tempo, zone_id, status, audio_file, categories, raw_data)
      SELECT firestore_id, data->>'title', data->>'key', data->>'tempo',
        data->>'zoneId', data->>'status', data->>'audioFile', data->'categories', data
      FROM firestore_export WHERE collection_path = 'zone_songs'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'subgroups',
    sql: `
      CREATE TABLE IF NOT EXISTS subgroups (
        id TEXT PRIMARY KEY, name TEXT, zone_id TEXT, description TEXT, raw_data JSONB
      );
      INSERT INTO subgroups (id, name, zone_id, description, raw_data)
      SELECT firestore_id, data->>'name', data->>'zoneId', data->>'description', data
      FROM firestore_export WHERE collection_path = 'subgroups'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'subgroup_songs',
    sql: `
      CREATE TABLE IF NOT EXISTS subgroup_songs (
        id TEXT PRIMARY KEY, title TEXT, key TEXT, tempo TEXT, zone_id TEXT, status TEXT, raw_data JSONB
      );
      INSERT INTO subgroup_songs (id, title, key, tempo, zone_id, status, raw_data)
      SELECT firestore_id, data->>'title', data->>'key', data->>'tempo',
        data->>'zoneId', data->>'status', data
      FROM firestore_export WHERE collection_path = 'subgroup_songs'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'subgroup_praise_nights',
    sql: `
      CREATE TABLE IF NOT EXISTS subgroup_praise_nights (
        id TEXT PRIMARY KEY, name TEXT, date TEXT, zone_id TEXT,
        sub_group_id TEXT, sub_group_name TEXT, song_ids JSONB, raw_data JSONB
      );
      INSERT INTO subgroup_praise_nights (id, name, date, zone_id, sub_group_id, sub_group_name, song_ids, raw_data)
      SELECT firestore_id, data->>'name', data->>'date', data->>'zoneId',
        data->>'subGroupId', data->>'subGroupName', data->'songIds', data
      FROM firestore_export WHERE collection_path = 'subgroup_praise_nights'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'schedule_programs',
    sql: `
      CREATE TABLE IF NOT EXISTS schedule_programs (
        id TEXT PRIMARY KEY, name TEXT, zone_id TEXT, days JSONB, weeks JSONB,
        new_songs JSONB, is_archived BOOLEAN, daily_schedules JSONB, raw_data JSONB
      );
      INSERT INTO schedule_programs (id, name, zone_id, days, weeks, new_songs, is_archived, daily_schedules, raw_data)
      SELECT firestore_id, data->>'name', data->>'zoneId', data->'days', data->'weeks',
        data->'newSongs', (data->>'isArchived')::boolean, data->'dailySchedules', data
      FROM firestore_export WHERE collection_path = 'schedule_programs'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'schedule_categories',
    sql: `
      CREATE TABLE IF NOT EXISTS schedule_categories (
        id TEXT PRIMARY KEY, label TEXT, icon TEXT, color TEXT,
        is_active BOOLEAN, parent_id TEXT, raw_data JSONB
      );
      INSERT INTO schedule_categories (id, label, icon, color, is_active, parent_id, raw_data)
      SELECT firestore_id, data->>'label', data->>'icon', data->>'color',
        (data->>'isActive')::boolean, data->>'parentId', data
      FROM firestore_export WHERE collection_path = 'schedule_categories'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'submitted_songs',
    sql: `
      CREATE TABLE IF NOT EXISTS submitted_songs (
        id TEXT PRIMARY KEY, title TEXT, zone_id TEXT, status TEXT,
        submitted_by TEXT, submitted_by_email TEXT, raw_data JSONB
      );
      INSERT INTO submitted_songs (id, title, zone_id, status, submitted_by, submitted_by_email, raw_data)
      SELECT firestore_id, data->>'title', data->>'zoneId', data->>'status',
        data->>'submittedBy', data->>'submittedByEmail', data
      FROM firestore_export WHERE collection_path = 'submitted_songs'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'user_favorites',
    sql: `
      CREATE TABLE IF NOT EXISTS user_favorites (
        id TEXT PRIMARY KEY, user_id TEXT, song_id TEXT, raw_data JSONB
      );
      INSERT INTO user_favorites (id, user_id, song_id, raw_data)
      SELECT firestore_id, data->>'userId', data->>'songId', data
      FROM firestore_export WHERE collection_path = 'user_favorites'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'user_playlists',
    sql: `
      CREATE TABLE IF NOT EXISTS user_playlists (
        id TEXT PRIMARY KEY, title TEXT, user_id TEXT, song_ids JSONB,
        is_public BOOLEAN, raw_data JSONB
      );
      INSERT INTO user_playlists (id, title, user_id, song_ids, is_public, raw_data)
      SELECT firestore_id, data->>'title', data->>'userId', data->'songIds',
        (data->>'isPublic')::boolean, data
      FROM firestore_export WHERE collection_path = 'user_playlists'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'notifications',
    sql: `
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY, type TEXT, title TEXT, message TEXT, zone_id TEXT,
        is_read BOOLEAN, category TEXT, priority TEXT, sender_id TEXT,
        action_url TEXT, created_at TEXT, target_user_id TEXT, target_audience TEXT, raw_data JSONB
      );
      INSERT INTO notifications (id, type, title, message, zone_id, is_read, category, priority,
        sender_id, action_url, created_at, target_user_id, target_audience, raw_data)
      SELECT firestore_id, data->>'type', data->>'title', data->>'message',
        data->>'zoneId', (COALESCE(data->>'is_read', data->>'isRead'))::boolean,
        data->>'category', data->>'priority',
        COALESCE(data->>'sender_id', data->>'senderId'),
        COALESCE(data->>'action_url', data->>'actionUrl'),
        data->>'created_at',
        COALESCE(data->>'target_user_id', data->>'targetUserId'),
        COALESCE(data->>'target_audience', data->>'targetAudience'), data
      FROM firestore_export WHERE collection_path = 'notifications'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'push_notifications',
    sql: `
      CREATE TABLE IF NOT EXISTS push_notifications (
        id TEXT PRIMARY KEY, type TEXT, title TEXT, message TEXT, category TEXT,
        priority TEXT, broadcast BOOLEAN, action_url TEXT, created_at TEXT,
        target_audience TEXT, raw_data JSONB
      );
      INSERT INTO push_notifications (id, type, title, message, category, priority,
        broadcast, action_url, created_at, target_audience, raw_data)
      SELECT firestore_id, data->>'type', data->>'title', data->>'message',
        data->>'category', data->>'priority', (data->>'broadcast')::boolean,
        data->>'action_url', data->>'created_at', data->>'target_audience', data
      FROM firestore_export WHERE collection_path = 'push_notifications'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'chats_v2',
    sql: `
      CREATE TABLE IF NOT EXISTS chats_v2 (
        id TEXT PRIMARY KEY, type TEXT, created_by TEXT,
        participants JSONB, participant_details JSONB, unread_count JSONB, raw_data JSONB
      );
      INSERT INTO chats_v2 (id, type, created_by, participants, participant_details, unread_count, raw_data)
      SELECT firestore_id, data->>'type', data->>'createdBy',
        data->'participants', data->'participantDetails', data->'unreadCount', data
      FROM firestore_export WHERE collection_path = 'chats_v2'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'messages_v2',
    sql: `
      CREATE TABLE IF NOT EXISTS messages_v2 (
        id TEXT PRIMARY KEY, text TEXT, type TEXT, chat_id TEXT, edited BOOLEAN,
        status TEXT, sender_id TEXT, sender_name TEXT, reactions JSONB, raw_data JSONB
      );
      INSERT INTO messages_v2 (id, text, type, chat_id, edited, status, sender_id, sender_name, reactions, raw_data)
      SELECT firestore_id, data->>'text', data->>'type', data->>'chatId',
        (data->>'edited')::boolean, data->>'status', data->>'senderId',
        data->>'senderName', data->'reactions', data
      FROM firestore_export WHERE collection_path = 'messages_v2'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'media_videos',
    sql: `
      CREATE TABLE IF NOT EXISTS media_videos (
        id TEXT PRIMARY KEY, title TEXT, type TEXT, video_url TEXT, thumbnail TEXT,
        description TEXT, for_hq BOOLEAN, is_youtube BOOLEAN, featured BOOLEAN,
        views INTEGER, likes INTEGER, created_by TEXT, created_by_name TEXT, raw_data JSONB
      );
      INSERT INTO media_videos (id, title, type, video_url, thumbnail, description,
        for_hq, is_youtube, featured, created_by, created_by_name, raw_data)
      SELECT firestore_id, data->>'title', data->>'type', data->>'videoUrl',
        data->>'thumbnail', data->>'description',
        (data->>'forHQ')::boolean, (data->>'isYouTube')::boolean, (data->>'featured')::boolean,
        data->>'createdBy', data->>'createdByName', data
      FROM firestore_export WHERE collection_path = 'media_videos'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'master_programs',
    sql: `
      CREATE TABLE IF NOT EXISTS master_programs (
        id TEXT PRIMARY KEY, name TEXT, song_ids JSONB, description TEXT,
        published_by TEXT, published_by_name TEXT, raw_data JSONB
      );
      INSERT INTO master_programs (id, name, song_ids, description, published_by, published_by_name, raw_data)
      SELECT firestore_id, data->>'name', data->'songIds', data->>'description',
        data->>'publishedBy', data->>'publishedByName', data
      FROM firestore_export WHERE collection_path = 'master_programs'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'song_notifications',
    sql: `
      CREATE TABLE IF NOT EXISTS song_notifications (
        id TEXT PRIMARY KEY, type TEXT, song_id TEXT, zone_id TEXT, message TEXT,
        zone_name TEXT, song_title TEXT, read BOOLEAN, submitted_by TEXT,
        submitted_by_email TEXT, raw_data JSONB
      );
      INSERT INTO song_notifications (id, type, song_id, zone_id, message, zone_name,
        song_title, read, submitted_by, submitted_by_email, raw_data)
      SELECT firestore_id, data->>'type', data->>'songId', data->>'zoneId',
        data->>'message', data->>'zoneName', data->>'songTitle',
        (data->>'read')::boolean, data->>'submittedBy', data->>'submittedByEmail', data
      FROM firestore_export WHERE collection_path = 'song_notifications'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
  {
    collection: 'upcoming_events',
    sql: `
      CREATE TABLE IF NOT EXISTS upcoming_events (
        id TEXT PRIMARY KEY, title TEXT, date TEXT, type TEXT, zone_id TEXT,
        location TEXT, description TEXT, raw_data JSONB
      );
      INSERT INTO upcoming_events (id, title, date, type, zone_id, location, description, raw_data)
      SELECT firestore_id, data->>'title', data->>'date', data->>'type',
        data->>'zoneId', data->>'location', data->>'description', data
      FROM firestore_export WHERE collection_path = 'upcoming_events'
      ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
    `
  },
];

// All remaining collections: simple id + raw_data table
const REMAINING_COLLECTIONS = [
  'achievement_templates','activity_logs','admin_playlists','analytics_events',
  'analytics_monthly','analytics_sessions','app_settings','audiolab_playlists',
  'audiolab_progress','audiolab_projects','audiolab_sessions','calendar_events',
  'calls_v2','categories','chat_users','chats','cloudinary_media','countdowns',
  'fcm_tokens','group_messages','kingschat_auth_sessions','media','media_categories',
  'media_comments','media_doodles','media_playlists','messages','page_categories',
  'presence','schedule_songs','settings','simplified_analytics','songs',
  'statuses_v2','support_messages','sys_metadata','user_groups','user_notifications',
  'user_sessions','user_song_notes','watch_history','whatsapp_users',
  'zone_admin_messages','zone_categories','zone_cloudinary_media',
  'zone_notifications','zone_page_categories','zone_praise_nights'
];

async function main() {
  console.log('🚀 Migrating data using server-side SQL (INSERT...SELECT)...\n');

  // Structured tables first
  for (const m of SQL_MIGRATIONS) {
    console.log(`📦 ${m.collection}...`);
    try {
      await pool.query(m.sql);
      const { rows } = await pool.query(
        `SELECT COUNT(*) FROM "${m.collection}"`
      );
      console.log(`   ✅ ${rows[0].count} rows`);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message.split('\n')[0]}`);
    }
  }

  // Generic fallback tables
  const alreadyDone = new Set(SQL_MIGRATIONS.map(m => m.collection));
  for (const col of REMAINING_COLLECTIONS) {
    if (alreadyDone.has(col)) continue;
    console.log(`📦 ${col} (raw)...`);
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS "${col}" (id TEXT PRIMARY KEY, raw_data JSONB);`);
      await pool.query(`
        INSERT INTO "${col}" (id, raw_data)
        SELECT firestore_id, data FROM firestore_export WHERE collection_path = $1
        ON CONFLICT (id) DO UPDATE SET raw_data = EXCLUDED.raw_data;
      `, [col]);
      const { rows } = await pool.query(`SELECT COUNT(*) FROM "${col}"`);
      console.log(`   ✅ ${rows[0].count} rows`);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message.split('\n')[0]}`);
    }
  }

  console.log('\n🎉 ALL DONE! Check your Supabase tables.');
  await pool.end();
}

main().catch(console.error);
