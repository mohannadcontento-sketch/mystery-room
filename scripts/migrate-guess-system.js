// Migration: 
// 1. Add 'guess' system (vote on "whose answer is this?")
// 2. Add real_names_enabled column to rooms
// 3. Add score column to profiles (total correct guesses)
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

  // 1. Create answer_guesses table — "whose answer is this?" guesses
  console.log('1. Creating answer_guesses table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS answer_guesses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      answer_id UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
      guesser_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      guessed_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      is_correct BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(answer_id, guesser_id)
    )
  `);
  console.log('   ✓ Done');

  // 2. Add score column to profiles (total correct guesses across all rooms)
  console.log('2. Adding score column to profiles...');
  await client.query(`
    ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS total_score INTEGER NOT NULL DEFAULT 0
  `);
  console.log('   ✓ Done');

  // 3. Add real_names_enabled column to rooms (use real usernames instead of anonymous)
  console.log('3. Adding real_names_enabled column to rooms...');
  await client.query(`
    ALTER TABLE rooms 
    ADD COLUMN IF NOT EXISTS real_names_enabled BOOLEAN NOT NULL DEFAULT TRUE
  `);
  console.log('   ✓ Done');

  // 4. Create indexes for performance
  console.log('4. Creating indexes...');
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_answer_guesses_answer ON answer_guesses(answer_id);
    CREATE INDEX IF NOT EXISTS idx_answer_guesses_guesser ON answer_guesses(guesser_id);
    CREATE INDEX IF NOT EXISTS idx_answer_guesses_room ON answer_guesses(room_id);
  `);
  console.log('   ✓ Done');

  // 5. Verify
  console.log('\n5. Verifying tables:');
  const tables = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `);
  for (const t of tables.rows) {
    console.log(`   - ${t.tablename}`);
  }

  console.log('\n6. profiles columns:');
  const cols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'profiles' ORDER BY ordinal_position
  `);
  for (const c of cols.rows) {
    console.log(`   - ${c.column_name} (${c.data_type})`);
  }

  console.log('\n7. rooms columns:');
  const rcols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'rooms' ORDER BY ordinal_position
  `);
  for (const c of rcols.rows) {
    console.log(`   - ${c.column_name} (${c.data_type})`);
  }

  await client.end();
  console.log('\n✅ Migration complete!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
