import { reactive } from 'vue'
import { config, db, initClient, maybeDb } from './client'
import { auth, initAuth } from './auth'

export interface PollOption {
  text: string
  /**
   * Inline answer key. Present only on ungraded practice decks — anything
   * inline is visible in the page source. Graded decks leave it out and the
   * key lives server-side; see docs/AUTH.md.
   */
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
 *   (no room)              solo      — self-paced
 */
export const roomCode = params.get('room')
const wantsFollow = params.get('follow') === '1'

export const poll = reactive({
  ready: false,
  configured: false,
  isPresenter: false,
  isFollower: false,
  isLive: false,
})

let initPromise: Promise<void> | null = null

export function initPoll(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    await initClient()
    await initAuth()
    poll.configured = Boolean(maybeDb())
    poll.isLive = Boolean(maybeDb() && roomCode)
    poll.isFollower = poll.isLive && wantsFollow
    poll.isPresenter = poll.isLive && !wantsFollow
    poll.ready = true
  })()
  return initPromise
}

/** Anonymous per-browser id, still used for ungraded decks with no sign-in. */
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

/** Presenter: open the room, owned by you and bound to your course. */
export async function ensureRoom() {
  await initPoll()
  if (!poll.isPresenter || !auth.user) return
  await db().from('rooms').upsert(
    {
      code: roomCode,
      course_id: config.courseId,
      owner: auth.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'code', ignoreDuplicates: false },
  )
}

export async function publishSlide(slideNo: number, clicks: number) {
  if (!poll.isPresenter || !auth.user) return
  await db().from('rooms').update({
    current_slide: slideNo,
    current_clicks: clicks,
    updated_at: new Date().toISOString(),
  }).eq('code', roomCode)
}

export async function activateQuestion(qid: string, question: string, options: PollOption[]) {
  await initPoll()
  if (!poll.isPresenter || !auth.user) return
  await db().from('rooms').update({
    active_question: { qid, question, options: options.map(o => o.text) },
    reveal: false,
    updated_at: new Date().toISOString(),
  }).eq('code', roomCode)
}

export async function setReveal(reveal: boolean) {
  if (!poll.isPresenter) return
  await db().from('rooms').update({ reveal }).eq('code', roomCode)
}

export async function fetchRoom(): Promise<RoomRow | null> {
  if (!poll.isLive) return null
  const { data } = await db()
    .from('rooms')
    .select('code, active_question, reveal, current_slide, current_clicks')
    .eq('code', roomCode)
    .maybeSingle()
  return (data as RoomRow) ?? null
}

export function subscribeRoom(onChange: (row: RoomRow) => void) {
  if (!poll.isLive) return () => {}
  const channel = db()
    .channel(`room:${roomCode}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
      payload => onChange(payload.new as RoomRow),
    )
    .subscribe()
  return () => { maybeDb()?.removeChannel(channel) }
}

export interface SubmitResult {
  ok: boolean
  /** null when the question has no key — an opinion poll or confidence check. */
  isCorrect: boolean | null
  error?: string
}

/**
 * Cast a vote.
 *
 * Goes through `submit_answer`, which checks the roster, records the answer,
 * grades it against a key the browser never sees, and drops the student's id
 * for anonymous polls. There is no insert policy on `responses`, so this
 * function is the only way in.
 */
export async function submitAnswer(qid: string, answer: string): Promise<SubmitResult> {
  await initPoll()

  if (!config.courseId || !auth.user) {
    // Ungraded deck, or nobody signed in: nothing server-side to talk to.
    return { ok: false, isCorrect: null, error: 'not signed in' }
  }

  const { data, error } = await db().rpc('submit_answer', {
    p_course: config.courseId,
    p_room: roomCode,
    p_qid: qid,
    p_answer: answer,
  })

  if (error) {
    const notEnrolled = error.code === '42501' || /roster/i.test(error.message)
    return {
      ok: false,
      isCorrect: null,
      error: notEnrolled
        ? 'You are not on the roster for this course.'
        : 'Could not send — check your connection and tap again.',
    }
  }

  const row = data as { is_correct: boolean | null, duplicate?: boolean }
  return { ok: true, isCorrect: row?.is_correct ?? null }
}

export async function fetchTallies(qid: string): Promise<Record<string, number>> {
  if (!poll.isLive) return {}
  const { data } = await db()
    .from('responses')
    .select('answer')
    .eq('room', roomCode)
    .eq('qid', qid)

  const tallies: Record<string, number> = {}
  for (const row of data ?? [])
    tallies[row.answer] = (tallies[row.answer] ?? 0) + 1
  return tallies
}

/** Presenter-only live tally feed. */
export function subscribeTallies(qid: string, onChange: () => void) {
  if (!poll.isPresenter) return () => {}
  const channel = db()
    .channel(`tally:${roomCode}:${qid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'responses', filter: `room=eq.${roomCode}` },
      payload => {
        if ((payload.new as { qid?: string }).qid === qid) onChange()
      },
    )
    .subscribe()
  return () => { maybeDb()?.removeChannel(channel) }
}

/** Self-paced answers, restored across devices for a signed-in student. */
export async function fetchProgress(): Promise<Record<string, string>> {
  if (!config.courseId || !auth.user) return {}
  const { data } = await db()
    .from('progress')
    .select('qid, answer')
    .eq('course_id', config.courseId)
    .eq('user_id', auth.user.id)

  const out: Record<string, string> = {}
  for (const row of data ?? []) out[row.qid] = row.answer
  return out
}

/** Fallback for decks with no backend: answers live in this browser only. */
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
