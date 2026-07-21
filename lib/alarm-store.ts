// alarm-store.ts - 闹钟数据 CRUD + Storage 操作
import { STORAGE_KEYS, DEFAULT_GROUPS, DEFAULT_SETTINGS, DEFAULT_HOLIDAYS, AlarmItem, AlarmGroup, AppSettings, normalizeRule } from "./constants"

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
  return data.map((a) => ({ ...a, repeat: normalizeRule(a.repeat) }))
}

export function saveAlarms(items: AlarmItem[]): void {
  Storage.set(STORAGE_KEYS.ITEMS, items, SHARED)
}

export function addAlarm(alarm: AlarmItem): void {
  const items = loadAlarms()
  items.push(alarm)
  saveAlarms(items)
}

export function updateAlarm(id: string, updates: Partial<AlarmItem>): AlarmItem | null {
  const items = loadAlarms()
  const idx = items.findIndex((a) => a.id === id)
  if (idx === -1) return null
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
  return migrateGroupIcons(groups)
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
  return Storage.get<AppSettings>(STORAGE_KEYS.SETTINGS, SHARED) ?? DEFAULT_SETTINGS
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
    ...partial,
  }
}
