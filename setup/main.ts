import { defineAppSetup } from '@slidev/types'
import { initPoll } from '../lib/poll'

export default defineAppSetup(() => {
  // Start loading config and resolving the session immediately; every
  // component that needs either awaits the same promise.
  initPoll()
})
