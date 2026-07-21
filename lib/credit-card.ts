// credit-card.ts - 信用卡还款日计算+闹钟生成
import { STORAGE_KEYS, CreditCard, AlarmItem, BANK_PRESETS } from "./constants"
import { generateUUID, addAlarm, updateAlarm, removeAlarm, loadAlarms, saveAlarms, createAlarmItem } from "./alarm-store"
import { scheduleAlarm, cancelAlarm } from "./alarm-bridge"

const SHARED = { shared: true }

// ==================== CRUD ====================
export function loadCards(): CreditCard[] {
  const data = Storage.get<CreditCard[]>(STORAGE_KEYS.CREDIT_CARDS, SHARED)
  return data ?? []
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
function createCardAlarm(card: CreditCard, date: Date, titleSuffix: string, tintColor: string): AlarmItem {
  return createAlarmItem({
    title: `${card.bankName}(${card.last4Digits}) ${titleSuffix}`,
    hour: 9,
    minute: 0,
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
  })
}

// 为一张卡生成本月+下月的4×2=8个闹钟
export function generateCardAlarms(card: CreditCard): AlarmItem[] {
  const now = new Date()
  const alarms: AlarmItem[] = []

  let year = now.getFullYear()
  let month = now.getMonth() + 1

  for (let i = 0; i < 2; i++) {
    const statementDate = getStatementDate(card, year, month)
    const dueDate = calculateDueDate(card, year, month)
    const remindDate = calculateRemindDate(card, year, month)
    const bufferEnd = calculateBufferEndDate(card, year, month)

    // 只生成未来的闹钟
    if (statementDate > now) {
      alarms.push(createCardAlarm(card, statementDate, "账单已出", card.tintColor))
    }
    if (remindDate > now) {
      alarms.push(createCardAlarm(card, remindDate, `${card.remindDaysBefore}天后还款`, card.tintColor))
    }
    if (dueDate > now) {
      alarms.push(createCardAlarm(card, dueDate, "今日还款截止", card.tintColor))
    }
    if (bufferEnd > now) {
      alarms.push(createCardAlarm(card, bufferEnd, "宽限期最后一天！", "systemRed"))
    }

    // 下个月
    month++
    if (month > 12) { month = 1; year++ }
  }

  return alarms
}

// ==================== 同步信用卡闹钟 ====================
export async function syncCardAlarms(card: CreditCard): Promise<CreditCard> {
  // 先取消旧闹钟
  for (const alarmId of card.alarmItemIds) {
    await cancelAlarm(alarmId)
  }

  // 从 alarm-store 中删除旧的信用卡闹钟
  const allAlarms = loadAlarms()
  const remaining = allAlarms.filter((a) => !card.alarmItemIds.includes(a.id))
  saveAlarms(remaining)

  // 生成新闹钟
  const newAlarms = generateCardAlarms(card)
  const newAlarmIds: string[] = []

  for (const alarm of newAlarms) {
    addAlarm(alarm)
    if (alarm.enabled) {
      const specificDate = new Date(alarm.repeat.anchorDate!)
      specificDate.setHours(alarm.hour, alarm.minute, 0, 0)
      const systemId = await scheduleAlarm(alarm, specificDate)
      if (systemId) {
        updateAlarm(alarm.id, { alarmIds: [systemId] })
      }
    }
    newAlarmIds.push(alarm.id)
  }

  // 更新信用卡记录
  const updated = updateCard(card.id, { alarmItemIds: newAlarmIds })
  return updated ?? card
}

// ==================== 创建新信用卡 ====================
export async function createCard(partial: Partial<CreditCard>): Promise<CreditCard> {
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
    ...partial,
  }

  addCard(card)
  const synced = await syncCardAlarms(card)
  return synced
}

// ==================== 删除信用卡 ====================
export async function deleteCard(id: string): Promise<void> {
  const card = getCardById(id)
  if (card) {
    // 取消所有系统闹钟
    for (const alarmId of card.alarmItemIds) {
      await cancelAlarm(alarmId)
    }
    // 从 alarm-store 删除关联闹钟
    const allAlarms = loadAlarms()
    const remaining = allAlarms.filter((a) => !card.alarmItemIds.includes(a.id))
    saveAlarms(remaining)
  }
  removeCard(id)
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
