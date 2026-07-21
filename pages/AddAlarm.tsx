// AddAlarm.tsx - 添加/编辑闹钟页
import { useObservable, useState, NavigationStack, List, Section, Text, DatePicker, Toggle, Picker, TextField, Button, Navigation, HStack, Spacer } from "scripting"

import { AlarmItem, RepeatRule } from "../lib/constants"
import { createAlarmItem, addAlarm, updateAlarm, getAlarmById, loadGroups, loadSettings } from "../lib/alarm-store"
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
  holidayAction: "none",
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

  // toast 状态（用 useState + onChanged，跟文档示例一致）
  const [toastMsg, setToastMsg] = useState("")
  const [toastShown, setToastShown] = useState(false)

  const title = useObservable(existing?.title ?? "新闹钟")
  const groupName = useObservable(existing?.groupName ?? "")
  const tag = useObservable(existing?.tag ?? "")
  const note = useObservable(existing?.note ?? "")
  const tintColor = useObservable(existing?.tintColor ?? "systemBlue")
  const defaults = existing ? null : loadSettings()
  const gradualWake = useObservable(existing?.gradualWake ?? defaults?.defaultGradualWake ?? false)

  // 时间
  const initialDate = new Date()
  initialDate.setHours(existing?.hour ?? 7, existing?.minute ?? 0, 0, 0)
  const timeValue = useObservable(initialDate)

  // 重复规则：RepeatSettings 自管状态，通过 rule Observable 读最新值
  const repeatRule = useObservable<RepeatRule>(existing?.repeat ?? DEFAULT_REPEAT_RULE)

  // 提前提醒
  const initialPreAlertIdx = existing
    ? PRESET_PRE_ALERTS.indexOf(existing.preAlertSeconds)
    : PRESET_PRE_ALERTS.indexOf(defaults?.defaultPreAlert ?? 300)
  const preAlertIdx = useObservable(initialPreAlertIdx >= 0 ? initialPreAlertIdx : 0)

  const handleSave = () => {
    if (!title.value.trim()) {
      setToastMsg("请输入闹钟标题")
      setToastShown(true)
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
      updateAlarm(editId, { ...alarmData })
    } else {
      const alarm = createAlarmItem(alarmData)
      addAlarm(alarm)
    }
    dismiss({ saved: true })
  }

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
        toast={{
          message: toastMsg,
          isPresented: toastShown,
          onChanged: setToastShown,
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

        <Section header={<Text>提醒方式</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">开启后，在正式响铃前先发一次轻提醒，逐步唤醒，避免被突然的大音量吓醒</Text>}>
          <Toggle title="渐进唤醒" value={gradualWake} />
          {gradualWake.value && (
            <Picker
              title="轻提醒提前量"
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
            {/* 无分类对应空串，其余对应分类名 */}
            <Text key="none" tag="">无分类</Text>
            {groups.map((g) => <Text key={g.id} tag={g.name}>{g.name}</Text>)}
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
