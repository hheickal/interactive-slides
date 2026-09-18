import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { reactive } from 'vue'

export interface PollOption {
  text: string
  correct?: boolean
}

export interface RoomRow {
  code: string
  active_question: { qid: string, question: string, options: string[] } | null
  reveal: boolean
  current_slide: number
  current_clicks: number
}

const params = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams()

/**
 * The deck runs in one of three modes, decided by the URL:
 *
 *   ?room=CS101            presenter — you drive; the room mirrors your slide
 *   ?room=CS101&follow=1   follower  — a student's phone; follows your slide
 *                                      and answers polls inline
 *   (no room)              solo      — self-paced; answers stay in localStorage
 */
export const roomCode = params.get('room')
const wantsFollow = params.get('follow') === '1'

export const poll = reactive({
  /** Config has been loaded (or failed) — safe to render. */
  ready: false,
  /** Backend configured at all — distinguishes "no backend" from "no room". */
  configured: false,
  /** In a room, driving it. */
  isPresenter: false,
  /** In a room, mirroring it. */
  isFollower: false,
  /** In a room at all. */
  isLive: false,
})

let client: SupabaseClient | null = null
let initPromise: Promise<void> | null = null

/** Anonymous per-browser id — enforces one vote per question, not an identity. */
export function clientId(): string {
  try {
    let id = localStorage.getItem('poll:client')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('poll:client', id)
    }
    return id
  }
  catch {
    return 'anon-' + Math.random().toString(36).slice(2)
  }
}

/**
 * Load config and open the Supabase client.
 *
 * Config is fetched rather than compiled in so that the deck and the join page
 * read the same file. `BASE_URL` resolves to `/` in dev and to the Pages
 * subpath in production, so this works in both without a second config.
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
    poll.isFollower = poll.isLive && wantsFollow
    poll.isPresenter = poll.isLive && !wantsFollow
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
  if (!poll.isPresenter) return
  await client!.from('rooms').upsert(
    { code: roomCode, updated_at: new Date().toISOString() },
    { onConflict: 'code', ignoreDuplicates: true },
  )
}

/** Presenter: mirror the slide you are on into the room. */
export async function publishSlide(slideNo: number, clicks: number) {
  if (!poll.isPresenter) return
  await client!.from('rooms').upsert({
    code: roomCode,
    current_slide: slideNo,
    current_clicks: clicks,
    updated_at: new Date().toISOString(),
  })
}

/** Tell followers which question is on screen right now. */
export async function activateQuestion(qid: string, question: string, options: PollOption[]) {
  await initPoll()
  if (!poll.isPresenter) return
  await client!.from('rooms').upsert({
    code: roomCode,
    active_question: { qid, question, options: options.map(o => o.text) },
    reveal: false,
    updated_at: new Date().toISOString(),
  })
}

export async function setReveal(reveal: boolean) {
  if (!poll.isPresenter) return
  await client!.from('rooms').update({ reveal }).eq('code', roomCode)
}

export async function fetchRoom(): Promise<RoomRow | null> {
  if (!poll.isLive) return null
  const { data } = await client!
    .from('rooms')
    .select('code, active_question, reveal, current_slide, current_clicks')
    .eq('code', roomCode)
    .maybeSingle()
  return (data as RoomRow) ?? null
}

/** Follower: watch the room row for slide moves and reveals. */
export function subscribeRoom(onChange: (row: RoomRow) => void) {
  if (!poll.isLive) return () => {}
  const channel = client!
    .channel(`room:${roomCode}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
      payload => onChange(payload.new as RoomRow),
    )
    .subscribe()
  return () => { client!.removeChannel(channel) }
}

/** Follower: cast a vote. Returns false only on a real failure. */
export async function submitAnswer(qid: string, answer: string): Promise<boolean> {
  if (!poll.isLive) return false
  const { error } = await client!
    .from('responses')
    .insert({ room: roomCode, qid, answer, client_id: clientId() })
  // 23505 = this browser already voted. Not something the student needs to see.
  return !error || error.code === '23505'
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
 * Live tally feed for one question — presenter only.
 *
 * Followers already hold one room subscription each, so a class of 100 sits at
 * ~101 concurrent connections, inside Supabase's 200-connection free tier. See
 * docs/SETUP.md § Scaling for what to do above roughly 180.
 */
export function subscribeTallies(qid: string, onChange: () => void) {
  if (!poll.isPresenter) return () => {}
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
