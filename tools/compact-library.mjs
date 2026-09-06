import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dataDir = join(root, 'data')
const libraryFile = join(dataDir, 'library.json')
const backupDir = join(dataDir, 'backups')
mkdirSync(backupDir, { recursive: true })
copyFileSync(libraryFile, join(backupDir, `library-before-advanced-compact-${Date.now()}.json`))

const fields = new Set(['abilityUses', 'acesBefore15Minutes', 'alliedJungleMonsterKills', 'baronTakedowns', 'bountyGold', 'buffsStolen', 'completeSupportQuestInTime', 'controlWardsPlaced', 'damagePerMinute', 'damageTakenOnTeamPercentage', 'deathsByEnemyChamps', 'dragonTakedowns', 'earlyLaningPhaseGoldExpAdvantage', 'effectiveHealAndShielding', 'enemyChampionImmobilizations', 'enemyJungleMonsterKills', 'epicMonsterSteals', 'epicMonsterStolenWithoutSmite', 'firstTurretKilled', 'firstTurretKilledTime', 'goldPerMinute', 'immobilizeAndKillWithAlly', 'jungleCsBefore10Minutes', 'kda', 'killParticipation', 'killsNearEnemyTurret', 'killsUnderOwnTurret', 'landSkillShotsEarlyGame', 'laneMinionsFirst10Minutes', 'laningPhaseGoldExpAdvantage', 'maxCsAdvantageOnLaneOpponent', 'maxKillDeficit', 'maxLevelLeadLaneOpponent', 'multikills', 'outnumberedKills', 'pickKillWithAlly', 'quickCleanse', 'quickFirstTurret', 'riftHeraldTakedowns', 'saveAllyFromDeath', 'scuttleCrabKills', 'skillshotsDodged', 'skillshotsHit', 'soloKills', 'teamDamagePercentage', 'teamBaronKills', 'teamElderDragonKills', 'teamRiftHeraldKills', 'takedowns', 'takedownsFirstXMinutes', 'takedownsAfterGainingLevelAdvantage', 'turretPlatesTaken', 'turretsTakenWithRiftHerald', 'visionScoreAdvantageLaneOpponent', 'visionScorePerMinute', 'wardTakedowns', 'wardTakedownsBefore20M', 'wardsGuarded', '12AssistStreakCount'])
const library = JSON.parse(readFileSync(libraryFile, 'utf8'))
let participants = 0
for (const record of library.records || []) for (const participant of record.participants || []) {
  const stats = participant.advancedStats
  if (!stats) continue
  if (stats.challenges) stats.challenges = Object.fromEntries(Object.entries(stats.challenges).filter(([key]) => fields.has(key)))
  delete stats.missions
  delete stats.perksDetail
  participants += 1
}
library.version = 2
library.updatedAt = new Date().toISOString()
writeFileSync(libraryFile, JSON.stringify(library), 'utf8')
console.log(JSON.stringify({ participants, records: library.records.length, bytes: readFileSync(libraryFile).byteLength }, null, 2))
