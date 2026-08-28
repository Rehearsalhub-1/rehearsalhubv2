const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

async function main() {
  console.log('Fetching collections and sample data...');
  const { rows: collections } = await pool.query(`
    SELECT DISTINCT ON (collection_path) collection_path, data 
    FROM firestore_export 
    ORDER BY collection_path
  `);
  
  let schemaContent = `import { pgTable, text, timestamp, boolean, jsonb, serial, integer } from 'drizzle-orm/pg-core';\n\n`;
  
  let migrateMappings = ``;

  for (const row of collections) {
    const colName = row.collection_path;
    const tableName = toCamelCase(colName);
    const sampleData = row.data || {};
    
    schemaContent += `export const ${tableName} = pgTable('${colName}', {\n`;
    schemaContent += `  id: text('id').primaryKey(),\n`;
    
    let mapFields = `        id: raw.firestore_id,\n`;

    for (const key of Object.keys(sampleData)) {
      if (key === 'id') continue;
      const val = sampleData[key];
      const camelKey = toCamelCase(key);
      
      let type = 'jsonb';
      let parseFn = `data.${key}`;
      
      if (typeof val === 'string') {
        type = 'text';
      } else if (typeof val === 'boolean') {
        type = 'boolean';
        parseFn = `!!data.${key}`;
      } else if (typeof val === 'number') {
        type = 'integer';
      } else if (val && val._seconds !== undefined) {
        type = 'timestamp';
        parseFn = `data.${key} ? new Date(data.${key}._seconds * 1000) : null`;
      }
      
      schemaContent += `  ${camelKey}: ${type}('${key}'),\n`;
      mapFields += `        ${camelKey}: ${parseFn},\n`;
    }
    
    schemaContent += `  raw_data: jsonb('raw_data')\n});\n\n`;
    
    migrateMappings += `    {\n`;
    migrateMappings += `      collection: '${colName}',\n`;
    migrateMappings += `      table: schema.${tableName},\n`;
    migrateMappings += `      mapFn: (id: string, data: any) => ({\n`;
    migrateMappings += mapFields;
    migrateMappings += `        raw_data: data\n`;
    migrateMappings += `      })\n    },\n`;
  }
  
  // Add firestoreExport landing table
  schemaContent += `export const firestoreExport = pgTable('firestore_export', {\n`;
  schemaContent += `  id: serial('id').primaryKey(),\n`;
  schemaContent += `  collection_path: text('collection_path').notNull(),\n`;
  schemaContent += `  firestore_id: text('firestore_id').notNull(),\n`;
  schemaContent += `  data: jsonb('data').notNull(),\n`;
  schemaContent += `  migrated_at: timestamp('migrated_at').defaultNow()\n});\n`;

  fs.writeFileSync('schema-auto.ts', schemaContent);
  fs.writeFileSync('mappings-auto.txt', migrateMappings);
  
  console.log('✅ Generated schema-auto.ts and mappings-auto.txt!');
  pool.end();
}

main();
