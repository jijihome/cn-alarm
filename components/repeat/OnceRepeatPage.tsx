// OnceRepeatPage.tsx - 仅一次模式内联 Section 片段
import { Section, Text, DatePicker } from "scripting"
import { RepeatRule } from "../../lib/constants"

interface OnceRepeatSectionProps {
  rule: Observable<RepeatRule>
}

export function OnceRepeatSection({ rule }: OnceRepeatSectionProps) {
  const r = rule.value
  const anchorTimestamp = (() => {
    const d = new Date()
    if (r.anchorDate) {
      const parts = r.anchorDate.split("-")
      d.setFullYear(+parts[0], +parts[1] - 1, +parts[2])
    }
    return d.getTime()
  })()

  return (
    <Section header={<Text>选择日期</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">闹钟将在选定日期响一次后自动关闭</Text>}>
      <DatePicker
        title="闹钟日期"
        displayedComponents={["date"]}
        value={anchorTimestamp}
        datePickerStyle="compact"
        onChanged={(ts: number) => {
          const d = new Date(ts)
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          rule.setValue({ ...rule.value, anchorDate: dateStr })
        }}
      />
    </Section>
  )
}
