import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dataDir = join(root, 'data')
const libraryFile = join(dataDir, 'library.json')
const detailsDir = join(dataDir, 'details')
const backupDir = join(dataDir, 'backups')
mkdirSync(backupDir, { recursive: true })
copyFileSync(libraryFile, join(backupDir, `library-before-summary-${Date.now()}.json`))
const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
const median = (values) => { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); if (!sorted.length) return null; const index = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[index] : (sorted[index - 1] + sorted[index]) / 2 }
const summarize = (record, timeline) => {
  const events = (timeline?.frames || []).flatMap((frame) => frame.events || [])
  const targetId = safeNumber(record.target?.participantId)
  const teams = new Map((record.participants || []).map((participant) => [safeNumber(participant.participantId), participant.teamId]))
  const typeCounts = {}
  let kills = 0; let deaths = 0; let assists = 0; let wardsPlaced = 0; let wardsKilled = 0; let earlyDeaths = 0; let isolatedDeaths = 0; let classifiedDeaths = 0; let deathSourceEvidence = false
  const deathTimes = []
  for (const event of events) {
    const type = event.type || event.eventType || 'UNKNOWN'
    typeCounts[type] = (typeCounts[type] || 0) + 1
    if (type === 'WARD_PLACED' && safeNumber(event.creatorId) === targetId) wardsPlaced += 1
    if (type === 'WARD_KILL' && safeNumber(event.killerId) === targetId) wardsKilled += 1
    if (type !== 'CHAMPION_KILL') continue
    if (safeNumber(event.killerId) === targetId) kills += 1
    if (safeNumber(event.victimId) === targetId) {
      deaths += 1
      const timestamp = safeNumber(event.timestamp)
      deathTimes.push(timestamp)
      if (timestamp <= 900000) earlyDeaths += 1
      const attackers = new Set((event.victimDamageReceived || []).map((item) => safeNumber(item.participantId)).filter((id) => id && id !== targetId && teams.has(id) && teams.get(id) !== teams.get(targetId)))
      if ((event.victimDamageReceived || []).length) deathSourceEvidence = true
      if (attackers.size) { classifiedDeaths += 1; if (attackers.size <= 1) isolatedDeaths += 1 }
    }
    if ((event.assistingParticipantIds || []).map(safeNumber).includes(targetId)) assists += 1
  }
  deathTimes.sort((a, b) => a - b)
  let repeatDeaths = 0
  for (let index = 1; index < deathTimes.length; index += 1) if (deathTimes[index] - deathTimes[index - 1] <= 90000) repeatDeaths += 1
  return { eventCount: events.length, kills, deaths, assists, wardsPlaced, wardsKilled, earlyDeaths, isolatedDeaths, classifiedDeaths, deathSourceEvidence, repeatDeaths, firstDeathMinute: deathTimes.length ? deathTimes[0] / 60000 : null, typeCounts }
}
const library = JSON.parse(readFileSync(libraryFile, 'utf8'))
let updated = 0
for (const record of library.records || []) {
  if (record.timelineSummary || !record.detailFile) continue
  try {
    const detail = JSON.parse(readFileSync(join(detailsDir, record.detailFile), 'utf8'))
    record.timelineSummary = summarize(record, detail.timeline)
    updated += 1
  } catch {}
}
library.version = 3
library.updatedAt = new Date().toISOString()
writeFileSync(libraryFile, JSON.stringify(library), 'utf8')
console.log(JSON.stringify({ updated, records: library.records.length, bytes: readFileSync(libraryFile).byteLength }, null, 2))
