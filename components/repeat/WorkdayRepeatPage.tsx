// WorkdayRepeatPage.tsx - 每工作日模式专属设置页
import { useObservable, List, Section, Text, Toggle } from "scripting"
import { RepeatRule } from "../../lib/constants"

interface WorkdayRepeatPageProps {
  rule: Observable<RepeatRule>
}

export function WorkdayRepeatPage({ rule }: WorkdayRepeatPageProps) {
  const init = rule.value
  const holidayAware = useObservable(init.holidayAware ?? true)

  const sync = () => {
    rule.setValue({
      mode: "workday",
      interval: 1,
      holidayAware: holidayAware.value,
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

      <Section header={<Text>智能调休</Text>}>
        <Toggle
          title="调休联动"
          value={holidayAware.value}
          onChanged={(v: boolean) => { holidayAware.setValue(v); sync() }}
        />
        <Text font={13} foregroundStyle="tertiaryLabel">
          {holidayAware.value
            ? "法定节假日自动跳过，调休补班日自动响铃"
            : "仅按周一至周五响铃，不受调休影响"}
        </Text>
      </Section>
    </List>
  )
}
