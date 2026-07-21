// AddAlarm.tsx - 添加/编辑闹钟页
import { useObservable, NavigationStack, List, Section, Text, DatePicker, Toggle, Picker, TextField, Button, HStack, Stepper, Navigation } from "scripting"

declare function alert(options: { title?: string; message: string }): Promise<void>
import { AlarmItem, RepeatRule, RepeatMode } from "../lib/constants"
import { createAlarmItem, addAlarm, updateAlarm, getAlarmById, loadGroups } from "../lib/alarm-store"
import { scheduleAlarm, cancelAlarm } from "../lib/alarm-bridge"
import { WeekdayPicker } from "../components/WeekdayPicker"
import { SOLAR_TERM_NAMES } from "../lib/solar-term"

const REPEAT_MODES: { value: RepeatMode; label: string }[] = [
  { value: "once", label: "仅一次" },
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "yearly", label: "每年" },
  { value: "lunar_yearly", label: "农历每年" },
  { value: "workday", label: "每工作日" },
]

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

  // 时间用 Date Observable
  const initialDate = new Date()
  initialDate.setHours(existing?.hour ?? 7, existing?.minute ?? 0, 0, 0)
  const timeValue = useObservable(initialDate)

  const repeatMode = useObservable<RepeatMode>(existing?.repeat.mode ?? "weekly")
  const interval = useObservable(existing?.repeat.interval ?? 1)
  const weekdays = useObservable<number[]>(existing?.repeat.weekdays ?? [2, 3, 4, 5, 6])
  const dayOfMonth = useObservable(existing?.repeat.dayOfMonth ?? 1)
  const monthOfYear = useObservable(existing?.repeat.monthOfYear ?? 1)
  const lunarMonth = useObservable(existing?.repeat.lunarMonth ?? 1)
  const lunarDay = useObservable(existing?.repeat.lunarDay ?? 1)
  // 编辑时从 existing 反查 solarTermIdx（0=不用节气，1+ = SOLAR_TERM_NAMES 索引+1）
  const initialSolarTermIdx = (() => {
    if (existing?.repeat.solarTerm) {
      const idx = SOLAR_TERM_NAMES.indexOf(existing.repeat.solarTerm)
      return idx >= 0 ? idx + 1 : 0
    }
    return 0
  })()
  const solarTermIdx = useObservable(initialSolarTermIdx)
  const holidayAware = useObservable(existing?.repeat.holidayAware ?? true)
  // 编辑时从 existing.preAlertSeconds 反查预设索引，找不到默认 0
  const initialPreAlertIdx = existing
    ? PRESET_PRE_ALERTS.indexOf(existing.preAlertSeconds)
    : 0
  const preAlertIdx = useObservable(initialPreAlertIdx >= 0 ? initialPreAlertIdx : 0)

  const buildRepeatRule = (): RepeatRule => {
    const mode = repeatMode.value as RepeatMode
    const rule: RepeatRule = {
      mode,
      interval: interval.value,
      holidayAware: holidayAware.value,
    }
    if (repeatMode.value === "weekly") rule.weekdays = weekdays.value
    if (repeatMode.value === "monthly") rule.dayOfMonth = dayOfMonth.value
    if (repeatMode.value === "yearly") {
      if (solarTermIdx.value > 0) {
        rule.solarTerm = SOLAR_TERM_NAMES[solarTermIdx.value - 1]
      } else {
        rule.monthOfYear = monthOfYear.value
        rule.dayOfMonth = dayOfMonth.value
      }
    }
    if (repeatMode.value === "lunar_yearly") {
      rule.lunarMonth = lunarMonth.value
      rule.lunarDay = lunarDay.value
    }
    return rule
  }

  const handleSave = async () => {
    if (!title.value.trim()) {
      await alert({ title: "提示", message: "请输入闹钟标题" })
      return
    }

    const alarmData: Partial<AlarmItem> = {
      title: title.value,
      hour: timeValue.value.getHours(),
      minute: timeValue.value.getMinutes(),
      repeat: buildRepeatRule(),
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

  const repeatModeLabels = REPEAT_MODES.map((m) => m.label)
  const groupLabels = groups.map((g) => g.name)
  const colorLabels = COLOR_OPTIONS.map((c) => c.label)
  const solarTermOptions = ["按日期", ...SOLAR_TERM_NAMES]

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

        <Section header={<Text>重复</Text>}>
          <Picker
            title="重复模式"
            value={repeatMode as any}
          >
            {repeatModeLabels.map((label) => <Text key={label}>{label}</Text>)}
          </Picker>

          {/* interval 间隔控件：daily/weekly/monthly/workday 都适用 */}
          {(repeatMode.value === "daily" || repeatMode.value === "weekly" || repeatMode.value === "monthly" || repeatMode.value === "workday") && (
            <HStack>
              <Text>间隔</Text>
              <Stepper
                title="间隔"
                onIncrement={() => interval.setValue(Math.min(30, interval.value + 1))}
                onDecrement={() => interval.setValue(Math.max(1, interval.value - 1))}
              />
              <Text font={20} fontWeight="bold">{interval.value}</Text>
              <Text foregroundStyle="secondaryLabel">
                {repeatMode.value === "daily" ? "天" : repeatMode.value === "weekly" ? "周" : repeatMode.value === "monthly" ? "月" : "个工作日"}
              </Text>
            </HStack>
          )}

          {repeatMode.value === "weekly" && (
            <WeekdayPicker value={weekdays.value} onChanged={(v) => weekdays.setValue(v)} />
          )}

          {repeatMode.value === "monthly" && (
            <HStack>
              <Text>每月第</Text>
              <Stepper
                title="日期"
                onIncrement={() => dayOfMonth.setValue(Math.min(31, dayOfMonth.value + 1))}
                onDecrement={() => dayOfMonth.setValue(Math.max(1, dayOfMonth.value - 1))}
              />
              <Text font={20} fontWeight="bold">{dayOfMonth.value}</Text>
              <Text>号</Text>
            </HStack>
          )}

          {repeatMode.value === "yearly" && (
            <>
              <Picker title="按节气/日期" value={solarTermIdx as any}>
                {solarTermOptions.map((label) => <Text key={label}>{label}</Text>)}
              </Picker>
              {solarTermIdx.value > 0 ? (
                <Text foregroundStyle="secondaryLabel">
                  每年「{SOLAR_TERM_NAMES[solarTermIdx.value - 1]}」当天提醒
                </Text>
              ) : (
                <>
                  <HStack>
                    <Text>月份</Text>
                    <Stepper
                      title="月份"
                      onIncrement={() => monthOfYear.setValue(Math.min(12, monthOfYear.value + 1))}
                      onDecrement={() => monthOfYear.setValue(Math.max(1, monthOfYear.value - 1))}
                    />
                    <Text font={20} fontWeight="bold">{monthOfYear.value}</Text>
                    <Text>月</Text>
                  </HStack>
                  <HStack>
                    <Text>日期</Text>
                    <Stepper
                      title="日期"
                      onIncrement={() => dayOfMonth.setValue(Math.min(31, dayOfMonth.value + 1))}
                      onDecrement={() => dayOfMonth.setValue(Math.max(1, dayOfMonth.value - 1))}
                    />
                    <Text font={20} fontWeight="bold">{dayOfMonth.value}</Text>
                    <Text>号</Text>
                  </HStack>
                </>
              )}
            </>
          )}

          {repeatMode.value === "lunar_yearly" && (
            <>
              <HStack>
                <Text>农历月</Text>
                <Stepper
                  title="农历月"
                  onIncrement={() => lunarMonth.setValue(Math.min(12, lunarMonth.value + 1))}
                  onDecrement={() => lunarMonth.setValue(Math.max(1, lunarMonth.value - 1))}
                />
                <Text font={20} fontWeight="bold">{lunarMonth.value}</Text>
                <Text>月</Text>
              </HStack>
              <HStack>
                <Text>农历日</Text>
                <Stepper
                  title="农历日"
                  onIncrement={() => lunarDay.setValue(Math.min(30, lunarDay.value + 1))}
                  onDecrement={() => lunarDay.setValue(Math.max(1, lunarDay.value - 1))}
                />
                <Text font={20} fontWeight="bold">{lunarDay.value}</Text>
                <Text>日</Text>
              </HStack>
            </>
          )}

          {(repeatMode.value === "weekly" || repeatMode.value === "workday" || repeatMode.value === "daily") && (
            <Toggle
              title="智能调休联动"
              value={holidayAware}
            />
          )}
        </Section>

        <Section header={<Text>提醒方式</Text>}>
          <Toggle
            title="渐进唤醒"
            value={gradualWake}
          />
          {gradualWake.value && (
            <Picker title="提前提醒" value={preAlertIdx as any}>
              {PRESET_PRE_ALERT_LABELS.map((label) => <Text key={label}>{label}</Text>)}
            </Picker>
          )}
        </Section>

        <Section header={<Text>信息</Text>}>
          <TextField title="标题" value={title} prompt="闹钟标题" />
          <Picker title="分组" value={groupName}>
            {groupLabels.map((label) => <Text key={label}>{label}</Text>)}
          </Picker>
          <TextField title="标签" value={tag} prompt="可选标签" />
          <TextField title="备注" value={note} prompt="可选备注" />
        </Section>

        <Section header={<Text>外观</Text>}>
          <Picker title="颜色" value={tintColor}>
            {colorLabels.map((label) => <Text key={label}>{label}</Text>)}
          </Picker>
        </Section>
      </List>
    </NavigationStack>
  )
}
