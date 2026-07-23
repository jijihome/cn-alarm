// WorkdayRepeatPage.tsx - 每工作日模式专属设置页
import { useObservable, List, Section, Text, NavigationStack, Button, Navigation } from "scripting"
import { RepeatRule, HolidayAction } from "../../lib/constants"
import { HolidayActionPicker } from "./HolidayActionPicker"

interface WorkdayRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function WorkdayRepeatPage({ rule }: WorkdayRepeatPageProps) {
  const dismiss = Navigation.useDismiss()
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
    <NavigationStack>
      <List
        navigationTitle="每工作日"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarLeading: <Button title="完成" action={() => dismiss()} />,
        }}
      >
      <Section
        header={<Text>工作日响铃</Text>}
        footer={<Text font="footnote" foregroundStyle="systemGray">自动在周一至周五响铃，法定节假日自动跳过，调休补班日补响</Text>}
      />

      <HolidayActionPicker
        value={holidayAction.value}
        onChanged={(v) => { holidayAction.setValue(v); sync() }}
      />
      </List>
    </NavigationStack>
  )
}
