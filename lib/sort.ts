// sort.ts - 列表排序纯函数（无依赖）
import { AlarmItem, CreditCard, AlarmSortKey, CardSortKey } from "./constants"
import { getNextDueDate } from "./credit-card"

// ==================== 方向标记 ====================

/** 升序标记 */
const ASC = "↑"
/** 降序标记 */
const DESC = "↓"

// ==================== 闹钟排序 ====================

/** 闹钟排序选项（维度 + 是否支持方向切换 + 默认方向） */
export const ALARM_SORT_OPTIONS: { key: AlarmSortKey; label: string; reversible: boolean; defaultAsc: boolean }[] = [
  { key: "time", label: "时间", reversible: true, defaultAsc: true },
  { key: "name", label: "名称", reversible: true, defaultAsc: true },
  { key: "enabled", label: "启用优先", reversible: false, defaultAsc: false },
  { key: "created", label: "创建时间", reversible: true, defaultAsc: false },
  { key: "group", label: "分类", reversible: true, defaultAsc: true },
]

/** 生成带方向标记的选项标题 */
export function alarmSortTitle(key: AlarmSortKey, asc: boolean): string {
  const opt = ALARM_SORT_OPTIONS.find(o => o.key === key)
  if (!opt || !opt.reversible) return opt?.label ?? key
  return `${opt.label}${asc ? ASC : DESC}`
}

/** 按指定维度和方向排序闹钟列表，返回新数组（不修改原数组） */
export function sortAlarms(alarms: AlarmItem[], sortBy: AlarmSortKey, ascending: boolean): AlarmItem[] {
  const arr = [...alarms]
  const dir = ascending ? 1 : -1
  switch (sortBy) {
    case "time":
      return arr.sort((a, b) => dir * ((a.hour * 60 + a.minute) - (b.hour * 60 + b.minute)))
    case "name":
      return arr.sort((a, b) => dir * a.title.localeCompare(b.title, "zh"))
    case "enabled":
      // 启用的在前（降序语义），同状态下按时间排
      return arr.sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
        return (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute)
      })
    case "created":
      return arr.sort((a, b) => dir * (a.createdAt - b.createdAt))
    case "group":
      // 按分类名排序，空分类排最后
      return arr.sort((a, b) => {
        const ga = a.groupName || "未分组"
        const gb = b.groupName || "未分组"
        return dir * ga.localeCompare(gb, "zh")
      })
    default:
      return arr
  }
}

// ==================== 信用卡排序 ====================

/** 信用卡排序选项 */
export const CARD_SORT_OPTIONS: { key: CardSortKey; label: string; reversible: boolean; defaultAsc: boolean }[] = [
  { key: "bank", label: "银行名", reversible: true, defaultAsc: true },
  { key: "dueDate", label: "还款日", reversible: true, defaultAsc: true },
  { key: "statementDay", label: "账单日", reversible: true, defaultAsc: true },
  { key: "enabled", label: "启用优先", reversible: false, defaultAsc: false },
]

/** 生成带方向标记的选项标题 */
export function cardSortTitle(key: CardSortKey, asc: boolean): string {
  const opt = CARD_SORT_OPTIONS.find(o => o.key === key)
  if (!opt || !opt.reversible) return opt?.label ?? key
  return `${opt.label}${asc ? ASC : DESC}`
}

/** 按指定维度和方向排序信用卡列表，返回新数组（不修改原数组） */
export function sortCards(cards: CreditCard[], sortBy: CardSortKey, ascending: boolean): CreditCard[] {
  const arr = [...cards]
  const dir = ascending ? 1 : -1
  switch (sortBy) {
    case "bank":
      return arr.sort((a, b) => dir * a.bankName.localeCompare(b.bankName, "zh"))
    case "dueDate":
      // 还款日：最近的在前（升序），远的在前（降序）
      return arr.sort((a, b) => {
        const da = getNextDueDate(a).getTime()
        const db = getNextDueDate(b).getTime()
        return dir * (da - db)
      })
    case "statementDay":
      return arr.sort((a, b) => dir * (a.statementDay - b.statementDay))
    case "enabled":
      // 启用的在前，同状态下按银行名排
      return arr.sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
        return a.bankName.localeCompare(b.bankName, "zh")
      })
    default:
      return arr
  }
}
