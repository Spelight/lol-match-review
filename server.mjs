import { execFileSync } from 'node:child_process'
import https from 'node:https'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const publicDir = join(root, 'public')
const dataDir = join(root, 'data')
const libraryFile = join(dataDir, 'library.json')
const detailsDir = join(dataDir, 'details')
const port = Number(process.env.PORT || 3790)
const jobs = new Map()
let libraryCache = null
let libraryCacheMtimeMs = -1
mkdirSync(dataDir, { recursive: true })
mkdirSync(detailsDir, { recursive: true })

const SGP_SERVERS = {
  TENCENT_HN1: 'https://hn1-k8s-sgp.lol.qq.com:21019',
  TENCENT_HN10: 'https://hn10-k8s-sgp.lol.qq.com:21019',
  TENCENT_TJ100: 'https://tj100-sgp.lol.qq.com:21019',
  TENCENT_TJ101: 'https://tj101-sgp.lol.qq.com:21019',
  TENCENT_NJ100: 'https://nj100-sgp.lol.qq.com:21019',
  TENCENT_GZ100: 'https://gz100-sgp.lol.qq.com:21019',
  TENCENT_CQ100: 'https://cq100-sgp.lol.qq.com:21019',
  TENCENT_BGP2: 'https://bgp2-k8s-sgp.lol.qq.com:21019',
  TW2: 'https://apse1-red.pp.sgp.pvp.net',
  SG2: 'https://apse1-red.pp.sgp.pvp.net',
  PH2: 'https://apse1-red.pp.sgp.pvp.net',
  VN2: 'https://apse1-red.pp.sgp.pvp.net',
  PBE: 'https://usw2-red.pp.sgp.pvp.net',
  EUW: 'https://euc1-red.pp.sgp.pvp.net',
  JP: 'https://apne1-red.pp.sgp.pvp.net',
  RU: 'https://euc1-red.pp.sgp.pvp.net',
  BR1: 'https://usw2-red.pp.sgp.pvp.net',
  OC1: 'https://apse1-red.pp.sgp.pvp.net',
  TR1: 'https://euc1-red.pp.sgp.pvp.net',
  LA1: 'https://usw2-red.pp.sgp.pvp.net',
  LA2: 'https://usw2-red.pp.sgp.pvp.net',
  NA1: 'https://usw2-red.pp.sgp.pvp.net',
  TH2: 'https://apse1-red.pp.sgp.pvp.net',
  KR: 'https://apne1-red.pp.sgp.pvp.net'
}

const SGP_COMMON_SERVERS = {
  TW2: 'https://tw2-red.lol.sgp.pvp.net',
  SG2: 'https://sg2-red.lol.sgp.pvp.net',
  PH2: 'https://ph2-red.lol.sgp.pvp.net',
  VN2: 'https://vn2-red.lol.sgp.pvp.net',
  PBE: 'https://pbe-red.lol.sgp.pvp.net',
  EUW: 'https://euw-red.lol.sgp.pvp.net',
  JP: 'https://jp-red.lol.sgp.pvp.net',
  RU: 'https://ru-red.lol.sgp.pvp.net',
  BR1: 'https://br-red.lol.sgp.pvp.net',
  OC1: 'https://oce-red.lol.sgp.pvp.net',
  TR1: 'https://tr-red.lol.sgp.pvp.net',
  LA1: 'https://lan-red.lol.sgp.pvp.net',
  LA2: 'https://las-red.lol.sgp.pvp.net',
  NA1: 'https://na-red.lol.sgp.pvp.net',
  TH2: 'https://th2-red.lol.sgp.pvp.net',
  KR: 'https://kr-red.lol.sgp.pvp.net'
}

const RANKED_QUEUE_DEFINITIONS = {
  solo: { id: 420, label: '单双排', queueType: 'RANKED_SOLO_5x5' },
  flex: { id: 440, label: '灵活排位', queueType: 'RANKED_FLEX_SR' }
}
const DEFAULT_QUEUE_TYPES = ['solo', 'flex']
const POSITION_NAMES = {
  TOP: '上路',
  JUNGLE: '打野',
  JG: '打野',
  MIDDLE: '中路',
  MID: '中路',
  CENTER: '中路',
  BOTTOM: '下路',
  ADC: '下路',
  CARRY: '下路',
  UTILITY: '辅助',
  SUPPORT: '辅助',
  DUO: '下路',
  DUO_CARRY: '下路',
  DUO_SUPPORT: '辅助',
  NONE: '未分配'
}
const MODE_NAMES = {
  CLASSIC: '经典召唤师峡谷',
  KIWI: '经典召唤师峡谷',
  KIWI_JADE: '经典召唤师峡谷',
  ARAM: '极地大乱斗',
  CHERRY: '斗魂竞技场',
  TFT: '云顶之弈',
  URF: '无限火力',
  ONEFORALL: '克隆大作战'
}
const QUEUE_TYPE_NAMES = {
  RANKED_SOLO_5X5: '单双排（召唤师峡谷）',
  RANKED_FLEX_SR: '灵活排位（召唤师峡谷）',
  RANKED_PREMADE_5X5: '旧版组队排位',
  RANKED_TFT: '云顶之弈排位',
  RANKED_TFT_TURBO: '云顶之弈狂暴模式排位',
  RANKED_TFT_DOUBLE_UP: '云顶之弈双人作战排位'
}
const TIER_NAMES = { IRON: '黑铁', BRONZE: '青铜', SILVER: '白银', GOLD: '黄金', PLATINUM: '铂金', EMERALD: '翡翠', DIAMOND: '钻石', MASTER: '大师', GRANDMASTER: '宗师', CHALLENGER: '王者' }
const RANK_NAMES = { I: '一', II: '二', III: '三', IV: '四' }
const TIER_STRENGTH_WEIGHTS = { IRON: .8, BRONZE: .87, SILVER: .94, GOLD: 1, PLATINUM: 1.07, EMERALD: 1.15, DIAMOND: 1.25, MASTER: 1.34, GRANDMASTER: 1.42, CHALLENGER: 1.5 }
const RANKING_RULES = { minGames: 5, minEffectiveSample: 3, maxInactiveDays: 90, recencyHalfLifeDays: 90 }
const DATA_DRAGON_CACHE = { loaded: false, champions: new Map(), items: new Map(), spells: new Map(), perks: new Map() }

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value))
const avg = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ADVANCED_PARTICIPANT_FIELDS = [
  'PlayerScore0', 'PlayerScore1', 'PlayerScore2', 'PlayerScore3', 'PlayerScore4', 'PlayerScore5', 'PlayerScore6', 'PlayerScore7', 'PlayerScore8', 'PlayerScore9', 'PlayerScore10', 'PlayerScore11',
  'allInPings', 'assistMePings', 'basicPings', 'commandPings', 'dangerPings', 'enemyMissingPings', 'enemyVisionPings', 'getBackPings', 'holdPings', 'needVisionPings', 'onMyWayPings', 'pushPings', 'retreatPings', 'visionClearedPings',
  'firstBloodKill', 'firstBloodAssist', 'firstTowerKill', 'firstTowerAssist', 'gameEndedInEarlySurrender', 'gameEndedInIGNBSurrender', 'gameEndedInSurrender', 'causedGameEndFromIGNBSurrender', 'teamEarlySurrendered', 'teamIGNBSurrendered', 'wasPremadeWithIGNBGameEndCauser', 'wasPremadeWithSevereTransgressor', 'wasSevereTransgressor',
  'baronKills', 'dragonKills', 'champExperience', 'champLevel', 'championTransform', 'consumablesPurchased', 'detectorWardsPlaced', 'doubleKills', 'tripleKills', 'quadraKills', 'pentaKills', 'unrealKills', 'killingSprees', 'largestKillingSpree', 'largestMultiKill', 'largestCriticalStrike',
  'goldSpent', 'damageDealtToBuildings', 'damageDealtToEpicMonsters', 'damageSelfMitigated', 'magicDamageDealt', 'magicDamageDealtToChampions', 'magicDamageTaken', 'physicalDamageDealt', 'physicalDamageDealtToChampions', 'physicalDamageTaken', 'totalDamageDealt', 'totalDamageShieldedOnTeammates', 'trueDamageDealt', 'trueDamageDealtToChampions', 'trueDamageTaken',
  'inhibitorKills', 'inhibitorTakedowns', 'inhibitorsLost', 'nexusKills', 'nexusLost', 'nexusTakedowns', 'turretKills', 'turretTakedowns', 'turretsLost',
  'individualPosition', 'lane', 'teamPosition', 'itemsPurchased', 'totalAllyJungleMinionsKilled', 'totalEnemyJungleMinionsKilled', 'objectivesStolen', 'objectivesStolenAssists', 'placement', 'sightWardsBoughtInGame', 'visionWardsBoughtInGame', 'spell1Casts', 'spell2Casts', 'spell3Casts', 'spell4Casts', 'summoner1Casts', 'summoner2Casts',
  'longestTimeSpentLiving', 'timeCCingOthers', 'timePlayed', 'totalTimeCCDealt', 'totalTimeSpentDead', 'totalHeal', 'totalHealsOnTeammates', 'totalUnitsHealed', 'eligibleForProgression', 'roleBoundItem', 'profileIcon', 'summonerLevel', 'teamId'
]
const ADVANCED_CHALLENGE_FIELDS = [
  'abilityUses', 'acesBefore15Minutes', 'alliedJungleMonsterKills', 'baronTakedowns', 'bountyGold', 'buffsStolen', 'completeSupportQuestInTime', 'controlWardsPlaced', 'damagePerMinute', 'damageTakenOnTeamPercentage', 'deathsByEnemyChamps', 'dragonTakedowns', 'earlyLaningPhaseGoldExpAdvantage', 'effectiveHealAndShielding', 'enemyChampionImmobilizations', 'enemyJungleMonsterKills', 'epicMonsterSteals', 'epicMonsterStolenWithoutSmite', 'firstTurretKilled', 'firstTurretKilledTime', 'goldPerMinute', 'immobilizeAndKillWithAlly', 'jungleCsBefore10Minutes', 'kda', 'killParticipation', 'killsNearEnemyTurret', 'killsUnderOwnTurret', 'landSkillShotsEarlyGame', 'laneMinionsFirst10Minutes', 'laningPhaseGoldExpAdvantage', 'maxCsAdvantageOnLaneOpponent', 'maxKillDeficit', 'maxLevelLeadLaneOpponent', 'multikills', 'outnumberedKills', 'pickKillWithAlly', 'quickCleanse', 'quickFirstTurret', 'riftHeraldTakedowns', 'saveAllyFromDeath', 'scuttleCrabKills', 'skillshotsDodged', 'skillshotsHit', 'soloKills', 'teamDamagePercentage', 'teamBaronKills', 'teamElderDragonKills', 'teamRiftHeraldKills', 'takedowns', 'takedownsFirstXMinutes', 'takedownsAfterGainingLevelAdvantage', 'turretPlatesTaken', 'turretsTakenWithRiftHerald', 'visionScoreAdvantageLaneOpponent', 'visionScorePerMinute', 'wardTakedowns', 'wardTakedownsBefore20M', 'wardsGuarded', '12AssistStreakCount'
]

function advancedParticipantStats(participant) {
  const source = participant?.stats ? { ...participant.stats, ...participant } : participant || {}
  const stats = {}
  for (const key of ADVANCED_PARTICIPANT_FIELDS) {
    if (source[key] !== undefined) stats[key] = source[key]
  }
  if (source.challenges && typeof source.challenges === 'object') stats.challenges = Object.fromEntries(ADVANCED_CHALLENGE_FIELDS.filter((key) => source.challenges[key] !== undefined).map((key) => [key, source.challenges[key]]))
  if (source.PlayerBehavior && typeof source.PlayerBehavior === 'object') stats.playerBehavior = source.PlayerBehavior
  return stats
}

const FRAME_PARTICIPANT_FIELDS = ['participantId', 'currentGold', 'totalGold', 'level', 'xp', 'minionsKilled', 'jungleMinionsKilled', 'goldPerSecond', 'timeEnemySpentControlled', 'position']

function compactDamageDetails(details) {
  const grouped = new Map()
  for (const item of details || []) {
    const participantId = safeNumber(item?.participantId)
    const key = `${participantId}:${item?.name || ''}`
    const current = grouped.get(key) || { participantId, name: item?.name || '', physicalDamage: 0, magicDamage: 0, trueDamage: 0, hits: 0 }
    current.physicalDamage += safeNumber(item?.physicalDamage)
    current.magicDamage += safeNumber(item?.magicDamage)
    current.trueDamage += safeNumber(item?.trueDamage)
    current.hits += 1
    grouped.set(key, current)
  }
  return [...grouped.values()].map((item) => ({ ...item, totalDamage: item.physicalDamage + item.magicDamage + item.trueDamage }))
}

function compactTimelineEvent(event) {
  if (!event || typeof event !== 'object') return event
  const { victimDamageDealt, victimDamageReceived, victimTeamfightDamageDealt, victimTeamfightDamageReceived, ...compact } = event
  if (victimDamageDealt) compact.victimDamageDealt = compactDamageDetails(victimDamageDealt)
  if (victimDamageReceived) compact.victimDamageReceived = compactDamageDetails(victimDamageReceived)
  if (victimTeamfightDamageDealt) compact.victimTeamfightDamageDealt = compactDamageDetails(victimTeamfightDamageDealt)
  if (victimTeamfightDamageReceived) compact.victimTeamfightDamageReceived = compactDamageDetails(victimTeamfightDamageReceived)
  return compact
}

function compactTimelineFrame(frame, targetParticipantId = 0) {
  const participantFrames = {}
  for (const [participantId, value] of Object.entries(frame?.participantFrames || {})) {
    if (targetParticipantId && safeNumber(participantId) !== safeNumber(targetParticipantId)) continue
    const compact = {}
    for (const key of FRAME_PARTICIPANT_FIELDS) if (value?.[key] !== undefined) compact[key] = value[key]
    if (value?.championStats) compact.championStats = value.championStats
    if (value?.damageStats) compact.damageStats = value.damageStats
    participantFrames[participantId] = compact
  }
  return { timestamp: frame?.timestamp || 0, participantFrames, events: (frame?.events || []).map(compactTimelineEvent) }
}

function normalizeQueueTypes(value) {
  const values = Array.isArray(value) ? value : []
  const normalized = values.map((item) => String(item).toLowerCase()).filter((item) => RANKED_QUEUE_DEFINITIONS[item])
  return [...new Set(normalized)].length ? [...new Set(normalized)] : [...DEFAULT_QUEUE_TYPES]
}

function queueIds(queueTypes) {
  return new Set(queueTypes.map((type) => RANKED_QUEUE_DEFINITIONS[type].id))
}

function rankProfile(friend, queueId) {
  const queueType = Number(queueId) === 420 ? 'RANKED_SOLO_5x5' : Number(queueId) === 440 ? 'RANKED_FLEX_SR' : ''
  const queue = (friend?.rankedStats?.queues || []).find((item) => String(item.queueType || '').toUpperCase() === queueType.toUpperCase())
  const tier = String(queue?.tier || '').toUpperCase()
  const division = String(queue?.rank || '').toUpperCase()
  const baseWeight = TIER_STRENGTH_WEIGHTS[tier] || 1
  const divisionOffset = { I: .015, II: .008, III: 0, IV: -.008 }[division] || 0
  const weight = Number((baseWeight + divisionOffset).toFixed(3))
  return { tier: tier || '', division, tierName: tierName(tier), rankName: rankName(division), label: queue ? `${tierName(tier)}${rankName(division) ? ` ${rankName(division)}` : ''}` : '未获取段位', weight }
}

function recencyProfile(createdAt) {
  const daysSince = Math.max(0, (Date.now() - Number(createdAt || Date.now())) / 86_400_000)
  const weight = Number(Math.max(.08, Math.pow(.5, daysSince / RANKING_RULES.recencyHalfLifeDays)).toFixed(3))
  const status = daysSince <= 30 ? '活跃' : daysSince <= RANKING_RULES.maxInactiveDays ? '近期' : '非活跃'
  return { daysSince, weight, status }
}

function weightedAverage(values, weights) {
  let total = 0
  let weight = 0
  values.forEach((value, index) => {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return
    const itemWeight = Number(weights[index] || 1)
    total += Number(value) * itemWeight
    weight += itemWeight
  })
  return weight ? total / weight : 0
}

function queueLabels(queueTypes) {
  return queueTypes.map((type) => RANKED_QUEUE_DEFINITIONS[type].label)
}

function positionName(value) {
  const key = String(value || '').toUpperCase()
  if (POSITION_NAMES[key]) return POSITION_NAMES[key]
  if (!key || ['INVALID', 'UNKNOWN', 'UNDEFINED', 'NONE'].includes(key)) return '未分配'
  return value || '未分配'
}
function normalizePosition(position, role = '') {
  const roleKey = String(role || '').toUpperCase()
  if (['SUPPORT', 'DUO_SUPPORT'].includes(roleKey)) return 'UTILITY'
  if (['CARRY', 'DUO', 'DUO_CARRY'].includes(roleKey)) return 'BOTTOM'
  const key = String(position || '').toUpperCase()
  if (['TOP'].includes(key)) return 'TOP'
  if (['JUNGLE', 'JG'].includes(key)) return 'JUNGLE'
  if (['MIDDLE', 'MID', 'CENTER'].includes(key)) return 'MIDDLE'
  if (['BOTTOM', 'ADC', 'CARRY', 'DUO', 'DUO_CARRY'].includes(key)) return 'BOTTOM'
  if (['UTILITY', 'SUPPORT', 'DUO_SUPPORT'].includes(key)) return 'UTILITY'
  return position || 'NONE'
}

function inferParticipantPosition(participant) {
  const role = participant?.role || participant?.timeline?.role || ''
  if (['SUPPORT', 'DUO_SUPPORT'].includes(String(role).toUpperCase())) return 'UTILITY'
  if (['CARRY', 'DUO', 'DUO_CARRY'].includes(String(role).toUpperCase())) return 'BOTTOM'
  return normalizePosition(
    [participant?.individualPosition, participant?.teamPosition, participant?.timeline?.lane, participant?.lane, participant?.position]
      .find((value) => value && !['NONE', 'INVALID', 'UNKNOWN'].includes(String(value).toUpperCase())),
    role
  )
}

function modeName(value, queueId = 0) {
  const key = String(value || '').toUpperCase()
  if (MODE_NAMES[key]) return MODE_NAMES[key]
  if ([420, 440].includes(Number(queueId))) return '经典召唤师峡谷'
  return value || '未知模式'
}
function queueTypeName(value) { return QUEUE_TYPE_NAMES[String(value || '').toUpperCase()] || value || '未知队列' }
function tierName(value) { return TIER_NAMES[String(value || '').toUpperCase()] || value || '-' }
function rankName(value) { return RANK_NAMES[String(value || '').toUpperCase()] || value || '' }

async function loadGameDictionary() {
  if (DATA_DRAGON_CACHE.loaded) return DATA_DRAGON_CACHE
  DATA_DRAGON_CACHE.loaded = true
  try {
    const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { signal: AbortSignal.timeout(6000) })
    const versions = await versionsResponse.json()
    const version = versions[0]
    const base = `https://ddragon.leagueoflegends.com/cdn/${version}/data/zh_CN`
    const [champions, items, spells, perks] = await Promise.allSettled([
      fetch(`${base}/champion.json`, { signal: AbortSignal.timeout(6000) }).then((response) => response.json()),
      fetch(`${base}/item.json`, { signal: AbortSignal.timeout(6000) }).then((response) => response.json()),
      fetch(`${base}/summoner.json`, { signal: AbortSignal.timeout(6000) }).then((response) => response.json()),
      fetch(`${base}/runesReforged.json`, { signal: AbortSignal.timeout(6000) }).then((response) => response.json())
    ])
    if (champions.status === 'fulfilled') for (const champion of Object.values(champions.value.data || {})) DATA_DRAGON_CACHE.champions.set(Number(champion.key), champion.name)
    if (items.status === 'fulfilled') for (const [id, item] of Object.entries(items.value.data || {})) DATA_DRAGON_CACHE.items.set(Number(id), item.name)
    if (spells.status === 'fulfilled') for (const spell of Object.values(spells.value.data || {})) DATA_DRAGON_CACHE.spells.set(Number(spell.key), spell.name)
    if (perks.status === 'fulfilled') for (const tree of perks.value || []) for (const slot of tree.slots || []) for (const rune of slot.runes || []) DATA_DRAGON_CACHE.perks.set(Number(rune.id), rune.name)
  } catch {}
  return DATA_DRAGON_CACHE
}

async function enrichGameDictionary(payload) {
  const dictionary = await loadGameDictionary()
  for (const record of payload.records || []) {
    for (const participant of record.participants || []) {
      participant.championName = dictionary.champions.get(Number(participant.championId)) || `英雄 ${participant.championId}`
      participant.positionName = positionName(participant.position)
      participant.itemNames = (participant.items || []).filter(Boolean).map((id) => dictionary.items.get(Number(id)) || `装备 ${id}`)
      participant.spellNames = (participant.spells || []).filter(Boolean).map((id) => dictionary.spells.get(Number(id)) || `技能 ${id}`)
      participant.perkNames = (participant.perks || []).filter(Boolean).map((id) => dictionary.perks.get(Number(id)) || `符文 ${id}`)
    }
    if (record.target) {
      const target = record.participants.find((participant) => participant.puuid === record.target.puuid || participant.participantId === record.target.participantId)
      if (target) record.target = target
    }
  }
  return payload
}

function json(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  })
  response.end(body)
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 2_000_000) reject(new Error('请求体过大'))
    })
    request.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) } catch { reject(new Error('请求 JSON 无效')) }
    })
    request.on('error', reject)
  })
}

function discoverLockfile() {
  const candidates = [
    process.env.LOL_LOCKFILE,
    'C:\\Riot Games\\League of Legends\\lockfile',
    'C:\\Program Files\\Riot Games\\League of Legends\\lockfile',
    'C:\\Program Files (x86)\\Riot Games\\League of Legends\\lockfile'
  ].filter(Boolean)

  for (const path of candidates) {
    if (!existsSync(path)) continue
    try {
      const content = readFileSync(path, 'utf8').trim()
      if (content.split(':').length >= 5) return path
    } catch {}
  }

  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile', '-Command',
      "(Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\").CommandLine"
    ], { encoding: 'utf8', timeout: 3000 })
    const match = output.match(/--lockfile[= ](?:'|")?([^'"\s]+)(?:'|")?/i)
    if (match && existsSync(match[1])) return match[1]
  } catch {}

  return null
}

function discoverClientCommandLine() {
  try {
    return execFileSync('powershell.exe', [
      '-NoProfile', '-Command',
      "(Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\").CommandLine"
    ], { encoding: 'utf8', timeout: 3000 })
  } catch {
    return ''
  }
}

function commandLineValue(commandLine, name) {
  const option = name.replaceAll('_', '[_-]')
  const pattern = new RegExp(`(?:^|\\s)[\\"']?--${option}(?:=|\\s+)[\\"']?([^\\s\\"']*)[\\"']?`, 'i')
  const match = commandLine.match(pattern)
  return match?.[1] || ''
}

function getLcuConnection() {
  const path = discoverLockfile()
  if (!path) {
    const commandLine = discoverClientCommandLine()
    const port = commandLineValue(commandLine, 'app_port')
    const password = commandLineValue(commandLine, 'remoting_auth_token')
    if (!port || !password) return null
    return {
      name: 'LeagueClientUx',
      port: Number(port),
      password,
      protocol: 'https',
      region: process.env.LOL_REGION || commandLineValue(commandLine, 'region'),
      rsoPlatformId: process.env.LOL_RSO_PLATFORM_ID || commandLineValue(commandLine, 'rso_platform_id')
    }
  }
  const content = readFileSync(path, 'utf8').trim().split(':')
  if (content.length < 5) throw new Error('League Client lockfile 格式无法识别')
  const commandLine = discoverClientCommandLine()
  return {
    name: content[0],
    port: Number(content[2]),
    password: content[3],
    protocol: content[4],
    region: process.env.LOL_REGION || commandLineValue(commandLine, 'region'),
    rsoPlatformId: process.env.LOL_RSO_PLATFORM_ID || commandLineValue(commandLine, 'rso_platform_id')
  }
}

function lcuRequest(pathname) {
  return new Promise((resolve, reject) => {
    let connection
    try { connection = getLcuConnection() } catch (error) { reject(error); return }
    if (!connection) {
      reject(new Error('未找到英雄联盟客户端，请先启动并登录客户端'))
      return
    }

    const request = https.request(`https://127.0.0.1:${connection.port}${pathname}`, {
      method: 'GET',
      rejectUnauthorized: false,
      headers: { Authorization: `Basic ${Buffer.from(`riot:${connection.password}`).toString('base64')}`, 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      timeout: 20_000
    }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        let value
        try { value = body ? JSON.parse(body) : null } catch { value = body }
        if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
          reject(new Error(`LCU ${response.statusCode}: ${typeof value === 'string' ? value : JSON.stringify(value)}`))
          return
        }
        resolve(value)
      })
    })
    request.on('timeout', () => request.destroy(new Error('LCU 请求超时')))
    request.on('error', reject)
    request.end()
  })
}

async function lcuCollectableFriends() {
  const friends = await lcuRequest('/lol-chat/v1/friends')
  try {
    const current = await lcuRequest('/lol-summoner/v1/current-summoner')
    const puuid = current?.puuid
    if (puuid && !friends.some((friend) => friend.puuid === puuid)) {
      friends.unshift({ ...current, gameName: current.gameName || current.displayName || current.name || '当前召唤师', tagLine: current.tagLine || current.gameTag || '' })
    }
  } catch {}
  return friends
}

function getSgpServerId(connection) {
  if (process.env.SGP_SERVER_ID) return process.env.SGP_SERVER_ID.toUpperCase()
  const region = (connection.region || '').toUpperCase()
  const platform = (connection.rsoPlatformId || '').toUpperCase()
  if (region === 'TENCENT') return `TENCENT_${platform}`
  const aliases = { NA: 'NA1', BR: 'BR1', TR: 'TR1', LAN: 'LA1', LAS: 'LA2', OCE: 'OC1', EUW1: 'EUW', JP1: 'JP' }
  return aliases[region] || region
}

async function getSgpContext() {
  const connection = getLcuConnection()
  if (!connection) throw new Error('未找到英雄联盟客户端')
  const serverId = getSgpServerId(connection)
  const baseUrl = process.env.SGP_MATCH_HISTORY_URL || SGP_SERVERS[serverId]
  if (!baseUrl) throw new Error(`没有找到 SGP 服务器配置：${serverId || '未知区域'}`)
  const entitlements = await lcuRequest('/entitlements/v1/token')
  const leagueSession = await lcuRequest('/lol-league-session/v1/league-session-token')
  const regionPathAliases = { EUW: 'EUW1', JP: 'JP1', PBE: 'PBE1' }
  const subId = process.env.SGP_SUB_ID || (serverId.startsWith('TENCENT_') ? serverId.slice('TENCENT_'.length) : (regionPathAliases[serverId] || serverId))
  return {
    serverId,
    subId,
    baseUrl,
    commonUrl: process.env.SGP_COMMON_URL || SGP_COMMON_SERVERS[serverId] || baseUrl,
    entitlementsToken: entitlements?.accessToken || entitlements?.token,
    leagueSessionToken: typeof leagueSession === 'string' ? leagueSession : leagueSession?.token
  }
}

function sgpRequestOnce(context, pathname, token, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, options.baseUrl || context.baseUrl)
    const body = options.body === undefined ? null : JSON.stringify(options.body)
    const request = https.request(url, {
      method: options.method || 'GET',
      rejectUnauthorized: false,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
      },
      timeout: 25_000
    }, (response) => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { text += chunk })
      response.on('end', () => {
        let value
        try { value = text ? JSON.parse(text) : null } catch { value = text }
        if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
          reject(new Error(`SGP ${response.statusCode}: ${typeof value === 'string' ? value : JSON.stringify(value)}`))
          return
        }
        resolve(value)
      })
    })
    request.on('timeout', () => request.destroy(new Error('SGP 请求超时')))
    request.on('error', reject)
    if (body) request.write(body)
    request.end()
  })
}

async function sgpRequest(context, pathname, token, options = {}) {
  let lastError
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await sgpRequestOnce(context, pathname, token, options)
    } catch (error) {
      lastError = error
      const retryable = /SGP (429|500|502|503|504)|SGP 请求超时|socket hang up|ECONNRESET|ETIMEDOUT/i.test(String(error?.message || error))
      if (!retryable || attempt === 3) throw error
      await delay(800 * (attempt + 1))
    }
  }
  throw lastError
}

function summarizeParticipant(game, identity, participant) {
  const stats = participant?.stats || {}
  const player = identity?.player || {}
  const duration = Math.max(safeNumber(game.gameDuration), 1)
  const kills = safeNumber(stats.kills)
  const deaths = safeNumber(stats.deaths)
  const assists = safeNumber(stats.assists)
  const cs = safeNumber(stats.totalMinionsKilled) + safeNumber(stats.neutralMinionsKilled)
  const team = (game.participants || []).filter((item) => item.teamId === participant.teamId)
  const teamStatsAvailable = (game.participants || []).length >= 10 && team.length >= 5
  const teamKills = team.reduce((sum, item) => sum + safeNumber(item.stats?.kills), 0)
  const teamDamage = team.reduce((sum, item) => sum + safeNumber(item.stats?.totalDamageDealtToChampions), 0)
  return {
    puuid: player.puuid || '',
    gameName: player.gameName || player.summonerName || `玩家 ${participant.participantId}`,
    tagLine: player.tagLine || '',
    participantId: participant.participantId,
    teamId: participant.teamId,
    championId: participant.championId,
    position: inferParticipantPosition(participant),
    role: participant.timeline?.role || '',
    win: Boolean(stats.win),
    kills, deaths, assists,
    kda: (kills + assists) / Math.max(deaths, 1),
    killParticipation: teamStatsAvailable ? (kills + assists) / Math.max(teamKills, 1) : null,
    cs,
    csPerMinute: cs / (duration / 60),
    goldEarned: safeNumber(stats.goldEarned),
    damageToChampions: safeNumber(stats.totalDamageDealtToChampions),
    damagePerMinute: safeNumber(stats.totalDamageDealtToChampions) / (duration / 60),
    damageShare: teamStatsAvailable ? safeNumber(stats.totalDamageDealtToChampions) / Math.max(teamDamage, 1) : null,
    teamStatsAvailable,
    damageTaken: safeNumber(stats.totalDamageTaken),
    damageToTurrets: safeNumber(stats.damageDealtToTurrets),
    damageToObjectives: safeNumber(stats.damageDealtToObjectives),
    visionScore: safeNumber(stats.visionScore),
    wardsPlaced: safeNumber(stats.wardsPlaced),
    wardsKilled: safeNumber(stats.wardsKilled),
    neutralMinionsKilled: safeNumber(stats.neutralMinionsKilled),
    items: [0, 1, 2, 3, 4, 5, 6].map((index) => stats[`item${index}`] || 0),
    spells: [participant.spell1Id, participant.spell2Id],
    perks: [0, 1, 2, 3, 4, 5].map((index) => stats[`perk${index}`] || 0),
    advancedStats: advancedParticipantStats({ ...stats, ...participant }),
    raw: { identity, participant }
  }
}

function normalizeGame(game, targetPuuid, timeline) {
  const identities = game.participantIdentities || []
  const targetIndex = identities.findIndex((identity) => identity.player?.puuid === targetPuuid)
  const targetParticipant = targetIndex >= 0 ? game.participants?.[targetIndex] : null
  const targetIdentity = targetIndex >= 0 ? identities[targetIndex] : null
  return {
    gameId: safeNumber(game.gameId),
    targetPuuid,
    createdAt: game.gameCreation || Date.now(),
    duration: safeNumber(game.gameDuration),
    gameVersion: game.gameVersion || '',
    gameMode: game.gameMode || '',
    gameType: game.gameType || '',
    mapId: safeNumber(game.mapId),
    queueId: safeNumber(game.queueId),
    platformId: game.platformId || '',
    target: targetParticipant ? summarizeParticipant(game, targetIdentity, targetParticipant) : null,
    participants: (game.participants || []).map((participant, index) => summarizeParticipant(game, identities[index], participant)),
    teams: game.teams || [],
    timeline: timeline || { frames: [] },
    raw: game
  }
}

function summarizeSgpParticipant(game, participant) {
  const duration = Math.max(safeNumber(game.gameDuration), 1)
  const team = (game.participants || []).filter((item) => item.teamId === participant.teamId)
  const teamStatsAvailable = (game.participants || []).length >= 10 && team.length >= 5
  const teamKills = team.reduce((sum, item) => sum + safeNumber(item.kills), 0)
  const teamDamage = team.reduce((sum, item) => sum + safeNumber(item.totalDamageDealtToChampions), 0)
  const kills = safeNumber(participant.kills)
  const deaths = safeNumber(participant.deaths)
  const assists = safeNumber(participant.assists)
  const cs = safeNumber(participant.totalMinionsKilled) + safeNumber(participant.neutralMinionsKilled)
  const items = [0, 1, 2, 3, 4, 5, 6].map((index) => participant[`item${index}`] || 0)
  const spells = [participant.spell1Id, participant.spell2Id]
  const perks = participant.perks?.styles?.flatMap((style) => style.selections?.map((selection) => selection.perk) || []) || []
  return {
    puuid: participant.puuid || '',
    gameName: participant.riotIdGameName || participant.summonerName || `玩家 ${participant.participantId}`,
    tagLine: participant.riotIdTagline || participant.riotIdTagLine || '',
    participantId: participant.participantId,
    teamId: participant.teamId,
    championId: participant.championId,
    position: inferParticipantPosition(participant),
    role: participant.role || '',
    win: Boolean(participant.win),
    kills, deaths, assists,
    kda: (kills + assists) / Math.max(deaths, 1),
    killParticipation: teamStatsAvailable ? (kills + assists) / Math.max(teamKills, 1) : null,
    cs,
    csPerMinute: cs / (duration / 60),
    goldEarned: safeNumber(participant.goldEarned),
    damageToChampions: safeNumber(participant.totalDamageDealtToChampions),
    damagePerMinute: safeNumber(participant.totalDamageDealtToChampions) / (duration / 60),
    damageShare: teamStatsAvailable ? safeNumber(participant.totalDamageDealtToChampions) / Math.max(teamDamage, 1) : null,
    teamStatsAvailable,
    damageTaken: safeNumber(participant.totalDamageTaken),
    damageToTurrets: safeNumber(participant.damageDealtToTurrets),
    damageToObjectives: safeNumber(participant.damageDealtToObjectives),
    visionScore: safeNumber(participant.visionScore),
    wardsPlaced: safeNumber(participant.wardsPlaced),
    wardsKilled: safeNumber(participant.wardsKilled),
    neutralMinionsKilled: safeNumber(participant.neutralMinionsKilled),
    items,
    spells,
    perks,
    advancedStats: advancedParticipantStats(participant),
    raw: participant
  }
}

function normalizeSgpGame(summary, targetPuuid, details) {
  const game = summary?.json || {}
  const participants = game.participants || []
  const target = participants.find((participant) => participant.puuid === targetPuuid)
  const detailJson = details?.json || { frames: [] }
  return {
    gameId: safeNumber(game.gameId),
    targetPuuid,
    createdAt: game.gameCreation || Date.now(),
    duration: safeNumber(game.gameDuration),
    gameVersion: game.gameVersion || '',
    gameMode: game.gameMode || '',
    gameType: game.gameType || '',
    mapId: safeNumber(game.mapId),
    queueId: safeNumber(game.queueId),
    platformId: game.platformId || '',
    target: target ? summarizeSgpParticipant(game, target) : null,
    participants: participants.map((participant) => summarizeSgpParticipant(game, participant)),
    teams: game.teams || [],
    timeline: detailJson,
    raw: summary,
    detailRaw: details || null
  }
}

function gameCreatedAt(game) {
  const value = game?.gameCreation ?? game?.gameCreationDate ?? game?.gameCreationTimestamp
  const numeric = safeNumber(value)
  return numeric || (typeof value === 'string' ? Date.parse(value) || 0 : 0)
}

async function collectLcu(job, selected, count, includeDetails, queueTypes = DEFAULT_QUEUE_TYPES, cached = [], sinceMs = 0, untilMs = Date.now()) {
  const friendList = await lcuCollectableFriends()
  const friendMap = new Map(friendList.map((friend) => [friend.puuid, friend]))
  const selectedFriends = selected.map((puuid) => friendMap.get(puuid)).filter(Boolean)
  if (!selectedFriends.length) throw new Error('所选好友不在当前客户端好友列表中')
  const allowedQueueIds = queueIds(queueTypes)
  const cachedByKey = new Map(cached.map((record) => [libraryRecordKey(record), record]))

  job.total = selectedFriends.length * count
  for (const friend of selectedFriends) {
    try {
      friend.rankedStats = await lcuRequest(`/lol-ranked/v1/ranked-stats/${encodeURIComponent(friend.puuid)}`)
    } catch {
      friend.rankedStats = null
    }
  }
  const historyByGame = new Map()
  for (const friend of selectedFriends) {
    job.message = `正在读取 ${friend.gameName || friend.name} 的历史`
    let startIndex = 0
    const batchSize = Math.min(100, Math.max(count * 2, 50))
    let reachedSinceBoundary = false
    while ([...historyByGame.values()].filter((item) => item.friend.puuid === friend.puuid).length < count && startIndex < 2000 && !reachedSinceBoundary) {
      const history = await lcuRequest(`/lol-match-history/v1/products/lol/${encodeURIComponent(friend.puuid)}/matches?begIndex=${startIndex}&endIndex=${startIndex + batchSize - 1}`)
      const games = history?.games?.games || []
      for (const game of games) {
        const createdAt = gameCreatedAt(game)
        if (createdAt && createdAt < sinceMs) reachedSinceBoundary = true
        if (game?.gameId && allowedQueueIds.has(safeNumber(game.queueId)) && createdAt >= sinceMs && createdAt <= untilMs) {
          historyByGame.set(`${friend.puuid}:${game.gameId}`, { friend, game })
        }
      }
      if (games.length < batchSize) break
      startIndex += games.length
    }
  }

  const gamesToCollect = selectedFriends.flatMap((friend) => [...historyByGame.values()].filter((item) => item.friend.puuid === friend.puuid).slice(0, count))
  job.total = gamesToCollect.length || job.total
  const records = []
  for (const { friend, game } of gamesToCollect) {
    job.message = `正在读取对局 ${game.gameId}`
    const cachedRecord = cachedByKey.get(`${friend.puuid}:${game.gameId}`)
    if (cachedRecord && (!includeDetails || hasCompleteSgpDetail(cachedRecord))) {
      records.push(cachedRecord)
      job.completed += 1
      continue
    }
    let fullGame = game
    let timeline = { frames: [] }
    try { fullGame = await lcuRequest(`/lol-match-history/v1/games/${game.gameId}`) } catch {}
    if (includeDetails) {
      try { timeline = await lcuRequest(`/lol-match-history/v1/game-timelines/${game.gameId}`) } catch {}
    }
    records.push(compactRecord(normalizeGame(fullGame, friend.puuid, timeline)))
    job.completed += 1
    await delay(100)
  }
  return { friends: selectedFriends, records, source: 'lcu' }
}

async function collectSgp(job, selected, count, includeDetails, queueTypes = DEFAULT_QUEUE_TYPES, cached = [], sinceMs = 0, untilMs = Date.now()) {
  const friendList = await lcuCollectableFriends()
  const friendMap = new Map(friendList.map((friend) => [friend.puuid, friend]))
  const selectedFriends = selected.map((puuid) => friendMap.get(puuid)).filter(Boolean)
  if (!selectedFriends.length) throw new Error('所选好友不在当前客户端好友列表中')
  const allowedQueueIds = queueIds(queueTypes)
  const cachedByKey = new Map(cached.map((record) => [libraryRecordKey(record), record]))
  const context = await getSgpContext()
  if (!context.entitlementsToken) throw new Error('未获取到 SGP entitlements token')
  job.message = `SGP ${context.serverId}：读取好友历史`
  job.total = selectedFriends.length * count
  for (const friend of selectedFriends) {
    try {
      friend.rankedStats = context.leagueSessionToken
        ? await sgpRequest(context, `/leagues-ledge/v2/rankedStats/puuid/${encodeURIComponent(friend.puuid)}`, context.leagueSessionToken, { baseUrl: context.commonUrl })
        : null
    } catch {
      friend.rankedStats = null
    }
  }
  const historyByGame = new Map()
  for (const friend of selectedFriends) {
    let startIndex = 0
    const batchSize = Math.min(100, Math.max(count * 2, 50))
    let reachedSinceBoundary = false
    while ([...historyByGame.values()].filter((item) => item.friend.puuid === friend.puuid).length < count && startIndex < 2000 && !reachedSinceBoundary) {
      const query = new URLSearchParams({ startIndex: String(startIndex), count: String(batchSize) })
      const history = await sgpRequest(context, `/match-history-query/v1/products/lol/player/${encodeURIComponent(friend.puuid)}/SUMMARY?${query}`, context.entitlementsToken)
      const games = history?.games || []
      for (const game of games) {
        const createdAt = gameCreatedAt(game?.json)
        if (createdAt && createdAt < sinceMs) reachedSinceBoundary = true
        if (game?.json?.gameId && allowedQueueIds.has(safeNumber(game.json.queueId)) && createdAt >= sinceMs && createdAt <= untilMs) {
          historyByGame.set(`${friend.puuid}:${game.json.gameId}`, { friend, game })
        }
      }
      if (games.length < batchSize) break
      startIndex += games.length
    }
  }

  const gamesToCollect = selectedFriends.flatMap((friend) => [...historyByGame.values()].filter((item) => item.friend.puuid === friend.puuid).slice(0, count))
  job.total = gamesToCollect.length || job.total
  const records = []
  for (let batchStart = 0; batchStart < gamesToCollect.length; batchStart += 5) {
    const batch = gamesToCollect.slice(batchStart, batchStart + 5)
    await Promise.all(batch.map(async ({ friend, game }) => {
      const gameId = game.json.gameId
      job.message = `SGP：读取对局 ${gameId}`
      const cachedRecord = cachedByKey.get(`${friend.puuid}:${gameId}`)
      if (cachedRecord && (!includeDetails || hasCompleteSgpDetail(cachedRecord))) {
        records.push(cachedRecord)
        job.completed += 1
        return
      }
      let details = null
      if (includeDetails) {
        try {
          details = await sgpRequest(context, `/match-history-query/v1/products/lol/${context.subId}_${gameId}/DETAILS`, context.entitlementsToken)
        } catch {}
      }
      records.push(compactRecord(normalizeSgpGame(game, friend.puuid, details)))
      job.completed += 1
    }))
    await delay(100)
  }
  return { friends: selectedFriends, records, source: 'sgp' }
}

async function collectLive(job, selected, count, includeDetails, requestedSource = 'auto', queueTypes = DEFAULT_QUEUE_TYPES, cached = [], sinceMs = 0, untilMs = Date.now()) {
  if (requestedSource === 'lcu') return collectLcu(job, selected, count, includeDetails, queueTypes, cached, sinceMs, untilMs)
  if (requestedSource === 'sgp') return collectSgp(job, selected, count, includeDetails, queueTypes, cached, sinceMs, untilMs)
  try {
    return await collectSgp(job, selected, count, includeDetails, queueTypes, cached, sinceMs, untilMs)
  } catch (error) {
    job.message = `SGP 不可用，回退 LCU：${error.message}`
    return collectLcu(job, selected, count, includeDetails, queueTypes, cached, sinceMs, untilMs)
  }
}

function seeded(seed) {
  let value = seed % 2147483647
  return () => (value = value * 16807 % 2147483647) / 2147483647
}

function createDemoData(requestedCount = 18, requestedPuuids = [], queueTypes = DEFAULT_QUEUE_TYPES) {
  const names = [
    { puuid: 'demo-alice', gameName: '暮色观测者', tagLine: 'ANALYSIS' },
    { puuid: 'demo-bob', gameName: '河道指挥官', tagLine: 'JGL' },
    { puuid: 'demo-cathy', gameName: '银翼射手', tagLine: 'ADC' }
  ]
  names[0].rankedStats = demoRanked('RANKED_SOLO_5x5', 'DIAMOND', 'II', 62, 118, 104)
  names[1].rankedStats = demoRanked('RANKED_SOLO_5x5', 'PLATINUM', 'I', 48, 92, 87)
  names[2].rankedStats = demoRanked('RANKED_SOLO_5x5', 'EMERALD', 'III', 71, 123, 119)
  const champions = [101, 102, 103, 104, 105, 106]
  const records = []
  for (let ownerIndex = 0; ownerIndex < names.length; ownerIndex += 1) {
    const random = seeded(20 + ownerIndex)
    for (let index = 0; index < requestedCount; index += 1) {
      const win = random() > (ownerIndex === 1 ? 0.46 : 0.4)
      const duration = 1450 + Math.floor(random() * 1100)
      const kills = Math.floor(random() * 12)
      const deaths = Math.floor(random() * 8)
      const assists = Math.floor(random() * 16)
      const cs = 80 + Math.floor(random() * 180)
      const damage = 9000 + Math.floor(random() * 28000)
      const owner = names[ownerIndex]
      const participants = Array.from({ length: 10 }, (_, slot) => ({
        puuid: `${owner.puuid}-teammate-${slot}`,
        gameName: slot === 0 ? owner.gameName : `队友${slot + 1}`,
        tagLine: slot === 0 ? owner.tagLine : 'TEAM',
        participantId: slot + 1,
        teamId: slot < 5 ? 100 : 200,
        championId: champions[(index + slot + ownerIndex) % champions.length],
        position: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][slot % 5],
        role: ['SOLO', 'NONE', 'SOLO', 'CARRY', 'SUPPORT'][slot % 5],
        win: slot < 5 ? win : !win,
        kills: slot === 0 ? kills : Math.floor(random() * 10),
        deaths: slot === 0 ? deaths : Math.floor(random() * 9),
        assists: slot === 0 ? assists : Math.floor(random() * 15),
        kda: 0,
        killParticipation: 0,
        cs: slot === 0 ? cs : Math.floor(random() * 210),
        csPerMinute: 0,
        goldEarned: 9000 + Math.floor(random() * 9000),
        damageToChampions: slot === 0 ? damage : 7000 + Math.floor(random() * 30000),
        damagePerMinute: 0,
        damageShare: 0,
        damageTaken: 6000 + Math.floor(random() * 20000),
        damageToTurrets: Math.floor(random() * 6000),
        damageToObjectives: Math.floor(random() * 5000),
        visionScore: 8 + Math.floor(random() * 65),
        wardsPlaced: Math.floor(random() * 22),
        wardsKilled: Math.floor(random() * 12),
        neutralMinionsKilled: Math.floor(random() * 90),
        items: [1001, 2003, 3006, 3031, 3072, 3508, 0],
        spells: [4, FlashId(slot)],
        perks: [8005, 9111, 9104, 8014, 8237, 8347],
        raw: {}
      }))
      const target = participants[0]
      target.kda = (target.kills + target.assists) / Math.max(target.deaths, 1)
      target.csPerMinute = target.cs / (duration / 60)
      target.damagePerMinute = target.damageToChampions / (duration / 60)
      target.damageShare = target.damageToChampions / Math.max(participants.reduce((sum, item) => sum + item.damageToChampions, 0), 1)
      target.killParticipation = (target.kills + target.assists) / Math.max(participants.filter((item) => item.teamId === target.teamId).reduce((sum, item) => sum + item.kills, 0), 1)
      records.push({
        gameId: 900000 + ownerIndex * 100 + index,
        targetPuuid: owner.puuid,
        createdAt: Date.now() - (ownerIndex * 18 + index) * 86_400_000,
        duration,
        gameVersion: '16.15.801.3452',
        gameMode: 'CLASSIC',
        gameType: 'MATCHED_GAME',
        mapId: 11,
        queueId: RANKED_QUEUE_DEFINITIONS[queueTypes[index % queueTypes.length]].id,
        platformId: 'DEMO',
        target,
        participants,
        teams: [{ teamId: 100, win }, { teamId: 200, win: !win }],
        timeline: { frames: Array.from({ length: 5 }, (_, frameIndex) => ({
          timestamp: (frameIndex + 1) * 300000,
          events: frameIndex === 1 ? [{ type: 'CHAMPION_KILL', timestamp: 600000, killerId: 1, victimId: 6, assistingParticipantIds: [2], position: { x: 6000, y: 7000 } }] : [],
          participantFrames: {}
        })) },
        raw: {}
      })
    }
  }
  const friends = requestedPuuids.length ? names.filter((friend) => requestedPuuids.includes(friend.puuid)) : names
  const limitedRecords = friends.flatMap((friend) => records.filter((record) => record.targetPuuid === friend.puuid).slice(0, requestedCount))
  return { friends, records: limitedRecords, source: 'demo', queueTypes }
}

function FlashId(slot) { return slot === 3 ? 7 : 11 }

function demoRanked(queueType, tier, rank, leaguePoints, wins, losses) {
  return { queues: [{ queueType, tier, rank, leaguePoints, wins, losses }] }
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function summarizeTimeline(record) {
  const events = (record.timeline?.frames || []).flatMap((frame) => frame.events || [])
  const targetId = safeNumber(record.target?.participantId)
  const participantTeams = new Map((record.participants || []).map((participant) => [safeNumber(participant.participantId), participant.teamId]))
  const typeCounts = {}
  let kills = 0
  let deaths = 0
  let assists = 0
  let wardsPlaced = 0
  let wardsKilled = 0
  let earlyDeaths = 0
  let isolatedDeaths = 0
  let classifiedDeaths = 0
  let deathSourceEvidence = false
  const deathTimestamps = []
  for (const event of events) {
    const type = event.type || event.eventType || 'UNKNOWN'
    typeCounts[type] = (typeCounts[type] || 0) + 1
    if (type === 'WARD_PLACED' && safeNumber(event.creatorId) === targetId) wardsPlaced += 1
    if (type === 'WARD_KILL' && safeNumber(event.killerId) === targetId) wardsKilled += 1
    if (type === 'CHAMPION_KILL') {
      if (safeNumber(event.killerId) === targetId) kills += 1
      if (safeNumber(event.victimId) === targetId) {
        deaths += 1
        const timestamp = safeNumber(event.timestamp)
        deathTimestamps.push(timestamp)
        if (timestamp <= 900_000) earlyDeaths += 1
        const targetTeam = participantTeams.get(targetId)
        const attackers = new Set((event.victimDamageReceived || [])
          .map((item) => safeNumber(item.participantId))
          .filter((participantId) => participantId && participantId !== targetId && participantTeams.has(participantId) && participantTeams.get(participantId) !== targetTeam))
        if ((event.victimDamageReceived || []).length) deathSourceEvidence = true
        if (attackers.size) {
          classifiedDeaths += 1
          if (attackers.size <= 1) isolatedDeaths += 1
        }
      }
      if ((event.assistingParticipantIds || []).map(safeNumber).includes(targetId)) assists += 1
    }
  }
  deathTimestamps.sort((left, right) => left - right)
  let repeatDeaths = 0
  for (let index = 1; index < deathTimestamps.length; index += 1) {
    if (deathTimestamps[index] - deathTimestamps[index - 1] <= 90_000) repeatDeaths += 1
  }
  return {
    eventCount: events.length,
    kills,
    deaths,
    assists,
    wardsPlaced,
    wardsKilled,
    earlyDeaths,
    isolatedDeaths,
    classifiedDeaths,
    deathSourceEvidence,
    repeatDeaths,
    firstDeathMinute: deathTimestamps.length ? deathTimestamps[0] / 60_000 : null,
    typeCounts
  }
}

function timelineCheckpoints(record) {
  const targetId = safeNumber(record.target?.participantId)
  const frames = record.timeline?.frames || []
  const checkpoint = (minute) => {
    const targetTime = minute * 60_000
    const frame = frames.reduce((best, item) => {
      if (safeNumber(item?.timestamp) > targetTime) return best
      return !best || safeNumber(item.timestamp) > safeNumber(best.timestamp) ? item : best
    }, null)
    const participant = frame?.participantFrames?.[targetId] || frame?.participantFrames?.[String(targetId)]
    if (!participant) return null
    return {
      minute,
      timestamp: safeNumber(frame.timestamp),
      gold: safeNumber(participant.totalGold),
      xp: safeNumber(participant.xp),
      level: safeNumber(participant.level),
      cs: safeNumber(participant.minionsKilled) + safeNumber(participant.jungleMinionsKilled)
    }
  }
  return [5, 10, 15].map(checkpoint).filter(Boolean)
}

function averageRows(rows) {
  const numeric = (key) => {
    const values = rows.map((row) => row?.[key]).filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value))).map(Number)
    return values.length ? avg(values) : null
  }
  return {
    games: rows.length,
    winRate: rows.length ? rows.filter((row) => row.result === '胜利').length / rows.length : null,
    kda: numeric('kda'),
    deaths: numeric('deaths'),
    csPerMinute: numeric('csPerMinute'),
    goldPerMinute: numeric('goldPerMinute'),
    damagePerMinute: numeric('damagePerMinute'),
    killParticipation: numeric('killParticipation'),
    visionScore: numeric('visionScore'),
    objectiveDamagePerMinute: numeric('objectivesDamagePerMinute'),
    earlyDeaths: numeric('earlyDeaths'),
    isolatedDeaths: numeric('isolatedDeaths'),
    repeatDeaths: numeric('repeatDeaths'),
    grade: numeric('grade')
  }
}

function trendDelta(recent, baseline) {
  const keys = ['winRate', 'kda', 'deaths', 'csPerMinute', 'goldPerMinute', 'damagePerMinute', 'killParticipation', 'visionScore', 'objectiveDamagePerMinute', 'earlyDeaths', 'isolatedDeaths', 'repeatDeaths', 'grade']
  return Object.fromEntries(keys.map((key) => [key, recent[key] === null || baseline[key] === null ? null : recent[key] - baseline[key]]))
}

function evidenceConfidence(sample, coverage) {
  if (sample >= 10 && coverage >= .8) return '高'
  if (sample >= 5 && coverage >= .5) return '中'
  return '低'
}

function buildEvidenceInsights(rows, portrait, representativeMatches) {
  const coverage = portrait.coverage?.totalGames ? portrait.coverage.detailedGames / portrait.coverage.totalGames : 0
  const caught = portrait.caughtRisk || {}
  const insights = []
  const add = (claim, metric, value, sample, action, successMetric, candidates) => insights.push({
    claim,
    metric,
    value,
    sample,
    coverage,
    confidence: evidenceConfidence(sample, coverage),
    action,
    successMetric,
    evidence: candidates.filter(Boolean).slice(0, 3).map((row) => ({ gameId: row.gameId, date: row.date, minute: row.firstDeathMinute, result: row.result, championName: row.championName }))
  })
  const early = rows.filter((row) => Number(row.earlyDeaths) > 0).sort((a, b) => Number(b.earlyDeaths) - Number(a.earlyDeaths))
  const isolated = rows.filter((row) => Number(row.isolatedDeaths) > 0).sort((a, b) => Number(b.isolatedDeaths) - Number(a.isolatedDeaths))
  const repeated = rows.filter((row) => Number(row.repeatDeaths) > 0).sort((a, b) => Number(b.repeatDeaths) - Number(a.repeatDeaths))
  if (early.length) add(`样本中有 ${early.length} 场出现 15 分钟前死亡`, 'earlyDeathGames', early.length, rows.length, '下一场把前 15 分钟的无视野压线和少打多接战降到最低。', '连续 3 场 15 分钟前死亡为 0', early)
  if (isolated.length) add(`有 ${isolated.length} 场出现可识别的孤立死亡`, 'isolatedDeathGames', isolated.length, caught.classifiedDeaths || rows.length, '死亡前先检查附近队友和敌方可见人数，缺少支援时立即后撤。', '连续 5 场孤立死亡率低于当前基线', isolated)
  if (repeated.length) add(`有 ${repeated.length} 场出现 90 秒内连续死亡`, 'repeatDeathGames', repeated.length, rows.length, '阵亡后先恢复视野和兵线，不立刻回到上一处高风险区域。', '连续 5 场 90 秒内连续死亡为 0', repeated)
  const lowCs = rows.filter((row) => Number(row.csPerMinute) < 6).sort((a, b) => Number(a.csPerMinute) - Number(b.csPerMinute))
  if (lowCs.length >= 3) add(`${lowCs.length}/${rows.length} 场补刀低于 6/min`, 'lowCsGames', lowCs.length, rows.length, '记录 10 分钟补刀与第一次回城，减少没有收益的早期游走。', '连续 3 场补刀达到 6/min 或个人长期基线', lowCs)
  if (!insights.length && representativeMatches.best) add('当前样本没有形成重复的高风险模式', 'stableSample', rows.length, rows.length, '保持当前节奏，重点复盘代表败局中的第一个转折点。', '扩大到至少 10 场后仍保持稳定', [representativeMatches.worst, representativeMatches.turning])
  return insights
}

function matchGrade(target, timeline) {
  const damageShare = Number.isFinite(Number(target.damageShare)) ? Number(target.damageShare) : 0.2
  const killParticipation = Number.isFinite(Number(target.killParticipation)) ? Number(target.killParticipation) : 0.45
  const raw = 24 + clamp(target.kda / 5) * 22 + clamp(damageShare / 0.3) * 18 + clamp(killParticipation / 0.7) * 15 + clamp(target.visionScore / 45) * 8 + clamp(target.csPerMinute / 8) * 6 + clamp(timeline.kills / 8) * 4 + (target.win ? 9 : 0) - clamp(target.deaths / 10) * 8
  return Math.round(clamp(raw))
}

function gradeLabel(value) {
  if (value >= 90) return 'S'
  if (value >= 80) return 'A'
  if (value >= 70) return 'B'
  if (value >= 60) return 'C'
  return 'D'
}

function matchAdvice(target) {
  const advice = []
  if (target.deaths >= 5) advice.push('减少无视野接战，复盘高频死亡时间点')
  if (target.csPerMinute < 6) advice.push('前 10 分钟优先稳定补刀与回城节奏')
  if (target.killParticipation < 0.45) advice.push('提前观察队友线权，改善支援与转线')
  if (target.visionScore < 20) advice.push('增加关键入口和目标物附近的视野投入')
  return advice.length ? advice : ['保持当前节奏，继续用时间线复盘关键决策']
}

function buildCoachAnalysis({ rows, overview, dimensions, modeBreakdown, positionBreakdown }) {
  const diagnosis = []
  diagnosis.push({
    title: '战斗交换',
    status: overview.kda >= 3 ? '优势' : '待提升',
    evidence: `平均 KDA ${overview.kda.toFixed(2)}，伤害/min ${Math.round(overview.damagePerMinute)}，伤害占比与死亡次数需要结合逐场表判断。`,
    action: overview.damagePerMinute >= 500 ? '保持输出窗口，优先复盘高伤害但失败的对局。' : '训练进场时机，避免技能交完后才开始承担输出。'
  })
  diagnosis.push({
    title: '经济曲线',
    status: overview.csPerMinute >= 6.5 ? '稳定' : '待提升',
    evidence: `平均补刀 ${overview.csPerMinute.toFixed(1)}/min，金币 ${Math.round(overview.goldPerMinute)}/min，经济维度 ${dimensions.economy} 分。`,
    action: overview.csPerMinute < 6.5 ? '固定前 10 分钟补刀目标，减少无收益游走；每次回城前检查下一波兵线。' : '继续保持补刀，同时比较领先时的转化效率。'
  })
  diagnosis.push({
    title: '团队与目标',
    status: overview.killParticipation >= 0.55 ? '积极' : '待提升',
    evidence: `参团率 ${Math.round(overview.killParticipation * 100)}%，目标伤害/min ${Math.round(overview.objectiveDamagePerMinute)}，视野 ${overview.vision.toFixed(1)}/场。`,
    action: overview.killParticipation < 0.55 ? '提前 20–30 秒观察队友线权，围绕先锋、龙和推塔窗口安排转线。' : '把高参团转化为目标物和塔皮，避免只拿击杀不拿资源。'
  })
  const trainingPlan = []
  if (overview.csPerMinute < 6.5) trainingPlan.push({ priority: 'P0', title: '补刀与回城节奏', evidence: `当前 ${overview.csPerMinute.toFixed(1)}/min`, drill: '连续 3 场记录 10 分钟 CS、第一次回城时间和漏刀原因。', metric: '10 分钟 CS 提升到 60+ 或个人位置基线以上' })
  if (overview.deaths >= 5) trainingPlan.push({ priority: 'P0', title: '死亡原因复盘', evidence: `场均死亡 ${overview.deaths.toFixed(1)}`, drill: '逐条打开时间线，给每次死亡标记“无视野、贪线、技能真空、队友失误”之一。', metric: '连续 5 场将无视野死亡控制在 2 次以内' })
  if (overview.killParticipation < 0.55) trainingPlan.push({ priority: 'P1', title: '支援与团战触发', evidence: `参团率 ${Math.round(overview.killParticipation * 100)}%`, drill: '每场记录第一次离开线上支援的时间，以及支援前后获得的击杀/目标。', metric: '参团率达到 55%，且支援至少转化为目标或击杀' })
  if (overview.vision < 25) trainingPlan.push({ priority: 'P1', title: '关键区域视野', evidence: `场均视野 ${overview.vision.toFixed(1)}`, drill: '在下一目标刷新前 45 秒完成河道入口和目标坑视野。', metric: '每场目标前有效视野动作至少 3 次' })
  if (!trainingPlan.length) trainingPlan.push({ priority: 'P1', title: '保持优势并扩大样本', evidence: '主要指标已达到当前样本基线', drill: '按单双排/灵活排位分别积累 20 场，比较不同位置和英雄的稳定性。', metric: '扩大样本后稳定度仍保持在 70 分以上' })
  const matchReviews = rows.map((row) => {
    const evidence = []
    if (row.kda >= 4) evidence.push(`KDA ${row.kda.toFixed(1)}`)
    if (row.damageShare >= 0.25) evidence.push(`伤害占比 ${Math.round(row.damageShare * 100)}%`)
    if (row.csPerMinute < 6) evidence.push(`补刀 ${row.csPerMinute.toFixed(1)}/min`)
    if (row.deaths >= 6) evidence.push(`死亡 ${row.deaths} 次`)
    if (row.timelineEvents) evidence.push(`时间线事件 ${row.timelineEvents} 个`)
    return { gameId: row.gameId, grade: row.gradeLabel, result: row.result, verdict: row.grade >= 75 ? '本场有可复用亮点' : '本场优先寻找决策失误', evidence: evidence.slice(0, 4), action: row.advice?.[0] || '打开时间线，定位第一次优势或崩盘的时间点。' }
  })
  return {
    executiveSummary: `在 ${rows.length} 场排位样本中，胜率 ${Math.round(overview.winRate * 100)}%，平均 KDA ${overview.kda.toFixed(2)}，综合评分 ${overview.total}。当前最值得优先处理的是${trainingPlan[0].title}，结论以逐场证据为准。`,
    diagnosis,
    trainingPlan,
    matchReviews,
    caveat: `这是基于当前样本的复盘建议，不等同于绝对实力判断；评分按当前单双排/灵活排位段位估算对局强度，置信度按段位加权有效样本计算；单双排与灵活排位仍应分开积累样本。`,
    modes: modeBreakdown.map((item) => ({ name: item.modeName, games: item.games, winRate: item.winRate, kda: item.kda })),
    positions: positionBreakdown.map((item) => ({ name: item.positionName, games: item.games, winRate: item.winRate, kda: item.kda }))
  }
}

function compactParticipant(participant) {
  if (!participant) return null
  const { raw, ...compact } = participant
  return compact
}

function compactRecord(record) {
  const { raw, detailRaw, timeline, ...compact } = record
  return {
    ...compact,
    target: compactParticipant(record.target),
    participants: (record.participants || []).map(compactParticipant),
    timeline: { frames: (timeline?.frames || []).map((frame) => compactTimelineFrame(frame, record.target?.participantId)) }
  }
}

function hasCompleteSgpDetail(record) {
  return Boolean(
    (record?.participants || []).some((participant) => Object.keys(participant?.advancedStats || {}).length >= 10) &&
    (record?.detailFile || (record?.timeline?.frames || []).some((frame) => Object.keys(frame?.participantFrames || {}).length))
  )
}

function detailFileName(record) {
  return `${encodeURIComponent(libraryRecordKey(record))}.json`
}

function hydrateRecord(record) {
  if (!record?.detailFile || record.timeline?.frames?.length) return record
  try {
    const detail = JSON.parse(readFileSync(join(detailsDir, record.detailFile), 'utf8'))
    return { ...record, timeline: detail.timeline || { frames: [] } }
  } catch {
    return record
  }
}

function recordDetailQuality(record) {
  const participant = (record?.participants || []).find((item) => item?.advancedStats && Object.keys(item.advancedStats).length)
  const hasFrames = (record?.timeline?.frames || []).some((frame) => Object.keys(frame?.participantFrames || {}).length)
  return Number(record?.detailVersion || 0) + (participant ? 1 : 0) + (hasFrames ? 1 : 0)
}

function libraryRecordKey(record) {
  return `${record.targetPuuid || record.target?.puuid || ''}:${record.gameId || ''}`
}

function readLibrary() {
  if (!existsSync(libraryFile)) {
    libraryCache = { version: 1, updatedAt: null, friends: [], records: [] }
    libraryCacheMtimeMs = -1
    return libraryCache
  }
  const mtimeMs = statSync(libraryFile).mtimeMs
  if (libraryCache && libraryCacheMtimeMs === mtimeMs) return libraryCache
  try {
    const library = JSON.parse(readFileSync(libraryFile, 'utf8').replace(/^\uFEFF/, ''))
    libraryCache = { version: library.version || 1, updatedAt: library.updatedAt || null, friends: Array.isArray(library.friends) ? library.friends : [], records: Array.isArray(library.records) ? library.records : [] }
    libraryCacheMtimeMs = mtimeMs
    return libraryCache
  } catch {
    libraryCache = { version: 1, updatedAt: null, friends: [], records: [] }
    libraryCacheMtimeMs = mtimeMs
    return libraryCache
  }
}

function writeLibrary(library) {
  library.updatedAt = new Date().toISOString()
  writeFileSync(libraryFile, JSON.stringify(library), 'utf8')
  libraryCache = library
  libraryCacheMtimeMs = statSync(libraryFile).mtimeMs
}

function compactFriend(friend) {
  if (!friend) return null
  return {
    puuid: friend.puuid,
    gameName: friend.gameName || friend.name || '',
    tagLine: friend.tagLine || friend.gameTag || '',
    rankedStats: friend.rankedStats || null
  }
}

function mergeIntoLibrary(payload) {
  const library = readLibrary()
  const friends = new Map(library.friends.map((friend) => [friend.puuid, friend]))
  const records = new Map(library.records.map((record) => [libraryRecordKey(record), record]))
  for (const [key, record] of records) {
    if (!record.timeline?.frames?.length || record.detailFile) continue
    const detailFile = detailFileName(record)
    const timelineSummary = summarizeTimeline(record)
    writeFileSync(join(detailsDir, detailFile), JSON.stringify({ timeline: record.timeline }), 'utf8')
    records.set(key, { ...record, timeline: { frames: [] }, timelineSummary, detailFile, detailVersion: record.detailVersion || 2 })
  }
  for (const friend of payload.friends || []) {
    const compact = compactFriend(friend)
    if (!compact?.puuid) continue
    friends.set(compact.puuid, { ...friends.get(compact.puuid), ...compact })
  }
  for (const record of payload.records || []) {
    const compact = compactRecord(record)
    const key = libraryRecordKey(compact)
    if (!key.endsWith(':')) {
      compact.detailsAvailable = Boolean(record.timeline?.frames?.length)
      compact.detailVersion = compact.detailsAvailable ? 2 : 0
      if (compact.detailsAvailable) {
        compact.detailFile = detailFileName(compact)
        compact.timelineSummary = summarizeTimeline(compact)
        writeFileSync(join(detailsDir, compact.detailFile), JSON.stringify({ timeline: compact.timeline }), 'utf8')
        compact.timeline = { frames: [] }
      }
      const previous = records.get(key)
      if (!previous || recordDetailQuality(compact) > recordDetailQuality(previous) || (!previous.detailsAvailable && compact.detailsAvailable)) records.set(key, compact)
    }
  }
  library.friends = [...friends.values()]
  library.records = [...records.values()]
  writeLibrary(library)
  return library
}

function cachedRecords(library, puuids, queueTypes, count = Infinity) {
  const allowedQueueIds = queueIds(queueTypes)
  return puuids.flatMap((puuid) => library.records
    .filter((record) => record.targetPuuid === puuid && allowedQueueIds.has(Number(record.queueId)))
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .slice(0, count))
}

function cacheHasCoverage(library, puuids, queueTypes, count, includeDetails) {
  const allowedQueueIds = queueIds(queueTypes)
  return puuids.every((puuid) => {
    const records = library.records
      .filter((record) => record.targetPuuid === puuid && allowedQueueIds.has(Number(record.queueId)))
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
      .slice(0, count)
    return records.length >= count && (!includeDetails || records.every(hasCompleteSgpDetail))
  })
}

function libraryPayload(library, puuids, queueTypes, count = Infinity) {
  const friendMap = new Map(library.friends.map((friend) => [friend.puuid, friend]))
  const friends = puuids.map((puuid) => friendMap.get(puuid)).filter(Boolean)
  return { friends, records: cachedRecords(library, puuids, queueTypes, count), source: 'library', queueTypes }
}

function libraryIndex() {
  const library = readLibrary()
  const recordsByFriend = new Map()
  const now = Date.now()
  for (const record of library.records) {
    const list = recordsByFriend.get(record.targetPuuid) || []
    list.push(record)
    recordsByFriend.set(record.targetPuuid, list)
  }
  return {
    updatedAt: library.updatedAt,
    dataHealth: {
      totalRecords: library.records.length,
      detailedRecords: library.records.filter((record) => record.detailsAvailable).length,
      latestMatchAt: library.records.length ? new Date(Math.max(...library.records.map((record) => safeNumber(record.createdAt)))).toISOString() : null,
      recent7d: library.records.filter((record) => now - safeNumber(record.createdAt) <= 7 * 86_400_000).length,
      recent30d: library.records.filter((record) => now - safeNumber(record.createdAt) <= 30 * 86_400_000).length,
      queueCounts: Object.fromEntries([420, 440].map((queueId) => [queueId, library.records.filter((record) => safeNumber(record.queueId) === queueId).length]))
    },
    friends: library.friends.map((friend) => {
      const records = recordsByFriend.get(friend.puuid) || []
      const queues = [...new Set(records.map((record) => Number(record.queueId)).filter((queueId) => [420, 440].includes(queueId)))]
      const latest = records.reduce((current, record) => Math.max(current, Number(record.createdAt || 0)), 0)
      return { ...friend, sampleSize: records.length, latestMatchAt: latest ? new Date(latest).toISOString() : null, queues }
    })
  }
}

function buildReport(payload, options = {}) {
  const grouped = new Map()
  for (const record of payload.records) {
    if (!record.target) continue
    const list = grouped.get(record.targetPuuid) || []
    list.push(record)
    grouped.set(record.targetPuuid, list)
  }

  const reports = payload.friends.map((friend) => {
    const records = grouped.get(friend.puuid) || []
    let checkpointBudget = 20
    const rows = records.map((record) => {
      const target = record.target
      const timeline = record.timelineSummary || summarizeTimeline(record)
      const checkpoints = record.detailsAvailable && checkpointBudget-- > 0 ? timelineCheckpoints(hydrateRecord(record)) : []
      const grade = matchGrade(target, timeline)
      const minutes = Math.max(record.duration / 60, 1)
      const rank = rankProfile(friend, record.queueId)
      const recency = recencyProfile(record.createdAt)
      return {
        gameId: record.gameId,
        date: new Date(record.createdAt).toISOString(),
        queueId: record.queueId,
        mode: record.gameMode,
        modeName: modeName(record.gameMode, record.queueId),
        queueName: record.queueId === 420 ? '单双排' : record.queueId === 440 ? '灵活排位' : `排位队列 ${record.queueId}`,
        rankTier: rank.tier,
        rankName: rank.label,
        rankWeight: rank.weight,
        recencyWeight: recency.weight,
        evidenceWeight: Number((rank.weight * recency.weight).toFixed(3)),
        daysSinceMatch: Number(recency.daysSince.toFixed(1)),
        activityStatus: recency.status,
        duration: record.duration,
        version: record.gameVersion,
        championId: target.championId,
        championName: target.championName || `英雄 ${target.championId}`,
         position: normalizePosition(target.position, target.role),
         positionName: positionName(normalizePosition(target.position, target.role)),
        result: target.win ? '胜利' : '失败',
        kills: target.kills,
        deaths: target.deaths,
        assists: target.assists,
        kda: target.kda,
         killParticipation: target.teamStatsAvailable === false || (record.participants || []).length < 10 ? null : target.killParticipation,
        cs: target.cs,
        csPerMinute: target.csPerMinute,
        goldEarned: target.goldEarned,
        goldPerMinute: target.goldEarned / minutes,
        damage: target.damageToChampions,
        damagePerMinute: target.damagePerMinute,
        damageShare: target.teamStatsAvailable === false || (record.participants || []).length < 10 ? null : target.damageShare,
        teamStatsAvailable: target.teamStatsAvailable !== false && (record.participants || []).length >= 10,
        advancedStats: target.advancedStats || {},
        detailsAvailable: Boolean(record.detailsAvailable || record.timeline?.frames?.length),
        damageTaken: target.damageTaken,
        damageTakenPerMinute: target.damageTaken / minutes,
        visionScore: target.visionScore,
        wardsPlaced: target.wardsPlaced,
        wardsKilled: target.wardsKilled,
        objectivesDamage: target.damageToObjectives,
        objectivesDamagePerMinute: target.damageToObjectives / minutes,
        neutralMinionsKilled: target.neutralMinionsKilled,
         timelineEvents: timeline.eventCount,
         timelineKills: timeline.kills,
         timelineDeaths: timeline.deaths,
         timelineAssists: timeline.assists,
         timelineWardsPlaced: timeline.wardsPlaced,
         timelineWardsKilled: timeline.wardsKilled,
         earlyDeaths: timeline.earlyDeaths,
         isolatedDeaths: timeline.isolatedDeaths,
         classifiedDeaths: timeline.classifiedDeaths,
         deathSourceEvidence: timeline.deathSourceEvidence,
         repeatDeaths: timeline.repeatDeaths,
         firstDeathMinute: timeline.firstDeathMinute,
         timelineTypes: timeline.typeCounts,
        checkpoints,
        grade,
        gradeLabel: gradeLabel(grade),
        advice: matchAdvice(target)
      }
    })
    const rankWeights = rows.map((row) => row.rankWeight || 1)
    const weights = rows.map((row) => row.evidenceWeight || row.rankWeight || 1)
    const rankWeightTotal = rankWeights.reduce((sum, value) => sum + value, 0)
    const totalWeight = weights.reduce((sum, value) => sum + value, 0)
    const effectiveSampleSize = totalWeight ** 2 / Math.max(weights.reduce((sum, value) => sum + value ** 2, 0), 1)
    const weighted = (values) => weightedAverage(values, weights)
    const winRate = weighted(rows.map((row) => row.result === '胜利' ? 1 : 0))
    const kda = weighted(rows.map((row) => row.kda))
    const damagePerMinute = weighted(rows.map((row) => row.damagePerMinute))
    const csPerMinute = weighted(rows.map((row) => row.csPerMinute))
    const killParticipation = weighted(rows.map((row) => row.killParticipation))
    const vision = weighted(rows.map((row) => row.visionScore))
    const objective = weighted(rows.map((row) => row.objectivesDamage))
    const deaths = weighted(rows.map((row) => row.deaths))
    const goldPerMinute = weighted(rows.map((row) => row.goldPerMinute))
    const damageTakenPerMinute = weighted(rows.map((row) => row.damageTakenPerMinute))
    const objectiveDamagePerMinute = weighted(rows.map((row) => row.objectivesDamagePerMinute))
    const wardsPlaced = weighted(rows.map((row) => row.wardsPlaced))
    const wardsKilled = weighted(rows.map((row) => row.wardsKilled))
    const timelineEvents = weighted(rows.map((row) => row.timelineEvents))
    const averageGrade = weighted(rows.map((row) => row.grade))
    const medianGrade = median(rows.map((row) => row.grade))
    const gradeSpread = Math.sqrt(weighted(rows.map((row) => (row.grade - averageGrade) ** 2)))
    const consistency = clamp(100 - gradeSpread * 1.8)
    const bestMatch = rows.reduce((best, row) => !best || row.grade > best.grade ? row : best, null)
    const worstMatch = rows.reduce((worst, row) => !worst || row.grade < worst.grade ? row : worst, null)
    const combat = clamp(25 + clamp(kda / 5) * 32 + clamp(damagePerMinute / 600) * 25 + winRate * 18)
    const team = clamp(18 + clamp(killParticipation / 0.7) * 55 + clamp(vision / 50) * 22)
    const economy = clamp(18 + clamp(csPerMinute / 8) * 48 + clamp(goldPerMinute / 500) * 28)
    const objectiveScore = clamp(18 + clamp(objectiveDamagePerMinute / 450) * 60 + winRate * 18)
    const stability = clamp(100 - weighted(rows.map((row) => Math.abs(row.kda - kda))) * 13 - Math.max(deaths - 4, 0) * 3)
    const total = Math.round(combat * 0.28 + team * 0.22 + economy * 0.16 + objectiveScore * 0.16 + winRate * 100 * 0.12 + stability * 0.06)
    const latestRow = rows.reduce((latest, row) => !latest || row.date > latest.date ? row : latest, null)
    const daysSinceLastMatch = latestRow ? Math.max(0, (Date.now() - new Date(latestRow.date).getTime()) / 86_400_000) : Infinity
    const recentGames30d = rows.filter((row) => row.daysSinceMatch <= 30).length
    const recentGames90d = rows.filter((row) => row.daysSinceMatch <= RANKING_RULES.maxInactiveDays).length
    const activityStatus = !rows.length ? '无有效对局' : daysSinceLastMatch <= 30 ? '活跃' : daysSinceLastMatch <= RANKING_RULES.maxInactiveDays ? '近期' : '非活跃'
    const activityWeight = latestRow ? Math.max(.08, Math.pow(.5, daysSinceLastMatch / RANKING_RULES.recencyHalfLifeDays)) : 0
    const sampleReliability = clamp(effectiveSampleSize / 10, 0, 1)
    const rankingScore = Math.round(total * (.7 + .3 * activityWeight) * (.65 + .35 * sampleReliability))
    const rankingStatus = !rows.length ? '无有效对局' : rows.length < RANKING_RULES.minGames ? '样本不足' : effectiveSampleSize < RANKING_RULES.minEffectiveSample ? '有效样本不足' : daysSinceLastMatch > RANKING_RULES.maxInactiveDays ? '非活跃' : '正式排名'
    const rankingEligible = rankingStatus === '正式排名'
    const overview = { winRate, kda, damagePerMinute, csPerMinute, killParticipation, vision, deaths, total, rankingScore, goldPerMinute, damageTakenPerMinute, objectiveDamagePerMinute, wardsPlaced, wardsKilled, timelineEvents, averageGrade, medianGrade, consistency, totalWeight, effectiveSampleSize, averageRankWeight: rankWeightTotal / Math.max(rows.length, 1), averageEvidenceWeight: totalWeight / Math.max(rows.length, 1), lastMatchAt: latestRow?.date || null, daysSinceLastMatch, recentGames30d, recentGames90d, activityStatus, rankingStatus, rankingEligible }
    const dimensions = { combat: Math.round(combat), team: Math.round(team), economy: Math.round(economy), objective: Math.round(objectiveScore), stability: Math.round(stability) }
    const championMap = new Map()
    for (const row of rows) {
      const item = championMap.get(row.championId) || { championId: row.championId, championName: row.championName, games: 0, weight: 0, wins: 0, kda: 0, damagePerMinute: 0, csPerMinute: 0 }
      const rowWeight = row.evidenceWeight || row.rankWeight || 1
      item.games += 1
      item.weight += rowWeight
      item.wins += row.result === '胜利' ? rowWeight : 0
      item.kda += row.kda * rowWeight
      item.damagePerMinute += row.damagePerMinute * rowWeight
      item.csPerMinute += row.csPerMinute * rowWeight
      championMap.set(row.championId, item)
    }
    const champions = [...championMap.values()].map((item) => ({ ...item, winRate: item.wins / Math.max(item.weight, 1), kda: item.kda / Math.max(item.weight, 1), damagePerMinute: item.damagePerMinute / Math.max(item.weight, 1), csPerMinute: item.csPerMinute / Math.max(item.weight, 1) })).sort((a, b) => b.games - a.games)
    const modeMap = new Map()
    const positionMap = new Map()
    for (const row of rows) {
      const modeKey = `${row.queueId}:${row.mode}`
      const mode = modeMap.get(modeKey) || { mode: modeKey, modeName: row.queueName, queueId: row.queueId, games: 0, weight: 0, wins: 0, kda: 0, damagePerMinute: 0, csPerMinute: 0, killParticipation: 0, killParticipationWeight: 0 }
      const rowWeight = row.evidenceWeight || row.rankWeight || 1
      mode.games += 1
      mode.weight += rowWeight
      mode.wins += row.result === '胜利' ? rowWeight : 0
      mode.kda += row.kda * rowWeight
      mode.damagePerMinute += row.damagePerMinute * rowWeight
      mode.csPerMinute += row.csPerMinute * rowWeight
      if (Number.isFinite(Number(row.killParticipation))) {
        mode.killParticipation += Number(row.killParticipation) * rowWeight
        mode.killParticipationWeight += rowWeight
      }
      modeMap.set(modeKey, mode)
      const position = positionMap.get(row.position) || { position: row.position, positionName: row.positionName, games: 0, weight: 0, wins: 0, kda: 0, damagePerMinute: 0, csPerMinute: 0, killParticipation: 0, killParticipationWeight: 0 }
      position.games += 1
      position.weight += rowWeight
      position.wins += row.result === '胜利' ? rowWeight : 0
      position.kda += row.kda * rowWeight
      position.damagePerMinute += row.damagePerMinute * rowWeight
      position.csPerMinute += row.csPerMinute * rowWeight
      if (Number.isFinite(Number(row.killParticipation))) {
        position.killParticipation += Number(row.killParticipation) * rowWeight
        position.killParticipationWeight += rowWeight
      }
      positionMap.set(row.position, position)
    }
    const modeBreakdown = [...modeMap.values()].map((item) => ({ ...item, winRate: item.wins / Math.max(item.weight, 1), kda: item.kda / Math.max(item.weight, 1), damagePerMinute: item.damagePerMinute / Math.max(item.weight, 1), csPerMinute: item.csPerMinute / Math.max(item.weight, 1), killParticipation: item.killParticipationWeight ? item.killParticipation / item.killParticipationWeight : null }))
    const positionBreakdown = [...positionMap.values()].map((item) => ({ ...item, positionName: positionName(item.position), winRate: item.wins / Math.max(item.weight, 1), kda: item.kda / Math.max(item.weight, 1), damagePerMinute: item.damagePerMinute / Math.max(item.weight, 1), csPerMinute: item.csPerMinute / Math.max(item.weight, 1), killParticipation: item.killParticipationWeight ? item.killParticipation / item.killParticipationWeight : null }))
    const deepAnalysis = buildCoachAnalysis({ rows, overview, dimensions, modeBreakdown, positionBreakdown })
    const detailedRows = rows.filter((row) => row.detailsAvailable)
    const detailedMinutes = detailedRows.reduce((sum, row) => sum + Math.max(Number(row.duration || 0) / 60, 1), 0)
    const detailedDeaths = detailedRows.reduce((sum, row) => sum + Number(row.timelineDeaths || 0), 0)
    const classifiedDeaths = detailedRows.reduce((sum, row) => sum + Number(row.classifiedDeaths || 0), 0)
    const deathSourceEvidenceGames = detailedRows.filter((row) => row.deathSourceEvidence).length
    const isolatedDeaths = detailedRows.reduce((sum, row) => sum + Number(row.isolatedDeaths || 0), 0)
    const earlyDeaths = detailedRows.reduce((sum, row) => sum + Number(row.earlyDeaths || 0), 0)
    const repeatDeaths = detailedRows.reduce((sum, row) => sum + Number(row.repeatDeaths || 0), 0)
    const deathPerGame = detailedRows.length ? detailedDeaths / detailedRows.length : null
    const earlyDeathPerGame = detailedRows.length ? earlyDeaths / detailedRows.length : null
    const isolatedDeathRate = classifiedDeaths ? isolatedDeaths / classifiedDeaths : null
    const repeatDeathRate = detailedDeaths ? repeatDeaths / detailedDeaths : null
    const catchRisk = detailedRows.length ? Math.round(clamp((deathPerGame || 0) / 5 * 35 + (earlyDeathPerGame || 0) / 2 * 25 + (isolatedDeathRate || 0) * 25 + (repeatDeathRate || 0) * 15)) : null
    const detailedRecordMap = new Map(records.map((record) => [String(record.gameId), record]))
    const pingRecords = detailedRows.map((row) => detailedRecordMap.get(String(row.gameId))).filter((record) => Object.keys(record?.target?.advancedStats || {}).some((key) => key.endsWith('Pings')))
    const pingKeys = ['allInPings', 'assistMePings', 'dangerPings', 'enemyMissingPings', 'enemyVisionPings', 'getBackPings', 'holdPings', 'needVisionPings', 'onMyWayPings', 'pushPings', 'retreatPings', 'visionClearedPings']
    const pingTotals = Object.fromEntries(pingKeys.map((key) => [key, pingRecords.reduce((sum, record) => sum + safeNumber(record.target?.advancedStats?.[key]), 0)]))
    const pingAverages = Object.fromEntries(pingKeys.map((key) => [key, pingRecords.length ? pingTotals[key] / pingRecords.length : null]))
    const portrait = {
      coverage: {
        totalGames: rows.length,
        detailedGames: detailedRows.length,
        summaryOnlyGames: rows.length - detailedRows.length,
        teamStatsGames: rows.filter((row) => row.teamStatsAvailable).length,
        pingGames: pingRecords.length
      },
      caughtRisk: {
        score: catchRisk,
        deathsPerDetailedGame: deathPerGame,
        earlyDeathsPerDetailedGame: earlyDeathPerGame,
        isolatedDeathRate,
        repeatDeathRate,
        classifiedDeaths,
        isolationEvidenceGames: deathSourceEvidenceGames
      },
      laneHabits: {
        wardsPlacedPer15: detailedMinutes && detailedRows.some((row) => row.timelineTypes?.WARD_PLACED) ? detailedRows.reduce((sum, row) => sum + Number(row.timelineWardsPlaced || 0), 0) / detailedMinutes * 15 : null,
        wardsKilledPer15: detailedMinutes && detailedRows.some((row) => row.timelineTypes?.WARD_KILL) ? detailedRows.reduce((sum, row) => sum + Number(row.timelineWardsKilled || 0), 0) / detailedMinutes * 15 : null,
        medianFirstDeathMinute: median(detailedRows.map((row) => row.firstDeathMinute).filter((value) => Number.isFinite(Number(value))))
      },
      signalHabits: {
        available: pingRecords.length > 0,
        games: pingRecords.length,
        totals: pingTotals,
        perGame: pingAverages,
        reason: pingRecords.length ? '基于 SGP 参赛者摘要中的 Ping 次数；它能反映沟通频率，不能还原每次 Ping 的地图位置与时间' : '当前详表没有 Ping 统计字段'
      }
    }
    const chronologicalRows = [...rows].sort((left, right) => new Date(right.date) - new Date(left.date))
    const recent5 = averageRows(chronologicalRows.slice(0, 5))
    const recent10 = averageRows(chronologicalRows.slice(0, 10))
    const baselineRows = chronologicalRows.length > 10 ? chronologicalRows.slice(10) : chronologicalRows
    const baseline = averageRows(baselineRows)
    const checkpointSummary = [5, 10, 15].map((minute) => {
      const values = chronologicalRows.map((row) => row.checkpoints?.find((item) => item.minute === minute)).filter(Boolean)
      return {
        minute,
        games: values.length,
        gold: values.length ? avg(values.map((item) => item.gold)) : null,
        xp: values.length ? avg(values.map((item) => item.xp)) : null,
        level: values.length ? avg(values.map((item) => item.level)) : null,
        cs: values.length ? avg(values.map((item) => item.cs)) : null
      }
    })
    const representativeMatches = {
      best: chronologicalRows.reduce((best, row) => !best || row.grade > best.grade ? row : best, null),
      worst: chronologicalRows.reduce((worst, row) => !worst || row.grade < worst.grade ? row : worst, null),
      turning: [...chronologicalRows].sort((left, right) => (Number(right.earlyDeaths) * 20 + Number(right.repeatDeaths) * 15 + Math.abs(Number(right.grade) - 70)) - (Number(left.earlyDeaths) * 20 + Number(left.repeatDeaths) * 15 + Math.abs(Number(left.grade) - 70)))[0] || null
    }
    const trend = { recent5, recent10, baseline, delta5: trendDelta(recent5, baseline), delta10: trendDelta(recent10, baseline), checkpoints: checkpointSummary }
    const evidenceInsights = buildEvidenceInsights(chronologicalRows.slice(0, 30), portrait, representativeMatches)
    const strengths = []
    const risks = []
    const recommendations = []
    if (killParticipation >= 0.55) strengths.push('团战参与率较高，能持续参与队伍击杀')
    if (vision >= 25) strengths.push('视野贡献稳定')
    if (damagePerMinute >= 450) strengths.push('输出效率突出')
    if (averageGrade >= 75) strengths.push(`逐场评级均值 ${Math.round(averageGrade)}，高质量对局占比不错`)
    if (deaths >= 5) risks.push('平均死亡偏高，建议减少无视野区域的接战')
    if (csPerMinute < 6) risks.push('补刀效率偏低，经济曲线容易落后')
    if (killParticipation < 0.45) risks.push('团战参与率偏低，需改善支援和转线时机')
    if (consistency < 65) risks.push('逐场表现波动较大，优势局与低谷局差距明显')
    if (csPerMinute < 6) recommendations.push('前 10 分钟优先稳定补刀，减少无收益游走')
    if (deaths >= 5) recommendations.push('把关键死亡按时间线复盘，重点检查河道与边线视野')
    recommendations.push('按排位模式、位置和英雄分别统计；本报告只用召唤师峡谷排位样本评价排位能力，不把娱乐模式表现混入结论')
    return {
      friend,
      sampleSize: rows.length,
      confidence: Math.round(clamp(effectiveSampleSize / (effectiveSampleSize + 10) * 100)),
      rankWeighting: {
        method: '对局权重 = 段位强度 × 时间新鲜度；黄金为 1.00 基准，越久远的对局影响越低',
        effectiveSampleSize,
        averageWeight: rankWeightTotal / Math.max(rows.length, 1),
        averageEvidenceWeight: totalWeight / Math.max(rows.length, 1),
        queues: [...new Map(rows.map((row) => [row.queueId, { queueName: row.queueName, rankName: row.rankName, rankWeight: row.rankWeight, recencyWeight: row.recencyWeight }])).values()]
      },
      ranking: { eligible: rankingEligible, status: rankingStatus, score: overview.rankingScore, reason: rankingStatus === '正式排名' ? '满足场次、有效样本和活跃度要求' : `暂不纳入正式排名：${rankingStatus}` },
      overview,
      dimensions,
      strengths: strengths.length ? strengths : ['当前样本仍在积累，暂未形成稳定优势结论'],
      risks: risks.length ? risks : ['暂未发现明显短板，继续积累不同模式样本'],
      recommendations,
      champions,
      modeBreakdown,
      positionBreakdown,
      deepAnalysis,
      rankedStats: friend.rankedStats ? { ...friend.rankedStats, queues: (friend.rankedStats.queues || []).filter((queue) => payload.queueTypes?.some((type) => queue.queueType === RANKED_QUEUE_DEFINITIONS[type].queueType)).map((queue) => ({ ...queue, queueName: queueTypeName(queue.queueType), tierName: tierName(queue.tier), rankName: rankName(queue.rank) })) } : null,
      advanced: {
        bestMatch: bestMatch ? { gameId: bestMatch.gameId, grade: bestMatch.grade, gradeLabel: bestMatch.gradeLabel, date: bestMatch.date } : null,
        worstMatch: worstMatch ? { gameId: worstMatch.gameId, grade: worstMatch.grade, gradeLabel: worstMatch.gradeLabel, date: worstMatch.date } : null,
        gradeDistribution: ['S', 'A', 'B', 'C', 'D'].map((label) => ({ label, games: rows.filter((row) => row.gradeLabel === label).length })),
        timelineTypes: rows.reduce((result, row) => { for (const [type, count] of Object.entries(row.timelineTypes || {})) result[type] = (result[type] || 0) + count; return result }, {})
      },
      portrait,
      trend,
      representativeMatches,
      evidenceInsights,
      matches: rows,
      ...(options.includeRawRecords === false ? {} : { rawRecords: records.map(compactRecord) })
    }
  })
  return { generatedAt: new Date().toISOString(), source: payload.source, collection: payload.collection || null, players: reports }
}

function aiInput(report) {
  return report.players.map((player, playerIndex) => ({
    playerIndex,
    sampleSize: player.sampleSize,
    overview: player.overview,
    dimensions: player.dimensions,
    ranked: player.rankedStats?.queues || [],
    modes: player.modeBreakdown,
    positions: player.positionBreakdown,
    champions: player.champions,
    advanced: player.advanced,
    portrait: player.portrait,
    matches: player.matches.slice(0, 120).map((match) => ({
      gameId: match.gameId,
      date: match.date,
      queueName: match.queueName,
      rankName: match.rankName,
      rankWeight: match.rankWeight,
      recencyWeight: match.recencyWeight,
      evidenceWeight: match.evidenceWeight,
      modeName: match.modeName,
      championName: match.championName,
      positionName: match.positionName,
      result: match.result,
      grade: match.grade,
      kills: match.kills,
      deaths: match.deaths,
      assists: match.assists,
      kda: match.kda,
      csPerMinute: match.csPerMinute,
      goldPerMinute: match.goldPerMinute,
      damagePerMinute: match.damagePerMinute,
      damageShare: match.damageShare,
      damageTakenPerMinute: match.damageTakenPerMinute,
      objectivesDamagePerMinute: match.objectivesDamagePerMinute,
      visionScore: match.visionScore,
      wardsPlaced: match.wardsPlaced,
      wardsKilled: match.wardsKilled,
      timelineEvents: match.timelineEvents,
      advice: match.advice
    }))
  }))
}

function extractResponseText(value) {
  if (typeof value.output_text === 'string') return value.output_text
  return (value.output || []).flatMap((item) => item.content || []).filter((item) => item.type === 'output_text').map((item) => item.text).join('\n')
}

async function generateAiAnalysis(report) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('未配置 OPENAI_API_KEY。请在当前 CMD 设置 API Key 后重启服务。')
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const prompt = `你是一名严谨的英雄联盟高段位教练和数据分析师。请只根据输入数据进行深度复盘，绝对不要编造看不到的技能、装备或时间线事实。输出严格 JSON，不要 Markdown，不要额外解释。所有自然语言必须使用简体中文。\nJSON 结构必须是：{"players":[{"playerIndex":0,"headline":"一句话结论","scoreReason":"解释综合评分的主要原因","strengths":["证据型优势"],"risks":["证据型问题"],"trainingPlan":[{"priority":"P0/P1/P2","title":"训练主题","why":"数据证据","drill":"具体训练动作","successMetric":"可测目标","reviewMethod":"复盘方法"}],"matchReviews":[{"gameId":0,"grade":"S/A/B/C/D","summary":"本场发生了什么","evidence":["数据证据"],"turningPoint":"最值得复盘的转折点；若数据不足请明确说不足","nextAction":"下一场只做的一件事"}],"modeComparison":"单双排和灵活排位的差异；没有数据就说明","confidence":"样本限制"}]}。重点回答：为什么赢/输、优势是否可复用、最应该先改什么、如何用下一场验证。\n输入数据：${JSON.stringify(aiInput(report))}`
  const response = await fetch(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 7000 }),
    signal: AbortSignal.timeout(120_000)
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`AI 请求失败（${response.status}）：${body.error?.message || '未知错误'}`)
  const text = extractResponseText(body).replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new Error('AI 返回的不是有效 JSON，请重试或更换模型') }
  if (!Array.isArray(parsed.players)) throw new Error('AI 返回缺少 players 字段')
  return { model, generatedAt: new Date().toISOString(), players: parsed.players }
}

async function startJob(body) {
  const jobId = randomUUID()
  const job = { id: jobId, status: 'running', completed: 0, total: 1, message: '准备采集', result: null, error: null }
  jobs.set(jobId, job)
  const count = Math.max(1, Math.min(Number(body.count) || 20, 1000))
  const selected = Array.isArray(body.puuids) ? body.puuids.slice(0, 500) : []
  const queueTypes = normalizeQueueTypes(body.queueTypes || body.queues)
  Promise.resolve().then(async () => {
    const includeDetails = body.includeDetails !== false
    const library = body.demo ? null : readLibrary()
    const cached = library ? cachedRecords(library, selected, queueTypes) : []
    const explicitSince = body.since ? Date.parse(String(body.since)) : NaN
    const latestCached = cached.reduce((latest, record) => Math.max(latest, gameCreatedAt(record)), 0)
    const sinceMs = Number.isFinite(explicitSince) ? explicitSince : latestCached
    const untilMs = body.until ? Date.parse(String(body.until)) : Date.now()
    const cacheHit = Boolean(library && selected.length && cacheHasCoverage(library, selected, queueTypes, count, includeDetails))
    const payload = body.demo
      ? createDemoData(count, selected, queueTypes)
      : cacheHit
        ? libraryPayload(library, selected, queueTypes, count)
        : await collectLive(job, selected, count, includeDetails, body.source || 'auto', queueTypes, cached, sinceMs, untilMs)
    payload.queueTypes = queueTypes
    payload.collection = { queueTypes, queueLabels: queueLabels(queueTypes), requestedCount: count, actualCount: payload.records.length, includeDetails, cacheHit, since: sinceMs ? new Date(sinceMs).toISOString() : null, until: new Date(untilMs).toISOString(), incremental: Boolean(sinceMs) }
    job.message = '正在整理中文游戏数据字典'
    if (payload.source !== 'library') await enrichGameDictionary(payload)
    if (!body.demo && payload.source !== 'library') mergeIntoLibrary(payload)
    job.total = payload.records.length || job.total
    job.completed = payload.records.length
    job.result = buildReport(payload, { includeRawRecords: payload.records.length <= 500 })
    job.status = 'done'
    job.message = '采集和分析完成'
    writeFileSync(join(dataDir, `${jobId}.json`), JSON.stringify(job.result, null, 2), 'utf8')
  }).catch((error) => {
    job.status = 'error'
    job.error = error.message
    job.message = '采集失败'
  })
  return job
}

const CSV_FIELD_NAMES = {
  name: '玩家', tag: '标签', gameId: '对局ID', date: '日期', queueId: '队列ID', queueName: '排位模式', rankName: '段位', rankWeight: '段位强度系数', mode: '模式代码', modeName: '模式', duration: '对局时长（秒）', version: '游戏版本', championId: '英雄ID', championName: '英雄', position: '位置代码', positionName: '位置', result: '结果', kills: '击杀', deaths: '死亡', assists: '助攻', kda: 'KDA', cs: '补刀', csPerMinute: '补刀/分钟', goldEarned: '金币', goldPerMinute: '金币/分钟', damage: '英雄伤害', damagePerMinute: '伤害/分钟', damageShare: '伤害占比', damageTaken: '承受伤害', damageTakenPerMinute: '承伤/分钟', visionScore: '视野得分', wardsPlaced: '插眼', wardsKilled: '排眼', objectivesDamage: '目标伤害', objectivesDamagePerMinute: '目标伤害/分钟', neutralMinionsKilled: '野怪补刀', timelineEvents: '时间线事件', timelineKills: '时间线击杀', timelineDeaths: '时间线死亡', timelineAssists: '时间线助攻', timelineTypes: '时间线事件类型', grade: '本场评分', gradeLabel: '本场评级', advice: '本场复盘建议', items: '装备ID', itemNames: '装备', spells: '技能ID', spellNames: '召唤师技能', perks: '符文ID', perkNames: '符文'
}

function csv(report) {
  const rows = report.players.flatMap((player) => player.matches.map((match) => ({ name: player.friend.gameName, tag: player.friend.tagLine, ...match })))
  if (!rows.length) return ''
  const fields = Object.keys(rows[0])
  const quote = (value) => { const serialized = Array.isArray(value) ? value.join('；') : value && typeof value === 'object' ? JSON.stringify(value) : value; return `"${String(serialized ?? '').replaceAll('"', '""')}"` }
  return [fields.map((field) => CSV_FIELD_NAMES[field] || field).join(','), ...rows.map((row) => fields.map((field) => quote(row[field])).join(','))].join('\n')
}

function participantCsv(report) {
  const rows = []
  for (const player of report.players) {
    for (const record of player.rawRecords || []) {
      for (const participant of record.participants || []) {
        rows.push({
          name: player.friend.gameName,
          tag: player.friend.tagLine,
          gameId: record.gameId,
          date: new Date(record.createdAt).toISOString(),
          mode: record.gameMode,
          modeName: modeName(record.gameMode, record.queueId),
          queueId: record.queueId,
          queueName: record.queueId === 420 ? '单双排' : record.queueId === 440 ? '灵活排位' : `排位队列 ${record.queueId}`,
          ...participant,
          items: (participant.items || []).join('|'),
          itemNames: (participant.itemNames || []).join('|'),
          spells: (participant.spells || []).join('|'),
          spellNames: (participant.spellNames || []).join('|'),
          perks: (participant.perks || []).join('|'),
          perkNames: (participant.perkNames || []).join('|'),
          raw: undefined
        })
      }
    }
  }
  if (!rows.length) return ''
  const fields = Object.keys(rows[0]).filter((field) => field !== 'raw')
  const quote = (value) => { const serialized = Array.isArray(value) ? value.join('；') : value && typeof value === 'object' ? JSON.stringify(value) : value; return `"${String(serialized ?? '').replaceAll('"', '""')}"` }
  return [fields.map((field) => CSV_FIELD_NAMES[field] || field).join(','), ...rows.map((row) => fields.map((field) => quote(row[field])).join(','))].join('\n')
}

async function handle(request, response) {
  const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`)
  const pathname = requestUrl.pathname
  if (request.method === 'GET' && pathname === '/api/status') {
    let connection = null
    try { connection = getLcuConnection() } catch {}
    const sgpServerId = connection ? getSgpServerId(connection) : ''
    json(response, 200, { connected: Boolean(connection), port: connection?.port || null, region: connection?.region || '', rsoPlatformId: connection?.rsoPlatformId || '', sgpServerId, sgpConfigured: Boolean(SGP_SERVERS[sgpServerId]) })
    return
  }
  if (request.method === 'GET' && pathname === '/api/friends') {
    try { json(response, 200, { source: 'lcu', friends: await lcuCollectableFriends() }); return } catch (error) { json(response, 503, { error: error.message }); return }
  }
  if (request.method === 'GET' && pathname === '/api/current-summoner') {
    try {
      const current = await lcuRequest('/lol-summoner/v1/current-summoner')
      json(response, 200, { source: 'lcu', summoner: { puuid: current?.puuid || '', gameName: current?.gameName || current?.displayName || current?.name || '当前召唤师', tagLine: current?.tagLine || current?.gameTag || '' } })
    } catch (error) { json(response, 503, { error: error.message }) }
    return
  }
  if (request.method === 'GET' && pathname === '/api/current-history-check') {
    try {
      const current = await lcuRequest('/lol-summoner/v1/current-summoner')
      const pages = []
      const queueCounts = {}
      let total = 0
      for (let startIndex = 0; startIndex < 1000; startIndex += 100) {
        const history = await lcuRequest(`/lol-match-history/v1/products/lol/${encodeURIComponent(current.puuid)}/matches?begIndex=${startIndex}&endIndex=${startIndex + 99}`)
        const games = history?.games?.games || []
        const pageQueues = {}
        for (const game of games) {
          const queueId = safeNumber(game?.queueId)
          pageQueues[queueId] = (pageQueues[queueId] || 0) + 1
          queueCounts[queueId] = (queueCounts[queueId] || 0) + 1
        }
        pages.push({ startIndex, count: games.length, firstGameId: games[0]?.gameId || null, lastGameId: games.at(-1)?.gameId || null, firstGameIndex: games[0]?.gameIndex ?? games[0]?.gameCreation ?? null, lastGameIndex: games.at(-1)?.gameIndex ?? games.at(-1)?.gameCreation ?? null, responseKeys: Object.keys(history || {}), gameKeys: Object.keys(games[0] || {}), queues: pageQueues })
        total += games.length
        if (games.length < 100) break
      }
      json(response, 200, { puuid: current.puuid, total, ranked: [420, 440].reduce((sum, queueId) => sum + (queueCounts[queueId] || 0), 0), queueCounts, pages })
    } catch (error) { json(response, 503, { error: error.message }) }
    return
  }
  if (request.method === 'GET' && pathname === '/api/current-history-variants') {
    try {
      const current = await lcuRequest('/lol-summoner/v1/current-summoner')
      const variants = [
        ['current-page-0', `/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex=99`],
        ['current-page-100', `/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=100&endIndex=199`],
        ['puuid-page-0', `/lol-match-history/v1/products/lol/${encodeURIComponent(current.puuid)}/matches?begIndex=0&endIndex=99`],
        ['puuid-page-100', `/lol-match-history/v1/products/lol/${encodeURIComponent(current.puuid)}/matches?begIndex=100&endIndex=199`]
      ]
      const results = []
      for (const [name, pathname] of variants) {
        try {
          const history = await lcuRequest(pathname)
          const games = history?.games?.games || []
          results.push({ name, count: games.length, firstGameId: games[0]?.gameId || null, lastGameId: games.at(-1)?.gameId || null })
        } catch (error) { results.push({ name, error: error.message }) }
      }
      json(response, 200, { results })
    } catch (error) { json(response, 503, { error: error.message }) }
    return
  }
  if (request.method === 'GET' && pathname === '/api/current-sgp-check') {
    try {
      const current = await lcuRequest('/lol-summoner/v1/current-summoner')
      const context = await getSgpContext()
      const results = []
      for (const startIndex of [0, 100, 200]) {
        const query = new URLSearchParams({ startIndex: String(startIndex), count: '100' })
        try {
          const history = await sgpRequest(context, `/match-history-query/v1/products/lol/player/${encodeURIComponent(current.puuid)}/SUMMARY?${query}`, context.entitlementsToken)
          const games = history?.games || []
          results.push({ startIndex, count: games.length, firstGameId: games[0]?.json?.gameId || null, lastGameId: games.at(-1)?.json?.gameId || null })
        } catch (error) { results.push({ startIndex, error: error.message }) }
      }
      json(response, 200, { serverId: context.serverId, subId: context.subId, baseUrl: context.baseUrl, commonUrl: context.commonUrl, hasEntitlements: Boolean(context.entitlementsToken), hasLeagueSession: Boolean(context.leagueSessionToken), results })
    } catch (error) { json(response, 503, { error: error.message }) }
    return
  }
  if (request.method === 'GET' && pathname === '/api/demo/friends') {
    json(response, 200, { source: 'demo', friends: createDemoData().friends })
    return
  }
  if (request.method === 'GET' && pathname === '/api/library') {
    json(response, 200, libraryIndex())
    return
  }
  if (request.method === 'GET' && pathname === '/api/library/match') {
    try {
      const gameId = safeNumber(requestUrl.searchParams.get('gameId'))
      const puuid = requestUrl.searchParams.get('puuid') || ''
      const record = readLibrary().records.find((item) => safeNumber(item.gameId) === gameId && (!puuid || item.targetPuuid === puuid))
      if (!record) { json(response, 404, { error: '找不到这场对局的详尽数据' }); return }
      json(response, 200, hydrateRecord(record))
    } catch (error) { json(response, 400, { error: error.message }) }
    return
  }
  if (request.method === 'POST' && pathname === '/api/library/report') {
    try {
      const body = await readBody(request)
      const selected = Array.isArray(body.puuids) ? body.puuids.slice(0, 500) : []
      const queueTypes = normalizeQueueTypes(body.queueTypes || body.queues)
      const allowedCounts = [20, 50, 100, 200]
      const count = allowedCounts.includes(Number(body.count)) ? Number(body.count) : 20
      if (!selected.length) throw new Error('请至少选择一位玩家')
      const library = readLibrary()
      const payload = libraryPayload(library, selected, queueTypes, count)
      payload.collection = { queueTypes, queueLabels: queueLabels(queueTypes), requestedCount: count, actualCount: payload.records.length, includeDetails: true, cacheHit: true }
      json(response, 200, buildReport(payload, { includeRawRecords: false }))
    } catch (error) {
      json(response, 400, { error: error.message })
    }
    return
  }
  const playerReportMatch = pathname.match(/^\/api\/library\/players\/([^/]+)$/)
  if (request.method === 'GET' && playerReportMatch) {
    try {
      const puuid = decodeURIComponent(playerReportMatch[1])
      const queueTypes = normalizeQueueTypes((requestUrl.searchParams.get('queues') || 'solo,flex').split(','))
      const allowedCounts = [20, 50, 100, 200]
      const requestedCount = safeNumber(requestUrl.searchParams.get('count'))
      const count = allowedCounts.includes(requestedCount) ? requestedCount : 50
      const library = readLibrary()
      if (!library.friends.some((friend) => friend.puuid === puuid)) throw new Error('资料库中找不到该玩家')
      const payload = libraryPayload(library, [puuid], queueTypes, count)
      payload.collection = { queueTypes, queueLabels: queueLabels(queueTypes), requestedCount: count, actualCount: payload.records.length, includeDetails: true, cacheHit: true }
      json(response, 200, buildReport(payload, { includeRawRecords: false }))
    } catch (error) { json(response, 400, { error: error.message }) }
    return
  }
  if (request.method === 'POST' && pathname === '/api/collect') {
    try { json(response, 202, await startJob(await readBody(request))); return } catch (error) { json(response, 400, { error: error.message }); return }
  }
  const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/)
  if (request.method === 'GET' && jobMatch) {
    const job = jobs.get(jobMatch[1])
    if (!job) { json(response, 404, { error: '任务不存在或服务已重启' }); return }
    json(response, 200, { id: job.id, status: job.status, completed: job.completed, total: job.total, message: job.message, error: job.error })
    return
  }
  const aiReportMatch = pathname.match(/^\/api\/reports\/([^/]+)\/ai$/)
  if (request.method === 'POST' && aiReportMatch) {
    const job = jobs.get(aiReportMatch[1])
    if (!job?.result) { json(response, 404, { error: '报告尚未生成' }); return }
    try {
      job.message = '正在请求 AI 深度复盘'
      const analysis = await generateAiAnalysis(job.result)
      job.result.ai = analysis
      for (const [index, player] of job.result.players.entries()) player.aiAnalysis = analysis.players.find((item) => item.playerIndex === index) || null
      job.message = 'AI 深度复盘完成'
      writeFileSync(join(dataDir, `${job.id}.json`), JSON.stringify(job.result, null, 2), 'utf8')
      json(response, 200, { analysis })
    } catch (error) {
      job.message = 'AI 深度复盘失败'
      json(response, 503, { error: error.message })
    }
    return
  }
  const reportMatch = pathname.match(/^\/api\/reports\/([^/]+)$/)
  if (request.method === 'GET' && reportMatch && requestUrl.searchParams.get('format') === 'json') {
    const job = jobs.get(reportMatch[1])
    if (!job?.result) { json(response, 404, { error: 'report-not-ready' }); return }
    const body = JSON.stringify(job.result, null, 2)
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="lol-match-report.json"' })
    response.end(body)
    return
  }
  if (request.method === 'GET' && reportMatch && requestUrl.searchParams.get('format') === 'participants') {
    const job = jobs.get(reportMatch[1])
    if (!job?.result) { json(response, 404, { error: 'report-not-ready' }); return }
    const content = participantCsv(job.result)
    response.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="lol-match-participants.csv"' })
    response.end(`\ufeff${content}`)
    return
  }
  if (request.method === 'GET' && reportMatch && requestUrl.searchParams.get('format') === 'csv') {
    const job = jobs.get(reportMatch[1])
    if (!job?.result) { json(response, 404, { error: '报告尚未生成' }); return }
    const content = csv(job.result)
    response.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="lol-match-report.csv"' })
    response.end(`\ufeff${content}`)
    return
  }
  if (request.method === 'GET' && reportMatch) {
    const job = jobs.get(reportMatch[1])
    if (!job?.result) { json(response, 404, { error: '报告尚未生成' }); return }
    json(response, 200, job.result)
    return
  }
  if (request.method === 'GET') {
    const safePath = normalize(pathname === '/' ? '/dashboard.html' : pathname)
    const filePath = join(publicDir, safePath)
    if (!filePath.startsWith(publicDir) || !existsSync(filePath)) { response.writeHead(404); response.end('Not found'); return }
    const contentType = filePath.endsWith('.html')
      ? 'text/html; charset=utf-8'
      : filePath.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : filePath.endsWith('.json')
          ? 'application/json; charset=utf-8'
          : filePath.endsWith('.md')
            ? 'text/markdown; charset=utf-8'
            : 'text/javascript; charset=utf-8'
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' })
    response.end(readFileSync(filePath))
    return
  }
  json(response, 405, { error: '方法不支持' })
}

createServer((request, response) => { handle(request, response).catch((error) => json(response, 500, { error: error.message })) }).listen(port, '127.0.0.1', () => {
  console.log(`LoL Friend Analytics running at http://127.0.0.1:${port}`)
})
