// WorkdayRepeatPage.tsx - 每工作日模式内联 Section 片段
import { Section, Text } from "scripting"
import { RepeatRule, HolidayAction } from "../../lib/constants"
import { HolidayActionPicker } from "./HolidayActionPicker"

interface WorkdayRepeatSectionProps {
  rule: Observable<RepeatRule>
}

export function WorkdayRepeatSection({ rule }: WorkdayRepeatSectionProps) {
  const r = rule.value

  return (
    <>
      <Section
        header={<Text>工作日响铃</Text>}
        footer={<Text font="footnote" foregroundStyle="systemGray">自动在周一至周五响铃，法定节假日自动跳过，调休补班日补响</Text>}
      />
      <HolidayActionPicker
        value={r.holidayAction ?? "skip"}
        onChanged={(v: HolidayAction) => rule.setValue({ ...r, holidayAction: v })}
      />
    </>
  )
}
