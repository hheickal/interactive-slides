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
  submitAnswer,
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
const sending = ref(false)
const failed = ref(false)
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

  if (poll.isPresenter) {
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
    return
  }

  // Follower and solo both answer in the deck; only the storage differs.
  myAnswer.value = readSoloAnswer(props.id)
  if (myAnswer.value && !poll.isFollower) {
    tallies.value = { [myAnswer.value]: 1 }
    reveal.value = true
  }
}, { immediate: true })

onBeforeUnmount(() => unsubscribe())

async function answer(option: PollOption) {
  if (poll.isPresenter || myAnswer.value || sending.value) return

  if (poll.isFollower) {
    sending.value = true
    failed.value = false
    const ok = await submitAnswer(props.id, option.text)
    sending.value = false
    if (!ok) {
      failed.value = true
      return
    }
    myAnswer.value = option.text
    writeSoloAnswer(props.id, option.text)
    return
  }

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

    <p v-if="!poll.ready" class="note">Loading…</p>

    <!-- Presenter: the deck is a scoreboard, not an answer surface. -->
    <template v-else-if="poll.isPresenter">
      <PollResults
        :options="options"
        :tallies="tallies"
        :reveal="reveal"
      />
      <button class="reveal" @click="toggleReveal">
        {{ reveal ? 'Hide answer' : 'Reveal answer' }}
      </button>
    </template>

    <!-- Follower answered: wait for the presenter to move on. -->
    <template v-else-if="poll.isFollower && myAnswer">
      <p class="picked">{{ myAnswer }}</p>
      <p class="note sent">Answer sent.</p>
    </template>

    <!-- Solo answered: instant feedback, since nobody is coming to reveal it. -->
    <template v-else-if="myAnswer">
      <PollResults
        :options="options"
        :tallies="tallies"
        :reveal="reveal"
        :my-answer="myAnswer"
      />
    </template>

    <!-- Unanswered, either mode. -->
    <template v-else>
      <div class="choices">
        <button
          v-for="o in options"
          :key="o.text"
          class="choice"
          :disabled="sending"
          @click="answer(o)"
        >
          {{ o.text }}
        </button>
      </div>
      <p v-if="sending" class="note">Sending…</p>
      <p v-if="failed" class="note err">Could not send — check your connection and tap again.</p>
    </template>
  </div>
</template>

<style scoped>
.poll {
  --text-muted: #898781;
  --series-1: #2a78d6;
  --status-good: #0ca30c;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme='light'])) .poll { --series-1: #3987e5; }
}
:root[data-theme='dark'] .poll { --series-1: #3987e5; }

.question { font-weight: 600; margin-bottom: 0.75rem; }
.note { color: var(--text-muted); font-size: 0.9em; }
.note.sent { color: var(--status-good); }
.note.err { color: #d03b3b; }

.picked {
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--series-1);
  border-radius: 6px;
  color: var(--series-1);
  font-weight: 600;
}

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
.choice:hover:not([disabled]) { border-color: var(--series-1); color: var(--series-1); }
.choice[disabled] { opacity: 0.5; cursor: default; }

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
