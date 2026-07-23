// repeat-rule-builder.ts - 根据新模式构建 RepeatRule
// 从 RepeatModePickerPage 的 selectMode 逻辑提取，供 RepeatSettings 的 .then() 回调使用
import { RepeatMode, RepeatRule, getDaysOfMonth } from "./constants"

export function buildRepeatRule(newMode: RepeatMode, oldRule: RepeatRule): RepeatRule {
  const newRule: RepeatRule = {
    mode: newMode,
    interval: 1,
    holidayAction: oldRule.holidayAction ?? "none",
  }
  if (newMode === "weekly") {
    newRule.weekdays = oldRule.weekdays ?? [2, 3, 4, 5, 6]
  }
  if (newMode === "monthly") {
    newRule.monthlySubMode = oldRule.monthlySubMode ?? "day"
    newRule.daysOfMonth = getDaysOfMonth(oldRule)
    if (oldRule.weekOfMonth) newRule.weekOfMonth = oldRule.weekOfMonth
    if (oldRule.weekdayOfMonth) newRule.weekdayOfMonth = oldRule.weekdayOfMonth
  }
  if (newMode === "yearly") {
    newRule.yearlySubMode = oldRule.yearlySubMode ?? "date"
    newRule.monthOfYear = oldRule.monthOfYear ?? 1
    newRule.daysOfMonth = getDaysOfMonth(oldRule)
    if (oldRule.solarTerm) newRule.solarTerm = oldRule.solarTerm
    if (oldRule.weekOfMonth) newRule.weekOfMonth = oldRule.weekOfMonth
    if (oldRule.weekdayOfMonth) newRule.weekdayOfMonth = oldRule.weekdayOfMonth
    if (oldRule.nthWorkdayOfYear) newRule.nthWorkdayOfYear = oldRule.nthWorkdayOfYear
  }
  if (newMode === "lunar_yearly") {
    newRule.lunarMonth = oldRule.lunarMonth ?? 1
    newRule.lunarDay = oldRule.lunarDay ?? 1
  }
  if (newMode === "once") {
    newRule.anchorDate = oldRule.anchorDate ?? new Date().toISOString().slice(0, 10)
  } else {
    // 非 once 模式：切换模式=重新开始，anchorDate 设为今天
    newRule.anchorDate = new Date().toISOString().slice(0, 10)
  }
  return newRule
}
