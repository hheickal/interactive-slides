import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { reactive } from 'vue'

export interface PollOption {
  text: string
  correct?: boolean
}

/**
 * The deck runs in one of two modes, decided by the URL:
 *
 *   ?room=CS101   live — you are presenting; students answer at /join/
 *   (no param)    solo — a learner working alone; answers stay in localStorage
 */
export const roomCode: string | null
  = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('room')
    : null

/** Reactive because config arrives over the network, after first render. */
export const poll = reactive({
  /** Config has been loaded (or failed) — safe to render. */
  ready: false,
  /** Backend configured AND a room code present. */
  isLive: false,
  /** Backend configured at all — distinguishes "no backend" from "no room". */
  configured: false,
})

let client: SupabaseClient | null = null
let initPromise: Promise<void> | null = null

/**
 * Load config and open the Supabase client.
 *
 * Config is fetched rather than compiled in so that the deck and the plain-HTML
 * join page read the same file. `BASE_URL` resolves to `/` in dev and to the
 * Pages subpath in production, so this works in both without a second config.
 */
export function initPoll(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}config.json`)
      const cfg = await res.json()
      if (cfg.supabaseUrl && cfg.supabaseAnonKey)
        client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
    }
    catch {
      // No config, or it is malformed. Solo mode still works fully.
    }
    poll.configured = Boolean(client)
    poll.isLive = Boolean(client && roomCode)
    poll.ready = true
  })()

  return initPromise
}

/**
 * Open the room as soon as the deck loads.
 *
 * Students join before the first poll slide is ever shown, so the room row has
 * to exist from the moment you open the deck — not from the moment you reach a
 * question. `ignoreDuplicates` keeps this from wiping an active question if the
 * deck is reloaded mid-lecture.
 */
export async function ensureRoom() {
  await initPoll()
  if (!poll.isLive) return
  await client!.from('rooms').upsert(
    { code: roomCode, updated_at: new Date().toISOString() },
    { onConflict: 'code', ignoreDuplicates: true },
  )
}

/** Tell the join page which question is on screen right now. */
export async function activateQuestion(qid: string, question: string, options: PollOption[]) {
  await initPoll()
  if (!poll.isLive) return
  await client!.from('rooms').upsert({
    code: roomCode,
    active_question: { qid, question, options: options.map(o => o.text) },
    reveal: false,
    updated_at: new Date().toISOString(),
  })
}

export async function setReveal(reveal: boolean) {
  if (!poll.isLive) return
  await client!.from('rooms').update({ reveal }).eq('code', roomCode)
}

export async function fetchTallies(qid: string): Promise<Record<string, number>> {
  if (!poll.isLive) return {}
  const { data } = await client!
    .from('responses')
    .select('answer')
    .eq('room', roomCode)
    .eq('qid', qid)

  const tallies: Record<string, number> = {}
  for (const row of data ?? [])
    tallies[row.answer] = (tallies[row.answer] ?? 0) + 1
  return tallies
}

/**
 * Live tally feed for one question.
 *
 * At 100 students this is ~101 concurrent connections, inside Supabase's
 * 200-connection free tier. See docs/SETUP.md § Scaling for what to do above
 * roughly 180.
 */
export function subscribeTallies(qid: string, onChange: () => void) {
  if (!poll.isLive) return () => {}
  const channel = client!
    .channel(`tally:${roomCode}:${qid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'responses', filter: `room=eq.${roomCode}` },
      payload => {
        if ((payload.new as { qid?: string }).qid === qid) onChange()
      },
    )
    .subscribe()
  return () => { client!.removeChannel(channel) }
}

/** Solo mode: the learner's own answers, per browser. */
const SOLO_KEY = 'interactive-slides:solo'

export function readSoloAnswer(qid: string): string | null {
  try {
    return JSON.parse(localStorage.getItem(SOLO_KEY) || '{}')[qid] ?? null
  }
  catch {
    return null
  }
}

export function writeSoloAnswer(qid: string, answer: string) {
  try {
    const all = JSON.parse(localStorage.getItem(SOLO_KEY) || '{}')
    all[qid] = answer
    localStorage.setItem(SOLO_KEY, JSON.stringify(all))
  }
  catch {
    // private mode or blocked storage — the answer just won't survive a reload
  }
}
