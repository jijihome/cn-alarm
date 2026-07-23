// RepeatSettings.tsx - 重复模式设置
// 交互设计：
//   1. "模式" 行 → Button + Navigation.present 模态弹出模式选择页
//      （NavigationLink push 的页面修改 Observable 后 dismiss 回来父页面不重渲染，
//       改用 present + dismiss 返回值 + .then() 回调更新 rule）
//   2. "设置" 行 → NavigationLink push 到当前模式的专属设置页
import { Text, List, Section, NavigationLink, NavigationStack, Button, Navigation, HStack, Spacer, Image } from "scripting"
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
  const mode = rule.value.mode
  const currentLabel = REPEAT_MODES.find((m) => m.value === mode)?.label ?? ""
  const summary = formatRepeatDescription(rule.value)

  const settingsDestination = (() => {
    switch (mode) {
      case "once": return <OnceRepeatPage rule={rule} />
      case "daily": return <DailyRepeatPage rule={rule} />
      case "weekly": return <WeeklyRepeatPage rule={rule} />
      case "monthly": return <MonthlyRepeatPage rule={rule} />
      case "yearly": return <YearlyRepeatPage rule={rule} />
      case "lunar_yearly": return <LunarRepeatPage rule={rule} />
      case "workday": return <WorkdayRepeatPage rule={rule} />
    }
  })()

  const presentModePicker = () => {
    Navigation.present({
      element: <RepeatModePickerPage currentMode={rule.value.mode} />,
    }).then((result) => {
      if (result?.selectedMode && result.selectedMode !== rule.value.mode) {
        const newRule = buildRepeatRule(result.selectedMode, rule.value)
        rule.setValue(newRule)
      }
    })
  }

  return (
    <>
      <Section header={<Text>重复</Text>}>
        <Button action={presentModePicker}>
          <HStack alignment="center">
            <Text>模式</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">{currentLabel}</Text>
            <Image systemName="chevron.right" imageScale="small" foregroundStyle="tertiaryLabel" />
          </HStack>
        </Button>
        <NavigationLink
          destination={settingsDestination}
        >
          <HStack alignment="center">
            <Text>设置</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">{summary}</Text>
          </HStack>
        </NavigationLink>
      </Section>
      {/* once 模式不需要结束条件（本身一次性） */}
      {mode !== "once" && <EndConditionPicker rule={rule} />}
    </>
  )
}

// ==================== 模式选择页（模态弹出，dismiss 返回选择结果） ====================
function RepeatModePickerPage({ currentMode }: { currentMode: RepeatMode }) {
  const dismiss = Navigation.useDismiss()
  const selectMode = (mode: RepeatMode) => {
    dismiss({ selectedMode: mode })
  }

  return (
    <NavigationStack>
      <List navigationTitle="选择重复模式" navigationBarTitleDisplayMode="inline">
        <Section>
          {REPEAT_MODES.map((m) => {
            const selected = m.value === currentMode
            return (
              <Button
                key={m.value}
                action={() => selectMode(m.value)}
              >
                <HStack alignment="center">
                  <Text foregroundStyle={selected ? "systemBlue" : "label"}>{m.label}</Text>
                  <Spacer />
                  {selected ? <Text foregroundStyle="systemBlue">✓</Text> : null}
                </HStack>
              </Button>
            )
          })}
        </Section>
      </List>
    </NavigationStack>
  )
}
