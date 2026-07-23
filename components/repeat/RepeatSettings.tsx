// RepeatSettings.tsx - 重复模式设置
// 交互设计：
//   1. "模式" 行 → Menu 下拉菜单选模式（轻量，无页面跳转）
//   2. "设置" 行 → Button + Navigation.present 模态弹出当前模式的专属设置页
import { Text, Section, Button, Navigation, HStack, Spacer, Image, Picker } from "scripting"
import { RepeatMode, RepeatRule } from "../../lib/constants"
import { formatRepeatDescription } from "../../lib/scheduler"
import { buildRepeatRule } from "../../lib/repeat-rule-builder"

import { WeeklyRepeatPage } from "./WeeklyRepeatPage"
import { DailyRepeatPage } from "./DailyRepeatPage"
import { MonthlyRepeatPage } from "./MonthlyRepeatPage"
import { YearlyRepeatPage } from "./YearlyRepeatPage"
import { LunarRepeatPage } from "./LunarRepeatPage"
import { WorkdayRepeatPage } from "./WorkdayRepeatPage"
import { OnceRepeatPage } from "./OnceRepeatPage"
import { EndConditionPicker } from "./EndConditionPicker"

const REPEAT_MODES: { value: RepeatMode; label: string }[] = [
  { value: "once", label: "仅一次" },
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "yearly", label: "每年" },
  { value: "lunar_yearly", label: "农历每年" },
  { value: "workday", label: "每工作日" },
]

interface RepeatSettingsProps {
  initialValue?: RepeatRule
  rule: Observable<RepeatRule>
}

export function RepeatSettings({ rule }: RepeatSettingsProps) {
  // 直接在 JSX 中读 rule.value，确保 Scripting 响应式追踪捕获依赖

  const presentSettingsPage = () => {
    const currentMode = rule.value.mode
    const element = (() => {
      switch (currentMode) {
        case "once": return <OnceRepeatPage rule={rule} />
        case "daily": return <DailyRepeatPage rule={rule} />
        case "weekly": return <WeeklyRepeatPage rule={rule} />
        case "monthly": return <MonthlyRepeatPage rule={rule} />
        case "yearly": return <YearlyRepeatPage rule={rule} />
        case "lunar_yearly": return <LunarRepeatPage rule={rule} />
        case "workday": return <WorkdayRepeatPage rule={rule} />
      }
    })()
    Navigation.present({
      element,
    }).then(() => {
      // dismiss 回来后触发 rule 重渲染（设置页已直接修改 rule Observable）
      rule.setValue({ ...rule.value })
    })
  }

  return (
    <>
      <Section header={<Text>重复</Text>}>
        {/* 模式选择：Picker menu 风格弹出式菜单 */}
        <Picker
          title="模式"
          value={rule.value.mode as string}
          onChanged={(mode: string) => {
            if (mode !== rule.value.mode) {
              rule.setValue(buildRepeatRule(mode as RepeatMode, rule.value))
            }
          }}
          pickerStyle="automatic"
        >
          {REPEAT_MODES.map((m) => (
            <Text key={m.value} tag={m.value}>{m.label}</Text>
          ))}
        </Picker>
        <Button action={presentSettingsPage}>
          <HStack alignment="center">
            <Text>设置</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">{formatRepeatDescription(rule.value)}</Text>
            <Image systemName="chevron.right" imageScale="small" foregroundStyle="tertiaryLabel" />
          </HStack>
        </Button>
      </Section>
      {/* once 模式不需要结束条件（本身一次性） */}
      {rule.value.mode !== "once" && <EndConditionPicker rule={rule} />}
    </>
  )
}
