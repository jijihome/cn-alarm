// WorkdayRepeatPage.tsx - 每工作日模式专属设置页
import { useObservable, List, Section, Text } from "scripting"
import { RepeatRule, HolidayAction } from "../../lib/constants"
import { HolidayActionPicker } from "./HolidayActionPicker"

interface WorkdayRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function WorkdayRepeatPage({ rule }: WorkdayRepeatPageProps) {
  const init = rule.value
  const holidayAction = useObservable<HolidayAction>(init.holidayAction ?? "skip")

  const sync = () => {
    rule.setValue({
      mode: "workday",
      interval: 1,
      holidayAction: holidayAction.value,
    })
  }

  return (
    <List navigationTitle="每工作日" navigationBarTitleDisplayMode="inline">
      <Section header={<Text>工作日响铃</Text>}>
        <Text font={15}>
          周一至周五自动响铃
        </Text>
        <Text foregroundStyle="secondaryLabel">
          interval 固定为 1，无需设置间隔
        </Text>
      </Section>

      <HolidayActionPicker
        value={holidayAction.value}
        onChanged={(v) => { holidayAction.setValue(v); sync() }}
      />
    </List>
  )
}
