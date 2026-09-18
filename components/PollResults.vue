<script setup lang="ts">
import { computed } from 'vue'
import type { PollOption } from '../lib/poll'

const props = defineProps<{
  options: PollOption[]
  tallies: Record<string, number>
  /** Show which option was right. */
  reveal?: boolean
  /** Solo mode: the one answer this learner picked. */
  myAnswer?: string | null
}>()

const total = computed(() =>
  Object.values(props.tallies).reduce((a, b) => a + b, 0))

const rows = computed(() => props.options.map((o) => {
  const count = props.tallies[o.text] ?? 0
  return {
    ...o,
    count,
    share: total.value ? count / total.value : 0,
    mine: props.myAnswer === o.text,
  }
}))
</script>

<template>
  <!--
    Single series (one count per option), so no legend — the question names it.
    Correct answers carry a check icon AND the word "correct", never hue alone.
  -->
  <div class="poll-results">
    <div v-for="row in rows" :key="row.text" class="row">
      <div class="label">
        <span class="text">{{ row.text }}</span>
        <span v-if="reveal && row.correct" class="tag tag-correct">✓ correct</span>
        <span v-if="row.mine" class="tag tag-mine">your answer</span>
      </div>

      <div class="track">
        <div
          class="bar"
          :class="{ 'is-correct': reveal && row.correct }"
          :style="{ width: `${Math.round(row.share * 100)}%` }"
          :title="`${row.count} of ${total}`"
        />
      </div>

      <div class="value">
        {{ row.count }}<span class="pct">{{ Math.round(row.share * 100) }}%</span>
      </div>
    </div>

    <p class="total">{{ total }} {{ total === 1 ? 'response' : 'responses' }}</p>
  </div>
</template>

<style scoped>
.poll-results {
  --text-primary: #0b0b0b;
  --text-muted: #898781;
  --track: #e1e0d9;
  --series-1: #2a78d6;
  --status-good: #0ca30c;

  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  margin-top: 0.75rem;
}

@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme='light'])) .poll-results {
    --text-primary: #ffffff;
    --text-muted: #898781;
    --track: #2c2c2a;
    --series-1: #3987e5;
  }
}
:root[data-theme='dark'] .poll-results {
  --text-primary: #ffffff;
  --text-muted: #898781;
  --track: #2c2c2a;
  --series-1: #3987e5;
}

/* 2px of surface between adjacent bars keeps them from reading as one mass. */
.row + .row { margin-top: 0.7rem; }

.label {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  color: var(--text-primary);
  font-size: 0.95em;
  margin-bottom: 0.25rem;
}

.tag {
  font-size: 0.72em;
  letter-spacing: 0.02em;
  padding: 0.05em 0.45em;
  border-radius: 3px;
  white-space: nowrap;
}
.tag-correct { color: var(--status-good); border: 1px solid currentColor; }
.tag-mine    { color: var(--text-muted);  border: 1px solid currentColor; }

.track {
  position: relative;
  height: 10px;
  border-radius: 2px;
  background: var(--track);
}

/* Anchored to the baseline; only the data end is rounded. */
.bar {
  height: 100%;
  min-width: 0;
  border-radius: 0 4px 4px 0;
  background: var(--series-1);
  transition: width 260ms ease-out;
}
.bar.is-correct { background: var(--status-good); }

.value {
  margin-top: 0.2rem;
  color: var(--text-muted);
  font-size: 0.8em;
  font-variant-numeric: tabular-nums;
}
.pct::before { content: ' · '; }

.total {
  margin-top: 1rem;
  color: var(--text-muted);
  font-size: 0.8em;
}
</style>
