// alarm-sync.ts - 启动/回前台时检查 Storage 闹钟与系统 AlarmManager 的一致性
// 发现 Storage 中 enabled=true 但 alarmIds 在系统中不存在的闹钟 → 自动重新调度
import { AlarmItem } from "./constants"
import { loadAlarms, saveAlarms, updateAlarm } from "./alarm-store"
import { getSystemAlarms, scheduleAlarm, cancelAllAlarms, ScheduleResult } from "./alarm-bridge"

// 内存级节流时间戳（不持久化，冷启动自动重置）
let lastSyncTime = 0
const RESUME_THROTTLE_MS = 5 * 60 * 1000 // onResume 节流 5 分钟

export interface SyncResult {
  checked: number      // 检查的 enabled 闹钟数
  rescheduled: number  // 重新调度成功的数
  failed: number       // 重新调度失败的数
  skipped: number      // 无需修复的数
}

/** 检查并修复 Storage 与系统 AlarmManager 的一致性 */
export async function syncAlarmsWithSystem(): Promise<SyncResult> {
  const result: SyncResult = { checked: 0, rescheduled: 0, failed: 0, skipped: 0 }

  let systemAlarms: any[]
  try {
    systemAlarms = await getSystemAlarms()
  } catch {
    // Shell.run 不可用或其他错误 → 静默跳过，下次再试
    return result
  }

  // 构建系统闹钟 ID 集合
  const systemIds = new Set<string>()
  for (const a of systemAlarms) {
    if (a.id) systemIds.add(a.id)
  }

  const allAlarms = loadAlarms()
  let hasChanges = false
  const failedAlarms: AlarmItem[] = []

  for (const alarm of allAlarms) {
    if (!alarm.enabled) {
      // 已禁用的闹钟，检查是否有残留系统闹钟需要清理
      if (alarm.alarmIds && alarm.alarmIds.length > 0) {
        const hasResidual = alarm.alarmIds.some(id => systemIds.has(id))
        if (hasResidual) {
          await cancelAllAlarms(alarm).catch(() => {})
        }
      }
      continue
    }

    result.checked++

    // 检查所有 alarmIds 是否在系统中存在
    const missingIds = (alarm.alarmIds || []).filter(id => !systemIds.has(id))

    if (missingIds.length === 0 && (alarm.alarmIds || []).length > 0) {
      // 全部存在，无需修复
      result.skipped++
      continue
    }

    // 有丢失的闹钟 ID → 重新调度
    // 先取消残留（可能部分 ID 还在系统但状态异常）
    await cancelAllAlarms(alarm).catch(() => {})

    // 重新调度
    const scheduleResult: ScheduleResult | null = await scheduleAlarm(alarm).catch(() => null)

    if (scheduleResult) {
      // 调度成功，更新 Storage
      updateAlarm(alarm.id, {
        alarmIds: scheduleResult.allAlarmIds,
        retryAlarmIds: scheduleResult.retryIds,
        gradualWakeIds: scheduleResult.gradualWakeIds,
      })
      hasChanges = true
      result.rescheduled++
    } else {
      // 调度失败（可能是已过期闹钟 getNextTrigger 返回 null）
      // 标记为禁用，避免反复尝试
      updateAlarm(alarm.id, { enabled: false, alarmIds: [], retryAlarmIds: [] })
      hasChanges = true
      result.failed++
      failedAlarms.push(alarm)
    }
  }

  // 清理孤儿系统闹钟：系统中存在但不在任何 Storage alarmIds 里的闹钟
  // ⚠️ get_alarms.ts 不返回 metadata，无法区分「我们的」和「其他 app 的」
  // 所以不做反向清理，避免误删用户在其他 app 创建的闹钟

  return result
}

/** onResume 节流判断：距上次检查超过 5 分钟才检查 */
export function shouldSyncOnResume(): boolean {
  const now = Date.now()
  if (now - lastSyncTime < RESUME_THROTTLE_MS) return false
  lastSyncTime = now
  return true
}

/** 冷启动时调用——总是检查，不节流 */
export async function syncOnColdStart(): Promise<SyncResult> {
  lastSyncTime = Date.now()
  return syncAlarmsWithSystem()
}

/** onResume 时调用——带节流 */
export async function syncOnResume(): Promise<SyncResult | null> {
  if (!shouldSyncOnResume()) return null
  return syncAlarmsWithSystem()
}
