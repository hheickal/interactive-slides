<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { initPoll, poll, roomCode } from '../lib/poll'

onMounted(initPoll)

const joinUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${import.meta.env.BASE_URL}join/`
})
</script>

<template>
  <div class="join">
    <template v-if="poll.isLive">
      <p class="lead">Go to</p>
      <p class="url">{{ joinUrl }}</p>
      <p class="lead">and enter code</p>
      <p class="code">{{ roomCode }}</p>
    </template>

    <p v-else-if="!poll.ready" class="warn">Loading…</p>

    <p v-else-if="!poll.configured" class="warn">
      No poll backend configured — running in solo mode.
      Fill in <code>public/config.json</code> to enable live polls.
    </p>

    <p v-else class="warn">
      Solo mode. Add <code>?room=YOURCODE</code> to the URL to present live.
    </p>
  </div>
</template>

<style scoped>
.join {
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  text-align: center;
}
.lead { color: #898781; font-size: 0.9em; margin: 0.4rem 0; }
.url  { font-size: 1.4em; font-weight: 600; word-break: break-all; }
.code {
  font-size: 3em;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin: 0.2rem 0;
}
.warn { color: #898781; font-size: 0.9em; }
code { font-size: 0.9em; }
</style>
