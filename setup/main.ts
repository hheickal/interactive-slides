import { defineAppSetup } from '@slidev/types'
import { ensureRoom } from '../lib/poll'

export default defineAppSetup(() => {
  // Opening the deck with ?room=CODE opens the room, so students who join
  // before the first question see "waiting" rather than "no such room".
  ensureRoom()
})
