// credit-card.ts - 信用卡还款日计算+闹钟生成
import { STORAGE_KEYS, CreditCard, AlarmItem, BANK_PRESETS, ReminderTypeConfig, RetryConfig, RetryType } from "./constants"
import { generateUUID, addAlarm, updateAlarm, removeAlarm, loadAlarms, saveAlarms, createAlarmItem, confirmReminder, unconfirmAllReminders, getUnconfirmedTimes } from "./alarm-store"
import { scheduleAlarm, cancelAlarm, cancelAllAlarms, cancelRetryAlarms } from "./alarm-bridge"

const SHARED = { shared: true }

// ==================== CRUD ====================

/** 升级单张信用卡数据：补齐 type/extraTimes/retryConfig 字段，返回升级后的卡 */
function upgradeCard(card: CreditCard): { card: CreditCard; changed: boolean } {
  let changed = false

  // 升级 reminderTypes 的每个子字段
  const rt = card.reminderTypes
  if (rt) {
    for (const key of ["statement", "advance", "due", "buffer"] as const) {
      const raw = (rt as any)[key]
      // 旧 boolean 格式 → 完整 ReminderTypeConfig
      if (typeof raw === "boolean") {
        (rt as any)[key] = { enabled: raw, hour: 9, minute: 0, type: "alarm" as RetryType, extraTimes: [] }
        changed = true
      } else if (raw && typeof raw === "object") {
        if (raw.type === undefined) { raw.type = "alarm" as RetryType; changed = true }
        if (raw.extraTimes === undefined) { raw.extraTimes = []; changed = true }
      }
    }
  } else {
    // reminderTypes 整体缺失 → 补默认值
    card.reminderTypes = {
      statement: { enabled: true, hour: 9, minute: 0, type: "alarm", extraTimes: [] },
      advance: { enabled: true, hour: 9, minute: 0, type: "alarm", extraTimes: [] },
      due: { enabled: true, hour: 9, minute: 0, type: "alarm", extraTimes: [] },
      buffer: { enabled: true, hour: 9, minute: 0, type: "alarm", extraTimes: [] },
    }
    changed = true
  }

  // 升级 retryConfig
  if (card.retryConfig === undefined) {
    card.retryConfig = { enabled: false, intervalMinutes: 5, maxRetries: 3, type: "notification" }
    changed = true
  }

  return { card, changed }
}
export function loadCards(): CreditCard[] {
  const data = Storage.get<CreditCard[]>(STORAGE_KEYS.CREDIT_CARDS, SHARED)
  if (!data || data.length === 0) return []
  // 数据升级：补齐 type/extraTimes/retryConfig，有变更则写回 Storage
  let needsSave = false
  const upgraded = data.map((card) => {
    const { card: c, changed } = upgradeCard(card)
    if (changed) needsSave = true
    return c
  })
  if (needsSave) {
    Storage.set(STORAGE_KEYS.CREDIT_CARDS, upgraded, SHARED)
  }
  return upgraded
}

export function saveCards(cards: CreditCard[]): void {
  Storage.set(STORAGE_KEYS.CREDIT_CARDS, cards, SHARED)
}

export function addCard(card: CreditCard): void {
  const cards = loadCards()
  cards.push(card)
  saveCards(cards)
}

export function updateCard(id: string, updates: Partial<CreditCard>): CreditCard | null {
  const cards = loadCards()
  const idx = cards.findIndex((c) => c.id === id)
  if (idx === -1) return null
  cards[idx] = { ...cards[idx], ...updates }
  saveCards(cards)
  return cards[idx]
}

export function removeCard(id: string): void {
  const cards = loadCards().filter((c) => c.id !== id)
  saveCards(cards)
}

export function getCardById(id: string): CreditCard | null {
  return loadCards().find((c) => c.id === id) ?? null
}

// ==================== 还款日计算 ====================
// 获取某年某月的天数
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// 计算账单日（处理 31号不存在的情况）
export function getStatementDate(card: CreditCard, year: number, month: number): Date {
  const days = getDaysInMonth(year, month)
  const day = Math.min(card.statementDay, days)
  return new Date(year, month - 1, day)
}

// 计算还款日 = 账单日 + graceDays（处理跨月）
export function calculateDueDate(card: CreditCard, year: number, month: number): Date {
  const statement = getStatementDate(card, year, month)
  const due = new Date(statement)
  due.setDate(due.getDate() + card.graceDays)
  return due
}

// 计算宽限期最后一天 = 还款日 + bufferDays
export function calculateBufferEndDate(card: CreditCard, year: number, month: number): Date {
  const due = calculateDueDate(card, year, month)
  const end = new Date(due)
  end.setDate(end.getDate() + card.bufferDays)
  return end
}

// 计算提前提醒日 = 还款日 - remindDaysBefore
export function calculateRemindDate(card: CreditCard, year: number, month: number): Date {
  const due = calculateDueDate(card, year, month)
  const remind = new Date(due)
  remind.setDate(remind.getDate() - card.remindDaysBefore)
  return remind
}

// ==================== 创建信用卡闹钟 ====================
function createCardAlarm(card: CreditCard, date: Date, titleSuffix: string, tintColor: string, hour: number, minute: number, remindType: RetryType): AlarmItem {
  return createAlarmItem({
    title: `${card.bankName}(${card.last4Digits}) ${titleSuffix}`,
    hour,
    minute,
    repeat: {
      mode: "once",
      interval: 1,
      holidayAction: "none",
      anchorDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    },
    enabled: true,
    groupName: "信用卡",
    tintColor,
    tag: card.last4Digits,
    note: `${card.bankName} 尾号${card.last4Digits}`,
    source: "credit_card",
    mainType: remindType,
  })
}

// 为一张卡生成本月+下月的提醒闹钟（按 reminderTypes 过滤+时间）
export function generateCardAlarms(card: CreditCard): AlarmItem[] {
  const now = new Date()
  const alarms: AlarmItem[] = []

  // reminderTypes 已由 loadCards 升级，字段确定存在
  const rt = card.reminderTypes!

  let year = now.getFullYear()
  let month = now.getMonth() + 1

  // 为某种类型生成主时间 + 额外时间的所有闹钟
  function genTypeAlarms(rtConfig: ReminderTypeConfig, date: Date, titleSuffix: string, tintColor: string): void {
    if (date <= now) return
    // 主时间
    alarms.push(createCardAlarm(card, date, titleSuffix, tintColor, rtConfig.hour, rtConfig.minute, rtConfig.type ?? "alarm"))
    // 额外时间
    for (const et of rtConfig.extraTimes ?? []) {
      alarms.push(createCardAlarm(card, date, titleSuffix, tintColor, et.hour, et.minute, et.type ?? "alarm"))
    }
  }

  for (let i = 0; i < 2; i++) {
    const statementDate = getStatementDate(card, year, month)
    const dueDate = calculateDueDate(card, year, month)
    const remindDate = calculateRemindDate(card, year, month)
    const bufferEnd = calculateBufferEndDate(card, year, month)

    if (rt.statement.enabled) genTypeAlarms(rt.statement, statementDate, "账单已出", card.tintColor)
    if (rt.advance.enabled) genTypeAlarms(rt.advance, remindDate, `${card.remindDaysBefore}天后还款`, card.tintColor)
    if (rt.due.enabled) genTypeAlarms(rt.due, dueDate, "今日还款截止", card.tintColor)
    if (rt.buffer.enabled) genTypeAlarms(rt.buffer, bufferEnd, "宽限期最后一天！", "systemRed")

    // 下个月
    month++
    if (month > 12) { month = 1; year++ }
  }

  return alarms
}

// ==================== 同步信用卡闹钟 ====================
export async function syncCardAlarms(card: CreditCard): Promise<CreditCard> {
  // 先取消旧闹钟（含重试）
  const existingAlarms = loadAlarms()
  const oldCardAlarms = existingAlarms.filter((a) => card.alarmItemIds.includes(a.id))
  for (const alarm of oldCardAlarms) {
    await cancelAllAlarms(alarm).catch(() => {})
  }
  for (const alarmId of card.alarmItemIds) {
    await cancelAlarm(alarmId).catch(() => {})
  }

  // 从 alarm-store 中删除旧的信用卡闹钟
  const remaining = existingAlarms.filter((a) => !card.alarmItemIds.includes(a.id))
  saveAlarms(remaining)

  // 生成新闹钟
  const newAlarms = generateCardAlarms(card)
  const newAlarmIds: string[] = []

  // 信用卡的 retryConfig 应用到所有生成的闹钟
  const cardRetryConfig = card.retryConfig

  for (const alarm of newAlarms) {
    // 把信用卡的 retryConfig 写入闹钟
    if (cardRetryConfig && cardRetryConfig.enabled) {
      alarm.retryConfig = cardRetryConfig
    }
    addAlarm(alarm)
    if (alarm.enabled) {
      const specificDate = new Date(alarm.repeat.anchorDate!)
      specificDate.setHours(alarm.hour, alarm.minute, 0, 0)
      const result = await scheduleAlarm(alarm, specificDate)
      if (result) {
        updateAlarm(alarm.id, { alarmIds: result.allAlarmIds, retryAlarmIds: result.retryIds })
      }
    }
    newAlarmIds.push(alarm.id)
  }

  // 更新信用卡记录
  const updated = updateCard(card.id, { alarmItemIds: newAlarmIds })
  return updated ?? card
}

// ==================== 同步创建（仅写 Storage，不调度系统闹钟）====================
export function createCardSync(partial: Partial<CreditCard>): CreditCard {
  const card: CreditCard = {
    id: generateUUID(),
    bankName: "招商银行",
    last4Digits: "0000",
    statementDay: 5,
    graceDays: 18,
    bufferDays: 3,
    remindDaysBefore: 3,
    enabled: true,
    tintColor: "systemOrange",
    alarmItemIds: [],
    reminderTypes: {
      statement: { enabled: true, hour: 9, minute: 0 },
      advance: { enabled: true, hour: 9, minute: 0 },
      due: { enabled: true, hour: 9, minute: 0 },
      buffer: { enabled: true, hour: 9, minute: 0 },
    },
    ...partial,
  }
  addCard(card)
  return card
}

// ==================== 同步删除（仅写 Storage，不取消系统闹钟）====================
export function removeCardSync(id: string): CreditCard | null {
  const card = getCardById(id)
  if (card) {
    // 从 alarm-store 删除关联闹钟记录
    const allAlarms = loadAlarms()
    const remaining = allAlarms.filter((a) => !card.alarmItemIds.includes(a.id))
    saveAlarms(remaining)
    removeCard(id)
  }
  return card
}

// ==================== 异步同步信用卡闹钟（调用方在 .then 里调）====================
export async function syncCardAlarmsById(cardId: string): Promise<CreditCard | null> {
  const card = getCardById(cardId)
  if (!card) return null
  return syncCardAlarms(card)
}

// ==================== 异步取消信用卡系统闹钟（调用方在 .then 里调）====================
export async function cancelCardAlarmsById(cardId: string): Promise<void> {
  const card = getCardById(cardId)
  if (!card) return
  // 从 alarm-store 获取关联闹钟，逐个用 cancelAllAlarms 取消（含重试）
  const allAlarms = loadAlarms()
  const cardAlarms = allAlarms.filter((a) => card.alarmItemIds.includes(a.id))
  for (const alarm of cardAlarms) {
    await cancelAllAlarms(alarm).catch(() => {})
  }
  // 也按 ID 取消（兜底：store 中可能已丢失的闹钟）
  for (const alarmId of card.alarmItemIds) {
    await cancelAlarm(alarmId).catch(() => {})
  }
}

// ==================== 创建新信用卡（保留原 async 版本，内部用同步+异步）====================
export async function createCard(partial: Partial<CreditCard>): Promise<CreditCard> {
  const card = createCardSync(partial)
  const synced = await syncCardAlarms(card)
  return synced
}

// ==================== 删除信用卡（保留原 async 版本）====================
export async function deleteCard(id: string): Promise<void> {
  const card = removeCardSync(id)
  if (card) {
    // 从 alarm-store 获取关联闹钟，逐个用 cancelAllAlarms 取消（含重试）
    const allAlarms = loadAlarms()
    const cardAlarms = allAlarms.filter((a) => card.alarmItemIds.includes(a.id))
    for (const alarm of cardAlarms) {
      await cancelAllAlarms(alarm).catch(() => {})
    }
    for (const alarmId of card.alarmItemIds) {
      await cancelAlarm(alarmId).catch(() => {})
    }
  }
}

// ==================== 格式化日期 ====================
export function formatDateCN(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// 获取下一还款日
export function getNextDueDate(card: CreditCard): Date {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1

  for (let i = 0; i < 3; i++) {
    const due = calculateDueDate(card, year, month)
    if (due > now) return due
    month++
    if (month > 12) { month = 1; year++ }
  }
  return calculateDueDate(card, year, month)
}

// ==================== 确认状态管理 ====================
// 信用卡闹钟的确认操作：对 card.alarmItemIds 关联的所有 AlarmItem 执行

/** 获取一张信用卡的未确认提醒数量（今天） */
export function getCardUnconfirmedCount(card: CreditCard): number {
  if (!card.retryConfig?.enabled) return 0
  const allAlarms = loadAlarms()
  const cardAlarms = allAlarms.filter((a) => card.alarmItemIds.includes(a.id) && a.retryConfig?.enabled)
  const today = new Date()
  let count = 0
  for (const alarm of cardAlarms) {
    count += getUnconfirmedTimes(alarm, today).length
  }
  return count
}

/** 确认一张信用卡的所有未确认提醒：标记已确认 + 取消重试闹钟 */
export function confirmCardReminders(card: CreditCard): void {
  const allAlarms = loadAlarms()
  const cardAlarms = allAlarms.filter((a) => card.alarmItemIds.includes(a.id))
  const today = new Date()
  for (const alarm of cardAlarms) {
    const unconfirmed = getUnconfirmedTimes(alarm, today)
    for (const t of unconfirmed) {
      confirmReminder(alarm.id, today, t.hour, t.minute)
    }
    // 异步取消该闹钟的重试提醒
    cancelRetryAlarms(alarm).catch(() => {})
  }
}

/** 取消确认一张信用卡的所有提醒：恢复为待确认状态 */
export function unconfirmCardReminders(card: CreditCard): void {
  const allAlarms = loadAlarms()
  const cardAlarms = allAlarms.filter((a) => card.alarmItemIds.includes(a.id))
  const today = new Date()
  for (const alarm of cardAlarms) {
    unconfirmAllReminders(alarm.id, today)
  }
}
