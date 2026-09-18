import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface PollOption {
  text: string
  correct?: boolean
}

declare global {
  interface Window {
    __POLL_CONFIG__?: { supabaseUrl?: string, supabaseAnonKey?: string }
  }
}

const cfg = (typeof window !== 'undefined' && window.__POLL_CONFIG__) || {}

export const supabase: SupabaseClient | null
  = cfg.supabaseUrl && cfg.supabaseAnonKey
    ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
    : null

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

export const isLive = Boolean(supabase && roomCode)

/**
 * Open the room as soon as the deck loads.
 *
 * Students join before the first poll slide is ever shown, so the room row has
 * to exist from the moment you open the deck — not from the moment you reach a
 * question. `ignoreDuplicates` keeps this from wiping an active question if the
 * deck is reloaded mid-lecture.
 */
export async function ensureRoom() {
  if (!isLive) return
  await supabase!.from('rooms').upsert(
    { code: roomCode, updated_at: new Date().toISOString() },
    { onConflict: 'code', ignoreDuplicates: true },
  )
}

/** Tell the join page which question is on screen right now. */
export async function activateQuestion(qid: string, question: string, options: PollOption[]) {
  if (!isLive) return
  await supabase!.from('rooms').upsert({
    code: roomCode,
    active_question: { qid, question, options: options.map(o => o.text) },
    reveal: false,
    updated_at: new Date().toISOString(),
  })
}

export async function setReveal(reveal: boolean) {
  if (!isLive) return
  await supabase!.from('rooms').update({ reveal }).eq('code', roomCode)
}

export async function fetchTallies(qid: string): Promise<Record<string, number>> {
  if (!isLive) return {}
  const { data } = await supabase!
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
 * Only the presenter ever opens a realtime connection — students POST once and
 * close. So a 100-student lecture uses exactly ONE concurrent connection, which
 * is why the free tier is nowhere near a constraint.
 */
export function subscribeTallies(qid: string, onChange: () => void) {
  if (!isLive) return () => {}
  const channel = supabase!
    .channel(`tally:${roomCode}:${qid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'responses', filter: `room=eq.${roomCode}` },
      payload => {
        if ((payload.new as { qid?: string }).qid === qid) onChange()
      },
    )
    .subscribe()
  return () => { supabase!.removeChannel(channel) }
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
