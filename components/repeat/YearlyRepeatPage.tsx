// YearlyRepeatPage.tsx - 每年模式专属设置页
// 支持4种子模式：按日期(同月多日) / 按星期(某月第N周星期X) / 按节气 / 第N个工作日
// 状态模式：useObservable + subscribe 监听变化触发 sync
import { useObservable, useEffect, List, Section, Text, Picker, NavigationLink, HStack, Spacer } from "scripting"
import { RepeatRule, YearlySubMode, HolidayAction, getDaysOfMonth } from "../../lib/constants"
import { WEEKDAY_LABELS } from "../../lib/constants"
import { SOLAR_TERM_NAMES } from "../../lib/solar-term"
import { HolidayActionPicker } from "./HolidayActionPicker"
import { DayOfMonthPicker, formatDaysOfMonth } from "../DayOfMonthPicker"

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
const WEEK_OF_MONTH_LABELS = ["第一周", "第二周", "第三周", "第四周", "最后一周"]
const WEEK_OF_MONTH_VALUES = [1, 2, 3, 4, -1]
const WEEKDAY_PICKER_LABELS = WEEKDAY_LABELS.map((l) => `星期${l}`)
const SUB_MODE_LABELS = ["按日期", "按星期", "按节气", "第N个工作日"]
const SUB_MODE_VALUES: YearlySubMode[] = ["date", "weekday", "solarTerm", "nthWorkday"]

interface YearlyRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function YearlyRepeatPage({ rule }: YearlyRepeatPageProps) {
  const init = rule.value
  const initialSubModeIdx = SUB_MODE_VALUES.indexOf((init.yearlySubMode ?? (init.solarTerm ? "solarTerm" : "date")) as YearlySubMode)
  const subModeIdx = useObservable(initialSubModeIdx >= 0 ? initialSubModeIdx : 0)
  const monthOfYear = useObservable(init.monthOfYear ?? 1)
  const daysOfMonth = useObservable<number[]>(getDaysOfMonth(init))
  const weekOfMonth = useObservable(init.weekOfMonth ?? 1)
  const weekdayOfMonth = useObservable(init.weekdayOfMonth ?? 2)
  const initialSolarIdx = (() => {
    if (init.solarTerm) {
      const idx = SOLAR_TERM_NAMES.indexOf(init.solarTerm)
      if (idx >= 0) return idx
    }
    return 0
  })()
  const solarTermIdx = useObservable(initialSolarIdx)
  const nthWorkday = useObservable(init.nthWorkdayOfYear ?? 1)
  const holidayAction = useObservable<HolidayAction>(init.holidayAction ?? "none")

  const sync = () => {
    const subMode = SUB_MODE_VALUES[subModeIdx.value]
    const newRule: RepeatRule = {
      mode: "yearly",
      interval: 1,
      yearlySubMode: subMode,
      holidayAction: holidayAction.value,
    }
    if (subMode === "date") {
      newRule.monthOfYear = monthOfYear.value
      newRule.daysOfMonth = daysOfMonth.value
    } else if (subMode === "weekday") {
      newRule.monthOfYear = monthOfYear.value
      newRule.weekOfMonth = weekOfMonth.value
      newRule.weekdayOfMonth = weekdayOfMonth.value
    } else if (subMode === "solarTerm") {
      if (solarTermIdx.value >= 0 && solarTermIdx.value < SOLAR_TERM_NAMES.length) {
        newRule.solarTerm = SOLAR_TERM_NAMES[solarTermIdx.value]
      }
    } else if (subMode === "nthWorkday") {
      newRule.nthWorkdayOfYear = nthWorkday.value
    }
    rule.setValue(newRule)
  }

  useEffect(() => {
    const onLocalChange = () => { sync() }
    subModeIdx.subscribe(onLocalChange)
    monthOfYear.subscribe(onLocalChange)
    daysOfMonth.subscribe(onLocalChange)
    weekOfMonth.subscribe(onLocalChange)
    weekdayOfMonth.subscribe(onLocalChange)
    solarTermIdx.subscribe(onLocalChange)
    nthWorkday.subscribe(onLocalChange)
    holidayAction.subscribe(onLocalChange)
    return () => {
      subModeIdx.unsubscribe(onLocalChange)
      monthOfYear.unsubscribe(onLocalChange)
      daysOfMonth.unsubscribe(onLocalChange)
      weekOfMonth.unsubscribe(onLocalChange)
      weekdayOfMonth.unsubscribe(onLocalChange)
      solarTermIdx.unsubscribe(onLocalChange)
      nthWorkday.unsubscribe(onLocalChange)
      holidayAction.unsubscribe(onLocalChange)
    }
  }, [])

  const subMode = SUB_MODE_VALUES[subModeIdx.value]

  return (
    <List navigationTitle="每年" navigationBarTitleDisplayMode="inline">
      <Section header={<Text>选择方式</Text>}>
        <Picker
          title="方式"
          value={subModeIdx as any}
        >
          {SUB_MODE_LABELS.map((label, idx) => <Text key={idx} tag={idx}>{label}</Text>)}
        </Picker>
      </Section>

      {subMode === "date" && (
        <Section header={<Text>公历日期</Text>}>
          <Picker
            title="月份"
            value={monthOfYear as any}
          >
            {MONTH_LABELS.map((label, idx) => <Text key={idx} tag={idx + 1}>{label}</Text>)}
          </Picker>
          <NavigationLink
            destination={<DayOfMonthPicker value={daysOfMonth.value} onChanged={(v) => { daysOfMonth.setValue(v); sync() }} />}
          >
            <HStack alignment="center">
              <Text>选择日期</Text>
              <Spacer />
              <Text foregroundStyle="secondaryLabel">{formatDaysOfMonth(daysOfMonth.value)}</Text>
            </HStack>
          </NavigationLink>
        </Section>
      )}

      {subMode === "weekday" && (
        <Section header={<Text>某月第N周星期X</Text>}>
          <Picker
            title="月份"
            value={monthOfYear as any}
          >
            {MONTH_LABELS.map((label, idx) => <Text key={idx} tag={idx + 1}>{label}</Text>)}
          </Picker>
          <Picker
            title="第几周"
            value={weekOfMonth as any}
          >
            {WEEK_OF_MONTH_LABELS.map((label, idx) => <Text key={idx} tag={WEEK_OF_MONTH_VALUES[idx]}>{label}</Text>)}
          </Picker>
          <Picker
            title="星期几"
            value={weekdayOfMonth as any}
          >
            {WEEKDAY_PICKER_LABELS.map((label, idx) => <Text key={idx} tag={idx + 1}>{label}</Text>)}
          </Picker>
        </Section>
      )}

      {subMode === "solarTerm" && (
        <Section header={<Text>节气</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">每年「{SOLAR_TERM_NAMES[solarTermIdx.value]}」当天提醒</Text>}>
          <Picker
            title="节气"
            value={solarTermIdx as any}
          >
            {SOLAR_TERM_NAMES.map((label, idx) => <Text key={idx} tag={idx}>{label}</Text>)}
          </Picker>
        </Section>
      )}

      {subMode === "nthWorkday" && (
        <Section header={<Text>第N个工作日</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">每年第{nthWorkday.value}个工作日提醒</Text>}>
          <Picker
            title="第几个"
            value={nthWorkday as any}
          >
            {Array.from({ length: 260 }, (_, i) => <Text key={i} tag={i + 1}>{i + 1}</Text>)}
          </Picker>
        </Section>
      )}

      <HolidayActionPicker
        value={holidayAction.value}
        onChanged={(v) => { holidayAction.setValue(v) }}
      />
    </List>
  )
}
