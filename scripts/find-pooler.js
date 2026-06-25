// Quick script to find which Supabase pooler region hosts our project
const { Client } = require('pg');

const projectRef = 'gfahkbafxrngwztvbnsq';
const password = 'qoqouo!191979';

const regions = [
  'aws-0-eu-central-1.pooler.supabase.com',
  'aws-0-us-east-1.pooler.supabase.com',
  'aws-0-eu-west-1.pooler.supabase.com',
  'aws-0-ap-southeast-1.pooler.supabase.com',
  'aws-0-ap-northeast-1.pooler.supabase.com',
  'aws-0-us-west-1.pooler.supabase.com',
  'aws-0-us-west-2.pooler.supabase.com',
  'aws-0-ca-central-1.pooler.supabase.com',
  'aws-0-sa-east-1.pooler.supabase.com',
  'aws-0-ap-south-1.pooler.supabase.com',
  'aws-0-ap-east-1.pooler.supabase.com',
  'aws-0-eu-north-1.pooler.supabase.com',
  'aws-0-eu-west-2.pooler.supabase.com',
  'aws-0-eu-west-3.pooler.supabase.com',
  'aws-0-ap-northeast-2.pooler.supabase.com',
  'aws-0-ap-northeast-3.pooler.supabase.com',
];

async function tryConnect(host, port, user) {
  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const res = await client.query('SELECT version()');
    console.log(`✅ ${host}:${port} user=${user} -> ${res.rows[0].version.substring(0, 50)}`);
    await client.end();
    return true;
  } catch (e) {
    console.log(`❌ ${host}:${port} user=${user} -> ${e.message.substring(0, 100)}`);
    try { await client.end(); } catch {}
    return false;
  }
}

async function main() {
  // Try each region with the pooler
  for (const region of regions) {
    // Use the CNAME if direct doesn't work
    const host = region;
    const ok = await tryConnect(host, 5432, `postgres.${projectRef}`);
    if (ok) {
      console.log(`\n🎉 Found pooler: ${host}`);
      process.exit(0);
    }
  }
  console.log('\n❌ No pooler region worked. Try checking Supabase dashboard.');
}

main();
