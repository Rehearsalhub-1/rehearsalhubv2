require('dotenv').config();
const {Pool} = require('pg');
const p = new Pool({connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});

const tables = ['profiles','song_history','attendance','zones','zone_members','hq_members',
  'praise_night_songs','zone_songs','subgroups','subgroup_songs','subgroup_praise_nights',
  'schedule_programs','submitted_songs','user_favorites','user_playlists','notifications','chats_v2'];

async function run() {
  for (const t of tables) {
    try {
      const r = await p.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]
      );
      const count = await p.query(`SELECT COUNT(*) FROM "${t}"`);
      console.log(`${t} (${count.rows[0].count} rows) — cols: ${r.rows.map(x=>x.column_name).join(', ')}`);
    } catch(e) { console.log(`${t}: ${e.message.split('\n')[0]}`); }
  }
  await p.end();
}
run();
