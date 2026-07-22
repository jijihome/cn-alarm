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

  // 所有提醒时间点（统一列表，每项含 id + hour + minute + type）
  // 第一个元素对应 AlarmItem.hour/minute，其余对应 reminderTimes
  const allTimes = useObservable<{ id: string; hour: number; minute: number; type: RetryType }[]>(() => {
    const main = { id: "main", hour: existing?.hour ?? 7, minute: existing?.minute ?? 0, type: existing?.mainType ?? "alarm" as RetryType }
    if (existing?.reminderTimes && existing.reminderTimes.length > 0) {
      const extras = existing.reminderTimes.map((t, i) => ({ id: `t${i}`, hour: t.hour, minute: t.minute, type: (t.type ?? "alarm") as RetryType }))
      const all = [main, ...extras]
      all.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
      return all
    }
    return [main]
  })

  // 重复规则：RepeatSettings 自管状态，通过 rule Observable 读最新值
  const repeatRule = useObservable<RepeatRule>(existing?.repeat ?? DEFAULT_REPEAT_RULE)

  // 重试配置
  const retryConfig = useObservable<RetryConfig>(
    existing?.retryConfig ? { ...existing.retryConfig } : { ...DEFAULT_RETRY_CONFIG }
  )

  // 提前提醒（秒）
  const preAlertSeconds = useObservable(existing?.preAlertSeconds ?? defaults?.defaultPreAlert ?? 300)

  const handleSave = () => {
    if (!title.value.trim()) {
      setToastMsg("请输入闹钟标题")
      setToastShown(true)
      return
    }

    // 从 allTimes 提取主时间 + 额外时间（已排序）
    const sorted = [...allTimes.value].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
    const mainTime = sorted[0] ?? { hour: 7, minute: 0, type: "alarm" as RetryType }
    const extraTimes = sorted.slice(1).map(t => ({ hour: t.hour, minute: t.minute, type: t.type }))

    const alarmData: Partial<AlarmItem> = {
      title: title.value,
      hour: mainTime.hour,
      minute: mainTime.minute,
      mainType: mainTime.type,
      repeat: repeatRule.value,
      gradualWake: gradualWake.value,
      preAlertSeconds: preAlertSeconds.value,
      groupName: groupName.value,
      tag: tag.value,
      note: note.value,
      tintColor: tintColor.value,
      reminderTimes: extraTimes,
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
        <Section
          header={<Text>提醒时间</Text>}
          footer={<Text font="footnote" foregroundStyle="systemGray">可添加多个时间点，如吃药、喝水等多次提醒。每个时间点独立响铃。</Text>}
        >
          <ForEach
            data={allTimes}
            editActions="delete"
            builder={(item: { id: string; hour: number; minute: number; type: RetryType }) => {
              const date = new Date()
              date.setHours(item.hour, item.minute, 0, 0)
              const timestamp = date.getTime()
              return (
                <HStack key={item.id} alignment="center" spacing={8}>
                  <DatePicker
                    title=""
                    displayedComponents={["hourAndMinute"]}
                    value={timestamp}
                    datePickerStyle="compact"
                    onChanged={(ts: number) => {
                      const d = new Date(ts)
                      const next = allTimes.value.map(t =>
                        t.id === item.id
                          ? { ...t, hour: d.getHours(), minute: d.getMinutes() }
                          : t
                      )
                      allTimes.setValue(next)
                    }}
                  />
                  <Picker
                    title=""
                    value={item.type as string}
                    onChanged={(v: string) => {
                      const next = allTimes.value.map(t =>
                        t.id === item.id
                          ? { ...t, type: v as RetryType }
                          : t
                      )
                      allTimes.setValue(next)
                    }}
                  >
                    <Text key="alarm" tag="alarm">闹钟</Text>
                    <Text key="notification" tag="notification">通知</Text>
                  </Picker>
                </HStack>
              )
            }}
          />
          <Button
            title="添加时间点"
            systemImage="plus.circle.fill"
            action={() => {
              const id = `t${Date.now()}`
              allTimes.setValue([...allTimes.value, { id, hour: 12, minute: 0, type: "alarm" as RetryType }])
            }}
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
          header={<Text>未确认重试</Text>}
          footer={<Text font="footnote" foregroundStyle="systemGray">每个时间点响铃后，如果未在程序内确认，将自动按间隔重复提醒。默认逐个确认，开启「一次确认全部」后确认任一时间点即确认当天所有时间点。</Text>}
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
              <Toggle
                title="一次确认全部"
                value={retryConfig.value.confirmAll ?? false}
                onChanged={(v: boolean) => retryConfig.setValue({ ...retryConfig.value, confirmAll: v })}
              />
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
