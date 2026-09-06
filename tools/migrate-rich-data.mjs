import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dataDir = join(root, 'data')
const libraryFile = join(dataDir, 'library.json')
const backupDir = join(dataDir, 'backups')
mkdirSync(backupDir, { recursive: true })
copyFileSync(libraryFile, join(backupDir, `library-before-rich-${Date.now()}.json`))

const fields = [
  'PlayerScore0', 'PlayerScore1', 'PlayerScore2', 'PlayerScore3', 'PlayerScore4', 'PlayerScore5', 'PlayerScore6', 'PlayerScore7', 'PlayerScore8', 'PlayerScore9', 'PlayerScore10', 'PlayerScore11',
  'allInPings', 'assistMePings', 'basicPings', 'commandPings', 'dangerPings', 'enemyMissingPings', 'enemyVisionPings', 'getBackPings', 'holdPings', 'needVisionPings', 'onMyWayPings', 'pushPings', 'retreatPings', 'visionClearedPings',
  'firstBloodKill', 'firstBloodAssist', 'firstTowerKill', 'firstTowerAssist', 'gameEndedInEarlySurrender', 'gameEndedInIGNBSurrender', 'gameEndedInSurrender', 'causedGameEndFromIGNBSurrender', 'teamEarlySurrendered', 'teamIGNBSurrendered', 'wasPremadeWithIGNBGameEndCauser', 'wasPremadeWithSevereTransgressor', 'wasSevereTransgressor',
  'baronKills', 'dragonKills', 'champExperience', 'champLevel', 'championTransform', 'consumablesPurchased', 'detectorWardsPlaced', 'doubleKills', 'tripleKills', 'quadraKills', 'pentaKills', 'unrealKills', 'killingSprees', 'largestKillingSpree', 'largestMultiKill', 'largestCriticalStrike',
  'goldSpent', 'damageDealtToBuildings', 'damageDealtToEpicMonsters', 'damageSelfMitigated', 'magicDamageDealt', 'magicDamageDealtToChampions', 'magicDamageTaken', 'physicalDamageDealt', 'physicalDamageDealtToChampions', 'physicalDamageTaken', 'totalDamageDealt', 'totalDamageShieldedOnTeammates', 'trueDamageDealt', 'trueDamageDealtToChampions', 'trueDamageTaken',
  'inhibitorKills', 'inhibitorTakedowns', 'inhibitorsLost', 'nexusKills', 'nexusLost', 'nexusTakedowns', 'turretKills', 'turretTakedowns', 'turretsLost', 'individualPosition', 'lane', 'teamPosition', 'itemsPurchased', 'totalAllyJungleMinionsKilled', 'totalEnemyJungleMinionsKilled', 'objectivesStolen', 'objectivesStolenAssists', 'placement', 'sightWardsBoughtInGame', 'visionWardsBoughtInGame', 'spell1Casts', 'spell2Casts', 'spell3Casts', 'spell4Casts', 'summoner1Casts', 'summoner2Casts',
  'longestTimeSpentLiving', 'timeCCingOthers', 'timePlayed', 'totalTimeCCDealt', 'totalTimeSpentDead', 'totalHeal', 'totalHealsOnTeammates', 'totalUnitsHealed', 'eligibleForProgression', 'roleBoundItem', 'profileIcon', 'summonerLevel', 'teamId'
]
const compactFrame = (frame) => {
  const participantFrames = {}
  for (const [id, value] of Object.entries(frame?.participantFrames || {})) {
    const item = {}
    for (const key of ['participantId', 'currentGold', 'totalGold', 'level', 'xp', 'minionsKilled', 'jungleMinionsKilled', 'goldPerSecond', 'timeEnemySpentControlled', 'position']) if (value?.[key] !== undefined) item[key] = value[key]
    if (value?.championStats) item.championStats = value.championStats
    if (value?.damageStats) item.damageStats = value.damageStats
    participantFrames[id] = item
  }
  return { timestamp: frame?.timestamp || 0, participantFrames, events: frame?.events || [] }
}
const advanced = (source) => {
  const result = {}
  for (const key of fields) if (source?.[key] !== undefined) result[key] = source[key]
  if (source?.challenges) result.challenges = source.challenges
  if (source?.missions) result.missions = source.missions
  if (source?.PlayerBehavior) result.playerBehavior = source.PlayerBehavior
  if (source?.perks) result.perksDetail = source.perks
  return result
}
const keyOf = (record) => `${record.targetPuuid || record.target?.puuid || ''}:${record.gameId || ''}`
const quality = (record) => Number(record.detailVersion || 0) + Number((record.participants || []).some((p) => Object.keys(p.advancedStats || {}).length) ? 1 : 0) + Number((record.timeline?.frames || []).some((f) => Object.keys(f.participantFrames || {}).length) ? 1 : 0)
const library = JSON.parse(readFileSync(libraryFile, 'utf8'))
const records = new Map((library.records || []).map((record) => [keyOf(record), record]))
const friends = new Map((library.friends || []).map((friend) => [friend.puuid, friend]))
let imported = 0
for (const file of readdirSync(dataDir).filter((name) => name.endsWith('.json') && name !== 'library.json')) {
  const value = JSON.parse(readFileSync(join(dataDir, file), 'utf8'))
  for (const player of value.players || []) {
    if (player.friend?.puuid && friends.has(player.friend.puuid)) friends.set(player.friend.puuid, { ...friends.get(player.friend.puuid), ...player.friend })
    for (const source of player.rawRecords || []) {
      if (![420, 440].includes(Number(source.queueId))) continue
      const rawParticipants = source.raw?.json?.participants || []
      if (!rawParticipants.length) continue
      const byPuuid = new Map(rawParticipants.map((participant) => [participant.puuid, participant]))
      const byId = new Map(rawParticipants.map((participant) => [String(participant.participantId), participant]))
      const participants = (source.participants || []).map((participant) => ({ ...participant, advancedStats: advanced(byPuuid.get(participant.puuid) || byId.get(String(participant.participantId))) }))
      const detailFrames = source.detailRaw?.json?.frames || source.timeline?.frames || []
      const record = { ...source, target: participants.find((participant) => participant.puuid === source.targetPuuid) || source.target, participants, timeline: { frames: detailFrames.map(compactFrame) }, detailsAvailable: Boolean(detailFrames.length), detailVersion: 2 }
      delete record.raw
      delete record.detailRaw
      const key = keyOf(record)
      if (!records.has(key) || quality(record) > quality(records.get(key))) { records.set(key, record); imported += 1 }
    }
  }
}
library.version = 2
library.updatedAt = new Date().toISOString()
library.friends = [...friends.values()]
library.records = [...records.values()]
writeFileSync(libraryFile, JSON.stringify(library), 'utf8')
console.log(JSON.stringify({ imported, friends: library.friends.length, records: library.records.length, richRecords: library.records.filter((record) => quality(record) >= 3).length, backupDir }, null, 2))
