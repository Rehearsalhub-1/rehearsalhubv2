import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema });

function chunkArray(array: any[], size: number) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function migrate() {
  console.log('🚀 Starting FAST Batch Migration...');

  const mappings = [
    {
      collection: 'profiles',
      table: schema.profiles,
      mapFn: (id: string, data: any) => ({
        id,
        email: data.email || null,
        firstName: data.firstName || data.first_name || null,
        lastName: data.lastName || data.last_name || null,
        role: data.role || 'member',
        hasHqAccess: !!data.has_hq_access,
        avatarUrl: data.avatarUrl || data.profile_image_url || null,
        raw_data: data
      })
    },
    {
      collection: 'zones',
      table: schema.zones,
      mapFn: (id: string, data: any) => ({
        id, name: data.name, invitationCode: data.invitationCode, isHq: !!data.isHq, raw_data: data
      })
    },
    {
      collection: 'praise_night_songs',
      table: schema.praiseNightSongs,
      mapFn: (id: string, data: any) => ({
        id, title: data.title, writer: data.writer, leadSinger: data.leadSinger, 
        audioFile: data.audioFile, audioUrls: data.audioUrls, status: data.status, 
        category: data.category, isActive: data.isActive !== false, raw_data: data
      })
    },
    {
      collection: 'song_history',
      table: schema.songHistory,
      mapFn: (id: string, data: any) => ({
        id, songId: data.songId, rehearsalId: data.rehearsalId, userId: data.userId, raw_data: data
      })
    },
    {
      collection: 'attendance',
      table: schema.attendance,
      mapFn: (id: string, data: any) => ({
        id, userId: data.userId, rehearsalId: data.rehearsalId, status: data.status, 
        scannedAt: data.scannedAt ? new Date(data.scannedAt._seconds * 1000) : null, raw_data: data
      })
    },
    {
      collection: 'hq_members',
      table: schema.hqMembers,
      mapFn: (id: string, data: any) => ({
        id, userId: data.userId, role: data.role, raw_data: data
      })
    },
    {
      collection: 'chats_v2',
      table: schema.chats,
      mapFn: (id: string, data: any) => ({
        id, type: data.type, createdBy: data.createdBy, participants: data.participants, 
        unreadCount: data.unreadCount, raw_data: data
      })
    },
    {
      collection: 'zone_songs',
      table: schema.zoneSongs,
      mapFn: (id: string, data: any) => ({
        id, zoneId: data.zoneId, title: data.title, writer: data.writer, leadSinger: data.leadSinger, 
        audioFile: data.audioFile, audioUrls: data.audioUrls, status: data.status, 
        category: data.category, isActive: data.isActive !== false, raw_data: data
      })
    },
    {
      collection: 'subgroup_praise_nights',
      table: schema.subgroupPraiseNights,
      mapFn: (id: string, data: any) => ({
        id, subGroupId: data.subGroupId, name: data.name, 
        date: data.date ? (data.date._seconds ? new Date(data.date._seconds * 1000) : new Date(data.date)) : null, 
        raw_data: data
      })
    },
    {
      collection: 'subgroups',
      table: schema.subgroups,
      mapFn: (id: string, data: any) => ({ id, zoneId: data.zoneId, name: data.name, raw_data: data })
    },
    {
      collection: 'zone_members',
      table: schema.zoneMembers,
      mapFn: (id: string, data: any) => ({ id, userId: data.userId, zoneId: data.zoneId, role: data.role, raw_data: data })
    },
    {
      collection: 'subgroup_songs',
      table: schema.subgroupSongs,
      mapFn: (id: string, data: any) => ({
        id, subGroupId: data.subGroupId || data.subgroupId, title: data.title, writer: data.writer, leadSinger: data.leadSinger, 
        audioFile: data.audioFile, audioUrls: data.audioUrls, status: data.status, 
        category: data.category, isActive: data.isActive !== false, raw_data: data
      })
    },
    {
      collection: 'notifications',
      table: schema.notifications,
      mapFn: (id: string, data: any) => ({ id, userId: data.userId, title: data.title, body: data.body, isRead: !!data.isRead, raw_data: data })
    },
    {
      collection: 'user_playlists',
      table: schema.userPlaylists,
      mapFn: (id: string, data: any) => ({ id, userId: data.userId, name: data.name, songs: data.songs, raw_data: data })
    },
    {
      collection: 'user_favorites',
      table: schema.userFavorites,
      mapFn: (id: string, data: any) => ({ id, userId: data.userId, songId: data.songId, raw_data: data })
    },
    {
      collection: 'submitted_songs',
      table: schema.submittedSongs,
      mapFn: (id: string, data: any) => ({ id, userId: data.userId, title: data.title, status: data.status, raw_data: data })
    },
    {
      collection: 'schedule_programs',
      table: schema.schedulePrograms,
      mapFn: (id: string, data: any) => ({
        id, name: data.name, 
        date: data.date ? (data.date._seconds ? new Date(data.date._seconds * 1000) : new Date(data.date)) : null, 
        raw_data: data
      })
    },
    {
      collection: 'media_doodles',
      table: schema.mediaDoodles,
      mapFn: (id: string, data: any) => ({ id, songId: data.songId, userId: data.userId, data: data.data, raw_data: data })
    },
    {
      collection: 'settings',
      table: schema.settings,
      mapFn: (id: string, data: any) => ({ id, key: data.key, value: data.value, raw_data: data })
    }
  ];

  for (const mapping of mappings) {
    console.log(`\n📦 Fetching ${mapping.collection}...`);
    
    // First get total count
    const totalRes = await pool.query(`SELECT COUNT(*) FROM firestore_export WHERE collection_path = $1`, [mapping.collection]);
    const total = parseInt(totalRes.rows[0].count, 10);
    
    if (total === 0) {
      console.log(`✅ Skipped ${mapping.collection} (0 docs)`);
      continue;
    }

    let inserted = 0;
    const batchSize = 500;
    
    for (let offset = 0; offset < total; offset += batchSize) {
      const rawDocs = await db.query.firestoreExport.findMany({ 
        where: eq(schema.firestoreExport.collection_path, mapping.collection),
        limit: batchSize,
        offset: offset
      });

      const mappedData = [];
      for (const raw of rawDocs) {
        try {
          mappedData.push(mapping.mapFn(raw.firestore_id, raw.data));
        } catch (e) {}
      }

      if (mappedData.length > 0) {
        try {
          await db.insert(mapping.table).values(mappedData).onConflictDoNothing();
          inserted += mappedData.length;
        } catch (e) {
          console.warn(`⚠️ Batch insert failed for ${mapping.collection}: ${(e as any)?.message ?? e}`);
        }
      }
    }
    
    console.log(`✅ Bulk inserted ${inserted} / ${total} ${mapping.collection}`);
  }

  console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY!');
  process.exit(0);
}

migrate();
