// EndConditionPicker.tsx - 结束条件选择组件
// 三选一：永不 / 指定日期 / 周期数
// 通过 rule Observable 与 RepeatSettings 双向同步
import { useObservable, Section, Text, DatePicker, Stepper, HStack, Spacer, Button } from "scripting"
import { RepeatRule, RepeatMode } from "../../lib/constants"

/** 结束条件类型 */
type EndConditionType = "never" | "endDate" | "occurrences"

/** 各模式对应的周期单位标签 */
function getOccurrenceUnit(mode: RepeatMode, interval: number): string {
  switch (mode) {
    case "daily": return interval === 1 ? "天" : "个周期"
    case "weekly": return interval === 1 ? "周" : "个周期"
    case "monthly": return interval === 1 ? "月" : "个周期"
    case "yearly":
    case "lunar_yearly": return "年"
    case "workday": return interval === 1 ? "个工作日" : "个周期"
    default: return "个周期"
  }
}

const END_TYPE_OPTIONS: { value: EndConditionType; label: string }[] = [
  { value: "never", label: "永不" },
  { value: "endDate", label: "指定日期" },
  { value: "occurrences", label: "周期数" },
]

interface EndConditionPickerProps {
  rule: Observable<RepeatRule>
}

export function EndConditionPicker({ rule }: EndConditionPickerProps) {
  const r = rule.value

  // 推断当前结束条件类型
  const currentType: EndConditionType = (() => {
    if (r.endAfterOccurrences && r.endAfterOccurrences > 0) return "occurrences"
    if (r.endDate) return "endDate"
    return "never"
  })()

  const type = useObservable<EndConditionType>(currentType)
  const endDate = useObservable(r.endDate ?? new Date().toISOString().slice(0, 10))
  const occurrences = useObservable(r.endAfterOccurrences ?? 10)
  const unit = getOccurrenceUnit(r.mode, r.interval || 1)

  const sync = () => {
    const updated = { ...rule.value }
    switch (type.value) {
      case "never":
        delete updated.endDate
        delete updated.endAfterOccurrences
        break
      case "endDate":
        updated.endDate = endDate.value
        delete updated.endAfterOccurrences
        break
      case "occurrences":
        delete updated.endDate
        updated.endAfterOccurrences = occurrences.value
        break
    }
    rule.setValue(updated)
  }

  return (
    <Section header={<Text>结束条件</Text>}>
      {/* 三选一列表行 */}
      {END_TYPE_OPTIONS.map((opt) => {
        const selected = opt.value === type.value
        return (
          <Button
            key={opt.value}
            action={() => { type.setValue(opt.value); sync() }}
          >
            <HStack alignment="center">
              <Text foregroundStyle={selected ? "systemBlue" : "label"}>{opt.label}</Text>
              <Spacer />
              {selected ? <Text foregroundStyle="systemBlue">✓</Text> : null}
            </HStack>
          </Button>
        )
      })}

      {/* 指定日期 */}
      {type.value === "endDate" && (
        <DatePicker
          title="结束日期"
          displayedComponents={["date"]}
          value={new Date(endDate.value).getTime()}
          datePickerStyle="compact"
          onChanged={(ts: number) => {
            const d = new Date(ts)
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
            endDate.setValue(iso)
            sync()
          }}
        />
      )}

      {/* 周期数 */}
      {type.value === "occurrences" && (
        <Stepper
          onIncrement={() => { occurrences.setValue(occurrences.value + 1); sync() }}
          onDecrement={() => { occurrences.setValue(Math.max(1, occurrences.value - 1)); sync() }}
        >
          <HStack alignment="center">
            <Text>周期数</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">共{occurrences.value}{unit}</Text>
          </HStack>
        </Stepper>
      )}
    </Section>
  )
}
