// Poll backend config.
//
// The anon key is PUBLIC BY DESIGN — Supabase ships it in every browser bundle.
// It is not a secret and committing it here is normal practice. The real
// security boundary is Row Level Security, defined in supabase/schema.sql.
//
// NEVER put the `service_role` key here. That one is a real secret.
window.__POLL_CONFIG__ = {
  supabaseUrl: 'https://gwqjyzycfqgnxqmmgpyx.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3cWp5enljZnFnbnhxbW1ncHl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3Mzg5OTksImV4cCI6MjEwNTMxNDk5OX0.RQqQAivGClSzEKXLJpVskBBTwDqQHG2ggjMsSbNkz1M',
}
