// fetch-holidays.ts — 从 ICS 订阅获取节假日数据（scripting-ts run 执行）
// 数据源：https://ical.muhan.org/（中国节假日 ICS 日历，2013年至今）
// 调用方式：Shell.run("scripting-ts run .../fetch-holidays.ts --queryparameters '{\"years\":[2026,2027]}'")

import { Script } from "scripting"

declare function fetch(url: string): Promise<any>

const ICS_URL = "https://ical.muhan.org/"
const SHARED = { shared: true }
const STORAGE_KEY = "cn_alarm_holidays"

interface HolidayEntry {
  date: string
  name: string
}

interface HolidayCalendar {
  year: number
  holidays: HolidayEntry[]
  workdays: HolidayEntry[]
  source?: "default" | "network"
  syncedAt?: string
}

// ==================== ICS 解析 ====================

/** 解析 ICS 文本，提取假期和补班日期 */
function parseICS(icsText: string): Map<number, { holidays: HolidayEntry[]; workdays: HolidayEntry[] }> {
  const result = new Map<number, { holidays: HolidayEntry[]; workdays: HolidayEntry[] }>()
  const events = icsText.split("BEGIN:VEVENT")

  for (let i = 1; i < events.length; i++) {
    const block = events[i]
    const endIdx = block.indexOf("END:VEVENT")
    const content = endIdx > 0 ? block.substring(0, endIdx) : block
    let dtstart = ""
    let summary = ""

    const lines = content.split(/\r?\n/)
    for (const line of lines) {
      if (line.startsWith("DTSTART")) {
        const colonIdx = line.indexOf(":")
        if (colonIdx > 0) {
          dtstart = line.substring(colonIdx + 1).trim().substring(0, 8)
        }
      } else if (line.startsWith("SUMMARY:")) {
        summary = line.substring(8).trim()
      }
    }

    if (dtstart.length === 8) {
      const y = parseInt(dtstart.substring(0, 4))
      const m = dtstart.substring(4, 6)
      const d = dtstart.substring(6, 8)
      const dateStr = `${y}-${m}-${d}`

      if (!result.has(y)) {
        result.set(y, { holidays: [], workdays: [] })
      }
      const yearData = result.get(y)!

      // SUMMARY 含"补班"→ 补班日，含"假期"→ 节假日
      if (summary.includes("补班")) {
        yearData.workdays.push({ date: dateStr, name: summary })
      } else {
        // 提取节日名称：去掉"假期""第N天 / 共N天"等后缀
        const name = summary.replace(/假期.*$/, "").trim() || summary
        yearData.holidays.push({ date: dateStr, name })
      }
    }
  }

  return result
}

// ==================== 主逻辑 ====================

const params = Script.queryParameters as { years?: number[] }
const targetYears = params.years ?? [new Date().getFullYear(), new Date().getFullYear() + 1]

fetch(ICS_URL)
  .then((resp: any) => {
    if (!resp.ok) {
      Script.exit({ ok: false, error: `HTTP ${resp.status}` })
      return
    }
    return resp.text().then((text: string) => {
      const parsed = parseICS(text)

      // 加载现有数据（增量合并）
      const existing = Storage.get<HolidayCalendar[]>(STORAGE_KEY, SHARED) ?? []
      const now = new Date().toISOString()

      const synced: number[] = []
      const failed: number[] = []

      for (const year of targetYears) {
        const yearData = parsed.get(year)
        if (!yearData || yearData.holidays.length === 0) {
          failed.push(year)
          continue
        }

        const calendar: HolidayCalendar = {
          year,
          holidays: yearData.holidays,
          workdays: yearData.workdays,
          source: "network",
          syncedAt: now,
        }

        const idx = existing.findIndex((c) => c.year === year)
        if (idx >= 0) {
          existing[idx] = calendar
        } else {
          existing.push(calendar)
        }
        synced.push(year)
      }

      // 写回 Storage（增量合并，不丢其他年份）
      Storage.set(STORAGE_KEY, existing, SHARED)

      const stats = synced.map((y) => {
        const d = parsed.get(y)!
        return `${y}年(${d.holidays.length}假 ${d.workdays.length}补)`
      })

      Script.exit({
        ok: true,
        synced,
        failed,
        summary: `已同步 ${stats.join("、")}${failed.length ? `，${failed.join("、")} 暂无数据` : ""}`,
      })
    })
  })
  .catch((e: any) => {
    Script.exit({ ok: false, error: String(e.message ?? e) })
  })