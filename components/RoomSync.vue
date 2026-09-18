<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useNav } from '@slidev/client'
import {
  ensureRoom,
  fetchRoom,
  initPoll,
  poll,
  publishSlide,
  subscribeRoom,
} from '../lib/poll'

/**
 * Keeps every follower's deck on the presenter's slide.
 *
 * Rendered once per deck (from global-bottom.vue), not once per slide, so the
 * subscription is a single connection for the whole session.
 */
const { currentSlideNo, clicks, go } = useNav()

let unsubscribe = () => {}
/** Set while applying a remote move, so a follower's own nav doesn't echo. */
let applyingRemote = false

onMounted(async () => {
  await initPoll()

  if (poll.isPresenter) {
    await ensureRoom()
    watch(
      [currentSlideNo, clicks],
      ([no, c]) => publishSlide(no, c),
      { immediate: true },
    )
    return
  }

  if (poll.isFollower) {
    const room = await fetchRoom()
    if (room) await apply(room.current_slide, room.current_clicks)
    unsubscribe = subscribeRoom(row => apply(row.current_slide, row.current_clicks))
  }
})

async function apply(slideNo: number, clickCount: number) {
  if (applyingRemote) return
  if (currentSlideNo.value === slideNo && clicks.value === clickCount) return
  applyingRemote = true
  try {
    await go(slideNo, clickCount)
  }
  finally {
    applyingRemote = false
  }
}

onBeforeUnmount(() => unsubscribe())
</script>

<template>
  <!-- A follower can still swipe; this says the deck will snap back. -->
  <div v-if="poll.isFollower" class="following">following the presenter</div>
</template>

<style scoped>
.following {
  position: fixed;
  left: 50%;
  bottom: 0.4rem;
  transform: translateX(-50%);
  z-index: 100;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: rgba(11, 11, 11, 0.55);
  color: #fff;
  font: 500 0.65rem/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
  letter-spacing: 0.03em;
  pointer-events: none;
}
</style>
