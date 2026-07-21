// AlarmRow.tsx - 闹钟列表行组件
import { useState } from "scripting"
import { Button, HStack, VStack, Text, Toggle, Circle } from "scripting"
import { AlarmItem } from "../lib/constants"
import { formatRepeatDescription } from "../lib/scheduler"

interface AlarmRowProps {
  alarm: AlarmItem
  onToggle: (id: string, enabled: boolean) => void
  onEdit: (id: string) => void
}

export function AlarmRow({ alarm, onToggle, onEdit }: AlarmRowProps) {
  const [loading, setLoading] = useState(false)

  const timeStr = `${String(alarm.hour).padStart(2, "0")}:${String(alarm.minute).padStart(2, "0")}`
  const desc = formatRepeatDescription(alarm.repeat)

  const handleToggle = (value: boolean) => {
    setLoading(true)
    try {
      onToggle(alarm.id, value)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button action={() => onEdit(alarm.id)}>
      <HStack alignment="center" spacing={12}>
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
        </VStack>
        <Toggle
          title="启用"
          value={alarm.enabled}
          onChanged={handleToggle}
        />
      </HStack>
    </Button>
  )
}
