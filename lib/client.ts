import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { reactive } from 'vue'

export interface AppConfig {
  supabaseUrl?: string
  supabaseAnonKey?: string
  /** The course these slides belong to. Created once — see docs/AUTH.md. */
  courseId?: string
}

export const config = reactive<AppConfig>({})

export const clientState = reactive({
  /** Config has been loaded (or failed) — safe to render. */
  ready: false,
  /** Backend configured at all. */
  configured: false,
})

let client: SupabaseClient | null = null
let initPromise: Promise<void> | null = null

/**
 * Config is fetched rather than compiled in so the deck and the join page read
 * the same file. `BASE_URL` resolves to `/` in dev and to the Pages subpath in
 * production, so one file serves both.
 */
export function initClient(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}config.json`)
      const cfg = await res.json() as AppConfig
      Object.assign(config, cfg)
      if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
        client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            // The OAuth redirect comes back with tokens in the URL fragment.
            detectSessionInUrl: true,
          },
        })
      }
    }
    catch {
      // No config, or malformed. Ungraded solo mode still works fully.
    }
    clientState.configured = Boolean(client)
    clientState.ready = true
  })()

  return initPromise
}

export function db(): SupabaseClient {
  if (!client) throw new Error('Supabase client not initialised')
  return client
}

export function maybeDb(): SupabaseClient | null {
  return client
}
