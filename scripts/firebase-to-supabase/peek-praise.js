require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    // columns in praise_night_songs
    const cols = await p.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'praise_night_songs' ORDER BY ordinal_position`);
    console.log('=== praise_night_songs columns ===');
    cols.rows.forEach(r => console.log(` ${r.column_name} (${r.data_type})`));

    // count
    const cnt = await p.query('SELECT COUNT(*) FROM praise_night_songs');
    console.log('\npraise_night_songs count:', cnt.rows[0].count);

    // sample 2 rows
    const rows = await p.query('SELECT * FROM praise_night_songs LIMIT 2');
    console.log('\n=== praise_night_songs sample ===');
    console.log(JSON.stringify(rows.rows, null, 2));

    // how many have audioFile or audioUrls filled?
    const withAudio = await p.query(`SELECT COUNT(*) FROM praise_night_songs WHERE audio_file IS NOT NULL AND audio_file != ''`);
    console.log('\npraise_night_songs with audio_file:', withAudio.rows[0].count);

  } catch(e) {
    console.error(e.message);
  } finally {
    await p.end();
  }
}
run();
