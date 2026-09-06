const state = { friends: [], selected: new Set(), search: '', source: '', report: null, activePuuid: null, job: null, roleFilter: 'ALL', comparisonRole: 'ALL' }
const $ = (selector) => document.querySelector(selector)
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
const number = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-'
const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const sourceNames = { demo: '演示数据', sgp: 'SGP 详尽接口', lcu: 'LCU 本地接口' }
const modeNames = { CLASSIC: '经典召唤师峡谷', KIWI: '经典召唤师峡谷', KIWI_JADE: '经典召唤师峡谷', ARAM: '极地大乱斗', CHERRY: '斗魂竞技场', TFT: '云顶之弈', URF: '无限火力', ONEFORALL: '克隆大作战' }
const positionNames = { TOP: '上路', JUNGLE: '打野', MIDDLE: '中路', MID: '中路', CENTER: '中路', JG: '打野', BOTTOM: '下路', ADC: '下路', CARRY: '下路', UTILITY: '辅助', SUPPORT: '辅助', DUO: '下路', DUO_CARRY: '下路', DUO_SUPPORT: '辅助', NONE: '未分配', INVALID: '未分配', UNKNOWN: '未分配' }
const championNames = { 517: '解脱者', 887: '灵罗娃娃', 893: '愁云使者' }
const roleProfiles = {
  TOP: { label: '上路', icon: '↗', weights: { win: .18, combat: .23, economy: .27, team: .12, survival: .20 }, criteria: '单线经济、换血质量、承伤与边线存活' },
  JUNGLE: { label: '打野', icon: '♧', weights: { win: .16, combat: .16, economy: .14, team: .27, objective: .27 }, criteria: '参团节奏、资源控制、支援转化与自身发育' },
  MIDDLE: { label: '中路', icon: '◇', weights: { win: .18, combat: .28, economy: .25, team: .20, survival: .09 }, criteria: '对线压制、伤害转化、推线支援与团战输出' },
  BOTTOM: { label: '射手', icon: '◎', weights: { win: .18, combat: .28, economy: .30, team: .14, survival: .10 }, criteria: '补刀发育、持续输出、团战站位与生存' },
  UTILITY: { label: '辅助', icon: '✦', weights: { win: .18, engage: .24, protection: .18, team: .20, vision: .20 }, criteria: '视野控制、开团控制、保护能力与团队参与' }
}

function toast(message) {
  const node = $('#toast')
  node.textContent = message
  node.classList.add('show')
  window.setTimeout(() => node.classList.remove('show'), 3200)
}

async function request(path, options) {
  const response = await fetch(path, options)
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || `请求失败（${response.status}）`)
  return value
}

function friendlyError(message) {
  const text = String(message || '')
  if (text.includes('Invalid string length')) return '本次采集数据量过大，报告已停止保存。请减少每位玩家场数，或关闭“读取时间线”后重试。'
  return text || '采集失败，请稍后重试。'
}

function updateConnection(status) {
  const node = $('#connection')
  const connected = Boolean(status?.connected)
  node.className = `status-pill ${connected ? 'online' : 'offline'}`
  node.querySelector('span').textContent = connected ? `客户端已连接 · ${status.region || '未知区域'}` : '客户端未连接'
}

async function checkStatus() {
  try { updateConnection(await request('/api/status')) } catch { updateConnection({ connected: false }) }
}

function visibleFriends() {
  const query = state.search.trim().toLowerCase()
  return state.friends.filter((friend) => !query || `${friend.gameName || friend.name || ''} ${friend.gameTag || friend.tagLine || ''}`.toLowerCase().includes(query))
}

function renderFriends() {
  $('#friendCount').textContent = state.friends.length
  $('#selectionText').textContent = state.selected.size ? `已选择 ${state.selected.size} 位好友` : '未选择好友'
  $('#selectAll').textContent = state.selected.size === state.friends.length && state.friends.length ? '取消全选' : '全选'
  const friends = visibleFriends()
  $('#friendList').innerHTML = friends.length ? friends.map((friend) => {
    const name = friend.gameName || friend.name || '未知玩家'
    const tag = friend.gameTag || friend.tagLine || 'UNKNOWN'
    return `<label class="friend-item ${state.selected.has(friend.puuid) ? 'selected' : ''}"><input type="checkbox" data-puuid="${escapeHtml(friend.puuid)}" ${state.selected.has(friend.puuid) ? 'checked' : ''} /><span class="avatar">${escapeHtml(name.slice(0, 1))}</span><span><span class="friend-name">${escapeHtml(name)}</span><span class="friend-tag">#${escapeHtml(tag)}</span></span></label>`
  }).join('') : '<div class="side-empty">没有匹配的好友。</div>'
  document.querySelectorAll('[data-puuid]').forEach((input) => input.addEventListener('change', () => {
    if (input.checked) state.selected.add(input.dataset.puuid); else state.selected.delete(input.dataset.puuid)
    renderFriends()
  }))
  $('#collectButton').disabled = state.selected.size === 0
  $('#bulkCollectButton').disabled = state.friends.length === 0
}

async function loadFriends(demo = false) {
  try {
    const data = await request(demo ? '/api/demo/friends' : '/api/friends')
    state.friends = data.friends || []
    state.source = data.source || (demo ? 'demo' : 'lcu')
    state.selected = new Set()
    $('#hint').textContent = demo ? '演示好友已载入，可以先熟悉报告结构。' : `已载入 ${state.friends.length} 位客户端好友，请勾选分析对象。`
    $('#hint').style.color = ''
    renderFriends()
    toast(`已载入 ${state.friends.length} 位好友`)
  } catch (error) {
    $('#hint').textContent = error.message
    $('#hint').style.color = 'var(--coral)'
    toast(error.message)
  }
}

function setProgress(job) {
  const progress = job.total ? Math.min(100, Math.round(job.completed / job.total * 100)) : 0
  $('#progressMessage').textContent = job.message || '处理中'
  $('#progressPercent').textContent = `${progress}%`
  $('#progressBar').style.width = `${progress}%`
}

async function collect() {
  const queueTypes = ['queueSolo', 'queueFlex'].filter((id) => $(`#${id}`).checked).map((id) => id === 'queueSolo' ? 'solo' : 'flex')
  if (!queueTypes.length) { toast('至少选择一种排位模式'); return }
  const body = { demo: state.source === 'demo', source: $('#sourceInput').value, puuids: [...state.selected], count: Number($('#countInput').value), includeDetails: $('#detailsInput').checked, queueTypes }
  state.report = null
  $('#progressBox').classList.remove('hidden')
  $('#collectButton').disabled = true
  $('#bulkCollectButton').disabled = true
  try {
    const job = await request('/api/collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    state.job = job
    const poll = async () => {
      const current = await request(`/api/jobs/${job.id}`)
      setProgress(current)
      if (current.status === 'running') { window.setTimeout(poll, 700); return }
      $('#collectButton').disabled = false
      $('#bulkCollectButton').disabled = state.friends.length === 0
      if (current.status === 'error') { const message = friendlyError(current.error); toast(message); $('#hint').textContent = message; return }
      state.report = await request(`/api/reports/${job.id}`)
      state.activePuuid = state.report.players?.[0]?.friend?.puuid || null
      renderReport()
      toast(state.report.collection?.cacheHit ? '已使用本地资料库完成分析，没有重复拉取' : '采集、分析完成，数据已保存到本地资料库')
    }
    await poll()
  } catch (error) {
    $('#collectButton').disabled = false
    $('#bulkCollectButton').disabled = state.friends.length === 0
    toast(friendlyError(error.message))
  }
}

async function collectAllFriends() {
  if (!state.friends.length) { toast('请先载入客户端好友'); return }
  const confirmed = window.confirm(`将采集全部 ${state.friends.length} 位好友，每人近 200 场排位数据，并保存到本地资料库。数据量较大，是否继续？`)
  if (!confirmed) return
  state.selected = new Set(state.friends.map((friend) => friend.puuid))
  $('#countInput').value = 200
  $('#detailsInput').checked = true
  renderFriends()
  await collect()
  if (state.source !== 'demo' && state.report?.collection) window.location.assign('/dashboard.html')
}

function sourceLabel(source) { return sourceNames[source] || source || '未知来源' }
function modeLabel(mode, localized, queueId = 0) {
  const key = String(mode || '').toUpperCase()
  return modeNames[key] || localized || ([420, 440].includes(Number(queueId)) ? '经典召唤师峡谷' : mode || '未知模式')
}
function positionKey(position) {
  const key = String(position || '').toUpperCase()
  if (['TOP'].includes(key)) return 'TOP'
  if (['JUNGLE', 'JG'].includes(key)) return 'JUNGLE'
  if (['MIDDLE', 'MID', 'CENTER'].includes(key)) return 'MIDDLE'
  if (['BOTTOM', 'ADC', 'CARRY', 'DUO', 'DUO_CARRY'].includes(key)) return 'BOTTOM'
  if (['UTILITY', 'SUPPORT', 'DUO_SUPPORT'].includes(key)) return 'UTILITY'
  return ''
}
function positionLabel(position, localized) { return positionNames[String(position || '').toUpperCase()] || positionNames[positionKey(position)] || (localized && localized !== 'Invalid' ? localized : '未分配') }
function championLabel(name, id) { return name && !/^英雄\s*\d+$/.test(String(name)) ? name : championNames[Number(id)] || (id ? `英雄 ${id}` : '未知英雄') }
function isWin(row) { return row.result === '胜利' || row.result === 'Win' || row.result === true }
function list(items, empty = '样本积累中，暂未形成明确结论。') { return `<ul>${(items?.length ? items : [empty]).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` }

function roleRows(player, role = state.roleFilter) {
  const rows = player.matches || []
  return role === 'ALL' ? rows : rows.filter((row) => positionKey(row.position) === role)
}

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
  return clamp(18 + ((numeric - low) / Math.max(high - low, Number.EPSILON)) * 82, 0, 100)
}
function neutralScore(value, low, high) { return scoreMetric(value, low, high) ?? 50 }
function blendScores(parts) {
  const available = parts.filter((part) => Number.isFinite(Number(part?.score)))
  if (!available.length) return 50
  const weight = available.reduce((sum, part) => sum + part.weight, 0)
  return available.reduce((sum, part) => sum + part.score * part.weight, 0) / Math.max(weight, Number.EPSILON)
}
function roleAnalysis(player, role) {
  const rows = roleRows(player, role)
  const profile = roleProfiles[role]
  if (!profile) return null
  const rowWeight = (row) => Number(row.evidenceWeight || row.rankWeight || 1)
  const totalWeight = rows.reduce((sum, row) => sum + rowWeight(row), 0)
  const effectiveSampleSize = totalWeight ** 2 / Math.max(rows.reduce((sum, row) => sum + rowWeight(row) ** 2, 0), 1)
  const avgValue = (key) => {
    let total = 0
    let weight = 0
    for (const row of rows) {
      const value = metricValue(row, key)
      if (value === null) continue
      const currentWeight = rowWeight(row)
      total += value * currentWeight
      weight += currentWeight
    }
    return weight ? total / weight : null
  }
  const wins = rows.reduce((sum, row) => sum + (isWin(row) ? rowWeight(row) : 0), 0) / Math.max(totalWeight, 1)
  const kp = avgValue('killParticipation')
  const damageShare = avgValue('damageShare')
  const allyPicks = avgValue('pickKillWithAlly')
  const immobilizations = avgValue('enemyChampionImmobilizations')
  const controlTime = avgValue('timeCCingOthers')
  const earlyTakedowns = avgValue('takedownsFirstXMinutes')
  const dragonTakedowns = avgValue('dragonTakedowns')
  const baronTakedowns = avgValue('baronTakedowns')
  const epicSteals = avgValue('epicMonsterSteals')
  const shields = avgValue('totalDamageShieldedOnTeammates')
  const heals = avgValue('totalHealsOnTeammates')
  const saves = avgValue('saveAllyFromDeath')
  const visionPerMinute = avgValue('visionScorePerMinute')
  const controlWards = avgValue('controlWardsPlaced')
  const metrics = {
    win: wins * 100,
    combat: (neutralScore(avgValue('kda'), 1, 5) * .55) + (neutralScore(avgValue('damagePerMinute'), 180, 700) * .45),
    economy: neutralScore(avgValue('csPerMinute'), 3, 8),
    team: blendScores([
      { score: scoreMetric(kp, .28, .68), weight: role === 'UTILITY' ? .35 : .55 },
      { score: scoreMetric(damageShare, .12, .32), weight: role === 'BOTTOM' ? .35 : .20 },
      { score: scoreMetric(allyPicks, .5, 5), weight: role === 'UTILITY' ? .30 : .25 },
      { score: scoreMetric(earlyTakedowns, .5, 4), weight: role === 'JUNGLE' ? .20 : .0 },
      { score: scoreMetric(controlTime, 10, 70), weight: role === 'UTILITY' ? .20 : .0 }
    ]),
    objective: blendScores([
      { score: scoreMetric(avgValue('objectivesDamagePerMinute'), 30, 450), weight: .55 },
      { score: scoreMetric(dragonTakedowns, .5, 3), weight: role === 'JUNGLE' ? .25 : .15 },
      { score: scoreMetric(baronTakedowns, .1, 1), weight: role === 'JUNGLE' ? .15 : .10 },
      { score: scoreMetric(epicSteals, .05, 1), weight: role === 'JUNGLE' ? .10 : .05 }
    ]),
    survival: neutralScore(8 - (avgValue('deaths') ?? 4), 0, 7),
    vision: blendScores([
      { score: scoreMetric(avgValue('visionScore'), 10, 55), weight: .65 },
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
  const score = Object.entries(profile.weights).reduce((sum, [key, weight]) => sum + (metrics[key] || 0) * weight, 0)
  const labels = { win: '胜负结果', combat: '战斗转化', economy: '经济发育', team: '团队参与', objective: '资源控制', survival: '生存质量', vision: '视野贡献', engage: '开团控制', protection: '保护能力' }
  const ranked = Object.entries(profile.weights).map(([key, weight]) => ({ key, label: labels[key], score: Math.round(metrics[key] || 0), weight: Math.round(weight * 100) })).sort((a, b) => b.score - a.score)
  const weakest = ranked[ranked.length - 1]
  const focus = {
    TOP: `优先观察 ${weakest.label}：上路需要把单线优势转化为边线压力和团战前排价值。`,
    JUNGLE: `优先观察 ${weakest.label}：打野评分重点不是刷野总量，而是支援是否转化成击杀、塔或史诗野怪。`,
    MIDDLE: `优先观察 ${weakest.label}：中路需要同时看推线权、游走时机和团战第一轮技能命中。`,
    BOTTOM: `优先观察 ${weakest.label}：射手先保证补刀和经济曲线，再判断输出是否在安全站位下完成。`,
    UTILITY: `优先观察 ${weakest.label}：辅助不以个人经济评价，核心是视野、保护/开团和参团节奏。`
  }[role]
  const rankingEligible = rows.length >= 3 && effectiveSampleSize >= 2 && rows.some((row) => row.activityStatus !== '非活跃')
  const analysisFields = ['killParticipation', 'damageShare', 'pickKillWithAlly', 'enemyChampionImmobilizations', 'timeCCingOthers', 'totalDamageShieldedOnTeammates', 'totalHealsOnTeammates', 'saveAllyFromDeath', 'visionScorePerMinute', 'controlWardsPlaced']
  const coveredFields = analysisFields.filter((key) => rows.some((row) => metricValue(row, key) !== null)).length
  return { rows, profile, score: Math.round(score), metrics, ranked, focus, effectiveSampleSize, winRate: wins, rankingEligible, coverage: Math.round(coveredFields / analysisFields.length * 100) }
}

function renderRoleAnalysis(player) {
  const selected = state.roleFilter === 'ALL' ? 'ALL' : state.roleFilter
  const analysis = selected === 'ALL' ? null : roleAnalysis(player, selected)
  const buttons = [['ALL', '全部位置', '▦'], ...Object.entries(roleProfiles).map(([key, item]) => [key, item.label, item.icon])].map(([key, label, icon]) => `<button class="role-tab ${selected === key ? 'active' : ''}" data-role="${key}"><b>${icon}</b><span>${label}</span>${key !== 'ALL' ? `<em>${roleRows(player, key).length}场</em>` : ''}</button>`).join('')
  if (!analysis) return `<section class="role-panel card"><div class="card-head"><div><h3>五路定位分析</h3><span>点击位置，按对应职责重新计算评分与证据</span></div><span class="role-method">评分不再用一套标准衡量所有位置</span></div><div class="role-tabs">${buttons}</div><div class="role-all-grid">${Object.keys(roleProfiles).map((key) => { const item = roleAnalysis(player, key); return `<div class="role-mini"><div><b>${roleProfiles[key].icon} ${roleProfiles[key].label}</b><strong>${item.score}</strong></div><span>${item.rows.length ? `${item.rows.length} 场 · 胜率 ${percent(item.winRate)}` : '暂无该位置样本'}</span><i style="width:${item.score}%"></i></div>` }).join('')}</div></section>`
  return `<section class="role-panel card"><div class="card-head"><div><h3>${analysis.profile.icon} ${analysis.profile.label}专项分析</h3><span>评价依据：${analysis.profile.criteria}</span></div><div class="role-score"><strong>${analysis.score}</strong><span>定位分</span></div></div><div class="role-tabs">${buttons}</div><div class="role-analysis-body"><div class="role-evidence"><b>本定位结论</b><p>${analysis.rows.length ? analysis.focus : '当前样本中没有识别到该位置，请先刷新采集或检查客户端返回的位置信息。'}</p><div class="role-bars">${analysis.ranked.map((item) => `<div class="role-bar"><span>${item.label}<small>权重 ${item.weight}%</small></span><i><b style="width:${item.score}%"></b></i><strong>${item.score}</strong></div>`).join('')}</div></div><div class="role-facts"><div><b>${analysis.rows.length}</b><span>该位置场次</span></div><div><b>${number(analysis.effectiveSampleSize, 1)}</b><span>加权有效样本</span></div><div><b>${percent(analysis.winRate)}</b><span>位置胜率</span></div><div><b>${number(analysis.rows.reduce((sum, row) => sum + Number(row.kda || 0) * Number(row.rankWeight || 1), 0) / Math.max(analysis.rows.reduce((sum, row) => sum + Number(row.rankWeight || 1), 0), 1))}</b><span>段位加权 KDA</span></div><div><b>${number(analysis.rows.reduce((sum, row) => sum + Number(row.killParticipation || 0) * Number(row.rankWeight || 1), 0) / Math.max(analysis.rows.reduce((sum, row) => sum + Number(row.rankWeight || 1), 0), 1) * 100, 0)}%</b><span>段位加权参团率</span></div><div><b>${analysis.coverage}%</b><span>高级指标覆盖</span></div></div></div><p class="role-method">评分采用平滑区间：低于参考区间不会直接归零；缺失指标不计入平均。高级指标覆盖越高，开团/保护结论越可靠。</p></section>`
}

const comparisonAxes = [['combat', '战斗'], ['team', '团队'], ['economy', '经济'], ['objective', '目标'], ['stability', '稳定']]
const roleRadarAxes = {
  ALL: comparisonAxes,
  TOP: [['economy', '经济发育'], ['combat', '对线换血'], ['survival', '生存承压'], ['team', '团战转化'], ['win', '胜负结果']],
  JUNGLE: [['objective', '资源控制'], ['team', '支援参团'], ['combat', '战斗转化'], ['economy', '发育效率'], ['survival', '自身稳定']],
  MIDDLE: [['combat', '对线输出'], ['economy', '推线发育'], ['team', '支援团战'], ['objective', '资源协同'], ['survival', '生存质量']],
  BOTTOM: [['economy', '补刀发育'], ['combat', '持续输出'], ['survival', '团战生存'], ['team', '团队转化'], ['win', '胜负结果']],
  UTILITY: [['vision', '视野控制'], ['engage', '开团控制'], ['protection', '保护能力'], ['team', '团队参与'], ['win', '胜负结果']]
}
const comparisonColors = ['#2ee4ca', '#9d8cff', '#ff756b', '#f2c667', '#6ea8ff', '#e98bce']

function comparisonName(player) {
  const friend = player.friend || {}
  return friend.gameName || friend.name || '未知玩家'
}

function comparisonRadarLegacy(players, role = 'ALL') {
  const axes = roleRadarAxes[role] || comparisonAxes
  const centerX = 184, centerY = 164, radius = 106
  const point = (value, index, scale = radius) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / axes.length
    const distance = scale * clamp(Number(value || 0), 0, 100) / 100
    return `${centerX + Math.cos(angle) * distance},${centerY + Math.sin(angle) * distance}`
  }
  const grid = [25, 50, 75, 100].map((value) => `<polygon class="comparison-grid" points="${axes.map((_, index) => point(value, index)).join(' ')}"/>`).join('')
  const axisLines = axes.map(([key, label], index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / axes.length; const x = centerX + Math.cos(angle) * (radius + 25); const y = centerY + Math.sin(angle) * (radius + 25); return `<line class="comparison-axis" x1="${centerX}" y1="${centerY}" x2="${centerX + Math.cos(angle) * radius}" y2="${centerY + Math.sin(angle) * radius}"/><text class="comparison-axis-label" x="${x}" y="${y}" text-anchor="middle">${label}</text>` }).join('')
  const radarValue = (player, key) => role === 'ALL' ? player.dimensions?.[key] : roleAnalysis(player, role)?.metrics?.[key]
  const polygons = players.slice(0, 6).map((player, index) => `<polygon class="comparison-shape" style="--comparison-color:${comparisonColors[index]}" points="${axes.map(([key], axisIndex) => point(radarValue(player, key), axisIndex)).join(' ')}"><title>${escapeHtml(comparisonName(player))}</title></polygon>`).join('')
  return `<div class="comparison-radar"><svg viewBox="0 0 370 330" role="img" aria-label="好友能力雷达图">${grid}${axes}${polygons}<circle cx="${centerX}" cy="${centerY}" r="3" class="comparison-center"/></svg></div>`
}

function comparisonRadar(players, role = state.comparisonRole || 'ALL') {
  const axes = roleRadarAxes[role] || comparisonAxes
  const centerX = 184, centerY = 164, radius = 106
  const point = (value, index, scale = radius) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / axes.length
    const distance = scale * clamp(Number(value || 0), 0, 100) / 100
    return `${centerX + Math.cos(angle) * distance},${centerY + Math.sin(angle) * distance}`
  }
  const grid = [25, 50, 75, 100].map((value) => `<polygon class="comparison-grid" points="${axes.map((_, index) => point(value, index)).join(' ')}"/>`).join('')
  const axisLines = axes.map(([key, label], index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / axes.length; const x = centerX + Math.cos(angle) * (radius + 25); const y = centerY + Math.sin(angle) * (radius + 25); return `<line class="comparison-axis" x1="${centerX}" y1="${centerY}" x2="${centerX + Math.cos(angle) * radius}" y2="${centerY + Math.sin(angle) * radius}"/><text class="comparison-axis-label" x="${x}" y="${y}" text-anchor="middle">${label}</text>` }).join('')
  const radarValue = (player, key) => role === 'ALL' ? player.dimensions?.[key] : roleAnalysis(player, role)?.metrics?.[key]
  const polygons = players.slice(0, 6).map((player, index) => `<polygon class="comparison-shape" style="--comparison-color:${comparisonColors[index]}" points="${axes.map(([key], axisIndex) => point(radarValue(player, key), axisIndex)).join(' ')}"><title>${escapeHtml(comparisonName(player))}</title></polygon>`).join('')
  return `<div class="comparison-radar"><svg viewBox="0 0 370 330" role="img" aria-label="好友能力雷达图">${grid}${axisLines}${polygons}<circle cx="${centerX}" cy="${centerY}" r="3" class="comparison-center"/></svg></div>`
}

function renderComparison(report) {
  const players = (report.players || []).filter((player) => player?.overview)
  if (players.length < 2) return ''
  const selectedRole = state.comparisonRole
  const roleProfile = roleProfiles[selectedRole]
  const roleInfo = (player) => selectedRole === 'ALL' ? null : roleAnalysis(player, selectedRole)
  const roleScore = (player) => selectedRole === 'ALL' ? Number(player.overview.total || 0) : roleInfo(player).score
  const roleGames = (player) => selectedRole === 'ALL' ? Number(player.sampleSize || 0) : roleInfo(player).effectiveSampleSize
  const roleActualGames = (player) => selectedRole === 'ALL' ? Number(player.sampleSize || 0) : roleInfo(player).rows.length
  const roleReliability = (player) => clamp(roleGames(player) / 10, 0, 1)
  const rankingScore = (player) => selectedRole === 'ALL' ? Number(player.overview.rankingScore ?? player.overview.total ?? 0) : Math.round(roleScore(player) * (.65 + .35 * roleReliability(player)))
  const formalStatus = (player) => {
    if (selectedRole !== 'ALL') {
      const info = roleInfo(player)
      if (info.rankingEligible && player.overview.activityStatus !== '非活跃') return '正式排名'
      if (player.overview.activityStatus === '非活跃') return '非活跃'
      return info.rows.length < 3 ? '定位样本不足' : '定位有效样本不足'
    }
    if (player.ranking?.status) return player.ranking.status
    if (player.overview.activityStatus === '非活跃') return '非活跃'
    return player.sampleSize < 5 ? '样本不足' : '正式排名'
  }
  const isFormal = (player) => formalStatus(player) === '正式排名'
  const formalPlayers = players.filter(isFormal)
  const pendingPlayers = players.filter((player) => !isFormal(player))
  const ranking = [...formalPlayers].sort((a, b) => rankingScore(b) - rankingScore(a) || roleGames(b) - roleGames(a))
  const categoryData = selectedRole === 'ALL'
    ? comparisonAxes.map(([key, label]) => ({ key, label, get: (player) => Number(player.dimensions?.[key] || 0) }))
    : roleAnalysis(formalPlayers[0] || players[0], selectedRole).ranked.map((item) => ({ key: item.key, label: item.label, get: (player) => Number(roleInfo(player).metrics[item.key] || 0) }))
  const categories = categoryData.map(({ label, get }) => {
    const sorted = [...formalPlayers].sort((a, b) => get(b) - get(a))
    return `<div class="comparison-category"><b>${escapeHtml(label)}排名</b>${sorted.length ? `<span>${sorted.slice(0, 3).map((player, index) => `<em><i>${index + 1}</i>${escapeHtml(comparisonName(player))}<strong>${Math.round(get(player))}</strong></em>`).join('')}</span>` : '<p class="comparison-empty">暂无符合正式排名条件的样本</p>'}</div>`
  }).join('')
  const weightingText = (player) => {
    const queues = player.rankWeighting?.queues || []
    const rankText = queues.length ? queues.map((queue) => `${queue.queueName || '排位'} ${queue.rankName || '未获取段位'} ×${number(queue.rankWeight ?? queue.weight, 3)}`).join(' / ') : `未获取段位 ×${number(player.overview?.averageRankWeight || 1, 3)}`
    return `${rankText} · 新鲜度均值 ×${number(player.overview?.averageEvidenceWeight / Math.max(player.overview?.averageRankWeight || 1, .01), 3)} · ${player.overview?.activityStatus || '活跃度未知'}`
  }
  const rows = ranking.map((player, index) => `<tr><td><strong class="comparison-rank rank-${index + 1}">${index + 1}</strong></td><td><b>${escapeHtml(comparisonName(player))}</b><small>${roleActualGames(player)} 场 · 有效 ${number(roleGames(player), 1)}${selectedRole === 'ALL' ? ' · 综合样本' : ` · ${roleProfile.label}`}</small><em title="段位加权依据">${escapeHtml(weightingText(player))}</em></td><td class="comparison-total">${Math.round(rankingScore(player))}</td>${comparisonAxes.map(([key]) => `<td>${Math.round(player.dimensions?.[key] || 0)}</td>`).join('')}<td>${percent(player.overview.winRate)}</td><td>${number(player.overview.kda)}</td></tr>`).join('')
  const pendingRows = pendingPlayers.map((player) => `<tr class="comparison-pending"><td><strong class="comparison-rank">—</strong></td><td><b>${escapeHtml(comparisonName(player))}</b><small>${roleActualGames(player)} 场 · 有效 ${number(roleGames(player), 1)} · ${escapeHtml(formalStatus(player))}</small><em title="段位加权依据">${escapeHtml(weightingText(player))}</em></td><td>—</td>${comparisonAxes.map(() => '<td>—</td>').join('')}<td>—</td><td>—</td></tr>`).join('')
  const radarPlayers = formalPlayers.length ? formalPlayers : players.slice(0, 6)
  const legend = radarPlayers.slice(0, 6).map((player, index) => `<span><i style="background:${comparisonColors[index]}"></i>${escapeHtml(comparisonName(player))}</span>`).join('')
  const roleTabs = [['ALL', '综合排名'], ...Object.entries(roleProfiles).map(([key, profile]) => [key, profile.label])].map(([key, label]) => `<button class="comparison-role-tab ${selectedRole === key ? 'active' : ''}" data-comparison-role="${key}">${label}</button>`).join('')
  const title = selectedRole === 'ALL' ? '综合排名' : `${roleProfile.label}专项排名`
  const description = selectedRole === 'ALL' ? '综合排名只纳入活跃、样本充足的玩家；其余玩家保留在暂不排名区。' : `已切换为${roleProfile.label}评分：${roleProfile.criteria}。定位样本不足或非活跃玩家不会进入正式排名。`
  return `<section class="comparison-panel card"><div class="comparison-heading"><div><span class="kicker">FRIEND COMPARISON</span><h3>多人横向对比</h3><p>基于相同采集范围，${description}</p></div><span class="comparison-sample">正式排名 ${formalPlayers.length} 人 · 暂不排名 ${pendingPlayers.length} 人</span></div><div class="comparison-role-tabs">${roleTabs}</div><div class="comparison-top"><div>${comparisonRadar(radarPlayers)}<div class="comparison-legend">${legend}${players.length > 6 ? '<span>其余玩家见下方排名</span>' : ''}</div></div><div class="comparison-ranking"><div class="comparison-ranking-title"><b>${title}</b><span>${selectedRole === 'ALL' ? '排名分 = 表现 × 活跃度 × 样本可靠度' : `排名分 = ${roleProfile.label}分 × 样本可靠度`}</span></div><table><thead><tr><th>#</th><th>玩家 / 加权说明</th><th>${selectedRole === 'ALL' ? '排名分' : '定位排名分'}</th>${comparisonAxes.map(([, label]) => `<th>${label}</th>`).join('')}<th>胜率</th><th>KDA</th></tr></thead><tbody>${rows}${pendingRows}</tbody></table></div></div><div class="comparison-categories">${categories}</div></section>`
}

function renderTrend(rows) {
  const values = [...rows].reverse().map((row) => clamp(Number(row.kda || 0) * 12, 0, 100))
  if (!values.length) return '<div class="chart-box"><p class="empty-chart">暂无足够对局趋势</p></div>'
  const width = 680, height = 170, left = 26, right = 12, top = 14, bottom = 25
  const x = (index) => values.length === 1 ? width / 2 : left + index * (width - left - right) / (values.length - 1)
  const y = (value) => top + (100 - value) * (height - top - bottom) / 100
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ')
  const area = `${left},${height - bottom} ${points} ${x(values.length - 1)},${height - bottom}`
  const circles = values.map((value, index) => `<circle class="chart-point" cx="${x(index)}" cy="${y(value)}" r="3.2"><title>第 ${index + 1} 场：KDA ${number(rows[rows.length - 1 - index]?.kda)}</title></circle>`).join('')
  return `<div class="chart-box"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="KDA 趋势图"><defs><linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2ee4ca" stop-opacity=".25"/><stop offset="1" stop-color="#2ee4ca" stop-opacity="0"/></linearGradient></defs><line class="chart-grid" x1="${left}" x2="${width - right}" y1="${y(75)}" y2="${y(75)}"/><line class="chart-grid" x1="${left}" x2="${width - right}" y1="${y(50)}" y2="${y(50)}"/><line class="chart-grid" x1="${left}" x2="${width - right}" y1="${y(25)}" y2="${y(25)}"/><text class="chart-label" x="0" y="${y(75) + 3}">75</text><text class="chart-label" x="0" y="${y(50) + 3}">50</text><text class="chart-label" x="0" y="${y(25) + 3}">25</text><polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${points}"/>${circles}<text class="chart-label" x="${left}" y="${height - 5}">较早</text><text class="chart-label" x="${width - 38}" y="${height - 5}">最近</text></svg></div>`
}

function metric(label, value, extra = '') { return `<div class="metric-card ${extra}"><strong>${value}</strong><span>${label}</span></div>` }
function dimensions(player) {
  const dimensions = [['战斗', player.dimensions?.combat], ['团队', player.dimensions?.team], ['经济', player.dimensions?.economy], ['目标', player.dimensions?.objective], ['稳定', player.dimensions?.stability]]
  return dimensions.map(([label, value]) => `<div class="dimension"><div class="dimension-score" style="--score:${Number(value) || 0}%"><b>${Math.round(value || 0)}</b></div><span>${label}</span></div>`).join('')
}

function renderRanked(player) {
  const queues = player.rankedStats?.queues || []
  if (!queues.length) return '<div class="rank-list"><span class="side-empty">没有可用的排位快照</span></div>'
  return `<div class="rank-list">${queues.map((queue) => `<div class="rank-chip"><b>${escapeHtml(queue.queueName || queue.queueType || '未知队列')}</b><span>${escapeHtml(queue.tierName || queue.tier || '-')} ${escapeHtml(queue.rankName || queue.rank || '')} · ${queue.leaguePoints ?? 0} LP</span><span>${queue.wins ?? 0} 胜 / ${queue.losses ?? 0} 负</span></div>`).join('')}</div>`
}

function breakdownTable(items, mode = false) {
  if (!items?.length) return '<div class="side-empty">暂无拆分数据</div>'
  return `<div class="table-scroll"><table class="data-table"><thead><tr><th>${mode ? '模式' : '位置'}</th><th>实际场次</th><th>有效场次</th><th>胜率</th><th>KDA</th><th>参团率</th><th>CS/min</th><th>伤害/min</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(mode ? modeLabel(item.mode, item.modeName) : positionLabel(item.position, item.positionName))}</td><td>${item.games}</td><td>${number(item.weight, 1)}</td><td>${percent(item.winRate)}</td><td>${number(item.kda)}</td><td>${percent(item.killParticipation)}</td><td>${number(item.csPerMinute)}</td><td>${number(item.damagePerMinute, 0)}</td></tr>`).join('')}</tbody></table></div>`
}

function renderDetailStats(player) {
  const overview = player.overview || {}
  const stats = [['场均金币/min', number(overview.goldPerMinute, 0)], ['承伤/min', number(overview.damageTakenPerMinute, 0)], ['目标伤害/min', number(overview.objectiveDamagePerMinute, 0)], ['场均视野', number(overview.vision, 0)], ['插眼/场', number(overview.wardsPlaced, 1)], ['排眼/场', number(overview.wardsKilled, 1)], ['时间线事件/场', number(overview.timelineEvents, 1)], ['表现稳定度', `${Math.round(overview.consistency || 0)}`], ['段位加权有效样本', number(overview.effectiveSampleSize, 1)], ['平均段位系数', number(overview.averageRankWeight, 2)], ['最近一场', overview.lastMatchAt ? formatDate(overview.lastMatchAt) : '-'], ['活跃状态', overview.activityStatus || '-'], ['排名资格', overview.rankingStatus || '-']]
  return `<div class="card detail-stats"><div class="card-head"><h3>复盘指标</h3><span>段位影响对局权重，但有效样本仍由实际场次决定</span></div><div class="detail-stat-grid">${stats.map(([label, value]) => `<div class="detail-stat"><b>${value}</b><span>${label}</span></div>`).join('')}</div></div>`
}

function renderChampions(player) {
  const champions = player.champions || []
  if (!champions.length) return ''
  return `<div class="card champion-card"><div class="card-head"><h3>英雄表现</h3><span>同一英雄分开看，不用总平均掩盖差异</span></div><div class="table-scroll"><table class="data-table champion-table"><thead><tr><th>英雄</th><th>场次</th><th>胜率</th><th>KDA</th><th>CS/min</th><th>伤害/min</th></tr></thead><tbody>${champions.map((item) => `<tr><td>${escapeHtml(championLabel(item.championName, item.championId))}</td><td>${item.games}</td><td>${percent(item.winRate)}</td><td>${number(item.kda)}</td><td>${number(item.csPerMinute)}</td><td>${number(item.damagePerMinute, 0)}</td></tr>`).join('')}</tbody></table></div></div>`
}

function formatDate(date) { const value = new Date(date); return Number.isNaN(value.getTime()) ? '-' : value.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) }
function formatFullDate(date) { const value = new Date(date); return Number.isNaN(value.getTime()) ? '未知时间' : value.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
function formatRelativeDate(date) {
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return '时间未知'
  const days = Math.floor((Date.now() - value.getTime()) / 86_400_000)
  return days <= 0 ? '今天' : days === 1 ? '昨天' : days < 7 ? `${days}天前` : formatDate(date)
}
function formatDuration(seconds) { const total = Math.max(0, Math.round(Number(seconds || 0))); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}` }

function eventLabel(type) {
  const labels = { ITEM_PURCHASED: '购买装备', ITEM_DESTROYED: '装备销毁', WARD_PLACED: '放置眼位', WARD_KILL: '排除眼位', SKILL_LEVEL_UP: '技能升级', LEVEL_UP: '等级提升', CHAMPION_KILL: '击杀英雄', CHAMPION_SPECIAL_KILL: '特殊击杀', ITEM_UNDO: '撤销购买', PAUSE_END: '暂停结束', BUILDING_KILL: '摧毁建筑', ELITE_MONSTER_KILL: '击杀史诗野怪' }
  return labels[String(type || '').toUpperCase()] || '游戏事件'
}

function participantName(participant) {
  const name = participant.gameName || participant.name || '未知玩家'
  return name.length > 8 ? `${name.slice(0, 8)}…` : name
}

function participantMetric(participant, key) {
  return participant?.advancedStats?.[key] ?? participant?.[key]
}

function participantMetricText(participant, key, format = 'number') {
  const value = participantMetric(participant, key)
  if (value === undefined || value === null || value === '') return '-'
  if (format === 'boolean') return value ? '是' : '否'
  if (format === 'percent') return `${number(value * 100, 1)}%`
  if (format === 'float') return number(value, 2)
  return number(value, 0)
}

function participantTable(record, build = false) {
  const participants = record?.participants || []
  if (!participants.length) return '<div class="side-empty">该对局没有返回全场参赛者数据。</div>'
  const minutes = Math.max((record?.duration || 1) / 60, 1)
  const value = (key, format = 'number') => (p) => participantMetricText(p, key, format)
  const groups = build ? [
    ['出装与配置', [['装备', (p) => (p.itemNames || p.items || []).filter(Boolean).join(' · ') || '-'], ['召唤师技能', (p) => (p.spellNames || p.spells || []).filter(Boolean).join(' · ') || '-'], ['符文', (p) => (p.perkNames || p.perks || []).filter(Boolean).join(' · ') || '-'], ['装备购买次数', value('itemsPurchased')], ['消耗品购买', value('consumablesPurchased')], ['金币收入', (p) => number(p.goldEarned, 0)], ['金币花费', value('goldSpent')]]],
    ['技能使用', [['Q 使用次数', value('spell1Casts')], ['W 使用次数', value('spell2Casts')], ['E 使用次数', value('spell3Casts')], ['R 使用次数', value('spell4Casts')], ['召唤师技能 1', value('summoner1Casts')], ['召唤师技能 2', value('summoner2Casts')], ['技能总使用', value('abilityUses')]]]
  ] : [
    ['战斗概览', [['结果', (p) => p.win ? '胜利' : '失败'], ['K / D / A', (p) => `${p.kills ?? 0} / ${p.deaths ?? 0} / ${p.assists ?? 0}`], ['KDA', value('kda', 'float')], ['参团率', value('killParticipation', 'percent')], ['单杀', value('soloKills')], ['双杀 / 三杀', (p) => `${participantMetricText(p, 'doubleKills')} / ${participantMetricText(p, 'tripleKills')}`], ['四杀 / 五杀', (p) => `${participantMetricText(p, 'quadraKills')} / ${participantMetricText(p, 'pentaKills')}`], ['最大连杀', value('largestKillingSpree')], ['最长存活秒数', value('longestTimeSpentLiving')]]],
    ['伤害与承伤', [['英雄伤害', (p) => number(p.damageToChampions, 0)], ['物理伤害', value('physicalDamageDealtToChampions')], ['魔法伤害', value('magicDamageDealtToChampions')], ['真实伤害', value('trueDamageDealtToChampions')], ['总伤害', value('totalDamageDealt')], ['团队伤害占比', value('teamDamagePercentage', 'percent')], ['承受伤害', (p) => number(p.damageTaken, 0)], ['物理承伤', value('physicalDamageTaken')], ['魔法承伤', value('magicDamageTaken')], ['减免伤害', value('damageSelfMitigated')], ['给队友护盾', value('totalDamageShieldedOnTeammates')]]],
    ['控制与团战', [['控制时长', value('timeCCingOthers')], ['总控制时长', value('totalTimeCCDealt')], ['限制敌方次数', value('enemyChampionImmobilizations')], ['助攻击杀', value('pickKillWithAlly')], ['完整团灭', value('fullTeamTakedown')], ['团战连杀', value('multikills')], ['救下队友', value('saveAllyFromDeath')], ['技能命中', value('skillshotsHit')], ['技能躲避', value('skillshotsDodged')]]],
    ['视野', [['视野得分', (p) => number(p.visionScore, 0)], ['视野得分 / 分钟', value('visionScorePerMinute', 'float')], ['插眼', (p) => participantMetricText(p, 'wardsPlaced')], ['排眼', (p) => participantMetricText(p, 'wardsKilled')], ['控制守卫', value('controlWardsPlaced')], ['真眼购买', value('visionWardsBoughtInGame')], ['守卫击杀参与', value('wardTakedowns')], ['20 分钟前排眼', value('wardTakedownsBefore20M')], ['守卫保护', value('wardsGuarded')]]],
    ['建筑与目标', [['防御塔击杀', value('turretKills')], ['防御塔参与', value('turretTakedowns')], ['推塔伤害', (p) => number(p.damageToTurrets, 0)], ['建筑伤害', value('damageDealtToBuildings')], ['镀层', value('turretPlatesTaken')], ['一塔击杀', value('firstTowerKill', 'boolean')], ['小龙参与', value('dragonTakedowns')], ['男爵参与', value('baronTakedowns')], ['先锋参与', value('riftHeraldTakedowns')], ['偷取史诗野怪', value('epicMonsterSteals')], ['目标伤害', (p) => number(p.damageToObjectives, 0)]]],
    ['经济与发育', [['补刀', (p) => p.cs ?? 0], ['补刀 / 分钟', (p) => number(p.csPerMinute)], ['金币', (p) => number(p.goldEarned, 0)], ['金币 / 分钟', (p) => number((p.goldEarned || 0) / minutes, 0)], ['总兵线补刀', value('totalMinionsKilled')], ['己方野怪', value('totalAllyJungleMinionsKilled')], ['敌方野怪', value('totalEnemyJungleMinionsKilled')], ['对线期经济优势', value('laningPhaseGoldExpAdvantage')], ['最大补刀优势', value('maxCsAdvantageOnLaneOpponent')]]],
    ['治疗与生存', [['总治疗', value('totalHeal')], ['队友治疗', value('totalHealsOnTeammates')], ['有效治疗护盾', value('effectiveHealAndShielding')], ['被敌方英雄击杀', value('deathsByEnemyChamps')], ['总死亡时间', value('totalTimeSpentDead')], ['低血量存活', value('survivedSingleDigitHpCount')], ['承受大额伤害后存活', value('tookLargeDamageSurvived')], ['快速净化', value('quickCleanse')]]],
    ['Ping 沟通', [['All-in 进攻', value('allInPings')], ['协助我', value('assistMePings')], ['危险', value('dangerPings')], ['敌人消失', value('enemyMissingPings')], ['敌方视野', value('enemyVisionPings')], ['撤退', value('retreatPings')], ['支援路上', value('onMyWayPings')], ['需要视野', value('needVisionPings')], ['清除视野', value('visionClearedPings')], ['推进', value('pushPings')], ['集合 / 指挥', (p) => `${participantMetricText(p, 'holdPings')} / ${participantMetricText(p, 'commandPings')}`]]]
  ]
  const header = participants.map((participant) => {
    const champion = championLabel(participant.championName, participant.championId)
    const target = participant.puuid && participant.puuid === record.targetPuuid
    return `<th class="participant-head ${participant.win ? 'team-blue' : 'team-red'} ${target ? 'target-player' : ''}"><span class="participant-champion">${escapeHtml(champion.slice(0, 1))}</span><b>${escapeHtml(participantName(participant))}</b><small>${escapeHtml(champion)} · ${escapeHtml(positionLabel(participant.position))}</small></th>`
  }).join('')
  return `<div class="akari-groups">${groups.map(([group, rows]) => `<section class="akari-group"><div class="akari-group-title"><b>${group}</b><span>${rows.length} 项指标 · 以参赛者为列</span></div><div class="akari-table-scroll"><table class="akari-table ${build ? 'build-table' : ''}"><thead><tr><th class="metric-name">指标</th>${header}</tr></thead><tbody>${rows.map(([label, getter]) => `<tr><th class="metric-name">${label}</th>${participants.map((participant) => `<td class="${label === '结果' ? (participant.win ? 'win' : 'loss') : ''}">${escapeHtml(String(getter(participant)))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`).join('')}</div>`
}

function renderMatchOverview(record, row) {
  const target = record?.participants?.find((participant) => participant.puuid === record.targetPuuid) || record?.target || {}
  const items = [['结果', target.win ? '胜利' : '失败'], ['K / D / A', `${target.kills ?? row?.kills ?? 0} / ${target.deaths ?? row?.deaths ?? 0} / ${target.assists ?? row?.assists ?? 0}`], ['KDA', number(target.kda ?? row?.kda)], ['补刀效率', `${number(target.csPerMinute ?? row?.csPerMinute)} / 分钟`], ['英雄伤害', number(target.damageToChampions ?? row?.damage, 0)], ['参团率', percent(target.killParticipation ?? row?.killParticipation)]]
  return `<div class="detail-overview"><div class="detail-summary-grid">${items.map(([label, value]) => `<div><b>${escapeHtml(String(value))}</b><span>${label}</span></div>`).join('')}</div><div class="overview-note"><b>本场识别</b><span>${escapeHtml(championLabel(row?.championName, row?.championId))} · ${escapeHtml(positionLabel(row?.position, row?.positionName))} · ${escapeHtml(row?.queueName || modeLabel(row?.mode, row?.modeName, row?.queueId))}</span></div></div>`
}

function renderEventTimeline(events) {
  if (!events.length) return '<div class="side-empty">暂无可展开的时间线事件，SUMMARY 统计仍已保存。</div>'
  return `<div class="event-summary"><div><b>${events.length}</b><span>条时间线事件</span></div><div><b>${new Set(events.map((event) => event.type || event.eventType)).size}</b><span>种事件类型</span></div></div><div class="event-list akari-events">${events.slice(0, 160).map((event) => `<span class="event-pill"><b>${escapeHtml(eventLabel(event.type || event.eventType))}</b><small>${Math.round((event.timestamp || 0) / 1000)} 秒</small></span>`).join('')}</div>`
}

function renderMatchDetail(record, row, index) {
  const events = (record?.timeline?.frames || []).flatMap((frame) => frame.events || [])
  const advice = row?.advice || []
  const tabs = [['overview', '对局概览'], ['stats', '详尽表格'], ['build', '出装符文'], ['events', '事件时间线']]
  return `<div class="match-detail"><div class="detail-meta"><span><b>${escapeHtml(formatFullDate(row?.date))}</b></span><span>${escapeHtml(row?.queueName || modeLabel(row?.mode, row?.modeName, row?.queueId))}</span><span>${escapeHtml(row?.rankName || '未获取段位')} · 强度系数 ${number(row?.rankWeight, 3)}</span><span>${formatDuration(record?.duration || row?.duration)} · ${record?.participants?.length || 0} 名参与者</span><span>${events.length} 个时间线事件</span><span>版本 ${escapeHtml(row?.version || '-')}</span><code>内部 ID ${escapeHtml(record?.gameId || row?.gameId || '-')}</code></div><div class="match-advice"><b>本场复盘建议</b>${advice.length ? advice.map((item) => escapeHtml(item)).join('；') : '暂无额外建议，建议结合下方时间线查看关键决策。'}</div><div class="detail-tabs">${tabs.map(([pane, label], tabIndex) => `<button class="detail-tab ${tabIndex === 0 ? 'active' : ''}" data-detail-tab="${index}" data-pane="${pane}">${label}</button>`).join('')}</div><div class="detail-pane active" data-pane-content="${index}" data-pane="overview">${renderMatchOverview(record, row)}</div><div class="detail-pane" data-pane-content="${index}" data-pane="stats">${participantTable(record)}</div><div class="detail-pane" data-pane-content="${index}" data-pane="build">${participantTable(record, true)}</div><div class="detail-pane" data-pane-content="${index}" data-pane="events">${renderEventTimeline(events)}</div></div>`
}

function renderMatches(player) {
  const allRows = player.matches || []
  const rows = roleRows(player)
  const records = player.rawRecords || []
  if (!rows.length) return '<div class="card table-card"><div class="side-empty">当前筛选没有可展示的对局。</div></div>'
  const roleTitle = state.roleFilter === 'ALL' ? '全部排位对局' : `${roleProfiles[state.roleFilter]?.label || '定位'}对局`
  return `<section class="match-section"><div class="section-heading"><div><span class="kicker">MATCH LOG</span><h3>${roleTitle} · ${rows.length} 场</h3><p>每张卡片用日期、模式、英雄和结果识别对局；点击“查看详表”展开对局面板。</p></div><span class="section-count">${allRows.length} 场总样本</span></div><div class="match-list">${rows.map((row) => { const index = allRows.indexOf(row); const result = isWin(row); const champion = championLabel(row.championName, row.championId); return `<article class="match-card ${result ? 'match-win' : 'match-loss'}"><div class="match-accent"></div><div class="match-main"><div class="match-identity"><div class="match-result"><strong>${result ? '胜利' : '失败'}</strong><span>${formatRelativeDate(row.date)}</span></div><div class="match-champion"><span class="champion-orb">${escapeHtml(champion.slice(0, 1))}</span><div><b>${escapeHtml(champion)}</b><span>${escapeHtml(positionLabel(row.position, row.positionName))} · ${escapeHtml(row.queueName || modeLabel(row.mode, row.modeName, row.queueId))} · ${escapeHtml(row.rankName || '未获取段位')}</span></div></div><div class="match-time"><b>${formatDuration(row.duration)}</b><span>${formatFullDate(row.date)}</span></div></div><div class="match-stats"><div><b>${row.kills ?? 0}/${row.deaths ?? 0}/${row.assists ?? 0}</b><span>K / D / A</span></div><div><b>${number(row.kda)}</b><span>KDA</span></div><div><b>${number(row.csPerMinute)}</b><span>补刀 / 分钟</span></div><div><b>${number(row.damagePerMinute, 0)}</b><span>伤害 / 分钟</span></div><div><b>${percent(row.killParticipation)}</b><span>参团率</span></div></div><div class="match-grade grade-${String(row.gradeLabel || 'D').toLowerCase()}"><strong>${row.gradeLabel || '-'}</strong><span>${row.grade ?? '-'} 分</span></div><button class="detail-toggle-button" data-match="${index}">查看详表 <span>↓</span></button></div><div class="detail-row hidden" data-detail="${index}">${renderMatchDetail(records[index], row, index)}</div></article>` }).join('')}</div></section>`
}

function renderAdvanced(player) {
  const advanced = player.advanced || {}
  const bestRow = player.matches?.find((row) => row.gameId === advanced.bestMatch?.gameId)
  const worstRow = player.matches?.find((row) => row.gameId === advanced.worstMatch?.gameId)
  const matchName = (row, fallback) => row ? `${row.result} · ${championLabel(row.championName, row.championId)} · ${formatDate(row.date)}` : fallback
  const best = matchName(bestRow, '-')
  const worst = matchName(worstRow, '-')
  const distribution = (advanced.gradeDistribution || []).map((item) => `<span>${item.label} ${item.games}场</span>`).join(' · ') || '-'
  const events = Object.entries(advanced.timelineTypes || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, count]) => `${eventLabel(type)} ${count}次`).join(' · ') || '暂无事件'
  return `<div class="card advanced-card"><div class="card-head"><h3>高低谷与证据</h3><span>从评级分布和时间线事件定位问题</span></div><div class="advanced-grid"><div><b>${best}</b><span>最佳对局</span></div><div><b>${worst}</b><span>最低对局</span></div><div><b>${distribution}</b><span>评级分布</span></div><div><b>${escapeHtml(events)}</b><span>高频事件</span></div></div></div>`
}

function renderDeepAnalysis(player) {
  const analysis = player.deepAnalysis
  if (!analysis) return ''
  const diagnosis = (analysis.diagnosis || []).map((item) => `<div class="diagnosis"><div><b>${escapeHtml(item.title)}</b><span class="diagnosis-status">${escapeHtml(item.status)}</span></div><p>${escapeHtml(item.evidence)}</p><strong>建议：${escapeHtml(item.action)}</strong></div>`).join('')
  const plan = (analysis.trainingPlan || []).map((item) => `<div class="training-item"><b>${escapeHtml(item.priority)}</b><div><h4>${escapeHtml(item.title)}</h4><p><span>证据：</span>${escapeHtml(item.evidence)}</p><p><span>训练：</span>${escapeHtml(item.drill)}</p><p><span>验收：</span>${escapeHtml(item.metric)}</p></div></div>`).join('')
  const reviews = (analysis.matchReviews || []).map((item) => { const row = player.matches?.find((match) => match.gameId === item.gameId); return `<div class="review-item"><div class="review-title"><b>${escapeHtml(row ? `${row.result} · ${championLabel(row.championName, row.championId)} · ${formatDate(row.date)}` : '逐场复盘')}</b><span class="grade grade-${String(item.grade || 'D').toLowerCase()}">${escapeHtml(item.grade || '-')}</span><span>${escapeHtml(item.result || '')}</span></div><p>${escapeHtml(item.verdict || '')}</p><small>${(item.evidence || []).map((evidence) => escapeHtml(evidence)).join(' · ')}</small><strong>下一场：${escapeHtml(item.action || '')}</strong></div>` }).join('')
  const ai = player.aiAnalysis ? `<div class="ai-result"><span class="kicker">AI COACH REVIEW</span><h3>${escapeHtml(player.aiAnalysis.headline || 'AI 深度复盘')}</h3><p>${escapeHtml(player.aiAnalysis.scoreReason || '')}</p><div class="ai-columns"><div><b>AI 识别优势</b>${list(player.aiAnalysis.strengths, '暂无')}</div><div><b>AI 识别问题</b>${list(player.aiAnalysis.risks, '暂无')}</div></div>${(player.aiAnalysis.trainingPlan || []).map((item) => `<div class="ai-plan"><b>${escapeHtml(item.priority || 'P1')} · ${escapeHtml(item.title || '')}</b><span>${escapeHtml(item.why || '')}</span><span>训练：${escapeHtml(item.drill || '')}</span><span>验收：${escapeHtml(item.successMetric || '')}</span></div>`).join('')}</div>` : ''
  return `<div class="deep-analysis"><div class="deep-header"><div><span class="kicker">COACHING CONCLUSION</span><h3>深度复盘：结论、证据与训练计划</h3></div><button id="aiAnalyzeButton" class="ai-button">${player.aiAnalysis ? '重新请求 AI 复盘' : '请求 AI 深度复盘'}</button></div><div class="executive-summary">${escapeHtml(analysis.executiveSummary)}</div><div class="diagnosis-grid">${diagnosis}</div><div class="training-plan"><h4>优先训练计划</h4>${plan}</div><div class="match-reviews"><h4>逐场关键复盘</h4>${reviews}</div><p class="analysis-caveat">${escapeHtml(analysis.caveat || '')}</p>${ai}</div>`
}

async function requestAiAnalysis() {
  const button = $('#aiAnalyzeButton')
  if (!button || !state.job?.id) return
  button.disabled = true
  button.textContent = 'AI 分析中…'
  try {
    const response = await request(`/api/reports/${state.job.id}/ai`, { method: 'POST' })
    state.report.ai = response.analysis
    response.analysis.players.forEach((analysis, index) => { if (state.report.players[index]) state.report.players[index].aiAnalysis = analysis })
    renderReport()
    toast('AI 深度复盘完成')
  } catch (error) {
    button.disabled = false
    button.textContent = '请求 AI 深度复盘'
    toast(error.message)
  }
}

function renderReport() {
  const report = state.report
  if (!report?.players?.length) return
  const player = report.players.find((item) => item.friend.puuid === state.activePuuid) || report.players[0]
  state.activePuuid = player.friend.puuid
  const friend = player.friend
  const name = friend.gameName || friend.name || '未知玩家'
  const tag = friend.gameTag || friend.tagLine || ''
  const overview = player.overview || {}
  const source = sourceLabel(report.source)
  const queueText = report.collection?.queueLabels?.join(' + ') || '单双排 + 灵活排位'
  $('#reportRoot').innerHTML = `<div class="report"><div class="report-head"><div><span class="kicker">PLAYER REVIEW · ${escapeHtml(source.toUpperCase())}</span><h2>${escapeHtml(name)} <span class="report-sub">#${escapeHtml(tag)}</span></h2><span class="confidence">实际样本 ${player.sampleSize} 场 · 加权有效样本 ${number(overview.effectiveSampleSize, 1)} · 置信度 ${player.confidence}% · ${escapeHtml(overview.activityStatus || '活跃度未知')} · ${escapeHtml(overview.rankingStatus || '排名状态未知')} · 仅统计 ${escapeHtml(queueText)}</span></div><div class="report-score"><strong>${player.overview?.total ?? 0}</strong><span>综合表现<br/>满分 100</span></div></div><div class="player-tabs">${report.players.map((item) => `<button class="player-tab ${item.friend.puuid === player.friend.puuid ? 'active' : ''}" data-player="${escapeHtml(item.friend.puuid)}">${escapeHtml(item.friend.gameName || item.friend.name || '未知玩家')}</button>`).join('')}</div>${renderComparison(report)}<div class="overview-grid">${metric('综合评分', player.overview?.total ?? 0, 'primary-metric')}${metric('胜率', percent(overview.winRate))}${metric('平均 KDA', number(overview.kda))}${metric('伤害 / min', number(overview.damagePerMinute, 0))}${metric('参团率', percent(overview.killParticipation))}</div><div class="report-grid"><div class="card"><div class="card-head"><h3>KDA 走势</h3><span>按采集结果从早到近</span></div>${renderTrend(player.matches || [])}</div><div class="card"><div class="card-head"><h3>五维能力雷达</h3><span>基于排位逐场详表归一化</span></div><div class="dimensions">${dimensions(player)}</div></div></div>${renderRoleAnalysis(player)}${renderDetailStats(player)}<div class="insight-grid"><div class="insight good"><h3>表现优势</h3>${list(player.strengths)}</div><div class="insight warn"><h3>需要关注</h3>${list(player.risks)}</div><div class="insight action"><h3>下一步提升</h3>${list(player.recommendations)}</div></div>${renderDeepAnalysis(player)}${renderAdvanced(player)}<div class="card rank-card"><div class="card-head"><h3>排位积分快照</h3><span>只展示当前选择模式的排位信息</span></div>${renderRanked(player)}</div><div class="split-grid"><div class="card"><div class="card-head"><h3>模式拆分</h3><span>单双排与灵活排位分开看</span></div>${breakdownTable(player.modeBreakdown, true)}</div><div class="card"><div class="card-head"><h3>位置拆分</h3><span>查看最稳定的职责与输出</span></div>${breakdownTable(player.positionBreakdown, false)}</div></div>${renderChampions(player)}${renderMatches(player)}<div class="export-links"><a href="/api/reports/${state.job.id}?format=csv">下载目标玩家 CSV</a><a href="/api/reports/${state.job.id}?format=participants">下载全场参与者 CSV</a><a href="/api/reports/${state.job.id}?format=json">下载原始 JSON</a></div></div>`
  document.querySelectorAll('[data-player]').forEach((button) => button.addEventListener('click', () => { state.activePuuid = button.dataset.player; renderReport() }))
  document.querySelectorAll('[data-role]').forEach((button) => button.addEventListener('click', () => { state.roleFilter = button.dataset.role; renderReport() }))
  document.querySelectorAll('[data-comparison-role]').forEach((button) => button.addEventListener('click', () => { state.comparisonRole = button.dataset.comparisonRole; renderReport() }))
  document.querySelectorAll('[data-match]').forEach((button) => button.addEventListener('click', () => { document.querySelector(`[data-detail="${button.dataset.match}"]`)?.classList.toggle('hidden') }))
  document.querySelectorAll('[data-detail-tab]').forEach((button) => button.addEventListener('click', () => {
    const detail = button.closest('.match-detail')
    detail.querySelectorAll('[data-detail-tab]').forEach((tab) => tab.classList.toggle('active', tab === button))
    detail.querySelectorAll('.detail-pane').forEach((pane) => pane.classList.toggle('active', pane.dataset.pane === button.dataset.pane))
  }))
  $('#aiAnalyzeButton')?.addEventListener('click', requestAiAnalysis)
}

$('#loadFriends').addEventListener('click', () => loadFriends(false))
$('#loadDemo').addEventListener('click', () => loadFriends(true))
$('#collectButton').addEventListener('click', collect)
$('#bulkCollectButton').addEventListener('click', collectAllFriends)
$('#friendSearch').addEventListener('input', (event) => { state.search = event.target.value; renderFriends() })
$('#selectAll').addEventListener('click', () => { state.selected = state.selected.size === state.friends.length ? new Set() : new Set(state.friends.map((friend) => friend.puuid)); renderFriends() })
checkStatus()
