require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const FIXES = [
  {
    name: 'profiles',
    alters: [
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kingschat_id TEXT`,
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN`,
      `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TEXT`,
    ],
    insert: `
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
        (COALESCE(data->>'has_hq_access', data->>'hasHqAccess'))::boolean,
        (COALESCE(data->>'profile_completed', data->>'profileCompleted'))::boolean,
        data
      FROM firestore_export WHERE collection_path = 'profiles'
      ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role, email = EXCLUDED.email,
        last_name = EXCLUDED.last_name, first_name = EXCLUDED.first_name,
        kingschat_id = EXCLUDED.kingschat_id,
        profile_completed = EXCLUDED.profile_completed,
        updated_at = EXCLUDED.updated_at,
        has_hq_access = EXCLUDED.has_hq_access,
        raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'song_history',
    alters: [
      `ALTER TABLE song_history ADD COLUMN IF NOT EXISTS type TEXT`,
      `ALTER TABLE song_history ADD COLUMN IF NOT EXISTS title TEXT`,
      `ALTER TABLE song_history ADD COLUMN IF NOT EXISTS new_value TEXT`,
      `ALTER TABLE song_history ADD COLUMN IF NOT EXISTS old_value TEXT`,
      `ALTER TABLE song_history ADD COLUMN IF NOT EXISTS created_by TEXT`,
      `ALTER TABLE song_history ADD COLUMN IF NOT EXISTS description TEXT`,
    ],
    insert: `
      INSERT INTO song_history (id, type, title, song_id, new_value, old_value, created_at, created_by, description, raw_data)
      SELECT firestore_id,
        data->>'type', data->>'title',
        COALESCE(data->>'song_id', data->>'songId'),
        COALESCE(data->>'new_value', data->>'newValue'),
        COALESCE(data->>'old_value', data->>'oldValue'),
        data->>'created_at',
        COALESCE(data->>'created_by', data->>'createdBy'),
        data->>'description', data
      FROM firestore_export WHERE collection_path = 'song_history'
      ON CONFLICT (id) DO UPDATE SET
        type = EXCLUDED.type, title = EXCLUDED.title,
        new_value = EXCLUDED.new_value, old_value = EXCLUDED.old_value,
        created_by = EXCLUDED.created_by, description = EXCLUDED.description,
        raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'attendance',
    alters: [
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS zone_id TEXT`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS user_name TEXT`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS event_name TEXT`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS qr_code TEXT`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_time TEXT`,
      `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS recorded_by_admin_id TEXT`,
    ],
    insert: `
      INSERT INTO attendance (id, status, user_id, zone_id, user_name, event_name,
        qr_code, check_in_time, recorded_by_admin_id, raw_data)
      SELECT firestore_id,
        data->>'status',
        COALESCE(data->>'userId', data->>'user_id'),
        data->>'zoneId',
        COALESCE(data->>'userName', data->>'user_name'),
        COALESCE(data->>'eventName', data->>'event_name'),
        data->>'qrCode',
        COALESCE(data->>'check_in_time', data->>'checkInTime'),
        data->>'recordedByAdminId', data
      FROM firestore_export WHERE collection_path = 'attendance'
      ON CONFLICT (id) DO UPDATE SET
        zone_id = EXCLUDED.zone_id, user_name = EXCLUDED.user_name,
        event_name = EXCLUDED.event_name, qr_code = EXCLUDED.qr_code,
        check_in_time = EXCLUDED.check_in_time, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'zones',
    alters: [
      `ALTER TABLE zones ADD COLUMN IF NOT EXISTS code TEXT`,
      `ALTER TABLE zones ADD COLUMN IF NOT EXISTS country TEXT`,
      `ALTER TABLE zones ADD COLUMN IF NOT EXISTS region TEXT`,
      `ALTER TABLE zones ADD COLUMN IF NOT EXISTS is_active BOOLEAN`,
      `ALTER TABLE zones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
    ],
    insert: `
      INSERT INTO zones (id, name, code, country, region, is_active, raw_data)
      SELECT firestore_id, data->>'name', data->>'code', data->>'country',
        data->>'region', (data->>'isActive')::boolean, data
      FROM firestore_export WHERE collection_path = 'zones'
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code, country = EXCLUDED.country,
        region = EXCLUDED.region, is_active = EXCLUDED.is_active,
        raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'zone_members',
    alters: [
      `ALTER TABLE zone_members ADD COLUMN IF NOT EXISTS status TEXT`,
    ],
    insert: `
      INSERT INTO zone_members (id, user_id, zone_id, role, status, raw_data)
      SELECT firestore_id, data->>'userId', data->>'zoneId',
        data->>'role', data->>'status', data
      FROM firestore_export WHERE collection_path = 'zone_members'
      ON CONFLICT (id) DO UPDATE SET
        zone_id = EXCLUDED.zone_id, role = EXCLUDED.role,
        status = EXCLUDED.status, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'hq_members',
    alters: [
      `ALTER TABLE hq_members ADD COLUMN IF NOT EXISTS status TEXT`,
      `ALTER TABLE hq_members ADD COLUMN IF NOT EXISTS user_name TEXT`,
      `ALTER TABLE hq_members ADD COLUMN IF NOT EXISTS hq_group_id TEXT`,
      `ALTER TABLE hq_members ADD COLUMN IF NOT EXISTS user_email TEXT`,
      `ALTER TABLE hq_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ`,
    ],
    insert: `
      INSERT INTO hq_members (id, role, status, user_id, user_name, hq_group_id, user_email, raw_data)
      SELECT firestore_id, data->>'role', data->>'status', data->>'userId',
        data->>'userName', data->>'hqGroupId', data->>'userEmail', data
      FROM firestore_export WHERE collection_path = 'hq_members'
      ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role, status = EXCLUDED.status,
        user_name = EXCLUDED.user_name, hq_group_id = EXCLUDED.hq_group_id,
        user_email = EXCLUDED.user_email, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'praise_night_songs',
    alters: [
      `ALTER TABLE praise_night_songs ADD COLUMN IF NOT EXISTS key TEXT`,
      `ALTER TABLE praise_night_songs ADD COLUMN IF NOT EXISTS tempo TEXT`,
      `ALTER TABLE praise_night_songs ADD COLUMN IF NOT EXISTS lyrics TEXT`,
      `ALTER TABLE praise_night_songs ADD COLUMN IF NOT EXISTS zone_id TEXT`,
      `ALTER TABLE praise_night_songs ADD COLUMN IF NOT EXISTS praise_night_id TEXT`,
      `ALTER TABLE praise_night_songs ADD COLUMN IF NOT EXISTS conductor TEXT`,
      `ALTER TABLE praise_night_songs ADD COLUMN IF NOT EXISTS drummer TEXT`,
      `ALTER TABLE praise_night_songs ADD COLUMN IF NOT EXISTS categories JSONB`,
      `ALTER TABLE praise_night_songs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
    ],
    insert: `
      INSERT INTO praise_night_songs (id, title, key, tempo, lyrics, writer, zone_id,
        praise_night_id, status, audio_file, conductor, lead_singer, drummer,
        categories, is_active, raw_data)
      SELECT firestore_id,
        data->>'title', data->>'key', data->>'tempo', data->>'lyrics',
        data->>'writer', data->>'zoneId', data->>'praiseNightId',
        data->>'status', data->>'audioFile', data->>'conductor',
        data->>'leadSinger', data->>'drummer', data->'categories',
        (data->>'isActive')::boolean, data
      FROM firestore_export WHERE collection_path = 'praise_night_songs'
      ON CONFLICT (id) DO UPDATE SET
        key = EXCLUDED.key, tempo = EXCLUDED.tempo, lyrics = EXCLUDED.lyrics,
        zone_id = EXCLUDED.zone_id, praise_night_id = EXCLUDED.praise_night_id,
        conductor = EXCLUDED.conductor, drummer = EXCLUDED.drummer,
        categories = EXCLUDED.categories, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'zone_songs',
    alters: [
      `ALTER TABLE zone_songs ADD COLUMN IF NOT EXISTS key TEXT`,
      `ALTER TABLE zone_songs ADD COLUMN IF NOT EXISTS tempo TEXT`,
      `ALTER TABLE zone_songs ADD COLUMN IF NOT EXISTS conductor TEXT`,
      `ALTER TABLE zone_songs ADD COLUMN IF NOT EXISTS drummer TEXT`,
      `ALTER TABLE zone_songs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
    ],
    insert: `
      INSERT INTO zone_songs (id, title, key, tempo, zone_id, status, audio_file, categories, raw_data)
      SELECT firestore_id,
        data->>'title', data->>'key', data->>'tempo',
        data->>'zoneId', data->>'status', data->>'audioFile',
        data->'categories', data
      FROM firestore_export WHERE collection_path = 'zone_songs'
      ON CONFLICT (id) DO UPDATE SET
        key = EXCLUDED.key, tempo = EXCLUDED.tempo,
        categories = EXCLUDED.categories, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'subgroups',
    alters: [
      `ALTER TABLE subgroups ADD COLUMN IF NOT EXISTS description TEXT`,
      `ALTER TABLE subgroups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
    ],
    insert: `
      INSERT INTO subgroups (id, name, zone_id, description, raw_data)
      SELECT firestore_id, data->>'name', data->>'zoneId', data->>'description', data
      FROM firestore_export WHERE collection_path = 'subgroups'
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description,
        raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'subgroup_songs',
    alters: [
      `ALTER TABLE subgroup_songs ADD COLUMN IF NOT EXISTS key TEXT`,
      `ALTER TABLE subgroup_songs ADD COLUMN IF NOT EXISTS tempo TEXT`,
      `ALTER TABLE subgroup_songs ADD COLUMN IF NOT EXISTS zone_id TEXT`,
      `ALTER TABLE subgroup_songs ADD COLUMN IF NOT EXISTS status TEXT`,
    ],
    insert: `
      INSERT INTO subgroup_songs (id, title, key, tempo, zone_id, status, raw_data)
      SELECT firestore_id, data->>'title', data->>'key', data->>'tempo',
        data->>'zoneId', data->>'status', data
      FROM firestore_export WHERE collection_path = 'subgroup_songs'
      ON CONFLICT (id) DO UPDATE SET
        key = EXCLUDED.key, tempo = EXCLUDED.tempo,
        zone_id = EXCLUDED.zone_id, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'subgroup_praise_nights',
    alters: [
      `ALTER TABLE subgroup_praise_nights ADD COLUMN IF NOT EXISTS zone_id TEXT`,
      `ALTER TABLE subgroup_praise_nights ADD COLUMN IF NOT EXISTS sub_group_name TEXT`,
      `ALTER TABLE subgroup_praise_nights ADD COLUMN IF NOT EXISTS song_ids JSONB`,
      `ALTER TABLE subgroup_praise_nights ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
    ],
    insert: `
      INSERT INTO subgroup_praise_nights (id, name, date, zone_id, sub_group_id, sub_group_name, song_ids, raw_data)
      SELECT firestore_id, data->>'name', data->>'date', data->>'zoneId',
        data->>'subGroupId', data->>'subGroupName', data->'songIds', data
      FROM firestore_export WHERE collection_path = 'subgroup_praise_nights'
      ON CONFLICT (id) DO UPDATE SET
        zone_id = EXCLUDED.zone_id, sub_group_name = EXCLUDED.sub_group_name,
        song_ids = EXCLUDED.song_ids, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'schedule_programs',
    alters: [
      `ALTER TABLE schedule_programs ADD COLUMN IF NOT EXISTS zone_id TEXT`,
      `ALTER TABLE schedule_programs ADD COLUMN IF NOT EXISTS days JSONB`,
      `ALTER TABLE schedule_programs ADD COLUMN IF NOT EXISTS weeks JSONB`,
      `ALTER TABLE schedule_programs ADD COLUMN IF NOT EXISTS new_songs JSONB`,
      `ALTER TABLE schedule_programs ADD COLUMN IF NOT EXISTS is_archived BOOLEAN`,
      `ALTER TABLE schedule_programs ADD COLUMN IF NOT EXISTS daily_schedules JSONB`,
      `ALTER TABLE schedule_programs ADD COLUMN IF NOT EXISTS updated_at TEXT`,
    ],
    insert: `
      INSERT INTO schedule_programs (id, name, zone_id, days, weeks, new_songs, is_archived, daily_schedules, raw_data)
      SELECT firestore_id, data->>'name', data->>'zoneId',
        data->'days', data->'weeks', data->'newSongs',
        (data->>'isArchived')::boolean, data->'dailySchedules', data
      FROM firestore_export WHERE collection_path = 'schedule_programs'
      ON CONFLICT (id) DO UPDATE SET
        zone_id = EXCLUDED.zone_id, days = EXCLUDED.days,
        new_songs = EXCLUDED.new_songs, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'submitted_songs',
    alters: [
      `ALTER TABLE submitted_songs ADD COLUMN IF NOT EXISTS zone_id TEXT`,
      `ALTER TABLE submitted_songs ADD COLUMN IF NOT EXISTS submitted_by TEXT`,
      `ALTER TABLE submitted_songs ADD COLUMN IF NOT EXISTS submitted_by_email TEXT`,
    ],
    insert: `
      INSERT INTO submitted_songs (id, title, zone_id, status, submitted_by, submitted_by_email, raw_data)
      SELECT firestore_id, data->>'title', data->>'zoneId', data->>'status',
        data->>'submittedBy', data->>'submittedByEmail', data
      FROM firestore_export WHERE collection_path = 'submitted_songs'
      ON CONFLICT (id) DO UPDATE SET
        zone_id = EXCLUDED.zone_id, submitted_by = EXCLUDED.submitted_by,
        submitted_by_email = EXCLUDED.submitted_by_email, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'user_favorites',
    alters: [
      `ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS song_id TEXT`,
    ],
    insert: `
      INSERT INTO user_favorites (id, user_id, song_id, raw_data)
      SELECT firestore_id, data->>'userId', data->>'songId', data
      FROM firestore_export WHERE collection_path = 'user_favorites'
      ON CONFLICT (id) DO UPDATE SET
        song_id = EXCLUDED.song_id, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'user_playlists',
    alters: [
      `ALTER TABLE user_playlists ADD COLUMN IF NOT EXISTS title TEXT`,
      `ALTER TABLE user_playlists ADD COLUMN IF NOT EXISTS song_ids JSONB`,
      `ALTER TABLE user_playlists ADD COLUMN IF NOT EXISTS is_public BOOLEAN`,
      `ALTER TABLE user_playlists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
    ],
    insert: `
      INSERT INTO user_playlists (id, title, user_id, song_ids, is_public, raw_data)
      SELECT firestore_id, data->>'title', data->>'userId',
        data->'songIds', (data->>'isPublic')::boolean, data
      FROM firestore_export WHERE collection_path = 'user_playlists'
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title, song_ids = EXCLUDED.song_ids,
        is_public = EXCLUDED.is_public, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'notifications',
    alters: [
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS zone_id TEXT`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category TEXT`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority TEXT`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id TEXT`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_user_id TEXT`,
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_audience TEXT`,
    ],
    insert: `
      INSERT INTO notifications (id, type, title, message, zone_id, is_read, category,
        priority, sender_id, action_url, created_at, target_user_id, target_audience, raw_data)
      SELECT firestore_id, data->>'type', data->>'title', data->>'message',
        data->>'zoneId',
        (COALESCE(data->>'is_read', data->>'isRead'))::boolean,
        data->>'category', data->>'priority',
        COALESCE(data->>'sender_id', data->>'senderId'),
        COALESCE(data->>'action_url', data->>'actionUrl'),
        data->>'created_at',
        COALESCE(data->>'target_user_id', data->>'targetUserId'),
        COALESCE(data->>'target_audience', data->>'targetAudience'), data
      FROM firestore_export WHERE collection_path = 'notifications'
      ON CONFLICT (id) DO UPDATE SET
        type = EXCLUDED.type, message = EXCLUDED.message,
        zone_id = EXCLUDED.zone_id, raw_data = EXCLUDED.raw_data;
    `
  },
  {
    name: 'chats_v2',
    alters: [
      `ALTER TABLE chats_v2 ADD COLUMN IF NOT EXISTS participant_details JSONB`,
    ],
    insert: `
      INSERT INTO chats_v2 (id, type, created_by, participants, participant_details, unread_count, raw_data)
      SELECT firestore_id, data->>'type', data->>'createdBy',
        data->'participants', data->'participantDetails', data->'unreadCount', data
      FROM firestore_export WHERE collection_path = 'chats_v2'
      ON CONFLICT (id) DO UPDATE SET
        participant_details = EXCLUDED.participant_details,
        raw_data = EXCLUDED.raw_data;
    `
  },
];

async function main() {
  console.log('🔧 Fixing tables: adding missing columns + re-inserting data...\n');

  for (const fix of FIXES) {
    console.log(`📦 Fixing: ${fix.name}`);
    
    // Add missing columns
    for (const alter of fix.alters) {
      try {
        await pool.query(alter);
      } catch (e) {
        // column may already exist, that's fine
      }
    }

    // Re-insert data
    try {
      await pool.query(fix.insert);
      const { rows } = await pool.query(`SELECT COUNT(*) FROM "${fix.name}"`);
      console.log(`   ✅ ${rows[0].count} rows`);
    } catch (err) {
      console.error(`   ❌ ${err.message.split('\n')[0]}`);
    }
  }

  console.log('\n🎉 All fixes applied!');
  await pool.end();
}

main().catch(console.error);
