// AlarmRow.tsx - 闹钟列表行组件
import { useState } from "scripting"
import { HStack, VStack, Text, Toggle, Image, Button } from "scripting"
import { AlarmItem, RepeatMode } from "../lib/constants"
import { formatRepeatDescription, getNextTriggerMulti, isAlarmToday } from "../lib/scheduler"
import { isReminderConfirmed, getUnconfirmedTimes } from "../lib/alarm-store"

interface AlarmRowProps {
  alarm: AlarmItem
  groupTintColor?: string
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

export function AlarmRow({ alarm, groupTintColor, onToggle, onEdit, onConfirm, onUnconfirm }: AlarmRowProps) {
  const [loading, setLoading] = useState(false)

  const timeStr = `${String(alarm.hour).padStart(2, "0")}:${String(alarm.minute).padStart(2, "0")}`
  const desc = formatRepeatDescription(alarm.repeat)
  const nextTrigger = alarm.enabled ? getNextTriggerMulti(alarm, new Date()) : null
  const nextDateStr = nextTrigger
    ? (nextTrigger.getFullYear() !== new Date().getFullYear() ? nextTrigger.getFullYear() + "年" : "") + (nextTrigger.getMonth() + 1) + "月" + nextTrigger.getDate() + "日 周" + "日一二三四五六"[nextTrigger.getDay()]
    : null
  const nextTimeStr = nextTrigger
    ? `${String(nextTrigger.getHours()).padStart(2, "0")}:${String(nextTrigger.getMinutes()).padStart(2, "0")}`
    : timeStr

  // 今天未确认的时间点（分为即将到来和已过期）
  const today = new Date()
  const unconfirmed = alarm.retryConfig?.enabled ? getUnconfirmedTimes(alarm, today) : []
  const nowMinutes = today.getHours() * 60 + today.getMinutes()
  const upcomingUnconfirmed = unconfirmed.filter(t => t.hour * 60 + t.minute > nowMinutes)
  const overdueUnconfirmed = unconfirmed.filter(t => t.hour * 60 + t.minute <= nowMinutes)
  const hasUnconfirmed = unconfirmed.length > 0
  const isToday = isAlarmToday(alarm, today)
  const allConfirmedToday = alarm.retryConfig?.enabled && isToday && !hasUnconfirmed
  const noConfirmNeeded = alarm.retryConfig?.enabled && !isToday

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
      <VStack alignment="leading" spacing={2} onTapGesture={() => onEdit(alarm.id)}
        leadingSwipeActions={leadingActions}
      >
        <HStack alignment="center" spacing={6}>
          <Image
            systemName={MODE_ICONS[alarm.repeat.mode] || "alarm"}
            foregroundStyle={alarm.tintColor as any}
            imageScale="small"
          />
          <Text font={20} fontWeight="bold">{alarm.title}</Text>
          {alarm.groupName ? <Text font={14} foregroundStyle={(groupTintColor || "systemBlue") as any}>{alarm.groupName}</Text> : null}
        </HStack>
        <HStack alignment="firstTextBaseline" spacing={4}>
          {nextDateStr ? <Text font={14} foregroundStyle="secondaryLabel">{nextDateStr}</Text> : null}
          <Text font={14} fontWeight="semibold" foregroundStyle="secondaryLabel">{nextTimeStr}</Text>
        </HStack>
        <Text font={14} foregroundStyle="secondaryLabel">{desc}</Text>
        {(alarm.tag || alarm.note) ? <HStack spacing={4} alignment="firstTextBaseline">
          {alarm.tag ? <Text font={14} foregroundStyle={(alarm.tintColor || "systemBlue") as any}>{alarm.tag}</Text> : null}
          {(alarm.tag && alarm.note) ? <Text font={14} foregroundStyle="secondaryLabel">·</Text> : null}
          {alarm.note ? <Text font={14} foregroundStyle="secondaryLabel">{alarm.note}</Text> : null}
        </HStack> : null}
          {(alarm.reminderTimes && alarm.reminderTimes.length > 0) && (
            <Text font={14} foregroundStyle="secondaryLabel">{timePointsStr}</Text>
          )}
          {upcomingUnconfirmed.length > 0 && (
            <Text font={14} foregroundStyle="systemOrange">
              待确认: {upcomingUnconfirmed.map(t => `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`).join(", ")}
            </Text>
          )}
          {overdueUnconfirmed.length > 0 && (
            <Text font={14} foregroundStyle="systemRed">
              已过期未确认: {overdueUnconfirmed.map(t => `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`).join(", ")}
            </Text>
          )}
          {allConfirmedToday && (
            <Text font={14} foregroundStyle="systemGreen">今日已全部确认</Text>
          )}
          {noConfirmNeeded && (
            <Text font={14} foregroundStyle="secondaryLabel">今日无需确认</Text>
          )}
        </VStack>
    </Toggle>
  )
}
