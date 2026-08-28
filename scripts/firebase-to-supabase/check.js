require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function test() {
  try {
    const res = await pool.query(`SELECT collection_path, COUNT(*) as count FROM firestore_export GROUP BY collection_path ORDER BY count DESC`);
    console.log("=== ALL COLLECTIONS IN EXPORT ===");
    res.rows.forEach(r => {
      console.log(`${r.collection_path}: ${r.count} documents`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
test();
