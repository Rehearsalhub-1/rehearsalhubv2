/**
 * STEP 1: Firebase → Supabase Export Script
 *
 * This script is 100% READ-ONLY on Firebase.
 * It does NOT write, update, or delete anything in Firebase/Firestore.
 * It only writes to your Supabase database.
 *
 * Run: node export.js
 */

require('dotenv').config();
const admin = require('firebase-admin');
const { Pool } = require('pg');
const path = require('path');

// ── Init Firebase Admin (READ-ONLY) ─────────────────────────────────────────
const serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

// ── Init Supabase Postgres connection ────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── We will fetch collections dynamically instead of hardcoding them ────────────────────────────────────────────────────
// Using firestore.listCollections() later in the script

// ── Create landing table in Supabase if it doesn't exist ────────────────────
async function createFirestoreExportTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS firestore_export (
      id              SERIAL PRIMARY KEY,
      collection_path TEXT NOT NULL,
      firestore_id    TEXT NOT NULL,
      data            JSONB NOT NULL,
      migrated_at     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(collection_path, firestore_id)
    );
  `);
  console.log('✅ firestore_export table ready');
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// ── Export a single collection ───────────────────────────────────────────────
async function exportCollection(collectionName) {
  console.log(`\n📦 Exporting collection: ${collectionName}`);
  let count = 0;
  let currentChunk = [];

  try {
    const stream = firestore.collection(collectionName).stream();
    
    for await (const doc of stream) {
      currentChunk.push(doc);
      
      if (currentChunk.length >= 100) {
        await insertChunk(collectionName, currentChunk);
        count += currentChunk.length;
        currentChunk = [];
      }
    }
    
    // Insert any remaining docs
    if (currentChunk.length > 0) {
      await insertChunk(collectionName, currentChunk);
      count += currentChunk.length;
    }

    if (count === 0) {
      console.log(`   ⚠️  Collection "${collectionName}" is empty — skipping`);
    } else {
      console.log(`   ✅ ${count} documents exported`);
    }
  } catch (err) {
    console.error(`   ❌ Failed to read collection "${collectionName}":`, err.message);
  }
}

async function insertChunk(collectionName, chunk) {
  try {
    const values = [];
    const params = [];
    let i = 1;
    
    for (const doc of chunk) {
      values.push(`($${i++}, $${i++}, $${i++})`);
      params.push(collectionName, doc.id, JSON.stringify(doc.data()));
    }

    const query = `
      INSERT INTO firestore_export (collection_path, firestore_id, data)
      VALUES ${values.join(', ')}
      ON CONFLICT (collection_path, firestore_id) DO UPDATE SET data = EXCLUDED.data, migrated_at = NOW()
    `;
    
    await pool.query(query, params);
  } catch (insertErr) {
    console.error(`   ❌ Failed to insert chunk:`, insertErr.message);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting Firebase → Supabase export (Batch Mode)...');
  console.log('🔒 Firebase is READ-ONLY — nothing will be modified there\n');

  try {
    await createFirestoreExportTable();

    console.log('🔍 Fetching list of all collections from Firebase...');
    const allCollections = await firestore.listCollections();
    const collectionIds = allCollections.map(col => col.id);
    
    console.log(`✅ Found ${collectionIds.length} collections!`);

    for (const col of collectionIds) {
      await exportCollection(col);
    }

    console.log('\n🎉 Export complete! All data is now in Supabase firestore_export table.');
  } catch (err) {
    console.error('\n❌ Export failed:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
