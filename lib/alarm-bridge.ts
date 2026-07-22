// alarm-bridge.ts - Shell.run 桥接 ios-alarm skill
import { SKILL_DIR, AlarmItem, RetryConfig } from "./constants"
import { scheduleNotification, cancelNotification } from "./notification-bridge"

// ==================== 通用桥接函数 ====================
async function runScript(scriptName: string, params: Record<string, any>): Promise<any> {
  const jsonParams = JSON.stringify(params).replace(/'/g, "\\u0027")
  // 路径含空格（Mobile Documents），必须转义，否则 Shell 把空格后当参数
  const skillPath = `${SKILL_DIR}/${scriptName}`.replace(/ /g, "\\ ")
  const cmd = `scripting-ts run ${skillPath} --queryparameters '${jsonParams}'`
  const result = await Shell.run(cmd)
  const stdout = result.output
  const match = stdout.match(/Script result:\s*(\{[\s\S]*\})/)
  if (!match) throw new Error("No result from script: " + scriptName + " | stdout: " + stdout.slice(0, 200))
  return JSON.parse(match[1])
}

// ==================== 构建触发时间 Date ====================
function buildTriggerDate(hour: number, minute: number, specificDate?: Date): Date {
  const d = new Date()
  if (specificDate) {
    d.setTime(specificDate.getTime())
  }
  d.setHours(hour, minute, 0, 0)
  return d
}

// ==================== 创建闹钟 ====================
// 根据 AlarmItem 构建 schedule_countdown.ts 参数并调用
// 支持多时间点 + 未确认重试调度
// 返回所有系统闹钟 ID + 重试 ID，调用方负责存储
export interface ScheduleResult {
  mainAlarmId: string
  allAlarmIds: string[]   // 主+额外时间点的系统闹钟 ID
  retryIds: string[]      // 重试闹钟 ID（alarm 类型）或通知 ID（notification 类型）
}

export async function scheduleAlarm(alarm: AlarmItem, specificDate?: Date): Promise<ScheduleResult | null> {
  const mainType = alarm.mainType ?? "alarm"
  let mainAlarmId: string | null = null
  const allAlarmIds: string[] = []
  const retryIds: string[] = []

  // 主时间点
  if (mainType === "notification") {
    const nid = await scheduleNotification(
      `${alarm.id}_main`,
      alarm.title,
      alarm.note || alarm.title,
      buildTriggerDate(alarm.hour, alarm.minute, specificDate)
    )
    if (nid) allAlarmIds.push(nid)
  } else {
    const aid = await scheduleSingleAlarm(alarm, alarm.hour, alarm.minute, specificDate)
    if (aid) {
      mainAlarmId = aid
      allAlarmIds.push(aid)
    }
  }

  // 额外时间点
  if (alarm.reminderTimes && alarm.reminderTimes.length > 0) {
    for (const t of alarm.reminderTimes) {
      const tType = t.type ?? "alarm"
      if (tType === "notification") {
        const nid = await scheduleNotification(
          `${alarm.id}_extra_${t.hour}_${t.minute}`,
          alarm.title,
          alarm.note || alarm.title,
          buildTriggerDate(t.hour, t.minute, specificDate)
        )
        if (nid) allAlarmIds.push(nid)
      } else {
        const aid = await scheduleSingleAlarm(alarm, t.hour, t.minute, specificDate)
        if (aid) allAlarmIds.push(aid)
      }
    }
  }

  // 为每个时间点调度重试提醒（预调度）
  if (alarm.retryConfig && alarm.retryConfig.enabled) {
    const rids = await scheduleRetries(alarm, specificDate)
    retryIds.push(...rids)
  }

  if (!mainAlarmId && allAlarmIds.length === 0) return null
  return { mainAlarmId: mainAlarmId ?? allAlarmIds[0], allAlarmIds, retryIds }
}

// ==================== 调度单个系统闹钟 ====================
async function scheduleSingleAlarm(
  alarm: AlarmItem,
  hour: number,
  minute: number,
  specificDate?: Date
): Promise<string | null> {
  const params: Record<string, any> = {
    title: alarm.title,
    tintColor: alarm.tintColor,
    metadata: { alarmItemId: alarm.id, hour, minute },
  }

  // 渐进唤醒：preAlert 为用户设置的提前秒数，postAlert 为正式响铃持续时长
  // 非渐进唤醒：也需要至少一个 alert 参数（schedule_countdown 硬性要求）
  // 用 postAlert=60 表示正式响铃后 60 秒自动停止
  if (alarm.gradualWake && alarm.preAlertSeconds > 0) {
    params.preAlert = alarm.preAlertSeconds
    params.postAlert = 60
  } else {
    params.postAlert = 60
  }

  if (alarm.repeat.mode === "weekly" && alarm.repeat.weekdays) {
    // 每周重复：用 weekly schedule
    params.scheduleType = "weekly"
    params.hour = hour
    params.minute = minute
    params.weekdays = alarm.repeat.weekdays
  } else if (specificDate) {
    // 一次性：用 fixed schedule
    const isoDate = new Date(
      specificDate.getFullYear(),
      specificDate.getMonth(),
      specificDate.getDate(),
      hour,
      minute
    ).toISOString()
    params.scheduleType = "fixed"
    params.date = isoDate
  } else {
    // 默认：relative schedule（每天）
    params.scheduleType = "relative"
    params.hour = hour
    params.minute = minute
  }

  const result = await runScript("schedule_countdown.ts", params)
  if (result.success) {
    // schedule_countdown 返回 { success, alarm: { id, state, ... } }
    const alarmId = result.alarm?.id ?? result.id ?? null
    return alarmId
  }
  console.log("scheduleSingleAlarm failed:", JSON.stringify(result))
  return null
}

// ==================== 调度重试提醒 ====================
// 为每个时间点预调度 maxRetries 条重试提醒
// type=alarm 用系统闹钟 / type=notification 用本地通知
async function scheduleRetries(
  alarm: AlarmItem,
  specificDate?: Date
): Promise<string[]> {
  const config = alarm.retryConfig!
  const retryIds: string[] = []

  // 收集所有时间点（主 + 额外）
  const allTimes = [
    { hour: alarm.hour, minute: alarm.minute },
    ...(alarm.reminderTimes ?? [])
  ]

  for (const t of allTimes) {
    for (let i = 1; i <= config.maxRetries; i++) {
      const retryTime = new Date()
      if (specificDate) {
        retryTime.setTime(specificDate.getTime())
      }
      retryTime.setHours(t.hour, t.minute, 0, 0)
      retryTime.setMinutes(retryTime.getMinutes() + i * config.intervalMinutes)

      const retryId = `${alarm.id}_retry_${t.hour}_${t.minute}_${i}`

      if (config.type === "notification") {
        const nid = await scheduleNotification(
          retryId,
          alarm.title + " (未确认提醒)",
          `第${i}次提醒：${alarm.title}，请在程序内确认`,
          retryTime
        )
        if (nid) retryIds.push(nid)
      } else {
        // 用系统闹钟做重试
        const aid = await scheduleSingleAlarm(alarm, retryTime.getHours(), retryTime.getMinutes(), specificDate)
        if (aid) retryIds.push(aid)
      }
    }
  }

  return retryIds
}

// ==================== 取消重试提醒 ====================
export async function cancelRetryAlarms(alarm: AlarmItem): Promise<void> {
  const config = alarm.retryConfig
  if (!config || !config.enabled) return

  // 收集所有时间点
  const allTimes = [
    { hour: alarm.hour, minute: alarm.minute },
    ...(alarm.reminderTimes ?? [])
  ]

  if (config.type === "notification") {
    // 通知重试：用 notification-bridge 取消
    const retryIds: string[] = []
    for (const t of allTimes) {
      for (let i = 1; i <= config.maxRetries; i++) {
        retryIds.push(`${alarm.id}_retry_${t.hour}_${t.minute}_${i}`)
      }
    }
    await Promise.all(retryIds.map(id => cancelNotification(id).catch(() => {})))
  } else {
    // 系统闹钟重试：取消 retryAlarmIds 中的所有 ID
    const retryIds = alarm.retryAlarmIds ?? []
    await Promise.all(retryIds.map(id => cancelAlarm(id).catch(() => {})))
  }
}

// ==================== 取消闹钟（主 + 重试） ====================
export async function cancelAllAlarms(alarm: AlarmItem): Promise<void> {
  // 取消重试
  await cancelRetryAlarms(alarm)
  // 取消所有系统闹钟
  await Promise.all(alarm.alarmIds.map(id => cancelAlarm(id).catch(() => {})))
  // 取消通知类型的时间点
  const notifIds: string[] = []
  const mainType = alarm.mainType ?? "alarm"
  if (mainType === "notification") {
    notifIds.push(`${alarm.id}_main`)
  }
  if (alarm.reminderTimes) {
    for (const t of alarm.reminderTimes) {
      if ((t.type ?? "alarm") === "notification") {
        notifIds.push(`${alarm.id}_extra_${t.hour}_${t.minute}`)
      }
    }
  }
  await Promise.all(notifIds.map(id => cancelNotification(id).catch(() => {})))
}

// ==================== 取消闹钟 ====================
export async function cancelAlarm(alarmId: string): Promise<boolean> {
  const result = await runScript("control_alarm.ts", { id: alarmId, action: "cancel" })
  return result.success === true
}

// ==================== 停止响铃 ====================
export async function stopAlarm(alarmId: string): Promise<boolean> {
  const result = await runScript("control_alarm.ts", { id: alarmId, action: "stop" })
  return result.success === true
}

// ==================== 获取系统闹钟列表 ====================
export async function getSystemAlarms(): Promise<any[]> {
  const result = await runScript("get_alarms.ts", {})
  if (result.success && result.alarms) {
    return result.alarms
  }
  return []
}

// ==================== 检查 AlarmManager 是否可用 ====================
export async function checkAlarmAvailable(): Promise<boolean> {
  try {
    const result = await runScript("get_alarms.ts", {})
    if (result.success) return true
    if (result.errorCode === "UNAVAILABLE") return false
    // 其他错误也说明 API 存在（只是参数问题）
    return true
  } catch {
    return false
  }
}
