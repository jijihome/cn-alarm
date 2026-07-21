// HolidayActionPicker.tsx - 调休动作三选一组件
// 三个选项：none=关闭 / skip=跳过节假日 / defer=顺延到下一工作日
// 各 repeat 模式页面共用，通过 onChanged 回调让宿主页面触发 sync
import { List, Section, Text, Button, HStack, Spacer } from "scripting"
import { HolidayAction } from "../../lib/constants"

const ACTION_LABELS: { value: HolidayAction; label: string; desc: string }[] = [
  { value: "none", label: "关闭", desc: "不查调休，按设定日期固定响铃" },
  { value: "skip", label: "跳过节假日", desc: "节假日当天不响，补班日额外响铃" },
  { value: "defer", label: "顺延到下一工作日", desc: "节假日当天顺延到下一个非节假日响铃" },
]

interface HolidayActionPickerProps {
  value: HolidayAction
  onChanged: (v: HolidayAction) => void
}

export function HolidayActionPicker({ value, onChanged }: HolidayActionPickerProps) {
  const current = ACTION_LABELS.find((a) => a.value === value) ?? ACTION_LABELS[0]

  return (
    <Section header={<Text>调休</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">{current.desc}</Text>}>
      {ACTION_LABELS.map((a) => {
        const selected = a.value === value
        return (
          <Button
            key={a.value}
            action={() => onChanged(a.value)}
          >
            <HStack alignment="center">
              <Text foregroundStyle={selected ? "systemBlue" : "label"}>{a.label}</Text>
              <Spacer />
              {selected ? <Text foregroundStyle="systemBlue">✓</Text> : null}
            </HStack>
          </Button>
        )
      })}
    </Section>
  )
}
