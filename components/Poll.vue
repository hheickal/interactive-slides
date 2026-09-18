<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useIsSlideActive } from '@slidev/client'
import PollResults from './PollResults.vue'
import {
  activateQuestion,
  fetchTallies,
  initPoll,
  poll,
  readSoloAnswer,
  setReveal,
  subscribeTallies,
  writeSoloAnswer,
  type PollOption,
} from '../lib/poll'

const props = defineProps<{
  id: string
  question: string
  options: PollOption[]
}>()

const tallies = ref<Record<string, number>>({})
const reveal = ref(false)
const myAnswer = ref<string | null>(null)
let unsubscribe = () => {}

async function refresh() {
  tallies.value = await fetchTallies(props.id)
}

/**
 * Slidev mounts neighbouring slides ahead of time, so `onMounted` fires while
 * you are still slides away — every poll in the deck would race to publish
 * itself and the last one to mount would win. Publish on slide ENTER instead,
 * which is the moment the question is actually on screen.
 */
const isActive = useIsSlideActive()

watch(isActive, async (active) => {
  // Config arrives over the network, so mode is unknown for the first tick.
  await initPoll()

  if (!poll.isLive) {
    myAnswer.value = readSoloAnswer(props.id)
    if (myAnswer.value) {
      tallies.value = { [myAnswer.value]: 1 }
      reveal.value = true
    }
    return
  }

  if (!active) {
    // Leaving the slide: stop listening, but leave the question up on the
    // phones — students answering slightly late should still get through.
    unsubscribe()
    unsubscribe = () => {}
    return
  }

  reveal.value = false
  await activateQuestion(props.id, props.question, props.options)
  await refresh()
  unsubscribe = subscribeTallies(props.id, refresh)
}, { immediate: true })

onBeforeUnmount(() => unsubscribe())

/** Solo mode only — in live mode the presenter's deck is not an answer surface. */
function answer(option: PollOption) {
  if (poll.isLive || myAnswer.value) return
  myAnswer.value = option.text
  writeSoloAnswer(props.id, option.text)
  tallies.value = { [option.text]: 1 }
  reveal.value = true
}

async function toggleReveal() {
  reveal.value = !reveal.value
  await setReveal(reveal.value)
}
</script>

<template>
  <div class="poll">
    <p class="question">{{ question }}</p>

    <p v-if="!poll.ready" class="pending">Loading…</p>

    <!-- Solo: the deck itself is the answer surface. -->
    <div v-else-if="!poll.isLive && !myAnswer" class="choices">
      <button
        v-for="o in options"
        :key="o.text"
        class="choice"
        @click="answer(o)"
      >
        {{ o.text }}
      </button>
    </div>

    <!-- Live: students answer on their phones; the deck only shows the tally. -->
    <template v-else>
      <PollResults
        :options="options"
        :tallies="tallies"
        :reveal="reveal"
        :my-answer="myAnswer"
      />
      <button v-if="poll.isLive" class="reveal" @click="toggleReveal">
        {{ reveal ? 'Hide answer' : 'Reveal answer' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.poll {
  --text-muted: #898781;
  --series-1: #2a78d6;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme='light'])) .poll { --series-1: #3987e5; }
}
:root[data-theme='dark'] .poll { --series-1: #3987e5; }

.question { font-weight: 600; margin-bottom: 0.75rem; }
.pending { color: var(--text-muted); font-size: 0.9em; }

.choices { display: flex; flex-direction: column; gap: 0.5rem; }

.choice {
  text-align: left;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--text-muted);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: border-color 120ms, color 120ms;
}
.choice:hover { border-color: var(--series-1); color: var(--series-1); }

.reveal {
  margin-top: 0.9rem;
  padding: 0.35rem 0.8rem;
  font-size: 0.8em;
  border: 1px solid var(--text-muted);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.reveal:hover { color: var(--series-1); border-color: var(--series-1); }
</style>
