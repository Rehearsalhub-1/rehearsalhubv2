require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runQuery(query, params = []) {
  try {
    await pool.query(query, params);
    return true;
  } catch (e) {
    console.warn(`Query failed: ${e.message}`, params);
    return false;
  }
}

async function migrateSubgroups() {
  console.log('\nMigrating subgroups...');
  const { rows: rawData } = await pool.query(`SELECT * FROM firestore_export WHERE collection_path = 'subgroups'`);
  let count = 0;
  for (const raw of rawData) {
    const data = raw.data;
    const id = raw.firestore_id;
    const zoneId = data.zoneId || null;
    const name = data.name || 'Unnamed Subgroup';

    if (zoneId) {
      const success = await runQuery(
        `INSERT INTO "Subgroup" ("id", "zoneId", "name") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [id, zoneId, name]
      );
      if (success) count++;
    }
  }
  console.log(`✅ Migrated ${count} subgroups.`);
}

async function migrateMemberships() {
  console.log('\nMigrating zone members...');
  const { rows: rawData } = await pool.query(`SELECT * FROM firestore_export WHERE collection_path = 'zone_members'`);
  let count = 0;
  for (const raw of rawData) {
    const data = raw.data;
    const id = raw.firestore_id;
    const userId = data.userId;
    const zoneId = data.zoneId;
    const role = data.role || 'member';

    if (userId && zoneId) {
      const success = await runQuery(
        `INSERT INTO "Membership" ("id", "userId", "zoneId", "role") VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [id, userId, zoneId, role]
      );
      if (success) count++;
    }
  }
  console.log(`✅ Migrated ${count} memberships.`);
}

async function migrateSongs() {
  console.log('\nMigrating songs...');
  const { rows: rawData } = await pool.query(`SELECT * FROM firestore_export WHERE collection_path = 'subgroup_songs'`);
  let count = 0;
  for (const raw of rawData) {
    const data = raw.data;
    const id = raw.firestore_id;
    const subgroupId = data.subGroupId || data.subgroupId || null;
    
    if (subgroupId) {
      const success = await runQuery(
        `INSERT INTO "Song" ("id", "subgroupId", "title", "key", "lyrics", "audioUrl", "status", "isActive") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [id, subgroupId, data.title || 'Unknown Song', data.key || null, data.lyrics || null, data.audioUrl || null, data.status || 'new', data.isActive !== false]
      );
      if (success) count++;
    }
  }
  console.log(`✅ Migrated ${count} songs.`);
}

async function migrateChats() {
  console.log('\nMigrating chats...');
  const { rows: rawData } = await pool.query(`SELECT * FROM firestore_export WHERE collection_path = 'chats_v2'`);
  let count = 0;
  for (const raw of rawData) {
    const data = raw.data;
    const id = raw.firestore_id;
    const roomId = data.roomId;
    const userId = data.senderId || data.userId;
    
    if (roomId && userId && data.text) {
      const success = await runQuery(
        `INSERT INTO "ChatMessage" ("id", "roomId", "userId", "text", "createdAt") 
         VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING`,
        [id, roomId, userId, data.text]
      );
      if (success) count++;
    }
  }
  console.log(`✅ Migrated ${count} chat messages.`);
}

async function main() {
  console.log('🚀 Starting Data Restructuring for remaining tables...');
  try {
    await migrateSubgroups();
    await migrateMemberships();
    await migrateSongs();
    await migrateChats();
    console.log('\n🎉 Phase 2 Migration 100% Complete!');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await pool.end();
  }
}

main();
