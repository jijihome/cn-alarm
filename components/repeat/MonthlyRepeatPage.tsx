// MonthlyRepeatPage.tsx - 每月模式专属设置页
// 支持两种子模式：按日期（每月N号，支持多选） / 按星期（每月第N周星期X）
// 状态模式：useObservable + subscribe 监听变化触发 sync
import { useObservable, useEffect, List, Section, Text, Picker, NavigationLink, HStack, Spacer } from "scripting"
import { RepeatRule, MonthlySubMode, HolidayAction, getDaysOfMonth } from "../../lib/constants"
import { WEEKDAY_LABELS } from "../../lib/constants"
import { HolidayActionPicker } from "./HolidayActionPicker"
import { DayOfMonthPicker, formatDaysOfMonth } from "../DayOfMonthPicker"

const WEEK_OF_MONTH_LABELS = ["第一周", "第二周", "第三周", "第四周", "最后一周"]
const WEEK_OF_MONTH_VALUES = [1, 2, 3, 4, -1]
const WEEKDAY_PICKER_LABELS = WEEKDAY_LABELS.map((l) => `星期${l}`)
const SUB_MODE_LABELS = ["按日期", "按星期"]
const SUB_MODE_VALUES: MonthlySubMode[] = ["day", "weekday"]

interface MonthlyRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function MonthlyRepeatPage({ rule }: MonthlyRepeatPageProps) {
  const init = rule.value
  const initialSubModeIdx = SUB_MODE_VALUES.indexOf(init.monthlySubMode ?? "day")
  const subModeIdx = useObservable(initialSubModeIdx >= 0 ? initialSubModeIdx : 0)
  const daysOfMonth = useObservable<number[]>(getDaysOfMonth(init))
  const weekOfMonth = useObservable(init.weekOfMonth ?? 1)
  const weekdayOfMonth = useObservable(init.weekdayOfMonth ?? 2)
  const holidayAction = useObservable<HolidayAction>(init.holidayAction ?? "none")

  // sync: 将本地 Observable 状态写入 rule
  const sync = () => {
    const subMode = SUB_MODE_VALUES[subModeIdx.value]
    const newRule: RepeatRule = {
      mode: "monthly",
      interval: 1,
      monthlySubMode: subMode,
      holidayAction: holidayAction.value,
    }
    if (subMode === "day") {
      newRule.daysOfMonth = daysOfMonth.value
    } else {
      newRule.weekOfMonth = weekOfMonth.value
      newRule.weekdayOfMonth = weekdayOfMonth.value
    }
    rule.setValue(newRule)
  }

  // 订阅所有本地 Observable，任意变化时触发 sync
  useEffect(() => {
    const onLocalChange = () => { sync() }
    subModeIdx.subscribe(onLocalChange)
    daysOfMonth.subscribe(onLocalChange)
    weekOfMonth.subscribe(onLocalChange)
    weekdayOfMonth.subscribe(onLocalChange)
    holidayAction.subscribe(onLocalChange)
    return () => {
      subModeIdx.unsubscribe(onLocalChange)
      daysOfMonth.unsubscribe(onLocalChange)
      weekOfMonth.unsubscribe(onLocalChange)
      weekdayOfMonth.unsubscribe(onLocalChange)
      holidayAction.unsubscribe(onLocalChange)
    }
  }, [])

  const subMode = SUB_MODE_VALUES[subModeIdx.value]

  return (
    <List navigationTitle="每月" navigationBarTitleDisplayMode="inline">
      <Section header={<Text>选择方式</Text>}>
        <Picker
          title="方式"
          value={subModeIdx as any}
        >
          {SUB_MODE_LABELS.map((label, idx) => <Text key={idx} tag={idx}>{label}</Text>)}
        </Picker>
      </Section>

      {subMode === "day" ? (
        <Section header={<Text>选择日期</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">2月无29/30/31号时将自动取当月最后一天</Text>}>
          <NavigationLink
            destination={<DayOfMonthPicker value={daysOfMonth.value} onChanged={(v) => { daysOfMonth.setValue(v); sync() }} />}
          >
            <HStack alignment="center">
              <Text>已选日期</Text>
              <Spacer />
              <Text foregroundStyle="secondaryLabel">{formatDaysOfMonth(daysOfMonth.value)}</Text>
            </HStack>
          </NavigationLink>
        </Section>
      ) : (
        <Section header={<Text>选择星期</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">最后一周=该月最后一个该星期几</Text>}>
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

      <HolidayActionPicker
        value={holidayAction.value}
        onChanged={(v) => { holidayAction.setValue(v) }}
      />
    </List>
  )
}
