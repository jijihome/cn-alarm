// AlarmRow.tsx - 闹钟列表行组件
import { useState } from "scripting"
import { HStack, VStack, Text, Toggle, Image, Button } from "scripting"
import { AlarmItem, RepeatMode } from "../lib/constants"
import { formatRepeatDescription } from "../lib/scheduler"
import { isReminderConfirmed, getUnconfirmedTimes } from "../lib/alarm-store"

interface AlarmRowProps {
  alarm: AlarmItem
  onToggle: (id: string, enabled: boolean) => void
  onEdit: (id: string) => void
  onConfirm?: (alarm: AlarmItem) => void
  onUnconfirm?: (alarm: AlarmItem) => void
}

/** 根据重复模式映射 SF Symbol 图标 */
const MODE_ICONS: Record<RepeatMode, string> = {
  once: "alarm",
  daily: "sunrise.fill",
  weekly: "calendar.badge.clock",
  monthly: "calendar",
  yearly: "calendar.badge.plus",
  lunar_yearly: "moon.fill",
  workday: "building.2.fill",
}

export function AlarmRow({ alarm, onToggle, onEdit, onConfirm, onUnconfirm }: AlarmRowProps) {
  const [loading, setLoading] = useState(false)

  const timeStr = `${String(alarm.hour).padStart(2, "0")}:${String(alarm.minute).padStart(2, "0")}`
  const desc = formatRepeatDescription(alarm.repeat)

  // 今天未确认的时间点
  const today = new Date()
  const unconfirmed = alarm.retryConfig?.enabled ? getUnconfirmedTimes(alarm, today) : []
  const hasUnconfirmed = unconfirmed.length > 0
  const allConfirmed = alarm.retryConfig?.enabled && !hasUnconfirmed

  const handleToggle = (value: boolean) => {
    setLoading(true)
    try {
      onToggle(alarm.id, value)
    } finally {
      setLoading(false)
    }
  }

  const timePointsStr = [
    { hour: alarm.hour, minute: alarm.minute },
    ...(alarm.reminderTimes ?? [])
  ].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
    .map(t => `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`)
    .join(", ")

  // 左滑操作按钮
  const leadingActions: { allowsFullSwipe?: boolean; actions: any[] } | undefined =
    alarm.retryConfig?.enabled ? {
      actions: hasUnconfirmed
        ? [<Button key="confirm" title="确认" tint="systemGreen" action={() => { if (onConfirm) onConfirm(alarm) }} />]
        : [<Button key="unconfirm" title="取消确认" tint="systemOrange" action={() => { if (onUnconfirm) onUnconfirm(alarm) }} />]
    } : undefined

  return (
    <Toggle
      value={alarm.enabled}
      onChanged={handleToggle}
    >
      <HStack alignment="center" spacing={8}
        leadingSwipeActions={leadingActions}
      >
        <Image
          systemName={MODE_ICONS[alarm.repeat.mode] || "alarm"}
          foregroundStyle={alarm.tintColor as any}
          imageScale="medium"
        />
        <VStack alignment="leading" spacing={2} onTapGesture={() => onEdit(alarm.id)}>
          <HStack alignment="firstTextBaseline" spacing={8}>
            <Text font={28} fontWeight="bold">{timeStr}</Text>
            <Text font={20} foregroundStyle="secondaryLabel">{alarm.title}{alarm.tag ? ` · ${alarm.tag}` : ""}</Text>
          </HStack>
          <Text font={14} foregroundStyle="secondaryLabel">{desc}</Text>
          {(alarm.reminderTimes && alarm.reminderTimes.length > 0) && (
            <Text font={12} foregroundStyle="tertiaryLabel">{timePointsStr}</Text>
          )}
          {hasUnconfirmed && (
            <Text font={12} foregroundStyle="systemOrange">
              待确认: {unconfirmed.map(t => `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`).join(", ")}
            </Text>
          )}
          {allConfirmed && (
            <Text font={12} foregroundStyle="systemGreen">今日已全部确认</Text>
          )}
        </VStack>
      </HStack>
    </Toggle>
  )
}
