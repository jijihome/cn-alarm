// YearlyRepeatPage.tsx - 每年模式内联 Section 片段
// 支持4种子模式：按日期(同月多日) / 按星期(某月第N周星期X) / 按节气 / 第N个工作日
import { useObservable, Section, Text, Picker, NavigationLink, HStack, Spacer } from "scripting"
import { RepeatRule, YearlySubMode, HolidayAction, getDaysOfMonth, WEEKDAY_LABELS } from "../../lib/constants"
import { SOLAR_TERM_NAMES } from "../../lib/solar-term"
import { HolidayActionPicker } from "./HolidayActionPicker"
import { DayOfMonthPicker, formatDaysOfMonth } from "../DayOfMonthPicker"

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
const WEEK_OF_MONTH_LABELS = ["第一周", "第二周", "第三周", "第四周", "最后一周"]
const WEEK_OF_MONTH_VALUES = [1, 2, 3, 4, -1]
const WEEKDAY_PICKER_LABELS = WEEKDAY_LABELS.map((l) => `星期${l}`)
const SUB_MODE_LABELS = ["按日期", "按星期", "按节气", "第N个工作日"]
const SUB_MODE_VALUES: YearlySubMode[] = ["date", "weekday", "solarTerm", "nthWorkday"]

interface YearlyRepeatSectionProps {
  rule: Observable<RepeatRule>
}

export function YearlyRepeatSection({ rule }: YearlyRepeatSectionProps) {
  const r = rule.value
  const initialSubModeIdx = SUB_MODE_VALUES.indexOf((r.yearlySubMode ?? (r.solarTerm ? "solarTerm" : "date")) as YearlySubMode)
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
      mode: "yearly",
      interval: 1,
      yearlySubMode: newSubMode,
      holidayAction: r.holidayAction,
    }
    if (newSubMode === "date") {
      newRule.monthOfYear = r.monthOfYear ?? 1
      newRule.daysOfMonth = getDaysOfMonth(r)
    } else if (newSubMode === "weekday") {
      newRule.monthOfYear = r.monthOfYear ?? 1
      newRule.weekOfMonth = r.weekOfMonth ?? 1
      newRule.weekdayOfMonth = r.weekdayOfMonth ?? 2
    } else if (newSubMode === "solarTerm") {
      newRule.solarTerm = r.solarTerm ?? SOLAR_TERM_NAMES[0]
    } else if (newSubMode === "nthWorkday") {
      newRule.nthWorkdayOfYear = r.nthWorkdayOfYear ?? 1
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

      {subMode === "date" && (
        <Section header={<Text>公历日期</Text>}>
          <Picker
            title="月份"
            value={r.monthOfYear ?? 1}
            onChanged={(v: number) => updateRule({ monthOfYear: v })}
          >
            {MONTH_LABELS.map((label, idx) => <Text key={idx} tag={idx + 1}>{label}</Text>)}
          </Picker>
          <NavigationLink
            destination={<DayOfMonthPicker month={r.monthOfYear ?? 1} value={getDaysOfMonth(r)} onChanged={(v: number[]) => updateRule({ daysOfMonth: v })} />}
          >
            <HStack alignment="center">
              <Text>选择日期</Text>
              <Spacer />
              <Text foregroundStyle="secondaryLabel">{formatDaysOfMonth(getDaysOfMonth(r))}</Text>
            </HStack>
          </NavigationLink>
        </Section>
      )}

      {subMode === "weekday" && (
        <Section header={<Text>某月第N周星期X</Text>}>
          <Picker
            title="月份"
            value={r.monthOfYear ?? 1}
            onChanged={(v: number) => updateRule({ monthOfYear: v })}
          >
            {MONTH_LABELS.map((label, idx) => <Text key={idx} tag={idx + 1}>{label}</Text>)}
          </Picker>
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

      {subMode === "solarTerm" && (
        <Section header={<Text>节气</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">每年「{SOLAR_TERM_NAMES[(r.solarTerm ? SOLAR_TERM_NAMES.indexOf(r.solarTerm) : 0)]}」当天提醒</Text>}>
          <Picker
            title="节气"
            value={r.solarTerm ? SOLAR_TERM_NAMES.indexOf(r.solarTerm) : 0}
            onChanged={(v: number) => updateRule({ solarTerm: SOLAR_TERM_NAMES[v] })}
          >
            {SOLAR_TERM_NAMES.map((label, idx) => <Text key={idx} tag={idx}>{label}</Text>)}
          </Picker>
        </Section>
      )}

      {subMode === "nthWorkday" && (
        <Section header={<Text>第N个工作日</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">每年第{r.nthWorkdayOfYear ?? 1}个工作日提醒</Text>}>
          <Picker
            title="第几个"
            value={r.nthWorkdayOfYear ?? 1}
            onChanged={(v: number) => updateRule({ nthWorkdayOfYear: v })}
          >
            {Array.from({ length: 260 }, (_, i) => <Text key={i} tag={i + 1}>{i + 1}</Text>)}
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
