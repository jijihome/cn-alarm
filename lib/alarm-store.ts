// alarm-store.ts - 闹钟数据 CRUD + Storage 操作
import { STORAGE_KEYS, DEFAULT_GROUPS, DEFAULT_SETTINGS, DEFAULT_HOLIDAYS, AlarmItem, AlarmGroup, AppSettings, normalizeRule } from "./constants"
import { isAlarmToday, getElapsedOccurrences } from "./scheduler"

// ==================== Storage 共享选项 ====================
const SHARED = { shared: true }

// ==================== UUID 生成 ====================
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ==================== 闹钟 CRUD ====================
export function loadAlarms(): AlarmItem[] {
  const data = Storage.get<AlarmItem[]>(STORAGE_KEYS.ITEMS, SHARED)
  if (!data) return []
  // 迁移旧 holidayAware → holidayAction
  return data.map((a) => ({ ...a, repeat: normalizeRule(a.repeat, a.createdAt) }))
}

export function saveAlarms(items: AlarmItem[]): void {
  Storage.set(STORAGE_KEYS.ITEMS, items, SHARED)
}

export function addAlarm(alarm: AlarmItem): void {
  // 确保 anchorDate 存在（非 once 模式也需要，用于 endAfterOccurrences 计算）
  if (!alarm.repeat.anchorDate && alarm.repeat.mode !== "once" && alarm.repeat.endAfterOccurrences) {
    alarm.repeat.anchorDate = new Date().toISOString().slice(0, 10)
  }
  const items = loadAlarms()
  items.push(alarm)
  saveAlarms(items)
}

export function updateAlarm(id: string, updates: Partial<AlarmItem>): AlarmItem | null {
  const items = loadAlarms()
  const idx = items.findIndex((a) => a.id === id)
  if (idx === -1) return null

  // 保存时折叠：有 endAfterOccurrences 时，算已过周期数→扣减为剩余→重置 anchorDate
  if (updates.repeat && updates.repeat.endAfterOccurrences && updates.repeat.endAfterOccurrences > 0) {
    const oldAlarm = items[idx]
    const now = new Date()
    const elapsed = getElapsedOccurrences(updates.repeat, now, oldAlarm.createdAt)
    const remaining = Math.max(0, updates.repeat.endAfterOccurrences - elapsed)
    updates.repeat.endAfterOccurrences = remaining
    const today = now.toISOString().slice(0, 10)
    updates.repeat.anchorDate = today
  }

  items[idx] = { ...items[idx], ...updates, updatedAt: Date.now() }
  saveAlarms(items)
  return items[idx]
}

export function removeAlarm(id: string): void {
  const items = loadAlarms().filter((a) => a.id !== id)
  saveAlarms(items)
}

export function getAlarmById(id: string): AlarmItem | null {
  return loadAlarms().find((a) => a.id === id) ?? null
}

// ==================== 查询 ====================
export function getByGroup(groupName: string): AlarmItem[] {
  return loadAlarms().filter((a) => a.groupName === groupName)
}

export function getEnabled(): AlarmItem[] {
  return loadAlarms().filter((a) => a.enabled)
}

// ==================== 分组操作 ====================
// 已知无效图标名 → 正确名映射（SF Symbol 7 验证）
const ICON_MIGRATIONS: Record<string, string> = {
  "figure.run.fill": "graduationcap.fill",
  "note.text": "list.bullet",
  "doc": "document",
  "doc.fill": "document.fill",
  "doc.text": "text.document",
  "doc.text.fill": "text.document.fill",
  "wrench": "wrench.and.screwdriver",
  "wrench.fill": "wrench.and.screwdriver.fill",
  "airplane.fill": "airplane",
  "navigate": "location.north",
  "navigate.fill": "location.north.fill",
  "snow": "snowflake",
  "thermometer": "thermometer.medium",
  "timer.square": "timer",
}

function migrateGroupIcons(groups: AlarmGroup[]): AlarmGroup[] {
  let changed = false
  const result = groups.map(g => {
    const newIcon = ICON_MIGRATIONS[g.icon]
    if (newIcon) {
      changed = true
      return { ...g, icon: newIcon }
    }
    return g
  })
  if (changed) saveGroups(result)
  return result
}

export function loadGroups(): AlarmGroup[] {
  const data = Storage.get<AlarmGroup[]>(STORAGE_KEYS.GROUPS, SHARED)
  const groups = data ?? DEFAULT_GROUPS
  const migrated = migrateGroupIcons(groups)
  // 按标题自动排序，同步更新 order 字段
  const sorted = migrated.sort((a, b) => a.name.localeCompare(b.name, "zh"))
  let orderChanged = false
  const result = sorted.map((g, i) => {
    if (g.order !== i) {
      orderChanged = true
      return { ...g, order: i }
    }
    return g
  })
  if (orderChanged) saveGroups(result)
  return result
}

export function saveGroups(groups: AlarmGroup[]): void {
  Storage.set(STORAGE_KEYS.GROUPS, groups, SHARED)
}

export function addGroup(group: AlarmGroup): void {
  const groups = loadGroups()
  groups.push(group)
  saveGroups(groups)
}

export function updateGroup(id: string, updates: Partial<AlarmGroup>): AlarmGroup | null {
  const groups = loadGroups()
  const idx = groups.findIndex((g) => g.id === id)
  if (idx === -1) return null
  groups[idx] = { ...groups[idx], ...updates }
  saveGroups(groups)
  return groups[idx]
}

export function removeGroup(id: string): void {
  saveGroups(loadGroups().filter((g) => g.id !== id))
}

export function createGroup(partial: Partial<AlarmGroup>): AlarmGroup {
  const groups = loadGroups()
  return {
    id: generateUUID(),
    name: "新分类",
    icon: "tag.fill",
    tintColor: "#007AFF",
    order: groups.length,
    ...partial,
  }
}

// ==================== 设置操作 ====================
export function loadSettings(): AppSettings {
  const stored = Storage.get<AppSettings>(STORAGE_KEYS.SETTINGS, SHARED)
  if (!stored) return { ...DEFAULT_SETTINGS }
  // 合并默认值，保证新增字段（如 backgroundKeepAlive）对旧数据兜底
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function saveSettings(settings: any): void {
  Storage.set(STORAGE_KEYS.SETTINGS, settings, SHARED)
}

// ==================== 初始化 ====================
export function initializeDefaults(): void {
  if (Storage.contains(STORAGE_KEYS.SETTINGS, SHARED)) return
  Storage.set(STORAGE_KEYS.ITEMS, [], SHARED)
  Storage.set(STORAGE_KEYS.GROUPS, DEFAULT_GROUPS, SHARED)
  Storage.set(STORAGE_KEYS.CREDIT_CARDS, [], SHARED)
  Storage.set(STORAGE_KEYS.HOLIDAYS, DEFAULT_HOLIDAYS, SHARED)
  Storage.set(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS, SHARED)
}

// ==================== 创建默认闹钟对象 ====================
export function createAlarmItem(partial: Partial<AlarmItem>): AlarmItem {
  const now = Date.now()
  return {
    id: generateUUID(),
    alarmIds: [],
    title: "新闹钟",
    hour: 7,
    minute: 0,
    repeat: {
      mode: "weekly",
      interval: 1,
      weekdays: [2, 3, 4, 5, 6],
      holidayAction: "skip",
    },
    enabled: true,
    gradualWake: false,
    preAlertSeconds: 300,
    sound: "default",
    groupName: "",
    tag: "",
    note: "",
    tintColor: "systemBlue",
    createdAt: now,
    updatedAt: now,
    reminderTimes: [],
    retryConfig: {
      enabled: false,
      intervalMinutes: 5,
      maxRetries: 3,
      type: "notification",
    },
    retryAlarmIds: [],
    confirmedReminders: {},
    ...partial,
  }
}

// ==================== 确认状态管理 ====================

/** 生成确认 key："YYYY-MM-DD_HH:MM" */
export function makeConfirmKey(date: Date, hour: number, minute: number): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const h = String(hour).padStart(2, "0")
  const min = String(minute).padStart(2, "0")
  return `${y}-${m}-${d}_${h}:${min}`
}

/** 标记某个时间点为已确认 */
export function confirmReminder(alarmId: string, date: Date, hour: number, minute: number): void {
  const items = loadAlarms()
  const idx = items.findIndex(a => a.id === alarmId)
  if (idx === -1) return
  const alarm = items[idx]
  const key = makeConfirmKey(date, hour, minute)
  if (!alarm.confirmedReminders) alarm.confirmedReminders = {}
  alarm.confirmedReminders[key] = Date.now()
  // 清理 7 天前的旧记录
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  for (const k of Object.keys(alarm.confirmedReminders)) {
    if (alarm.confirmedReminders[k] < weekAgo) {
      delete alarm.confirmedReminders[k]
    }
  }
  alarm.updatedAt = Date.now()
  saveAlarms(items)
}

/** 检查某个时间点是否已确认 */
export function isReminderConfirmed(alarm: AlarmItem, date: Date, hour: number, minute: number): boolean {
  const key = makeConfirmKey(date, hour, minute)
  return !!(alarm.confirmedReminders && alarm.confirmedReminders[key])
}

/** 获取某闹钟指定日期所有未确认的时间点（仅当闹钟在该日期触发时） */
export function getUnconfirmedTimes(alarm: AlarmItem, date: Date): { hour: number; minute: number }[] {
  if (!isAlarmToday(alarm, date)) return []
  const allTimes = [
    { hour: alarm.hour, minute: alarm.minute },
    ...(alarm.reminderTimes ?? [])
  ]
  return allTimes.filter(t => !isReminderConfirmed(alarm, date, t.hour, t.minute))
}

/** 取消确认：删除该闹钟当天所有已确认记录，恢复为待确认状态 */
export function unconfirmAllReminders(alarmId: string, date: Date): void {
  const items = loadAlarms()
  const idx = items.findIndex(a => a.id === alarmId)
  if (idx === -1) return
  const alarm = items[idx]
  if (!alarm.confirmedReminders) return
  const datePrefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}_`
  for (const k of Object.keys(alarm.confirmedReminders)) {
    if (k.startsWith(datePrefix)) {
      delete alarm.confirmedReminders[k]
    }
  }
  alarm.updatedAt = Date.now()
  saveAlarms(items)
}

// ==================== 过期未确认扫描 ====================

/** 过期未确认记录 */
export interface OverdueUnconfirmedRecord {
  alarm: AlarmItem
  date: Date           // 触发日期（过去）
  hour: number
  minute: number
  source: "user" | "credit_card"
  /** 天数差：距今几天前 */
  daysAgo: number
}

/** 扫描最近 N 天内触发但未被确认的提醒记录（仅 retryConfig 启用的闹钟）。
 *  跳过今天（今天在今日视图主体显示），只扫过去日期。 */
export function getOverdueUnconfirmed(days: number = 7): OverdueUnconfirmedRecord[] {
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const allAlarms = loadAlarms()
  const records: OverdueUnconfirmedRecord[] = []

  for (const alarm of allAlarms) {
    if (!alarm.enabled || !alarm.retryConfig?.enabled) continue

    // 所有时间点（主 + 额外）
    const times = [
      { hour: alarm.hour, minute: alarm.minute },
      ...(alarm.reminderTimes ?? [])
    ]

    for (let d = 1; d <= days; d++) {
      const checkDate = new Date(todayStart)
      checkDate.setDate(checkDate.getDate() - d)

      if (!isAlarmToday(alarm, checkDate)) continue

      for (const t of times) {
        const key = makeConfirmKey(checkDate, t.hour, t.minute)
        const isConfirmed = !!(alarm.confirmedReminders && alarm.confirmedReminders[key])
        if (!isConfirmed) {
          const source: "user" | "credit_card" = alarm.source === "credit_card" ? "credit_card" : "user"
          records.push({ alarm, date: new Date(checkDate), hour: t.hour, minute: t.minute, source, daysAgo: d })
        }
      }
    }
  }

  // 按日期+时间排序（最近的在前）
  records.sort((a, b) => {
    const dateCmp = b.date.getTime() - a.date.getTime()
    if (dateCmp !== 0) return dateCmp
    return (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute)
  })

  return records
}

/** 确认一条过期未确认记录：标记已确认 + 取消重试闹钟 */
export function confirmOverdueRecord(record: OverdueUnconfirmedRecord): void {
  confirmReminder(record.alarm.id, record.date, record.hour, record.minute)
}

/** 过期已确认记录（今天补确认的过期提醒） */
export interface OverdueConfirmedRecord {
  alarm: AlarmItem
  date: Date           // 触发日期（过去）
  hour: number
  minute: number
  source: "user" | "credit_card"
  daysAgo: number
  /** 确认时间戳 */
  confirmedAt: number
}

/** 扫描今天确认的过期记录（确认时间戳在今天）。
 *  confirmedReminders key 是过去日期但 value（时间戳）落在今天。 */
export function getOverdueConfirmedToday(days: number = 7): OverdueConfirmedRecord[] {
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayEnd = todayStart.getTime() + 24 * 60 * 60 * 1000
  const allAlarms = loadAlarms()
  const records: OverdueConfirmedRecord[] = []

  for (const alarm of allAlarms) {
    if (!alarm.enabled || !alarm.retryConfig?.enabled) continue
    if (!alarm.confirmedReminders) continue

    const times = [
      { hour: alarm.hour, minute: alarm.minute },
      ...(alarm.reminderTimes ?? [])
    ]

    for (let d = 1; d <= days; d++) {
      const checkDate = new Date(todayStart)
      checkDate.setDate(checkDate.getDate() - d)
      if (!isAlarmToday(alarm, checkDate)) continue

      for (const t of times) {
        const key = makeConfirmKey(checkDate, t.hour, t.minute)
        const ts = alarm.confirmedReminders[key]
        if (ts && ts >= todayStart.getTime() && ts < todayEnd) {
          const source: "user" | "credit_card" = alarm.source === "credit_card" ? "credit_card" : "user"
          records.push({ alarm, date: new Date(checkDate), hour: t.hour, minute: t.minute, source, daysAgo: d, confirmedAt: ts })
        }
      }
    }
  }

  // 按确认时间倒序（最近补确认的在前）
  records.sort((a, b) => b.confirmedAt - a.confirmedAt)
  return records
}
