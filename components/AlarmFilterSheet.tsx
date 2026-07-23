// AlarmFilterSheet.tsx - 闹钟筛选 Sheet
import { useObservable, NavigationStack, List, Section, Text, Picker, Button, HStack, Navigation } from "scripting"
import { RepeatMode } from "../lib/constants"
import { loadGroups } from "../lib/alarm-store"

/** 筛选状态 */
export interface AlarmFilter {
  /** 启用状态：all=全部 / on=启用 / off=停用 */
  enabledFilter: "all" | "on" | "off"
  /** 分组筛选：""=全部 / 具体分组名 */
  groupFilter: string
  /** 重复模式筛选：""=全部 / 具体mode */
  modeFilter: string
}

/** 默认筛选（无筛选） */
export const DEFAULT_FILTER: AlarmFilter = {
  enabledFilter: "all",
  groupFilter: "",
  modeFilter: "",
}

/** 判断是否有活跃筛选条件 */
export function hasActiveFilter(f: AlarmFilter): boolean {
  return f.enabledFilter !== "all" || f.groupFilter !== "" || f.modeFilter !== ""
}

/** 重复模式中文标签 */
const MODE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "全部" },
  { value: "once", label: "仅一次" },
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "yearly", label: "每年" },
  { value: "lunar_yearly", label: "农历每年" },
  { value: "workday", label: "每工作日" },
]

/** 启用状态选项 */
const ENABLED_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "on", label: "启用" },
  { value: "off", label: "停用" },
]

interface AlarmFilterSheetProps {
  initialFilter: AlarmFilter
}

export function AlarmFilterSheet({ initialFilter }: AlarmFilterSheetProps) {
  const dismiss = Navigation.useDismiss()
  const enabledFilter = useObservable<string>(() => initialFilter.enabledFilter)
  const groupFilter = useObservable<string>(() => initialFilter.groupFilter)
  const modeFilter = useObservable<string>(() => initialFilter.modeFilter)

  // 动态获取分组列表
  const groups = loadGroups()
  const groupOptions = [
    { value: "", label: "全部" },
    ...groups.map(g => ({ value: g.name, label: g.name })),
    { value: "__none__", label: "未分组" },
  ]

  const handleReset = () => {
    enabledFilter.setValue("all")
    groupFilter.setValue("")
    modeFilter.setValue("")
  }

  const handleApply = () => {
    dismiss({
      enabledFilter: enabledFilter.value as "all" | "on" | "off",
      groupFilter: groupFilter.value,
      modeFilter: modeFilter.value,
    })
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="筛选"
        toolbar={{
          topBarLeading: (
            <Button title="重置" action={handleReset} />
          ),
          topBarTrailing: (
            <Button title="完成" action={handleApply} />
          ),
        }}
      >
        <Section header={<Text>启用状态</Text>}>
          <Picker title="启用状态" value={enabledFilter}>
            {ENABLED_OPTIONS.map(o => (
              <Text key={o.value} tag={o.value}>{o.label}</Text>
            ))}
          </Picker>
        </Section>

        <Section header={<Text>分组</Text>}>
          <Picker title="分组" value={groupFilter}>
            {groupOptions.map(o => (
              <Text key={o.value} tag={o.value}>{o.label}</Text>
            ))}
          </Picker>
        </Section>

        <Section header={<Text>重复模式</Text>}>
          <Picker title="重复模式" value={modeFilter}>
            {MODE_OPTIONS.map(o => (
              <Text key={o.value} tag={o.value}>{o.label}</Text>
            ))}
          </Picker>
        </Section>
      </List>
    </NavigationStack>
  )
}
