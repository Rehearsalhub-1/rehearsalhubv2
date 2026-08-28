require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    // check actual columns in songs
    const cols_s = await p.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'songs' ORDER BY ordinal_position`);
    console.log('=== songs columns ===');
    cols_s.rows.forEach(r => console.log(` ${r.column_name} (${r.data_type})`));

    // check actual columns in master_songs
    const cols_ms = await p.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'master_songs' ORDER BY ordinal_position`);
    console.log('\n=== master_songs columns ===');
    cols_ms.rows.forEach(r => console.log(` ${r.column_name} (${r.data_type})`));

    // counts
    const sc = await p.query('SELECT COUNT(*) FROM songs');
    const msc = await p.query('SELECT COUNT(*) FROM master_songs');
    console.log('\nsongs count:', sc.rows[0].count);
    console.log('master_songs count:', msc.rows[0].count);

    // sample row from each (all columns)
    const sr = await p.query('SELECT * FROM songs LIMIT 2');
    console.log('\n=== songs sample ===');
    console.log(JSON.stringify(sr.rows, null, 2));

    const msr = await p.query('SELECT * FROM master_songs LIMIT 2');
    console.log('\n=== master_songs sample ===');
    console.log(JSON.stringify(msr.rows, null, 2));

  } catch(e) {
    console.error(e.message);
  } finally {
    await p.end();
  }
}
run();
