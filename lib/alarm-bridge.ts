// alarm-bridge.ts - Shell.run 桥接 ios-alarm skill
import { SKILL_DIR, AlarmItem, RetryConfig } from "./constants"
import { scheduleNotification, cancelNotification } from "./notification-bridge"
import { getNextTrigger } from "./scheduler"

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
  gradualWakeIds: string[] // 渐进唤醒通知 ID
}

export async function scheduleAlarm(alarm: AlarmItem, specificDate?: Date): Promise<ScheduleResult | null> {
  // 非 weekly 模式且未传 specificDate 时，用调度引擎算下次触发日期
  // 否则会掉进 scheduleSingleAlarm 的 else 分支变成 relative（每天重复响）
  // weekly 模式 + gradualWake 时也需要算 specificDate，供渐进唤醒通知确定首次触发日期
  // （scheduleSingleAlarm 对 weekly 走 weekly schedule 不依赖 specificDate，但渐进唤醒通知需要）
  if (!specificDate && alarm.repeat.mode !== "weekly") {
    // 调用方可能传入 enabled=false 的 alarm（toggle 场景：先 updateAlarm 再用旧对象调 scheduleAlarm）
    // 强制当 enabled=true 来算下次触发日期，因为调用方已决定要调度
    const alarmForCalc = { ...alarm, enabled: true }
    const next = getNextTrigger(alarmForCalc, new Date())
    if (next) {
      specificDate = next
    } else {
      // 调度引擎返回 null（已过期/达到次数上限），不调度
      return null
    }
  }

  // weekly 模式 + 渐进唤醒：算下次触发日期供渐进唤醒通知用（系统闹钟仍走 weekly schedule）
  let gradualDate: Date | undefined
  if (alarm.gradualWake && alarm.preAlertSeconds > 0 && alarm.repeat.mode === "weekly" && !specificDate) {
    const alarmForCalc = { ...alarm, enabled: true }
    gradualDate = getNextTrigger(alarmForCalc, new Date()) ?? undefined
  } else if (specificDate) {
    gradualDate = specificDate
  }

  const mainType = alarm.mainType ?? "alarm"
  let mainAlarmId: string | null = null
  const allAlarmIds: string[] = []
  const retryIds: string[] = []
  const gradualWakeIds: string[] = []

  // 渐进唤醒：在正式闹钟前 preAlertSeconds 秒调度本地通知（轻提醒）
  // ⚠️ AlarmManager.Countdown 的 preAlert 只是静默倒计时 UI，不产生声音
  // 所以用本地通知做真正的"轻提醒"，而不是用 preAlert 参数
  if (alarm.gradualWake && alarm.preAlertSeconds > 0) {
    const gids = await scheduleGradualWakeNotifications(alarm, gradualDate)
    gradualWakeIds.push(...gids)
  }

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
  return { mainAlarmId: mainAlarmId ?? allAlarmIds[0], allAlarmIds, retryIds, gradualWakeIds }
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
    metadata: { alarmItemId: alarm.id, hour: String(hour), minute: String(minute) },
  }

  // postAlert=60 表示正式响铃后 60 秒自动停止
  // schedule_countdown 要求至少一个 alert 参数
  // ⚠️ 不再传 preAlert——它只是静默倒计时 UI，不产生声音
  // 渐进唤醒改用本地通知（见 scheduleGradualWakeNotifications）
  params.postAlert = 60

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
      minute,
      0
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

// ==================== 调度渐进唤醒通知 ====================
// 在正式闹钟前 preAlertSeconds 秒调度本地通知（轻提醒）
// 为每个时间点（主+额外）各调度一条通知
// weekly 闹钟用 weekly 重复通知（每个选中星期各一条），非 weekly 用 one-shot
async function scheduleGradualWakeNotifications(
  alarm: AlarmItem,
  specificDate?: Date
): Promise<string[]> {
  const ids: string[] = []
  const preAlertSec = alarm.preAlertSeconds
  const isWeekly = alarm.repeat.mode === "weekly"
  const weekdays = alarm.repeat.weekdays ?? []

  // 收集所有时间点
  const allTimes = [
    { hour: alarm.hour, minute: alarm.minute, label: "main" },
    ...(alarm.reminderTimes ?? []).map((t, i) => ({ hour: t.hour, minute: t.minute, label: `extra${i}` }))
  ]

  for (const t of allTimes) {
    if (isWeekly && weekdays.length > 0) {
      // weekly 闹钟：为每个选中星期各调度一条 weekly 重复通知
      // 需要为每个星期几算一个「未来的该星期几」日期作为 trigger_time
      for (const wd of weekdays) {
        // wd: Apple 编号 1=日 2=一 ... 7=六 → JS getDay: 0=日 1=一 ... 6=六
        const jsDay = wd % 7
        const triggerTime = findNextWeekday(jsDay, t.hour, t.minute, preAlertSec)
        if (!triggerTime) continue

        const notifId = `${alarm.id}_gradual_${t.label}_wd${wd}`
        const nid = await scheduleNotification(
          notifId,
          alarm.title + " ⏰",
          `${Math.floor(preAlertSec / 60)} 分钟后响铃，请准备`,
          triggerTime,
          "weekly"
        )
        if (nid) ids.push(nid)
      }
    } else {
      // 非 weekly：one-shot 通知
      const notifId = `${alarm.id}_gradual_${t.label}`
      const triggerTime = buildTriggerDate(t.hour, t.minute, specificDate)
      triggerTime.setSeconds(triggerTime.getSeconds() - preAlertSec)

      // 如果触发时间已过去，跳过
      if (triggerTime.getTime() <= Date.now()) continue

      const nid = await scheduleNotification(
        notifId,
        alarm.title + " ⏰",
        `${Math.floor(preAlertSec / 60)} 分钟后响铃，请准备`,
        triggerTime
      )
      if (nid) ids.push(nid)
    }
  }

  return ids
}

/** 找到下一个指定星期几的触发时间（减去 preAlert 秒），用于 weekly 重复通知的首次 trigger_time */
function findNextWeekday(targetDay: number, hour: number, minute: number, preAlertSec: number): Date | null {
  const now = new Date()
  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(now)
    candidate.setDate(candidate.getDate() + offset)
    candidate.setHours(hour, minute, 0, 0)
    candidate.setSeconds(candidate.getSeconds() - preAlertSec)

    // 必须是目标星期几
    if (candidate.getDay() !== targetDay) continue
    // 触发时间必须在未来
    if (candidate.getTime() <= now.getTime()) continue

    return candidate
  }
  return null
}

// ==================== 取消渐进唤醒通知 ====================
export async function cancelGradualWakeNotifications(alarm: AlarmItem): Promise<void> {
  const ids: string[] = []
  // 按规则构造 ID
  ids.push(`${alarm.id}_gradual_main`)
  if (alarm.reminderTimes) {
    alarm.reminderTimes.forEach((_, i) => ids.push(`${alarm.id}_gradual_extra${i}`))
  }
  // 也取消 Storage 中记录的 ID
  if (alarm.gradualWakeIds) {
    ids.push(...alarm.gradualWakeIds)
  }
  await Promise.all(ids.map(id => cancelNotification(id).catch(() => {})))
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
