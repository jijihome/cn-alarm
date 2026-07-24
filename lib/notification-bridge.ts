// notification-bridge.ts - Shell.run 桥接 ios-notifications skill
import { STORAGE_KEYS } from "./constants"

const NOTIF_SKILL_DIR = "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/ios-notifications/scripts"

// ==================== 通用桥接函数 ====================
async function runNotifScript(scriptName: string, params: Record<string, any>): Promise<any> {
  const jsonParams = JSON.stringify(params).replace(/'/g, "\\u0027")
  const skillPath = `${NOTIF_SKILL_DIR}/${scriptName}`.replace(/ /g, "\\ ")
  const cmd = `scripting-ts run ${skillPath} --queryparameters '${jsonParams}'`
  const result = await Shell.run(cmd)
  const stdout = result.output
  const match = stdout.match(/Script result:\s*(\{[\s\S]*\})/)
  if (!match) throw new Error("No result from notification script: " + scriptName + " | stdout: " + stdout.slice(0, 200))
  return JSON.parse(match[1])
}

// ==================== 调度单条通知 ====================
// 返回通知标识符（用 title+trigger_time 组合作为 ID，后续可按此取消）
export async function scheduleNotification(
  id: string,
  title: string,
  body: string,
  triggerTime: Date,
  repeatsType?: "hourly" | "daily" | "weekly" | "monthly"
): Promise<string | null> {
  // trigger_time 格式：YYYY-MM-DD HH:MM:SS
  const y = triggerTime.getFullYear()
  const mo = String(triggerTime.getMonth() + 1).padStart(2, "0")
  const d = String(triggerTime.getDate()).padStart(2, "0")
  const h = String(triggerTime.getHours()).padStart(2, "0")
  const mi = String(triggerTime.getMinutes()).padStart(2, "0")
  const s = String(triggerTime.getSeconds()).padStart(2, "0")
  const triggerTimeStr = `${y}-${mo}-${d} ${h}:${mi}:${s}`

  const result = await runNotifScript("schedule_notification.ts", {
    title,
    body,
    trigger_time: triggerTimeStr,
    ...(repeatsType ? { repeats_type: repeatsType } : {}),
  })

  if (result.success) {
    // schedule_notification 不返回 identifier，用自定义 ID 记录映射
    // 存到 Storage 便于后续取消
    const idMap = loadNotifIdMap()
    idMap[id] = { title, trigger_time: triggerTimeStr, ...(repeatsType ? { repeats_type: repeatsType } : {}) }
    saveNotifIdMap(idMap)
    return id
  }
  console.log("scheduleNotification failed:", JSON.stringify(result))
  return null
}

// ==================== 取消通知 ====================
export async function cancelNotification(id: string): Promise<boolean> {
  const idMap = loadNotifIdMap()
  const entry = idMap[id]
  if (!entry) return true // 没记录=可能已取消或从未调度

  // 拿到所有 pending 通知，按 title+trigger_time 匹配
  const result = await runNotifScript("get_notifications.ts", { type: "pending" })
  if (!result || !result.notifications) return false

  // 找到匹配的通知
  const matched = result.notifications.filter((n: any) =>
    n.title === entry.title && n.triggerDate && n.triggerDate.includes(entry.trigger_time)
  )

  if (matched.length === 0) {
    // 可能已触发或不存在，清理映射
    delete idMap[id]
    saveNotifIdMap(idMap)
    return true
  }

  // 按标识符取消
  const identifiers = matched.map((n: any) => n.identifier)
  const removeResult = await runNotifScript("remove_notifications.ts", {
    identifiers,
    type: "pending",
  })

  if (removeResult.success) {
    delete idMap[id]
    saveNotifIdMap(idMap)
    return true
  }
  return false
}

// ==================== 批量取消 ====================
export async function cancelNotifications(ids: string[]): Promise<void> {
  await Promise.all(ids.map(id => cancelNotification(id).catch(() => {})))
}

// ==================== 通知 ID 映射存储 ====================
// Storage key → { notifId: { title, trigger_time } }
const SHARED = { shared: true }
const NOTIF_ID_MAP_KEY = "cn_alarm_notif_id_map"

function loadNotifIdMap(): Record<string, { title: string; trigger_time: string }> {
  const data = Storage.get<Record<string, { title: string; trigger_time: string }>>(NOTIF_ID_MAP_KEY, SHARED)
  return data ?? {}
}

function saveNotifIdMap(map: Record<string, { title: string; trigger_time: string }>): void {
  Storage.set(NOTIF_ID_MAP_KEY, map, SHARED)
}

// 忽略未使用的 STORAGE_KEYS（保留引用以防 tree-shake 问题）
void STORAGE_KEYS
