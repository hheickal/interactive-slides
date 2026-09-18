#!/usr/bin/env node
/**
 * Course administration.
 *
 * Uses the SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level Security
 * entirely. It lives in .env, which is gitignored, and must never be committed
 * or shipped to a browser.
 *
 *   npm run admin course:create  CS101 "Intro to Hashing" you@uni.edu
 *   npm run admin roster:sync    roster/cs101.csv
 *   npm run admin polls:sync     keys/lecture-01.json
 *   npm run admin scores:export  scores.csv
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

// Minimal .env reader — one dependency fewer, and the file is three lines.
function loadEnv(path = '.env') {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Copy .env.example to .env and fill both in. See docs/AUTH.md.')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

const configPath = 'public/config.json'
const readConfig = () => JSON.parse(readFileSync(configPath, 'utf8'))

function die(msg) {
  console.error(msg)
  process.exit(1)
}

async function courseId() {
  const id = readConfig().courseId
  if (!id) die(`No courseId in ${configPath}. Run "course:create" first.`)
  return id
}

const [cmd, ...args] = process.argv.slice(2)

const commands = {
  async 'course:create'([code, name, ownerEmail]) {
    if (!code || !ownerEmail)
      die('Usage: course:create <CODE> "<Name>" <owner-email>')

    // The owner must have signed in at least once, so auth.users has them.
    const { data: users, error: uErr } = await db.auth.admin.listUsers()
    if (uErr) die(`Could not list users: ${uErr.message}`)
    const owner = users.users.find(u => u.email?.toLowerCase() === ownerEmail.toLowerCase())
    if (!owner) {
      die(`No user with email ${ownerEmail}. Sign in to the deck once with that `
        + 'Google account, then re-run this.')
    }

    const { data, error } = await db.from('courses')
      .upsert({ code, name: name ?? '', owner: owner.id }, { onConflict: 'owner,code' })
      .select('id')
      .single()
    if (error) die(`Could not create course: ${error.message}`)

    const cfg = readConfig()
    cfg.courseId = data.id
    writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`)

    console.log(`Course ${code} → ${data.id}`)
    console.log(`Wrote courseId into ${configPath}. Commit it.`)
  },

  async 'roster:sync'([path]) {
    if (!path) die('Usage: roster:sync <file.csv>   (columns: email,name)')
    const course = await courseId()

    const rows = readFileSync(path, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/^email\s*,/i.test(l))
      .map((line) => {
        const [email, ...rest] = line.split(',')
        return { course_id: course, email: email.trim(), name: rest.join(',').trim() }
      })
      .filter(r => r.email.includes('@'))

    if (!rows.length) die(`No usable rows in ${path}.`)

    const { error } = await db.from('roster')
      .upsert(rows, { onConflict: 'course_id,email' })
    if (error) die(`Could not sync roster: ${error.message}`)

    console.log(`Roster: ${rows.length} students on course ${course}.`)
    console.log('Note: this adds and updates. It does not remove anyone.')
  },

  async 'polls:sync'([path]) {
    if (!path) die('Usage: polls:sync <keys/file.json>')
    const course = await courseId()
    const keys = JSON.parse(readFileSync(path, 'utf8'))

    const rows = Object.entries(keys).map(([qid, v]) => ({
      course_id: course,
      qid,
      question: v.question ?? '',
      options: v.options ?? [],
      correct_answer: v.correct ?? null,
      anonymous: v.anonymous ?? false,
    }))
    if (!rows.length) die(`No questions in ${path}.`)

    const { error } = await db.from('polls')
      .upsert(rows, { onConflict: 'course_id,qid' })
    if (error) die(`Could not sync polls: ${error.message}`)

    const graded = rows.filter(r => r.correct_answer !== null).length
    console.log(`Polls: ${rows.length} synced (${graded} with an answer key).`)
  },

  async 'scores:export'([out = 'scores.csv']) {
    const course = await courseId()

    const { data: rows, error } = await db
      .from('responses')
      .select('user_id, qid, answer, is_correct, created_at')
      .eq('course_id', course)
      .not('user_id', 'is', null)
    if (error) die(`Could not read responses: ${error.message}`)

    const { data: users } = await db.auth.admin.listUsers()
    const emailOf = new Map((users?.users ?? []).map(u => [u.id, u.email ?? '']))

    const lines = ['email,qid,answer,is_correct,answered_at']
    for (const r of rows ?? []) {
      const cell = s => `"${String(s ?? '').replace(/"/g, '""')}"`
      lines.push([
        cell(emailOf.get(r.user_id)),
        cell(r.qid),
        cell(r.answer),
        r.is_correct === null ? '' : r.is_correct,
        cell(r.created_at),
      ].join(','))
    }
    writeFileSync(out, `${lines.join('\n')}\n`)
    console.log(`Wrote ${rows?.length ?? 0} graded answers to ${out}.`)
    console.log('Anonymous polls are excluded — they carry no student id.')
  },
}

const run = commands[cmd]
if (!run) {
  console.error(`Unknown command: ${cmd ?? '(none)'}`)
  console.error(`Available: ${Object.keys(commands).join(', ')}`)
  process.exit(1)
}
await run(args)
