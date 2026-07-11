#!/usr/bin/env node
/**
 * set-admin-claim.js
 * ------------------
 * One-time script to grant admin: true custom claim to ds.exampractice@gmail.com.
 * Run this locally with the Firebase service account key BEFORE the first deploy.
 *
 * Usage:
 *   node scripts/set-admin-claim.js
 *
 * Requires firebase-admin installed (already in devDependencies).
 * Reads service account key from the path below — adjust if different.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { fileURLToPath } from 'url'
import path from 'path'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const SERVICE_KEY_PATH = path.join(
  __dirname,
  '../../FlutterApps/door_supervisor_mocks_app_v1/Service_Key/serviceAccountKey.json'
)

const ADMIN_EMAIL = 'ds.exampractice@gmail.com'

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: cert(require(SERVICE_KEY_PATH)) })
  }

  const auth = getAuth()

  let user
  try {
    user = await auth.getUserByEmail(ADMIN_EMAIL)
  } catch {
    console.error(`❌ No Firebase Auth account found for ${ADMIN_EMAIL}`)
    console.error('   Create the account in Firebase Console → Authentication first, then re-run this script.')
    process.exit(1)
  }

  await auth.setCustomUserClaims(user.uid, { admin: true })

  console.log(`✅ admin: true claim set on ${ADMIN_EMAIL} (uid: ${user.uid})`)
  console.log('   The user must sign out and back in for the new claim to take effect.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
