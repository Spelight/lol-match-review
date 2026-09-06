const playerQuery = new URLSearchParams(window.location.search).get('player') || ''
const state = { library: [], health: null, report: null, role: 'ALL', activePuuid: playerQuery || null, focused: Boolean(playerQuery) }
const $ = (selector) => document.querySelector(selector)
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
const number = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-'
const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0))
const roleProfiles = {
  TOP: { label: '上路', icon: '↑', weights: { win: .18, combat: .23, economy: .27, team: .12, survival: .20 }, focus: '经济发育、对线换血、生存承压与团战转化' },
  JUNGLE: { label: '打野', icon: '♞', weights: { win: .16, combat: .16, economy: .14, team: .27, objective: .27 }, focus: '支援参团、资源控制、战斗转化与自身发育' },
  MIDDLE: { label: '中路', icon: '◉', weights: { win: .18, combat: .28, economy: .25, team: .20, survival: .09 }, focus: '对线压制、伤害转化、推线支援与团战输出' },
  BOTTOM: { label: '射手', icon: '◈', weights: { win: .18, combat: .28, economy: .30, team: .14, survival: .10 }, focus: '补刀发育、持续输出、团战站位与生存' },
  UTILITY: { label: '辅助', icon: '✦', weights: { win: .18, engage: .24, protection: .18, team: .20, vision: .20 }, focus: '视野控制、开团控制、保护能力与团队参与' }
}
const roleAxes = {
  ALL: [['combat', '战斗'], ['team', '团队'], ['economy', '经济'], ['objective', '目标'], ['stability', '稳定']],
  TOP: [['economy', '经济发育'], ['combat', '对线换血'], ['survival', '生存承压'], ['team', '团战转化'], ['win', '胜负结果']],
  JUNGLE: [['objective', '资源控制'], ['team', '支援参团'], ['combat', '战斗转化'], ['economy', '发育效率'], ['survival', '自身稳定']],
  MIDDLE: [['combat', '对线输出'], ['economy', '推线发育'], ['team', '支援团战'], ['objective', '资源协同'], ['survival', '生存质量']],
  BOTTOM: [['economy', '补刀发育'], ['combat', '持续输出'], ['survival', '团战生存'], ['team', '团队转化'], ['win', '胜负结果']],
  UTILITY: [['vision', '视野控制'], ['engage', '开团控制'], ['protection', '保护能力'], ['team', '团队参与'], ['win', '胜负结果']]
}
const roleLabels = [['ALL', '综合'], ...Object.entries(roleProfiles).map(([key, profile]) => [key, profile.label])]

async function request(path, options) {
  const response = await fetch(path, options)
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || `请求失败（${response.status}）`)
  return value
}

function toast(message) {
  const node = $('#dashboardToast')
  node.textContent = message
  node.classList.add('show')
  window.setTimeout(() => node.classList.remove('show'), 3000)
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false })
}

function signed(value, digits = 1, suffix = '') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-'
  const numeric = Number(value)
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(digits)}${suffix}`
}

function isWin(row) { return row.result === '胜利' || row.result === 'Win' || row.result === true }
function positionKey(value) {
  const key = String(value || '').toUpperCase()
  if (key === 'TOP') return 'TOP'
  if (['JUNGLE', 'JG'].includes(key)) return 'JUNGLE'
  if (['MIDDLE', 'MID', 'CENTER'].includes(key)) return 'MIDDLE'
  if (['BOTTOM', 'ADC', 'CARRY', 'DUO', 'DUO_CARRY'].includes(key)) return 'BOTTOM'
  if (['UTILITY', 'SUPPORT', 'DUO_SUPPORT'].includes(key)) return 'UTILITY'
  return ''
}
function rowWeight(row) { return Number(row.evidenceWeight || row.rankWeight || 1) }
function numericValue(value) { return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null }
function metricValue(row, key) {
  const direct = numericValue(row?.[key])
  if (direct !== null) return direct
  const advanced = row?.advancedStats || {}
  const nested = advanced.challenges || {}
  return numericValue(advanced[key]) ?? numericValue(nested[key])
}
function scoreMetric(value, low, high) {
  const numeric = numericValue(value)
  if (numeric === null) return null
  const ratio = (numeric - low) / Math.max(high - low, Number.EPSILON)
  return clamp(18 + ratio * 82)
}
function neutralScore(value, low, high) { return scoreMetric(value, low, high) ?? 50 }
function blendScores(parts) {
  const available = parts.filter((part) => Number.isFinite(Number(part?.score)))
  if (!available.length) return 50
  const weight = available.reduce((sum, part) => sum + part.weight, 0)
  return available.reduce((sum, part) => sum + part.score * part.weight, 0) / Math.max(weight, Number.EPSILON)
}
function roleInfo(player, role) {
  if (role === 'ALL') return { score: Number(player.overview?.total || 0), metrics: { ...player.dimensions, win: Number(player.overview?.winRate || 0) * 100 }, rows: player.matches || [], effectiveSampleSize: Number(player.overview?.effectiveSampleSize || 0), winRate: Number(player.overview?.winRate || 0), formal: Boolean(player.ranking?.eligible) }
  const rows = (player.matches || []).filter((row) => positionKey(row.position) === role)
  const weights = rows.map(rowWeight)
  const totalWeight = weights.reduce((sum, value) => sum + value, 0)
  const avg = (key) => {
    let total = 0
    let weight = 0
    rows.forEach((row, index) => {
      const value = metricValue(row, key)
      if (value === null) return
      total += value * weights[index]
      weight += weights[index]
    })
    return weight ? total / weight : null
  }
  const winRate = totalWeight ? rows.reduce((sum, row, index) => sum + (isWin(row) ? weights[index] : 0), 0) / totalWeight : 0
  const effectiveSampleSize = totalWeight ** 2 / Math.max(weights.reduce((sum, value) => sum + value ** 2, 0), 1)
  const kp = avg('killParticipation')
  const damageShare = avg('damageShare')
  const allyPicks = avg('pickKillWithAlly')
  const immobilizations = avg('enemyChampionImmobilizations')
  const controlTime = avg('timeCCingOthers')
  const earlyTakedowns = avg('takedownsFirstXMinutes')
  const dragonTakedowns = avg('dragonTakedowns')
  const baronTakedowns = avg('baronTakedowns')
  const epicSteals = avg('epicMonsterSteals')
  const shields = avg('totalDamageShieldedOnTeammates')
  const heals = avg('totalHealsOnTeammates')
  const saves = avg('saveAllyFromDeath')
  const visionPerMinute = avg('visionScorePerMinute')
  const controlWards = avg('controlWardsPlaced')
  const metrics = {
    win: winRate * 100,
    combat: neutralScore(avg('kda'), 1, 5) * .55 + neutralScore(avg('damagePerMinute'), 180, 700) * .45,
    economy: neutralScore(avg('csPerMinute'), 3, 8),
    team: blendScores([
      { score: scoreMetric(kp, .28, .68), weight: role === 'UTILITY' ? .35 : .55 },
      { score: scoreMetric(damageShare, .12, .32), weight: role === 'BOTTOM' ? .35 : .20 },
      { score: scoreMetric(allyPicks, .5, 5), weight: role === 'UTILITY' ? .30 : .25 },
      { score: scoreMetric(earlyTakedowns, .5, 4), weight: role === 'JUNGLE' ? .20 : .0 },
      { score: scoreMetric(controlTime, 10, 70), weight: role === 'UTILITY' ? .20 : .0 }
    ]),
    objective: blendScores([
      { score: scoreMetric(avg('objectivesDamagePerMinute'), 30, 450), weight: .55 },
      { score: scoreMetric(dragonTakedowns, .5, 3), weight: role === 'JUNGLE' ? .25 : .15 },
      { score: scoreMetric(baronTakedowns, .1, 1), weight: role === 'JUNGLE' ? .15 : .10 },
      { score: scoreMetric(epicSteals, .05, 1), weight: role === 'JUNGLE' ? .10 : .05 }
    ]),
    survival: neutralScore(8 - (avg('deaths') ?? 4), 0, 7),
    vision: blendScores([
      { score: scoreMetric(avg('visionScore'), 10, 55), weight: .65 },
      { score: scoreMetric(visionPerMinute, .3, 1.1), weight: .20 },
      { score: scoreMetric(controlWards, .5, 4), weight: .15 }
    ]),
    engage: blendScores([
      { score: scoreMetric(controlTime, 10, 70), weight: .40 },
      { score: scoreMetric(immobilizations, 2, 15), weight: .35 },
      { score: scoreMetric(allyPicks, 1, 6), weight: .25 }
    ]),
    protection: blendScores([
      { score: scoreMetric(shields, 500, 8000), weight: .40 },
      { score: scoreMetric(heals, 500, 6000), weight: .30 },
      { score: scoreMetric(saves, .1, 3), weight: .30 }
    ])
  }
  const profile = roleProfiles[role]
  const score = Object.entries(profile.weights).reduce((sum, [key, weight]) => sum + (metrics[key] || 0) * weight, 0)
  const formal = rows.length >= 3 && effectiveSampleSize >= 2 && rows.some((row) => row.activityStatus !== '非活跃') && player.overview?.activityStatus !== '非活跃'
  const analysisFields = ['killParticipation', 'damageShare', 'pickKillWithAlly', 'enemyChampionImmobilizations', 'timeCCingOthers', 'totalDamageShieldedOnTeammates', 'totalHealsOnTeammates', 'saveAllyFromDeath', 'visionScorePerMinute', 'controlWardsPlaced']
  const coveredFields = analysisFields.filter((key) => rows.some((row) => metricValue(row, key) !== null)).length
  return { score: Math.round(score), metrics, rows, effectiveSampleSize, winRate, formal, coverage: Math.round(coveredFields / analysisFields.length * 100) }
}

function statusFor(player, role) {
  const info = roleInfo(player, role)
  if (role === 'ALL') return player.ranking?.status || player.overview?.rankingStatus || '暂不排名'
  if (info.formal) return '正式排名'
  if (player.overview?.activityStatus === '非活跃') return '非活跃'
  if (info.rows.length < 3) return '定位样本不足'
  return '定位有效样本不足'
}

function rankingScore(player, role) {
  const info = roleInfo(player, role)
  if (role === 'ALL') return Number(player.overview?.rankingScore ?? player.overview?.total ?? 0)
  return Math.round(info.score * (.65 + .35 * clamp(info.effectiveSampleSize / 10, 0, 1)))
}

function radarValue(player, role, key) { return Number(roleInfo(player, role).metrics[key] || 0) }

function renderRadar(players, role) {
  const axes = roleAxes[role]
  const centerX = 185, centerY = 162, radius = 108
  const point = (value, index, scale = radius) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / axes.length
    const distance = scale * clamp(value) / 100
    return `${centerX + Math.cos(angle) * distance},${centerY + Math.sin(angle) * distance}`
  }
  const polygon = (value, className = 'radar-grid', color = '') => `<polygon class="${className}" ${color ? `style="--comparison-color:${color}"` : ''} points="${axes.map((_, index) => point(value, index)).join(' ')}"/>`
  const grid = [25, 50, 75, 100].map((value) => polygon(value)).join('')
  const lines = axes.map(([, label], index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / axes.length; const x = centerX + Math.cos(angle) * (radius + 28); const y = centerY + Math.sin(angle) * (radius + 28); return `<line class="radar-axis" x1="${centerX}" y1="${centerY}" x2="${centerX + Math.cos(angle) * radius}" y2="${centerY + Math.sin(angle) * radius}"/><text x="${x}" y="${y}" text-anchor="middle">${label}</text>` }).join('')
  const colors = ['#2ee4ca', '#9d8cff', '#ff756b', '#f2c667', '#6ea8ff', '#e98bce']
  const shapes = players.slice(0, 6).map((player, index) => polygon(100, 'radar-shape', colors[index]).replace(`points="${axes.map((_, axisIndex) => point(100, axisIndex)).join(' ')}"`, `points="${axes.map(([key], axisIndex) => point(radarValue(player, role, key), axisIndex)).join(' ')}"`)).join('')
  const legend = players.slice(0, 6).map((player, index) => `<span><i style="background:${colors[index]}"></i>${escapeHtml(player.friend?.gameName || '未知玩家')}</span>`).join('')
  const focus = role === 'ALL' ? '综合维度' : `${roleProfiles[role].label}侧重：${roleProfiles[role].focus}`
  return `<div class="showcase-radar"><div><svg viewBox="0 0 370 300" role="img" aria-label="${escapeHtml(focus)}雷达图">${grid}${lines}${shapes}<circle cx="${centerX}" cy="${centerY}" r="3" fill="var(--teal)"/></svg><div class="comparison-legend">${legend}</div><div class="radar-focus"><b>${escapeHtml(role === 'ALL' ? '综合评价' : roleProfiles[role].label + '专项评价')}</b> · ${escapeHtml(focus)}</div></div></div>`
}

function rankText(player) {
  const queues = player.rankWeighting?.queues || []
  if (!queues.length) return '段位信息未保存'
  return queues.map((queue) => `${queue.rankName || '未获取段位'} ×${number(queue.rankWeight, 3)}`).join(' / ')
}

function renderRanking(players, role) {
  const formal = players.filter((player) => statusFor(player, role) === '正式排名').sort((a, b) => rankingScore(b, role) - rankingScore(a, role) || roleInfo(b, role).effectiveSampleSize - roleInfo(a, role).effectiveSampleSize)
  const pending = players.filter((player) => statusFor(player, role) !== '正式排名')
  const rows = formal.map((player, index) => { const info = roleInfo(player, role); return `<tr><td><span class="ranking-number">${index + 1}</span></td><td><b>${escapeHtml(player.friend?.gameName || '未知玩家')}</b><small>${info.rows.length} 场 · 有效样本 ${number(info.effectiveSampleSize, 1)}</small><em>${escapeHtml(rankText(player))}</em></td><td class="ranking-score">${rankingScore(player, role)}</td><td>${percent(info.winRate)}</td><td>${number(player.overview?.kda)}</td></tr>` }).join('')
  const pendingRows = pending.map((player) => { const info = roleInfo(player, role); return `<tr class="pending-player"><td>—</td><td><b>${escapeHtml(player.friend?.gameName || '未知玩家')}</b><small>${info.rows.length} 场 · ${escapeHtml(statusFor(player, role))}</small><em>${escapeHtml(rankText(player))}</em></td><td>—</td><td>—</td><td>—</td></tr>` }).join('')
  const title = role === 'ALL' ? '综合排名' : `${roleProfiles[role].label}定位排名`
  const method = role === 'ALL' ? '表现 × 活跃度 × 样本可靠度；不足条件的玩家不进入正式排名' : `${roleProfiles[role].focus}；按该定位有效样本修正`
  return `<div class="showcase-ranking"><h4>${title}</h4><span class="method">${method}</span>${formal.length || pending.length ? `<table><thead><tr><th>#</th><th>玩家 / 加权说明</th><th>排名分</th><th>胜率</th><th>KDA</th></tr></thead><tbody>${rows}${pendingRows}</tbody></table>` : '<div class="ranking-empty">当前没有可展示的玩家</div>'}</div>`
}

function renderComparison(players) {
  const roleTabs = roleLabels.map(([key, label]) => `<button class="showcase-role-tab ${state.role === key ? 'active' : ''}" data-role="${key}">${label}</button>`).join('')
  const formalCount = players.filter((player) => statusFor(player, state.role) === '正式排名').length
  const radarPlayers = players.filter((player) => statusFor(player, state.role) === '正式排名')
  return `<section class="showcase-panel"><div class="showcase-panel-head"><div><span class="kicker">RANKING & RADAR</span><h3>好友横向对比</h3><p>切换定位后，雷达轴和排名依据会同步改变。</p></div><span class="showcase-sample">正式排名 ${formalCount} 人 · 共 ${players.length} 人</span></div><div class="showcase-role-tabs">${roleTabs}</div><div class="showcase-top">${renderRadar(radarPlayers.length ? radarPlayers : players, state.role)}${renderRanking(players, state.role)}</div></section>`
}

function list(items) { return `<ul>${(items?.length ? items : ['样本仍在积累中，暂未形成明确结论']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` }
function renderBreakdown(items, mode) {
  const rows = (items || []).sort((a, b) => Number(b.games || 0) - Number(a.games || 0)).slice(0, 8).map((item) => `<tr><td>${escapeHtml(mode ? item.modeName || item.mode : item.positionName || item.position)}</td><td>${item.games || 0}</td><td>${percent(item.winRate)}</td><td>${number(item.kda)}</td><td>${number(item.weight, 1)}</td></tr>`).join('')
  return `<div class="card showcase-table-card"><div class="showcase-section-head"><h3>${mode ? '模式拆分' : '位置拆分'}</h3><span>段位与新鲜度加权</span></div><div class="showcase-table-wrap"><table class="showcase-table"><thead><tr><th>${mode ? '模式' : '位置'}</th><th>场次</th><th>胜率</th><th>KDA</th><th>有效权重</th></tr></thead><tbody>${rows || '<tr><td colspan="5">暂无数据</td></tr>'}</tbody></table></div></div>`
}

function detailedMetric(participant, key) {
  return participant?.advancedStats?.[key] ?? participant?.[key]
}

function detailedText(participant, key, format = 'number') {
  const value = detailedMetric(participant, key)
  if (value === undefined || value === null || value === '') return '-'
  if (format === 'boolean') return value ? '是' : '否'
  if (format === 'percent') return `${number(value * 100, 1)}%`
  if (format === 'float') return number(value, 2)
  return number(value, 0)
}

function renderDashboardDetail(record) {
  const participants = record?.participants || []
  if (!participants.length) return '<div class="side-empty">这场对局没有完整的十人数据。</div>'
  const get = (key, format) => (participant) => detailedText(participant, key, format)
  const groups = [
    ['战斗', [['结果', (p) => p.win ? '胜利' : '失败'], ['K / D / A', (p) => `${p.kills ?? 0} / ${p.deaths ?? 0} / ${p.assists ?? 0}`], ['KDA', get('kda', 'float')], ['参团率', get('killParticipation', 'percent')], ['单杀', get('soloKills')], ['双杀 / 三杀', (p) => `${detailedText(p, 'doubleKills')} / ${detailedText(p, 'tripleKills')}`], ['四杀 / 五杀', (p) => `${detailedText(p, 'quadraKills')} / ${detailedText(p, 'pentaKills')}`]]],
    ['伤害 / 承伤', [['英雄伤害', (p) => number(p.damageToChampions, 0)], ['物理伤害', get('physicalDamageDealtToChampions')], ['魔法伤害', get('magicDamageDealtToChampions')], ['真实伤害', get('trueDamageDealtToChampions')], ['总承伤', (p) => number(p.damageTaken, 0)], ['减免伤害', get('damageSelfMitigated')], ['队友护盾', get('totalDamageShieldedOnTeammates')]]],
    ['视野 / 建筑 / 目标', [['视野得分', (p) => number(p.visionScore, 0)], ['视野 / 分钟', get('visionScorePerMinute', 'float')], ['插眼 / 排眼', (p) => `${p.wardsPlaced ?? 0} / ${p.wardsKilled ?? 0}`], ['控制守卫', get('controlWardsPlaced')], ['防御塔参与', get('turretTakedowns')], ['镀层', get('turretPlatesTaken')], ['小龙参与', get('dragonTakedowns')], ['男爵参与', get('baronTakedowns')], ['偷取史诗野怪', get('epicMonsterSteals')]]],
    ['经济 / 发育', [['补刀', (p) => p.cs ?? 0], ['补刀 / 分钟', (p) => number(p.csPerMinute)], ['金币', (p) => number(p.goldEarned, 0)], ['金币 / 分钟', (p) => number((p.goldEarned || 0) / Math.max((record.duration || 1) / 60, 1), 0)], ['总兵线补刀', get('totalMinionsKilled')], ['己方野怪', get('totalAllyJungleMinionsKilled')], ['敌方野怪', get('totalEnemyJungleMinionsKilled')], ['装备购买', get('itemsPurchased')]]],
    ['技能 / Ping', [['Q / W / E / R', (p) => `${detailedText(p, 'spell1Casts')} / ${detailedText(p, 'spell2Casts')} / ${detailedText(p, 'spell3Casts')} / ${detailedText(p, 'spell4Casts')}`], ['召唤师技能使用', (p) => `${detailedText(p, 'summoner1Casts')} / ${detailedText(p, 'summoner2Casts')}`], ['All-in', get('allInPings')], ['协助我', get('assistMePings')], ['危险', get('dangerPings')], ['敌人消失', get('enemyMissingPings')], ['撤退', get('retreatPings')], ['支援路上', get('onMyWayPings')], ['清除视野', get('visionClearedPings')]]],
    ['生存 / 控制', [['控制时长', get('timeCCingOthers')], ['限制敌方次数', get('enemyChampionImmobilizations')], ['技能命中', get('skillshotsHit')], ['技能躲避', get('skillshotsDodged')], ['被英雄击杀', get('deathsByEnemyChamps')], ['死亡时间', get('totalTimeSpentDead')], ['低血量存活', get('survivedSingleDigitHpCount')], ['队友治疗', get('totalHealsOnTeammates')]]]
  ]
  const header = participants.map((participant) => { const target = participant.puuid === record.targetPuuid; const name = participant.gameName || '未知玩家'; const champion = participant.championName || `英雄 ${participant.championId}`; return `<th class="participant-head ${participant.win ? 'team-blue' : 'team-red'} ${target ? 'target-player' : ''}"><span class="participant-champion">${escapeHtml(champion.slice(0, 1))}</span><b>${escapeHtml(name)}</b><small>${escapeHtml(champion)} · ${escapeHtml(participant.positionName || participant.position || '未分配')}</small></th>` }).join('')
  return `<div class="akari-groups dashboard-detail-groups">${groups.map(([title, rows]) => `<section class="akari-group"><div class="akari-group-title"><b>${title}</b><span>全场十名参赛者</span></div><div class="akari-table-scroll"><table class="akari-table"><thead><tr><th class="metric-name">指标</th>${header}</tr></thead><tbody>${rows.map(([label, getter]) => `<tr><th class="metric-name">${label}</th>${participants.map((participant) => `<td class="${label === '结果' ? (participant.win ? 'win' : 'loss') : ''}">${escapeHtml(String(getter(participant)))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`).join('')}</div>`
}

function renderMatches(player) {
  const visible = (player.matches || []).slice(0, 30)
  const visibleIds = new Set(visible.map((match) => String(match.gameId)))
  for (const match of Object.values(player.representativeMatches || {})) {
    if (match && !visibleIds.has(String(match.gameId))) {
      visible.push(match)
      visibleIds.add(String(match.gameId))
    }
  }
  const rows = visible.map((match) => `<tr><td>${formatDate(match.date)}</td><td>${escapeHtml(match.queueName || '排位')}</td><td>${escapeHtml(match.championName || `英雄 ${match.championId}`)}</td><td>${escapeHtml(match.positionName || match.position || '未分配')}</td><td class="${match.result === '胜利' ? 'win' : 'loss'}">${escapeHtml(match.result || '-')}</td><td>${match.kills}/${match.deaths}/${match.assists}</td><td>${number(match.kda)}</td><td>${number(match.evidenceWeight, 3)}</td><td>${escapeHtml(match.gradeLabel || '-')}</td><td><button class="detail-toggle-button dashboard-detail-button" data-dashboard-match="${match.gameId}" data-dashboard-puuid="${escapeHtml(player.friend?.puuid || '')}">查看 LeagueAkari 详表</button></td></tr><tr class="dashboard-detail-row hidden" data-dashboard-detail="${match.gameId}"><td colspan="10"><div class="side-empty">点击上方按钮加载这场对局的逐项数据。</div></td></tr>`).join('')
  return `<div class="card showcase-table-card"><div class="showcase-section-head"><h3>最近对局与 LeagueAkari 详表</h3><span>按日期、模式、英雄识别；详表按需加载，避免页面卡死</span></div><div class="showcase-table-wrap"><table class="showcase-table"><thead><tr><th>日期</th><th>排位模式</th><th>英雄</th><th>位置</th><th>结果</th><th>K/D/A</th><th>KDA</th><th>证据权重</th><th>评价</th><th>详表</th></tr></thead><tbody>${rows || '<tr><td colspan="10">暂无已保存对局</td></tr>'}</tbody></table></div></div>`
}

function renderDeepAnalysis(player) {
  const analysis = player.deepAnalysis
  if (!analysis) return ''
  const diagnosis = (analysis.diagnosis || []).slice(0, 3).map((item) => `<div><b>${escapeHtml(item.title || item.name || '专项诊断')}</b><span>${escapeHtml(item.status || '')}</span><p>${escapeHtml(item.detail || item.description || item.reason || '')}</p></div>`).join('')
  const training = (analysis.trainingPlan || []).slice(0, 3).map((item) => `<li><b>${escapeHtml(item.priority || 'P1')}</b>${escapeHtml(item.title || '')}：${escapeHtml(item.drill || item.evidence || '')}</li>`).join('')
  return `<div class="card showcase-analysis"><div class="showcase-section-head"><h3>深度分析与训练计划</h3><span>基于逐场证据生成</span></div><p class="analysis-summary">${escapeHtml(analysis.executiveSummary || '当前样本已完成基础分析。')}</p><div class="analysis-diagnosis">${diagnosis}</div>${training ? `<ul class="analysis-training">${training}</ul>` : ''}</div>`
}

function renderPortrait(player) {
  const portrait = player.portrait
  if (!portrait) return ''
  const coverage = portrait.coverage || {}
  const caught = portrait.caughtRisk || {}
  const lane = portrait.laneHabits || {}
  const signal = portrait.signalHabits || {}
  const detailRate = coverage.totalGames ? Math.round(coverage.detailedGames / coverage.totalGames * 100) : 0
  const risk = caught.score == null ? '暂无' : `${Math.round(caught.score)} / 100`
  const signalText = signal.available ? `${signal.games} 场有记录` : '暂无'
  const signalDetail = signal.available ? `进攻 ${number(signal.perGame?.allInPings, 1)} / 撤退 ${number(signal.perGame?.retreatPings, 1)} / 危险 ${number(signal.perGame?.dangerPings, 1)} / 敌人消失 ${number(signal.perGame?.enemyMissingPings, 1)}` : signal.reason || '当前没有可用的 Ping 统计。'
  return `<section class="card portrait-panel"><div class="showcase-section-head"><div><span class="kicker">BEHAVIOR PORTRAIT</span><h3>行为画像与风险证据</h3></div><span>${coverage.detailedGames || 0} 场有时间线 · 覆盖率 ${detailRate}%</span></div><div class="portrait-grid"><article><b>死亡 / 被抓风险指数</b><strong>${risk}</strong><small>当前依据死亡频率、15 分钟前死亡、90 秒内连续死亡；伤害来源仅 ${caught.isolationEvidenceGames || 0} 场可用，不能把所有死亡断言为被抓。</small></article><article><b>线上活动</b><strong>${lane.wardsPlacedPer15 == null ? '暂无' : `${Number(lane.wardsPlacedPer15).toFixed(1)} 眼/15分`}</strong><small>排眼 ${lane.wardsKilledPer15 == null ? '暂无' : `${Number(lane.wardsKilledPer15).toFixed(1)} 个/15分`} · 首次死亡中位 ${lane.medianFirstDeathMinute == null ? '暂无' : `${Number(lane.medianFirstDeathMinute).toFixed(1)} 分钟`}</small></article><article><b>Ping 信号习惯</b><strong>${signalText}</strong><small>${escapeHtml(signalDetail)}。这里只统计次数，不能推断 Ping 的具体位置和意图。</small></article></div><p class="portrait-note">队伍参团率仅使用完整十人数据；${coverage.summaryOnlyGames || 0} 场只有战绩摘要，已排除出时间线画像。</p></section>`
}

function renderFreshness() {
  const health = state.health || {}
  const total = Number(health.totalRecords || 0)
  const detailed = Number(health.detailedRecords || 0)
  const coverage = total ? Math.round(detailed / total * 100) : 0
  return `<section class="freshness-strip"><article><span>DATA FRESHNESS</span><b>${formatDateTime(health.latestMatchAt)}</b><small>最新排位对局</small></article><article><span>ROSTER</span><b>${state.library.length} 人</b><small>全部好友画像</small></article><article><span>RECENT SIGNAL</span><b>${health.recent7d || 0} / ${health.recent30d || 0}</b><small>近 7 天 / 30 天记录</small></article><article><span>DETAIL COVERAGE</span><b>${coverage}%</b><small>${detailed} / ${total} 有时间线</small></article><article><span>QUEUE SPLIT</span><b>${health.queueCounts?.[420] || 0} / ${health.queueCounts?.[440] || 0}</b><small>单双排 / 灵活排位</small></article></section>`
}

function trendCell(label, recent, baseline, delta, format = 'number', inverse = false) {
  const display = format === 'percent' ? percent(recent) : number(recent, format === 'integer' ? 0 : 1)
  const base = format === 'percent' ? percent(baseline) : number(baseline, format === 'integer' ? 0 : 1)
  const deltaValue = Number(delta)
  const good = Number.isFinite(deltaValue) && (inverse ? deltaValue <= 0 : deltaValue >= 0)
  const deltaText = format === 'percent' ? signed(deltaValue * 100, 0, 'pt') : signed(deltaValue, format === 'integer' ? 0 : 1)
  return `<div class="trend-cell"><span>${label}</span><b>${display}</b><small>长期 ${base}</small><em class="${good ? 'positive' : 'negative'}">${deltaText}</em></div>`
}

function renderTrend(player) {
  const trend = player.trend || {}
  const recent = trend.recent5 || {}
  const baseline = trend.baseline || {}
  const delta = trend.delta5 || {}
  const checkpoints = (trend.checkpoints || []).map((item) => `<div><span>${item.minute} 分钟</span><b>${item.games ? `${number(item.gold, 0)} 金币` : '暂无'}</b><small>${item.games ? `经验 ${number(item.xp, 0)} · 等级 ${number(item.level, 1)} · 补刀 ${number(item.cs, 1)} · ${item.games} 场` : '时间线样本不足'}</small></div>`).join('')
  return `<section class="trend-panel"><div class="showcase-section-head"><div><span class="kicker">FORM & BASELINE</span><h3>最近 5 场 vs 长期基线</h3></div><span>正负变化只描述趋势，不直接等于因果</span></div><div class="trend-grid">${trendCell('胜率', recent.winRate, baseline.winRate, delta.winRate, 'percent')}${trendCell('KDA', recent.kda, baseline.kda, delta.kda)}${trendCell('死亡', recent.deaths, baseline.deaths, delta.deaths, 'number', true)}${trendCell('补刀 / 分', recent.csPerMinute, baseline.csPerMinute, delta.csPerMinute)}${trendCell('金币 / 分', recent.goldPerMinute, baseline.goldPerMinute, delta.goldPerMinute, 'integer')}${trendCell('伤害 / 分', recent.damagePerMinute, baseline.damagePerMinute, delta.damagePerMinute, 'integer')}</div><div class="checkpoint-grid">${checkpoints}</div></section>`
}

function evidenceLink(item, puuid) {
  return `<button class="evidence-link" data-evidence-match="${item.gameId}" data-dashboard-puuid="${escapeHtml(puuid)}">#${item.gameId} · ${formatDate(item.date)}${item.minute == null ? '' : ` · ${number(item.minute, 1)} 分`}</button>`
}

function renderEvidence(player) {
  const insights = player.evidenceInsights || []
  const cards = insights.map((item) => `<article class="evidence-card"><div class="evidence-head"><span>${escapeHtml(item.metric)}</span><b class="confidence-${item.confidence === '高' ? 'high' : item.confidence === '中' ? 'medium' : 'low'}">${escapeHtml(item.confidence)}可信</b></div><h4>${escapeHtml(item.claim)}</h4><p><strong>下一场动作</strong>${escapeHtml(item.action)}</p><p><strong>验证标准</strong>${escapeHtml(item.successMetric)}</p><div class="evidence-meta">样本 ${item.sample} · 字段覆盖 ${Math.round(Number(item.coverage || 0) * 100)}%</div><div class="evidence-links">${(item.evidence || []).map((evidence) => evidenceLink(evidence, player.friend?.puuid || '')).join('') || '<span>暂无可链接的单场证据</span>'}</div></article>`).join('')
  return `<section class="evidence-panel"><div class="showcase-section-head"><div><span class="kicker">EVIDENCE TO ACTION</span><h3>证据链接式训练建议</h3></div><span>每条结论都显示样本、覆盖和可复盘对局</span></div><div class="evidence-grid">${cards || '<div class="ranking-empty">当前样本不足以形成证据链</div>'}</div></section>`
}

function renderRepresentatives(player) {
  const source = player.representativeMatches || {}
  const items = [['best', '代表胜局', '可复用的高质量表现'], ['worst', '代表败局', '优先定位第一个失控节点'], ['turning', '关键转折局', '早期风险或表现波动最明显']]
  const cards = items.map(([key, title, hint]) => {
    const match = source[key]
    if (!match) return `<article><span>${title}</span><b>暂无</b><small>${hint}</small></article>`
    return `<article><span>${title}</span><b>${escapeHtml(match.championName || `英雄 ${match.championId}`)} · ${escapeHtml(match.result)}</b><small>${formatDate(match.date)} · ${match.kills}/${match.deaths}/${match.assists} · ${match.gradeLabel} 级</small><button class="evidence-link" data-evidence-match="${match.gameId}" data-dashboard-puuid="${escapeHtml(player.friend?.puuid || '')}">查看 #${match.gameId}</button></article>`
  }).join('')
  return `<section class="representative-panel"><div class="showcase-section-head"><h3>代表性对局</h3><span>胜局、败局和关键转折局</span></div><div class="representative-grid">${cards}</div></section>`
}

function renderChampionPool(player) {
  const rows = (player.champions || []).slice(0, 10).map((item) => `<tr><td>${escapeHtml(item.championName || `英雄 ${item.championId}`)}</td><td>${item.games}</td><td>${percent(item.winRate)}</td><td>${number(item.kda)}</td><td>${number(item.csPerMinute)}</td><td>${number(item.damagePerMinute, 0)}</td></tr>`).join('')
  return `<div class="card showcase-table-card"><div class="showcase-section-head"><h3>英雄池分层</h3><span>按样本数排序，低样本高胜率不视为稳定结论</span></div><div class="showcase-table-wrap"><table class="showcase-table"><thead><tr><th>英雄</th><th>场次</th><th>胜率</th><th>KDA</th><th>补刀/分</th><th>伤害/分</th></tr></thead><tbody>${rows || '<tr><td colspan="6">暂无英雄样本</td></tr>'}</tbody></table></div></div>`
}

function renderProfile(player) {
  const overview = player.overview || {}
  const tabs = (state.report.players || []).map((item) => `<button class="showcase-tab ${item.friend?.puuid === state.activePuuid ? 'active' : ''}" data-profile="${escapeHtml(item.friend?.puuid)}">${escapeHtml(item.friend?.gameName || '未知玩家')}</button>`).join('')
  return `<section class="showcase-profile"><div class="showcase-tabs">${tabs}</div><div class="showcase-head"><div><span class="kicker">PERSONAL DOSSIER</span><h2>${escapeHtml(player.friend?.gameName || '未知玩家')} <small>#${escapeHtml(player.friend?.tagLine || '')}</small></h2><p>${player.sampleSize} 场实际样本 · 有效样本 ${number(overview.effectiveSampleSize, 1)} · 置信度 ${player.confidence ?? '-'}% · ${escapeHtml(overview.activityStatus || '活跃度未知')} · ${escapeHtml(overview.rankingStatus || '暂不排名')}</p><a class="profile-permalink" href="/?player=${encodeURIComponent(player.friend?.puuid || '')}">打开独立画像页</a></div><div><strong>${overview.rankingScore ?? overview.total ?? 0}<small>当前排名分</small></strong></div></div><div class="profile-grid"><div class="profile-metric primary"><b>${overview.total ?? 0}</b><span>综合表现</span></div><div class="profile-metric"><b>${percent(overview.winRate)}</b><span>段位加权胜率</span></div><div class="profile-metric"><b>${number(overview.kda)}</b><span>段位加权 KDA</span></div><div class="profile-metric"><b>${number(overview.averageRankWeight, 2)}</b><span>平均段位系数</span></div><div class="profile-metric"><b>${number(overview.effectiveSampleSize, 1)}</b><span>有效样本量</span></div></div>${renderTrend(player)}${renderDimensionOverview(player)}${renderAbilityOverview(player)}${renderPortrait(player)}${renderEvidence(player)}${renderRepresentatives(player)}<div class="personal-grid"><div class="personal-card good"><h3>表现优势</h3>${list(player.strengths)}</div><div class="personal-card warn"><h3>需要关注</h3>${list(player.risks)}</div><div class="personal-card action"><h3>训练建议</h3>${list(player.recommendations)}</div></div>${renderDeepAnalysis(player)}<div class="breakdown-grid">${renderBreakdown(player.modeBreakdown, true)}${renderBreakdown(player.positionBreakdown, false)}</div>${renderChampionPool(player)}${renderMatches(player)}</section>`
}

const dimensionProfiles = {
  combat: { label: '战斗转化', icon: '⚔', description: '把对线和个人操作转化为击杀、伤害与胜利', metrics: (overview) => [`KDA ${number(overview.kda, 2)}`, `每分钟伤害 ${number(overview.damagePerMinute, 0)}`], advice: '优先复盘第一次阵亡前的视野、技能和接战选择。' },
  team: { label: '团队协同', icon: '◌', description: '参团、支援和视野对团队胜负的贡献', metrics: (overview) => [`参团率 ${percent(overview.killParticipation)}`, `视野分 ${number(overview.vision, 1)}`], advice: '关注资源刷新前的转线和与队友同步进场的时机。' },
  economy: { label: '经济发育', icon: '◇', description: '补刀、金币和发育曲线是否稳定支撑中后期', metrics: (overview) => [`补刀/分钟 ${number(overview.csPerMinute, 1)}`, `金币/分钟 ${number(overview.goldPerMinute, 0)}`], advice: '把前 10 分钟补刀和无效游走拆开复盘，先稳住资源曲线。' },
  objective: { label: '资源控制', icon: '◎', description: '围绕防御塔、史诗野怪和地图资源的转化效率', metrics: (overview) => [`目标伤害/分钟 ${number(overview.objectiveDamagePerMinute, 0)}`, `胜率 ${percent(overview.winRate)}`], advice: '在资源刷新前提前落位，不要只在目标血量下降后被动接团。' },
  stability: { label: '表现稳定', icon: '≈', description: '不同对局之间的波动、死亡控制和持续输出能力', metrics: (overview) => [`平均死亡 ${number(overview.deaths, 1)}`, `一致性 ${number(overview.consistency, 0)}`], advice: '优先减少低收益死亡；稳定性提升通常比追求极限高光更能提高排名。' }
}

function renderDimensionOverview(player) {
  const overview = player.overview || {}
  const dimensions = player.dimensions || {}
  const cards = Object.entries(dimensionProfiles).map(([key, profile]) => {
    const score = clamp(dimensions[key])
    const status = score >= 75 ? '优势' : score >= 55 ? '稳定' : '待提升'
    const statusClass = status === '优势' ? 'good' : status === '稳定' ? 'steady' : 'weak'
    const advice = score < 55 ? profile.advice : score >= 75 ? '这是当前报告中的相对优势，可继续转化为稳定胜率。' : '基础表现尚可，继续保持并扩大有效样本。'
    return `<article class="dimension-card ${statusClass}"><div class="dimension-head"><span class="dimension-icon">${profile.icon}</span><div><strong>${profile.label}</strong><small>${status}</small></div><b>${Math.round(score)}</b></div><div class="dimension-meter"><i style="width:${score}%"></i></div><p>${profile.description}</p><div class="dimension-metrics">${profile.metrics(overview).map((metric) => `<span>${escapeHtml(metric)}</span>`).join('')}</div><div class="dimension-advice">${escapeHtml(advice)}</div></article>`
  }).join('')
  return `<section class="dimension-overview"><div class="dimension-overview-head"><div><span class="kicker">MULTI-DIMENSION DIAGNOSIS</span><h3>个人能力分维度诊断</h3></div><span>评分基于段位、时间新鲜度和有效样本加权</span></div><div class="dimension-grid">${cards}</div></section>`
}

function renderAbilityOverview(player) {
  const cards = Object.entries(roleProfiles).map(([role, profile]) => {
    const info = roleInfo(player, role)
    const status = statusFor(player, role)
    const statusClass = status === '正式排名' ? 'formal' : 'pending'
    const axes = roleAxes[role].slice(0, 3).map(([key, label]) => `${label} ${Math.round(info.metrics[key] || 0)}`).join(' · ')
    const score = info.rows.length ? Math.round(info.score) : '-'
    const meter = info.rows.length ? clamp(info.score) : 0
    return `<article class="ability-card"><div class="ability-card-top"><div><span class="ability-icon">${profile.icon}</span><strong>${profile.label}</strong></div><span class="ability-status ${statusClass}">${status}</span></div><div class="ability-score-row"><b>${score}</b><span>定位分</span><em>${info.rows.length} 场 · 有效 ${number(info.effectiveSampleSize, 1)}</em></div><div class="ability-meter"><i style="width:${meter}%"></i></div><p>${escapeHtml(axes || '暂无该定位的有效对局')}</p><small>${escapeHtml(profile.focus)}</small></article>`
  }).join('')
  return `<section class="ability-overview"><div class="ability-overview-head"><div><span class="kicker">ROLE PROFILE</span><h3>五路个人能力画像</h3></div><span>定位分只使用对应位置的单双排 / 灵活排位数据</span></div><div class="ability-grid">${cards}</div></section>`
}

function render() {
  const players = state.report?.players || []
  if (!players.length) return
  const active = players.find((player) => player.friend?.puuid === state.activePuuid) || players[0]
  $('#dashboardRoot').innerHTML = `<div class="showcase">${renderFreshness()}${state.focused ? '' : renderComparison(players)}${renderProfile(active)}</div>`
  document.querySelectorAll('[data-role]').forEach((button) => button.addEventListener('click', () => { state.role = button.dataset.role; render() }))
  document.querySelectorAll('[data-profile]').forEach((button) => button.addEventListener('click', () => { state.activePuuid = button.dataset.profile; history.replaceState(null, '', `/?player=${encodeURIComponent(state.activePuuid)}`); render() }))
  document.querySelectorAll('[data-evidence-match]').forEach((button) => button.addEventListener('click', () => {
    const matchButton = document.querySelector(`[data-dashboard-match="${button.dataset.evidenceMatch}"]`)
    matchButton?.click()
    matchButton?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }))
  document.querySelectorAll('[data-dashboard-match]').forEach((button) => button.addEventListener('click', async () => {
    const detail = document.querySelector(`[data-dashboard-detail="${button.dataset.dashboardMatch}"]`)
    if (!detail) return
    detail.classList.toggle('hidden')
    if (!detail.classList.contains('hidden') && !detail.dataset.loaded) {
      button.disabled = true
      try {
        const record = await request(`/api/library/match?gameId=${encodeURIComponent(button.dataset.dashboardMatch)}&puuid=${encodeURIComponent(button.dataset.dashboardPuuid || '')}`)
        detail.querySelector('td').innerHTML = renderDashboardDetail(record)
        detail.dataset.loaded = 'true'
        button.textContent = '收起详表'
      } catch (error) { detail.querySelector('td').innerHTML = `<div class="side-empty">${escapeHtml(error.message)}</div>` } finally { button.disabled = false }
    }
  }))
}

async function loadLibrary() {
  try {
    const data = await request('/api/library')
    state.library = data.friends || []
    state.health = data.dataHealth || null
    $('#libraryCount').textContent = `全部 ${state.library.length} 位好友`
    $('#libraryUpdated').textContent = data.updatedAt ? `资料更新时间：${formatDate(data.updatedAt)}` : '本地资料库'
    await analyze()
  } catch (error) { toast(error.message) }
}

async function analyze() {
  const queueTypes = ['dashboardSolo', 'dashboardFlex'].filter((id) => $(`#${id}`).checked).map((id) => id === 'dashboardSolo' ? 'solo' : 'flex')
  if (!queueTypes.length) { toast('至少选择一种排位模式'); return }
  const count = Number($('#analysisCount').value) || 20
  try {
    $('#dashboardAnalyze').disabled = true
    if (state.focused && state.activePuuid) {
      state.report = await request(`/api/library/players/${encodeURIComponent(state.activePuuid)}?count=${count}&queues=${queueTypes.join(',')}`)
    } else {
      state.report = await request('/api/library/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ puuids: state.library.map((friend) => friend.puuid), queueTypes, count }) })
    }
    state.activePuuid = state.activePuuid && state.report.players?.some((player) => player.friend?.puuid === state.activePuuid) ? state.activePuuid : state.report.players?.[0]?.friend?.puuid || null
    state.role = 'ALL'
    render()
    toast(`已基于资料库完成分析：每人近 ${count} 场，没有重复拉取对局`)
  } catch (error) { toast(error.message) } finally { $('#dashboardAnalyze').disabled = false }
}

$('#dashboardAnalyze').addEventListener('click', analyze)
loadLibrary()
