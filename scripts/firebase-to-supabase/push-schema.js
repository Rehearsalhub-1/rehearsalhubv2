const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    let sql = fs.readFileSync('schema_utf8.sql', 'utf-8');
    if (sql.charCodeAt(0) === 0xFEFF) {
      sql = sql.slice(1);
    }
    
    // We remove the drop table commands just to be incredibly safe
    const safeSql = sql.split(';').filter(stmt => !stmt.toLowerCase().includes('drop table')).join(';');

    console.log('Pushing schema to Supabase using pg...');
    await pool.query(safeSql);
    console.log('✅ Schema pushed successfully!');
    
    // Now generate Prisma client
    const { execSync } = require('child_process');
    console.log('Generating Prisma Client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma Client generated!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

main();
