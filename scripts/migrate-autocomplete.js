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

  // 1. Create autocomplete_rounds table
  console.log('1. Creating autocomplete_rounds table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS autocomplete_rounds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL DEFAULT 1,
      phrase TEXT NOT NULL,
      language TEXT DEFAULT 'ar',
      time_limit INTEGER DEFAULT 30,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('   ✓ Done');

  // 2. Create autocomplete_answers table
  console.log('2. Creating autocomplete_answers table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS autocomplete_answers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      round_id UUID NOT NULL REFERENCES autocomplete_rounds(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      answer_text TEXT NOT NULL,
      used_voice BOOLEAN DEFAULT FALSE,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      response_time_ms INTEGER,
      UNIQUE(round_id, user_id)
    )
  `);
  console.log('   ✓ Done');

  // 3. Verify
  console.log('\n3. Tables:');
  const res = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `);
  for (const r of res.rows) console.log(`   - ${r.tablename}`);

  await client.end();
  console.log('\n✅ Migration complete!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
