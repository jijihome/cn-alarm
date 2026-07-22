// AlarmRow.tsx - 闹钟列表行组件
import { useState } from "scripting"
import { HStack, VStack, Text, Toggle, Circle, Button } from "scripting"
import { AlarmItem } from "../lib/constants"
import { formatRepeatDescription } from "../lib/scheduler"
import { isReminderConfirmed, getUnconfirmedTimes } from "../lib/alarm-store"

interface AlarmRowProps {
  alarm: AlarmItem
  onToggle: (id: string, enabled: boolean) => void
  onEdit: (id: string) => void
  onConfirm?: (alarm: AlarmItem) => void
}

export function AlarmRow({ alarm, onToggle, onEdit, onConfirm }: AlarmRowProps) {
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

  return (
    <Toggle
      value={alarm.enabled}
      onChanged={handleToggle}
    >
      <HStack alignment="center" spacing={12} onTapGesture={() => onEdit(alarm.id)}>
        <Circle fill={alarm.tintColor as any} frame={{ width: 8, height: 8 }} />
        <VStack alignment="leading" spacing={2}>
          <HStack alignment="firstTextBaseline" spacing={8}>
            <Text font={28} fontWeight="bold">{timeStr}</Text>
            <Text font={13} foregroundStyle="secondaryLabel">{desc}</Text>
          </HStack>
          <Text font={14} foregroundStyle="secondaryLabel">
            {alarm.title}
            {alarm.tag ? ` · ${alarm.tag}` : ""}
          </Text>
          {alarm.retryConfig?.enabled && hasUnconfirmed && (
            <HStack alignment="center" spacing={4}>
              <Text font={12} foregroundStyle="systemOrange">
                待确认: {unconfirmed.map(t => `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`).join(", ")}
              </Text>
              {onConfirm && (
                <Button
                  title="确认"
                  font={12}
                  action={() => onConfirm(alarm)}
                />
              )}
            </HStack>
          )}
          {allConfirmed && (
            <Text font={12} foregroundStyle="systemGreen">今日已全部确认</Text>
          )}
        </VStack>
      </HStack>
    </Toggle>
  )
}
