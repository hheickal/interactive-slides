// Poll backend config. Edit these two values, then commit.
//
// The anon key is PUBLIC BY DESIGN — Supabase ships it in every browser bundle.
// It is not a secret and committing it here is normal practice. The real
// security boundary is Row Level Security, defined in supabase/schema.sql.
//
// NEVER put the `service_role` key here. That one is a real secret.
window.__POLL_CONFIG__ = {
  supabaseUrl: '',
  supabaseAnonKey: '',
}
