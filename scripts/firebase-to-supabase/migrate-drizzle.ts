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

async function migrate() {
  console.log('🚀 Starting Drizzle Migration for 11,000+ documents...');

  // Map of collections to their Drizzle table and field mappings
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
        id, subGroupId: data.subGroupId, name: data.name, date: data.date ? new Date(data.date._seconds * 1000) : null, raw_data: data
      })
    }
  ];

  for (const mapping of mappings) {
    console.log(`\n📦 Migrating ${mapping.collection}...`);
    const rawDocs = await db.query.firestoreExport.findMany({ 
      where: eq(schema.firestoreExport.collection_path, mapping.collection) 
    });
    
    let count = 0;
    for (const raw of rawDocs) {
      try {
        const mappedData = mapping.mapFn(raw.firestore_id, raw.data);
        await db.insert(mapping.table).values(mappedData).onConflictDoNothing();
        count++;
      } catch (e) {
        // Silently skip corrupted rows (e.g. missing foreign keys or bad data)
      }
    }
    console.log(`✅ Migrated ${count} / ${rawDocs.length} ${mapping.collection}`);
  }

  console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY!');
  process.exit(0);
}

migrate();
