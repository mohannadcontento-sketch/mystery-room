// Migration: rebuild autocomplete tables for category game (letter + ولد/بنت/حيوان/بلاد/نبات)
const { Client } = require('/home/z/my-project/node_modules/pg');

async function run() {
  const client = new Client({
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.debbnyecyepqvltzpasr',
    password: 'qoqouo!191979',
    database: 'postgres',
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('✅ Connected\n');

  // Drop old tables and recreate
  console.log('1. Dropping old autocomplete tables...');
  await client.query('DROP TABLE IF EXISTS autocomplete_answers CASCADE');
  await client.query('DROP TABLE IF EXISTS autocomplete_rounds CASCADE');
  console.log('   ✓ Done');

  // Create autocomplete_rounds — stores the letter for each round
  console.log('2. Creating autocomplete_rounds (letter-based)...');
  await client.query(`
    CREATE TABLE autocomplete_rounds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL DEFAULT 1,
      letter TEXT NOT NULL,
      time_limit INTEGER DEFAULT 60,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('   ✓ Done');

  // Create autocomplete_answers — stores all 5 categories per player per round
  console.log('3. Creating autocomplete_answers (5 categories)...');
  await client.query(`
    CREATE TABLE autocomplete_answers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      round_id UUID NOT NULL REFERENCES autocomplete_rounds(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      boy_name TEXT DEFAULT '',
      girl_name TEXT DEFAULT '',
      animal TEXT DEFAULT '',
      country TEXT DEFAULT '',
      plant TEXT DEFAULT '',
      used_voice BOOLEAN DEFAULT FALSE,
      response_time_ms INTEGER,
      score INTEGER DEFAULT 0,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      corrected BOOLEAN DEFAULT FALSE,
      UNIQUE(round_id, user_id)
    )
  `);
  console.log('   ✓ Done');

  console.log('\n✅ Migration complete!');
  await client.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
