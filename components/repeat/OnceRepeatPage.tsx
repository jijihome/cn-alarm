// OnceRepeatPage.tsx - 仅一次模式专属设置页
import { useObservable, useEffect, List, Section, Text, DatePicker, NavigationStack, Button, Navigation } from "scripting"
import { RepeatRule } from "../../lib/constants"

interface OnceRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function OnceRepeatPage({ rule }: OnceRepeatPageProps) {
  const dismiss = Navigation.useDismiss()
  const init = rule.value
  const anchorDate = useObservable(() => {
    const d = new Date()
    if (init.anchorDate) {
      const parts = init.anchorDate.split("-")
      d.setFullYear(+parts[0], +parts[1] - 1, +parts[2])
    }
    return d
  })

  // DatePicker 自动双向绑定 anchorDate Observable
  // 用 useEffect 监听变化同步到 rule
  useEffect(() => {
    const d = anchorDate.value
    const dateStr = d.toISOString().slice(0, 10)
    if (dateStr !== rule.value.anchorDate) {
      rule.setValue({
        ...rule.value,
        mode: "once",
        anchorDate: dateStr,
      })
    }
  }, [anchorDate.value])

  return (
    <NavigationStack>
      <List
        navigationTitle="仅一次"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarLeading: <Button title="完成" action={() => dismiss()} />,
        }}
      >
        <Section header={<Text>选择日期</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">闹钟将在选定日期响一次后自动关闭</Text>}>
          <DatePicker
            title="闹钟日期"
            displayedComponents={["date"]}
            value={anchorDate}
            datePickerStyle="wheel"
          />
        </Section>
      </List>
    </NavigationStack>
  )
}
