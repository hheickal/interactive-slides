<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useIsSlideActive } from '@slidev/client'
import PollResults from './PollResults.vue'
import { auth } from '../lib/auth'
import { config } from '../lib/client'
import {
  activateQuestion,
  fetchProgress,
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
  /** Record the answer without the student's identity. */
  anonymous?: boolean
}>()

const tallies = ref<Record<string, number>>({})
const reveal = ref(false)
const myAnswer = ref<string | null>(null)
const wasCorrect = ref<boolean | null>(null)
const sending = ref(false)
const errorText = ref('')
let unsubscribe = () => {}

/** True when this deck grades server-side rather than from an inline key. */
const graded = computed(() => Boolean(config.courseId && auth.user))
const hasInlineKey = computed(() => props.options.some(o => o.correct))

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
  await initPoll()

  if (poll.isPresenter) {
    if (!active) {
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

  if (!active || myAnswer.value) return

  // Self-paced: a signed-in student's answers follow them between devices;
  // otherwise fall back to this browser's own storage.
  if (graded.value && !poll.isLive) {
    const progress = await fetchProgress()
    if (progress[props.id]) {
      myAnswer.value = progress[props.id]
      settleSolo(progress[props.id])
    }
    return
  }

  const stored = readSoloAnswer(props.id)
  if (stored) {
    myAnswer.value = stored
    settleSolo(stored)
  }
}, { immediate: true })

/** Solo display: show the learner their own answer against the inline key. */
function settleSolo(answer: string) {
  if (poll.isFollower) return
  tallies.value = { [answer]: 1 }
  reveal.value = hasInlineKey.value
  if (hasInlineKey.value)
    wasCorrect.value = props.options.find(o => o.text === answer)?.correct === true
}

onBeforeUnmount(() => unsubscribe())

async function answer(option: PollOption) {
  if (poll.isPresenter || myAnswer.value || sending.value) return

  errorText.value = ''

  // Graded: the server holds the key, checks the roster, and decides.
  if (graded.value) {
    sending.value = true
    const result = await submitAnswer(props.id, option.text)
    sending.value = false
    if (!result.ok) {
      errorText.value = result.error ?? 'Could not send.'
      return
    }
    myAnswer.value = option.text
    wasCorrect.value = result.isCorrect
    if (!poll.isFollower) {
      tallies.value = { [option.text]: 1 }
      reveal.value = result.isCorrect !== null
    }
    return
  }

  // Ungraded practice deck: inline key, no network, no identity.
  myAnswer.value = option.text
  writeSoloAnswer(props.id, option.text)
  settleSolo(option.text)
}

async function toggleReveal() {
  reveal.value = !reveal.value
  await setReveal(reveal.value)
}
</script>

<template>
  <div class="poll">
    <p class="question">
      {{ question }}
      <span v-if="anonymous" class="badge">anonymous</span>
    </p>

    <p v-if="!poll.ready" class="note">Loading…</p>

    <!-- Presenter: the deck is a scoreboard, not an answer surface. -->
    <template v-else-if="poll.isPresenter">
      <PollResults :options="options" :tallies="tallies" :reveal="reveal" />
      <button class="reveal" @click="toggleReveal">
        {{ reveal ? 'Hide answer' : 'Reveal answer' }}
      </button>
    </template>

    <!-- Follower answered: wait for the presenter to move on. -->
    <template v-else-if="poll.isFollower && myAnswer">
      <p class="picked">{{ myAnswer }}</p>
      <p v-if="wasCorrect === true" class="note good">Correct.</p>
      <p v-else-if="wasCorrect === false" class="note wrong">Not quite.</p>
      <p v-else class="note sent">Answer sent.</p>
    </template>

    <!-- Solo answered: instant feedback, since nobody is coming to reveal it. -->
    <template v-else-if="myAnswer">
      <PollResults
        :options="options"
        :tallies="tallies"
        :reveal="reveal"
        :my-answer="myAnswer"
      />
      <p v-if="wasCorrect === true" class="note good">Correct.</p>
      <p v-else-if="wasCorrect === false" class="note wrong">Not quite.</p>
    </template>

    <!-- Unanswered. -->
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
      <p v-if="errorText" class="note err">{{ errorText }}</p>
    </template>
  </div>
</template>

<style scoped>
.poll {
  --text-muted: #898781;
  --series-1: #2a78d6;
  --status-good: #0ca30c;
  --status-bad: #d03b3b;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme='light'])) .poll { --series-1: #3987e5; }
}
:root[data-theme='dark'] .poll { --series-1: #3987e5; }

.question { font-weight: 600; margin-bottom: 0.75rem; }

.badge {
  margin-left: 0.5rem;
  padding: 0.05em 0.45em;
  border: 1px solid var(--text-muted);
  border-radius: 3px;
  color: var(--text-muted);
  font-size: 0.6em;
  font-weight: 500;
  letter-spacing: 0.03em;
  vertical-align: middle;
}

.note { color: var(--text-muted); font-size: 0.9em; margin-top: 0.6rem; }
.note.sent { color: var(--status-good); }
.note.good { color: var(--status-good); font-weight: 600; }
.note.wrong { color: var(--status-bad); font-weight: 600; }
.note.err { color: var(--status-bad); }

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
