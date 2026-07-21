// alarm-bridge.ts - Shell.run 桥接 ios-alarm skill
import { SKILL_DIR, AlarmItem } from "./constants"

// ==================== 通用桥接函数 ====================
async function runScript(scriptName: string, params: Record<string, any>): Promise<any> {
  const jsonParams = JSON.stringify(params).replace(/'/g, "\\u0027")
  const cmd = `scripting-ts run ${SKILL_DIR}/${scriptName} --queryparameters '${jsonParams}'`
  const result = await Shell.run(cmd)
  const stdout = result.output
  const match = stdout.match(/Script result:\s*(\{[\s\S]*\})/)
  if (!match) throw new Error("No result from script: " + scriptName)
  return JSON.parse(match[1])
}

// ==================== 创建闹钟 ====================
// 根据 AlarmItem 构建 schedule_countdown.ts 参数并调用
export async function scheduleAlarm(alarm: AlarmItem, specificDate?: Date): Promise<string | null> {
  const params: Record<string, any> = {
    title: alarm.title,
    tintColor: alarm.tintColor,
    metadata: { alarmItemId: alarm.id },
  }

  // 渐进唤醒
  if (alarm.gradualWake && alarm.preAlertSeconds > 0) {
    params.preAlert = alarm.preAlertSeconds
    params.postAlert = 60
  }

  if (alarm.repeat.mode === "weekly" && alarm.repeat.weekdays) {
    // 每周重复：用 weekly schedule
    params.scheduleType = "weekly"
    params.hour = alarm.hour
    params.minute = alarm.minute
    params.weekdays = alarm.repeat.weekdays
  } else if (specificDate) {
    // 一次性：用 fixed schedule
    const isoDate = new Date(
      specificDate.getFullYear(),
      specificDate.getMonth(),
      specificDate.getDate(),
      alarm.hour,
      alarm.minute
    ).toISOString()
    params.scheduleType = "fixed"
    params.date = isoDate
  } else {
    // 默认：relative schedule（每天）
    params.scheduleType = "relative"
    params.hour = alarm.hour
    params.minute = alarm.minute
  }

  const result = await runScript("schedule_countdown.ts", params)
  if (result.success && result.id) {
    return result.id
  }
  console.log("scheduleAlarm failed:", JSON.stringify(result))
  return null
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
