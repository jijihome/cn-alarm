// AddAlarm.tsx - 添加/编辑闹钟页
import { useObservable, useState, NavigationStack, List, Section, Text, DatePicker, Toggle, Picker, TextField, Button, Stepper, Navigation, HStack, Spacer, VStack, ForEach } from "scripting"

import { AlarmItem, RepeatRule, RetryConfig, RetryType } from "../lib/constants"
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

const DEFAULT_REPEAT_RULE: RepeatRule = {
  mode: "weekly",
  interval: 1,
  holidayAction: "none",
  weekdays: [2, 3, 4, 5, 6],
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  enabled: false,
  intervalMinutes: 5,
  maxRetries: 3,
  type: "notification",
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

  // 多时间点提醒（额外时间点，主时间点仍是 hour/minute）
  // ForEach 要求元素有 id 字段
  const reminderTimes = useObservable<{ id: string; hour: number; minute: number }[]>(
    existing?.reminderTimes ? existing.reminderTimes.map((t, i) => ({ id: `t${i}`, ...t })) : []
  )
  // 重试配置
  const retryConfig = useObservable<RetryConfig>(
    existing?.retryConfig ? { ...existing.retryConfig } : { ...DEFAULT_RETRY_CONFIG }
  )
  // 新增时间点用的 DatePicker
  const newTimeValue = useObservable<Date>(() => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    return d
  })

  // 提前提醒（秒）
  const preAlertSeconds = useObservable(existing?.preAlertSeconds ?? defaults?.defaultPreAlert ?? 300)

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
      preAlertSeconds: preAlertSeconds.value,
      groupName: groupName.value,
      tag: tag.value,
      note: note.value,
      tintColor: tintColor.value,
      reminderTimes: reminderTimes.value.map(({ hour, minute }) => ({ hour, minute })),
      retryConfig: retryConfig.value,
    }

    let savedAlarmId: string | null = null
    if (editId && existing) {
      updateAlarm(editId, { ...alarmData })
      savedAlarmId = editId
    } else {
      const alarm = createAlarmItem(alarmData)
      addAlarm(alarm)
      savedAlarmId = alarm.id
    }
    dismiss({ saved: true, alarmId: savedAlarmId })
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
            <Stepper
              onIncrement={() => preAlertSeconds.setValue(preAlertSeconds.value + 60)}
              onDecrement={() => preAlertSeconds.setValue(Math.max(60, preAlertSeconds.value - 60))}
            >
              <HStack alignment="center">
                <Text>轻提醒提前</Text>
                <Spacer />
                <Text foregroundStyle="secondaryLabel">{Math.floor(preAlertSeconds.value / 60)} 分钟</Text>
              </HStack>
            </Stepper>
          )}
        </Section>

        <Section
          header={<Text>多时间点提醒</Text>}
          footer={<Text font="footnote" foregroundStyle="systemGray">主时间点在上方设置。这里添加当天额外提醒时间点，如吃药、喝水等多次提醒。</Text>}
        >
          <HStack alignment="center" spacing={8}>
            <DatePicker
              title="新增时间"
              displayedComponents={["hourAndMinute"]}
              value={newTimeValue}
              datePickerStyle="compact"
            />
            <Spacer />
            <Button
              title="添加"
              systemImage="plus.circle.fill"
              action={() => {
                const id = `t${Date.now()}`
                const hour = newTimeValue.value.getHours()
                const minute = newTimeValue.value.getMinutes()
                const next = [...reminderTimes.value, { id, hour, minute }]
                next.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
                reminderTimes.setValue(next)
              }}
            />
          </HStack>
          {reminderTimes.value.length > 0 ? (
            <ForEach
              data={reminderTimes}
              builder={(t: { id: string; hour: number; minute: number }) => (
                <HStack key={t.id} alignment="center" spacing={12}>
                  <Text font="body">
                    {String(t.hour).padStart(2, "0")}:{String(t.minute).padStart(2, "0")}
                  </Text>
                  <Spacer />
                  <Button
                    title="删除"
                    systemImage="minus.circle.fill"
                    action={() => {
                      const next = reminderTimes.value.filter(item => item.id !== t.id)
                      reminderTimes.setValue(next)
                    }}
                  />
                </HStack>
              )}
            />
          ) : (
            <Text foregroundStyle="secondaryLabel">无额外时间点</Text>
          )}
        </Section>

        <Section
          header={<Text>未确认重试</Text>}
          footer={<Text font="footnote" foregroundStyle="systemGray">每个时间点响铃后，如果未在程序内确认，将自动按间隔重复提醒。确认后取消剩余重试。</Text>}
        >
          <Toggle title="启用重试" value={retryConfig.value.enabled} onChanged={(v: boolean) => retryConfig.setValue({ ...retryConfig.value, enabled: v })} />
          {retryConfig.value.enabled && (
            <>
              <Stepper
                onIncrement={() => retryConfig.value.intervalMinutes < 120 && retryConfig.setValue({ ...retryConfig.value, intervalMinutes: retryConfig.value.intervalMinutes + 1 })}
                onDecrement={() => retryConfig.value.intervalMinutes > 1 && retryConfig.setValue({ ...retryConfig.value, intervalMinutes: retryConfig.value.intervalMinutes - 1 })}
              >
                <HStack alignment="center">
                  <Text>重试间隔</Text>
                  <Spacer />
                  <Text foregroundStyle="secondaryLabel">{retryConfig.value.intervalMinutes} 分钟</Text>
                </HStack>
              </Stepper>
              <Stepper
                onIncrement={() => retryConfig.setValue({ ...retryConfig.value, maxRetries: retryConfig.value.maxRetries + 1 })}
                onDecrement={() => retryConfig.value.maxRetries > 1 && retryConfig.setValue({ ...retryConfig.value, maxRetries: retryConfig.value.maxRetries - 1 })}
              >
                <HStack alignment="center">
                  <Text>重试次数</Text>
                  <Spacer />
                  <Text foregroundStyle="secondaryLabel">{retryConfig.value.maxRetries} 次</Text>
                </HStack>
              </Stepper>
              <Picker
                title="重试方式"
                value={retryConfig.value.type as string}
                onChanged={(v: string) => retryConfig.setValue({ ...retryConfig.value, type: v as RetryType })}
              >
                <Text key="notification" tag="notification">通知</Text>
                <Text key="alarm" tag="alarm">系统闹钟</Text>
              </Picker>
            </>
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
