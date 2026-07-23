// MonthlyRepeatPage.tsx - 每月模式内联 Section 片段
// 支持两种子模式：按日期（每月N号，支持多选） / 按星期（每月第N周星期X）
import { useObservable, Section, Text, Picker, NavigationLink, HStack, Spacer } from "scripting"
import { RepeatRule, MonthlySubMode, HolidayAction, getDaysOfMonth, WEEKDAY_LABELS } from "../../lib/constants"
import { HolidayActionPicker } from "./HolidayActionPicker"
import { DayOfMonthPicker, formatDaysOfMonth } from "../DayOfMonthPicker"

const WEEK_OF_MONTH_LABELS = ["第一周", "第二周", "第三周", "第四周", "最后一周"]
const WEEK_OF_MONTH_VALUES = [1, 2, 3, 4, -1]
const WEEKDAY_PICKER_LABELS = WEEKDAY_LABELS.map((l) => `星期${l}`)
const SUB_MODE_LABELS = ["按日期", "按星期"]
const SUB_MODE_VALUES: MonthlySubMode[] = ["day", "weekday"]

interface MonthlyRepeatSectionProps {
  rule: Observable<RepeatRule>
}

export function MonthlyRepeatSection({ rule }: MonthlyRepeatSectionProps) {
  const r = rule.value
  // 子模式索引需要 useObservable（字符串→数字映射）
  const initialSubModeIdx = SUB_MODE_VALUES.indexOf(r.monthlySubMode ?? "day")
  const subModeIdx = useObservable(initialSubModeIdx >= 0 ? initialSubModeIdx : 0)
  const subMode = SUB_MODE_VALUES[subModeIdx.value]

  const updateRule = (updates: Partial<RepeatRule>) => {
    rule.setValue({ ...r, ...updates })
  }

  // 子模式切换时重建 rule
  const handleSubModeChange = (idx: number) => {
    subModeIdx.setValue(idx)
    const newSubMode = SUB_MODE_VALUES[idx]
    const newRule: RepeatRule = {
      mode: "monthly",
      interval: 1,
      monthlySubMode: newSubMode,
      holidayAction: r.holidayAction,
    }
    if (newSubMode === "day") {
      newRule.daysOfMonth = getDaysOfMonth(r)
    } else {
      newRule.weekOfMonth = r.weekOfMonth ?? 1
      newRule.weekdayOfMonth = r.weekdayOfMonth ?? 2
    }
    rule.setValue(newRule)
  }

  return (
    <>
      <Section header={<Text>选择方式</Text>}>
        <Picker
          title="方式"
          value={subModeIdx}
        >
          {SUB_MODE_LABELS.map((label, idx) => <Text key={idx} tag={idx}>{label}</Text>)}
        </Picker>
      </Section>

      {subMode === "day" ? (
        <Section header={<Text>选择日期</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">2月无29/30/31号时将自动取当月最后一天</Text>}>
          <NavigationLink
            destination={<DayOfMonthPicker value={getDaysOfMonth(r)} onChanged={(v: number[]) => updateRule({ daysOfMonth: v })} />}
          >
            <HStack alignment="center">
              <Text>已选日期</Text>
              <Spacer />
              <Text foregroundStyle="secondaryLabel">{formatDaysOfMonth(getDaysOfMonth(r))}</Text>
            </HStack>
          </NavigationLink>
        </Section>
      ) : (
        <Section header={<Text>选择星期</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">最后一周=该月最后一个该星期几</Text>}>
          <Picker
            title="第几周"
            value={r.weekOfMonth ?? 1}
            onChanged={(v: number) => updateRule({ weekOfMonth: v })}
          >
            {WEEK_OF_MONTH_LABELS.map((label, idx) => <Text key={idx} tag={WEEK_OF_MONTH_VALUES[idx]}>{label}</Text>)}
          </Picker>
          <Picker
            title="星期几"
            value={r.weekdayOfMonth ?? 2}
            onChanged={(v: number) => updateRule({ weekdayOfMonth: v })}
          >
            {WEEKDAY_PICKER_LABELS.map((label, idx) => <Text key={idx} tag={idx + 1}>{label}</Text>)}
          </Picker>
        </Section>
      )}

      <HolidayActionPicker
        value={r.holidayAction ?? "none"}
        onChanged={(v: HolidayAction) => updateRule({ holidayAction: v })}
      />
    </>
  )
}
