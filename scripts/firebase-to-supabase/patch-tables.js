require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('🔧 Applying final patches...\n');

  // 1. profiles & song_history: created_at column is TIMESTAMP, but Firebase stores it as text string
  //    Change created_at to TEXT on those tables so it accepts the raw string value
  const patches = [
    // profiles: cast created_at to text
    {
      name: 'profiles (fix created_at type)',
      sql: `
        ALTER TABLE profiles ALTER COLUMN created_at TYPE TEXT USING created_at::text;
        ALTER TABLE profiles ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
        INSERT INTO profiles (id, role, email, last_name, first_name, created_at, updated_at,
          kingschat_id, has_hq_access, profile_completed, raw_data)
        SELECT firestore_id,
          data->>'role', data->>'email',
          COALESCE(data->>'last_name', data->>'lastName'),
          COALESCE(data->>'first_name', data->>'firstName'),
          data->>'created_at', data->>'updated_at',
          COALESCE(data->>'kingschat_id', data->>'kingschatId'),
          (COALESCE(data->>'has_hq_access', data->>'hasHqAccess'))::boolean,
          (COALESCE(data->>'profile_completed', data->>'profileCompleted'))::boolean,
          data
        FROM firestore_export WHERE collection_path = 'profiles'
        ON CONFLICT (id) DO UPDATE SET
          kingschat_id = EXCLUDED.kingschat_id,
          profile_completed = EXCLUDED.profile_completed,
          updated_at = EXCLUDED.updated_at,
          raw_data = EXCLUDED.raw_data;
      `
    },

    // song_history: created_at is TIMESTAMP, store as text
    {
      name: 'song_history (fix created_at type)',
      sql: `
        ALTER TABLE song_history ALTER COLUMN created_at TYPE TEXT USING created_at::text;
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

    // zone_members: FK constraint blocking insert. Drop the FK, insert, done.
    {
      name: 'zone_members (drop FK + insert)',
      sql: `
        ALTER TABLE zone_members DROP CONSTRAINT IF EXISTS zone_members_user_id_profiles_id_fk;
        INSERT INTO zone_members (id, user_id, zone_id, role, status, raw_data)
        SELECT firestore_id, data->>'userId', data->>'zoneId',
          data->>'role', data->>'status', data
        FROM firestore_export WHERE collection_path = 'zone_members'
        ON CONFLICT (id) DO UPDATE SET
          zone_id = EXCLUDED.zone_id, role = EXCLUDED.role,
          status = EXCLUDED.status, raw_data = EXCLUDED.raw_data;
      `
    },

    // hq_members: FK constraint blocking insert. Drop the FK, insert, done.
    {
      name: 'hq_members (drop FK + insert)',
      sql: `
        ALTER TABLE hq_members DROP CONSTRAINT IF EXISTS hq_members_user_id_profiles_id_fk;
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

    // zone_songs: categories column missing — add it then insert
    {
      name: 'zone_songs (add categories + insert)',
      sql: `
        ALTER TABLE zone_songs ADD COLUMN IF NOT EXISTS categories JSONB;
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

    // subgroup_praise_nights: date col is TIMESTAMP but value is text string
    {
      name: 'subgroup_praise_nights (fix date type)',
      sql: `
        ALTER TABLE subgroup_praise_nights ALTER COLUMN date TYPE TEXT USING date::text;
        INSERT INTO subgroup_praise_nights (id, name, date, zone_id, sub_group_id, sub_group_name, song_ids, raw_data)
        SELECT firestore_id, data->>'name', data->>'date', data->>'zoneId',
          data->>'subGroupId', data->>'subGroupName', data->'songIds', data
        FROM firestore_export WHERE collection_path = 'subgroup_praise_nights'
        ON CONFLICT (id) DO UPDATE SET
          zone_id = EXCLUDED.zone_id, sub_group_name = EXCLUDED.sub_group_name,
          song_ids = EXCLUDED.song_ids, raw_data = EXCLUDED.raw_data;
      `
    },

    // notifications: created_at is TIMESTAMP but value is text
    {
      name: 'notifications (fix created_at type)',
      sql: `
        ALTER TABLE notifications ALTER COLUMN created_at TYPE TEXT USING created_at::text;
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
  ];

  for (const patch of patches) {
    console.log(`📦 ${patch.name}`);
    try {
      await pool.query(patch.sql);
      const tbl = patch.name.split(' ')[0];
      const { rows } = await pool.query(`SELECT COUNT(*) FROM "${tbl}"`);
      console.log(`   ✅ ${rows[0].count} rows`);
    } catch (err) {
      console.error(`   ❌ ${err.message.split('\n')[0]}`);
    }
  }

  console.log('\n🎉 All patches done!');
  await pool.end();
}

main().catch(console.error);
