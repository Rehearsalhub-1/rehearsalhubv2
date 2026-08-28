require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await pool.query(`
    DROP TABLE IF EXISTS "User" CASCADE;
    DROP TABLE IF EXISTS "Zone" CASCADE;
    DROP TABLE IF EXISTS "Subgroup" CASCADE;
    DROP TABLE IF EXISTS "Membership" CASCADE;
    DROP TABLE IF EXISTS "Song" CASCADE;
    DROP TABLE IF EXISTS "Rehearsal" CASCADE;
    DROP TABLE IF EXISTS "RehearsalSong" CASCADE;
    DROP TABLE IF EXISTS "Playlist" CASCADE;
    DROP TABLE IF EXISTS "Attendance" CASCADE;
    DROP TABLE IF EXISTS "ChatMessage" CASCADE;
  `);
  console.log('Dropped Prisma tables');
  pool.end();
}
run();
