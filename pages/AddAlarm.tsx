// AddAlarm.tsx - 添加/编辑闹钟页
import { useObservable, NavigationStack, List, Section, Text, DatePicker, Toggle, Picker, TextField, Button, Navigation, HStack, Spacer } from "scripting"

declare function alert(options: { title?: string; message: string }): Promise<void>
import { AlarmItem, RepeatRule } from "../lib/constants"
import { createAlarmItem, addAlarm, updateAlarm, getAlarmById, loadGroups } from "../lib/alarm-store"
import { scheduleAlarm, cancelAlarm } from "../lib/alarm-bridge"
import { RepeatSettings } from "../components/repeat/RepeatSettings"

const COLOR_OPTIONS = [
  { label: "蓝", value: "systemBlue" },
  { label: "青", value: "systemTeal" },
  { label: "紫", value: "systemPurple" },
  { label: "橙", value: "systemOrange" },
  { label: "绿", value: "systemGreen" },
  { label: "黄", value: "systemYellow" },
  { label: "红", value: "systemRed" },
  { label: "粉", value: "systemPink" },
]

const PRESET_PRE_ALERTS = [300, 600, 900, 1800]
const PRESET_PRE_ALERT_LABELS = ["5分钟", "10分钟", "15分钟", "30分钟"]

const DEFAULT_REPEAT_RULE: RepeatRule = {
  mode: "weekly",
  interval: 1,
  holidayAware: true,
  weekdays: [2, 3, 4, 5, 6],
}

interface AddAlarmProps {
  editId?: string
  onSave?: () => void
  onCancel?: () => void
}

export function AddAlarm({ editId }: AddAlarmProps) {
  const dismiss = Navigation.useDismiss()
  const existing = editId ? getAlarmById(editId) : null
  const groups = loadGroups()

  const title = useObservable(existing?.title ?? "新闹钟")
  const groupName = useObservable(existing?.groupName ?? "上班")
  const tag = useObservable(existing?.tag ?? "")
  const note = useObservable(existing?.note ?? "")
  const tintColor = useObservable(existing?.tintColor ?? "systemBlue")
  const gradualWake = useObservable(existing?.gradualWake ?? false)

  // 时间
  const initialDate = new Date()
  initialDate.setHours(existing?.hour ?? 7, existing?.minute ?? 0, 0, 0)
  const timeValue = useObservable(initialDate)

  // 重复规则：RepeatSettings 自管状态，通过 rule Observable 读最新值
  const repeatRule = useObservable<RepeatRule>(existing?.repeat ?? DEFAULT_REPEAT_RULE)

  // 提前提醒
  const initialPreAlertIdx = existing
    ? PRESET_PRE_ALERTS.indexOf(existing.preAlertSeconds)
    : 0
  const preAlertIdx = useObservable(initialPreAlertIdx >= 0 ? initialPreAlertIdx : 0)

  const handleSave = async () => {
    if (!title.value.trim()) {
      await alert({ title: "提示", message: "请输入闹钟标题" })
      return
    }

    const alarmData: Partial<AlarmItem> = {
      title: title.value,
      hour: timeValue.value.getHours(),
      minute: timeValue.value.getMinutes(),
      repeat: repeatRule.value,
      gradualWake: gradualWake.value,
      preAlertSeconds: PRESET_PRE_ALERTS[preAlertIdx.value],
      groupName: groupName.value,
      tag: tag.value,
      note: note.value,
      tintColor: tintColor.value,
    }

    if (editId && existing) {
      for (const aid of existing.alarmIds) await cancelAlarm(aid)
      const updated = updateAlarm(editId, { ...alarmData, alarmIds: [], enabled: false })
      if (existing.enabled && updated) {
        const newAlarmId = await scheduleAlarm(updated)
        if (newAlarmId) updateAlarm(editId, { enabled: true, alarmIds: [newAlarmId] })
      }
    } else {
      const alarm = createAlarmItem(alarmData)
      addAlarm(alarm)
      if (alarm.enabled) {
        const newAlarmId = await scheduleAlarm(alarm)
        if (newAlarmId) updateAlarm(alarm.id, { alarmIds: [newAlarmId] })
      }
    }
    dismiss({ saved: true })
  }

  const groupLabels = groups.map((g) => g.name)
  const colorLabels = COLOR_OPTIONS.map((c) => c.label)

  return (
    <NavigationStack>
      <List
        navigationTitle={editId ? "编辑闹钟" : "添加闹钟"}
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarLeading: <Button title="取消" action={() => dismiss({ saved: false })} />,
          topBarTrailing: <Button title="保存" action={handleSave} />,
        }}
      >
        <Section header={<Text>时间</Text>}>
          <DatePicker
            title="闹钟时间"
            displayedComponents={["hourAndMinute"]}
            value={timeValue}
            datePickerStyle="wheel"
          />
        </Section>

        <RepeatSettings
          initialValue={existing?.repeat}
          rule={repeatRule}
        />

        <Section header={<Text>提醒方式</Text>}>
          <Toggle title="渐进唤醒" value={gradualWake} />
          {gradualWake.value && (
            <Picker
              title="提前提醒"
              value={preAlertIdx as any}
            >
              {PRESET_PRE_ALERT_LABELS.map((label, idx) => <Text key={label} tag={idx}>{label}</Text>)}
            </Picker>
          )}
        </Section>

        <Section header={<Text>信息</Text>}>
          <TextField title="标题" value={title} prompt="闹钟标题" />
          <Picker
            title="分组"
            value={groupName}
          >
            {groupLabels.map((label) => <Text key={label} tag={label}>{label}</Text>)}
          </Picker>
          <TextField title="标签" value={tag} prompt="可选标签" />
          <TextField title="备注" value={note} prompt="可选备注" />
        </Section>

        <Section header={<Text>外观</Text>}>
          <Picker
            title="颜色"
            value={tintColor}
          >
            {colorLabels.map((label, idx) => <Text key={label} tag={COLOR_OPTIONS[idx].value}>{label}</Text>)}
          </Picker>
        </Section>
      </List>
    </NavigationStack>
  )
}
