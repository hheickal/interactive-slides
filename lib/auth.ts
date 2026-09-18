import type { User } from '@supabase/supabase-js'
import { reactive } from 'vue'
import { config, initClient, maybeDb } from './client'

export const auth = reactive({
  /** Session has been resolved — before this, we do not know either way. */
  ready: false,
  user: null as User | null,
  email: '' as string,
  name: '' as string,
  /** On the roster for this deck's course. Null until checked. */
  enrolled: null as boolean | null,
  /** Owns the course — the presenter. */
  owner: false,
  error: '' as string,
})

let initPromise: Promise<void> | null = null

export function initAuth(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    await initClient()
    const sb = maybeDb()
    if (!sb) {
      auth.ready = true
      return
    }

    const { data } = await sb.auth.getSession()
    await apply(data.session?.user ?? null)

    sb.auth.onAuthStateChange((_event, session) => {
      void apply(session?.user ?? null)
    })

    auth.ready = true
  })()

  return initPromise
}

async function apply(user: User | null) {
  auth.user = user
  auth.email = user?.email ?? ''
  auth.name = (user?.user_metadata?.full_name as string) ?? user?.email ?? ''

  if (!user || !config.courseId) {
    auth.enrolled = user ? false : null
    auth.owner = false
    return
  }

  const sb = maybeDb()!

  // Two independent questions: is this person on the roster, and do they own
  // the course? The presenter is normally not on their own roster.
  const [enrolment, ownership] = await Promise.all([
    sb.rpc('is_enrolled', { p_course: config.courseId }),
    sb.rpc('owns_course', { p_course: config.courseId }),
  ])

  auth.enrolled = enrolment.data === true
  auth.owner = ownership.data === true
}

export async function signInWithGoogle() {
  await initClient()
  const sb = maybeDb()
  if (!sb) return
  auth.error = ''
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Come back to exactly this deck, room code and follow flag intact.
      redirectTo: window.location.href,
    },
  })
  if (error) auth.error = error.message
}

export async function signOut() {
  const sb = maybeDb()
  if (!sb) return
  await sb.auth.signOut()
}
