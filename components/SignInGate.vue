<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { auth, initAuth, signInWithGoogle, signOut } from '../lib/auth'
import { config } from '../lib/client'
import { poll, initPoll } from '../lib/poll'

onMounted(async () => {
  await initPoll()
  await initAuth()
})

/**
 * Only a room needs identity. A deck opened with no room code is either a
 * public practice deck or a signed-in student revising, and neither should be
 * blocked behind a sign-in wall.
 */
const needsAuth = computed(() => poll.ready && poll.isLive && Boolean(config.courseId))

const blocked = computed(() => {
  if (!needsAuth.value || !auth.ready) return null
  if (!auth.user) return 'signin'
  // The presenter owns the course and is not expected on their own roster.
  if (auth.owner) return null
  if (auth.enrolled === false) return 'not-enrolled'
  return null
})
</script>

<template>
  <div v-if="blocked" class="gate">
    <div class="card">
      <template v-if="blocked === 'signin'">
        <h1>Sign in to join</h1>
        <p>This lecture records who answered, so you need to sign in with the
          Google account on your course roster.</p>
        <button class="primary" @click="signInWithGoogle">Continue with Google</button>
        <p v-if="auth.error" class="err">{{ auth.error }}</p>
      </template>

      <template v-else>
        <h1>Not on the roster</h1>
        <p>You are signed in as <strong>{{ auth.email }}</strong>, which is not
          on this course's roster. If that is the wrong account, switch and try
          again — otherwise ask your instructor to add you.</p>
        <button class="secondary" @click="signOut">Use a different account</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.gate {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: #fcfcfb;
  color: #0b0b0b;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme='light'])) .gate { background: #1a1a19; color: #fff; }
}
:root[data-theme='dark'] .gate { background: #1a1a19; color: #fff; }

.card { width: 100%; max-width: 24rem; text-align: center; }
h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.6rem; }
p { color: #898781; font-size: 0.95rem; margin: 0 0 1.25rem; line-height: 1.5; }
.err { color: #d03b3b; margin-top: 0.75rem; }

button {
  width: 100%;
  padding: 0.85rem 1.2rem;
  font: inherit;
  font-weight: 500;
  border-radius: 10px;
  cursor: pointer;
}
.primary { color: #fff; background: #2a78d6; border: 0; }
.secondary { color: inherit; background: transparent; border: 1px solid #898781; }
</style>
