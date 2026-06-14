/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  // Add your Cloudflare bindings here, e.g.:
  // MY_KV: KVNamespace;
  // MY_D1: D1Database;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  NODE_ENV: string;
}
