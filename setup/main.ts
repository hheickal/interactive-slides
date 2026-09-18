import { defineAppSetup } from '@slidev/types'
import { initPoll } from '../lib/poll'

export default defineAppSetup(() => {
  // Start loading config immediately; RoomSync and Poll both await it.
  initPoll()
})
