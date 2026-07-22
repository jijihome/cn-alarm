// AddCreditCard.tsx - 添加/编辑信用卡页
import { useObservable, NavigationStack, List, Section, Text, Picker, TextField, Button, Stepper, Toggle, DatePicker, Navigation, useState, HStack, VStack, Spacer, ForEach } from "scripting"
import { CreditCard, BANK_PRESETS, ReminderTypeConfig, RetryConfig, RetryType } from "../lib/constants"
import { createCardSync, updateCard, removeCardSync, syncCardAlarmsById, cancelCardAlarmsById, getCardById } from "../lib/credit-card"

const COLOR_OPTIONS = [
  { label: "橙", value: "systemOrange" },
  { label: "蓝", value: "systemBlue" },
  { label: "红", value: "systemRed" },
  { label: "绿", value: "systemGreen" },
  { label: "紫", value: "systemPurple" },
]

interface AddCreditCardProps {
  editId?: string
  onSave?: () => void
  onCancel?: () => void
}

/** 构造当天某个时间的 Date 对象，供 DatePicker 使用 */
function makeDate(hour: number, minute: number): Date {
  const d = new Date()
  d.setHours(hour || 9, minute || 0, 0, 0)
  return d
}

/** 从 DatePicker 的 Date 提取 hour/minute */
function extractTime(d: Date): { hour: number; minute: number } {
  return { hour: d.getHours(), minute: d.getMinutes() }
}

/** 默认配置：开启、9:00 */
const DEFAULT_RT: ReminderTypeConfig = { enabled: true, hour: 9, minute: 0, type: "alarm", extraTimes: [] }

/** 提醒类型行组件：Toggle + 主时间 + 额外时间列表 + 添加按钮 */
/** 添加额外时间点 */
function addExtraTime(extras: Observable<{ id: string; hour: number; minute: number; type: string }[]>) {
  const id = `e${Date.now()}`
  extras.setValue([...extras.value, { id, hour: 12, minute: 0, type: "alarm" }])
}

export function AddCreditCard({ editId }: AddCreditCardProps) {
  const dismiss = Navigation.useDismiss()
  const existing = editId ? getCardById(editId) : null

  // 删除确认对话框状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // toast 状态（用 useState + onChanged，跟文档示例一致）
  const [toastMsg, setToastMsg] = useState("")
  const [toastShown, setToastShown] = useState(false)

  const bankLabels = BANK_PRESETS.map((b) => b.name)
  const CUSTOM_TAG = "__custom__"
  const isPresetBank = existing ? bankLabels.includes(existing.bankName) : true
  const isCustom = useObservable(!isPresetBank)
  const bankName = useObservable(existing?.bankName ?? BANK_PRESETS[0].name)
  const last4Digits = useObservable(existing?.last4Digits ?? "")
  const statementDay = useObservable(existing?.statementDay ?? 5)
  const graceDays = useObservable(existing?.graceDays ?? 18)
  const bufferDays = useObservable(existing?.bufferDays ?? 3)
  const remindDaysBefore = useObservable(existing?.remindDaysBefore ?? 3)
  const tintColor = useObservable(existing?.tintColor ?? "systemOrange")

  // 提醒类型配置（数据已由 loadCards 升级，字段确定存在）
  const rawRT = existing?.reminderTypes
  const stmRT = rawRT?.statement ?? DEFAULT_RT
  const advRT = rawRT?.advance ?? DEFAULT_RT
  const dueRT = rawRT?.due ?? DEFAULT_RT
  const bufRT = rawRT?.buffer ?? DEFAULT_RT
  const stmEnabled = useObservable(stmRT.enabled)
  const stmTime = useObservable(makeDate(stmRT.hour, stmRT.minute))
  const stmType = useObservable<string>(stmRT.type ?? "alarm")
  const advEnabled = useObservable(advRT.enabled)
  const advTime = useObservable(makeDate(advRT.hour, advRT.minute))
  const advType = useObservable<string>(advRT.type ?? "alarm")
  const dueEnabled = useObservable(dueRT.enabled)
  const dueTime = useObservable(makeDate(dueRT.hour, dueRT.minute))
  const dueType = useObservable<string>(dueRT.type ?? "alarm")
  const bufEnabled = useObservable(bufRT.enabled)
  const bufTime = useObservable(makeDate(bufRT.hour, bufRT.minute))
  const bufType = useObservable<string>(bufRT.type ?? "alarm")

  // 每种类型的额外时间点（数据已升级，extraTimes 确定存在）
  type ExtraTimeItem = { id: string; hour: number; minute: number; type: string }
  const stmExtras = useObservable<ExtraTimeItem[]>(() => (stmRT.extraTimes ?? []).map((t: any, i: number) => ({ id: `s${i}`, hour: t.hour, minute: t.minute, type: (t.type ?? "alarm") as string })))
  const advExtras = useObservable<ExtraTimeItem[]>(() => (advRT.extraTimes ?? []).map((t: any, i: number) => ({ id: `a${i}`, hour: t.hour, minute: t.minute, type: (t.type ?? "alarm") as string })))
  const dueExtras = useObservable<ExtraTimeItem[]>(() => (dueRT.extraTimes ?? []).map((t: any, i: number) => ({ id: `d${i}`, hour: t.hour, minute: t.minute, type: (t.type ?? "alarm") as string })))
  const bufExtras = useObservable<ExtraTimeItem[]>(() => (bufRT.extraTimes ?? []).map((t: any, i: number) => ({ id: `b${i}`, hour: t.hour, minute: t.minute, type: (t.type ?? "alarm") as string })))

  // 重试配置（未确认重复提醒）
  const DEFAULT_RETRY: RetryConfig = { enabled: false, intervalMinutes: 5, maxRetries: 3, type: "notification" }
  const retryConfig = useObservable<RetryConfig>(
    existing?.retryConfig ? { ...existing.retryConfig } : { ...DEFAULT_RETRY }
  )

  const pickerValue = isCustom.value ? CUSTOM_TAG : bankName.value

  const handleSave = () => {
    if (!bankName.value.trim()) {
      setToastMsg("请输入银行名称")
      setToastShown(true)
      return
    }
    if (!last4Digits.value.trim() || last4Digits.value.length !== 4) {
      setToastMsg("请输入4位卡号尾号")
      setToastShown(true)
      return
    }

    // 根据银行名自动设置 graceDays（如果是预设银行且用户未改）
    const preset = BANK_PRESETS.find((b) => b.name === bankName.value)
    const finalGraceDays = preset && !existing ? preset.graceDays : graceDays.value

    const cardData: Partial<CreditCard> = {
      bankName: bankName.value,
      last4Digits: last4Digits.value,
      statementDay: statementDay.value,
      graceDays: finalGraceDays,
      bufferDays: bufferDays.value,
      remindDaysBefore: remindDaysBefore.value,
      tintColor: tintColor.value,
      reminderTypes: {
        statement: { enabled: stmEnabled.value, ...extractTime(stmTime.value), type: stmType.value as RetryType, extraTimes: stmExtras.value.map(t => ({ hour: t.hour, minute: t.minute, type: t.type as RetryType })) },
        advance: { enabled: advEnabled.value, ...extractTime(advTime.value), type: advType.value as RetryType, extraTimes: advExtras.value.map(t => ({ hour: t.hour, minute: t.minute, type: t.type as RetryType })) },
        due: { enabled: dueEnabled.value, ...extractTime(dueTime.value), type: dueType.value as RetryType, extraTimes: dueExtras.value.map(t => ({ hour: t.hour, minute: t.minute, type: t.type as RetryType })) },
        buffer: { enabled: bufEnabled.value, ...extractTime(bufTime.value), type: bufType.value as RetryType, extraTimes: bufExtras.value.map(t => ({ hour: t.hour, minute: t.minute, type: t.type as RetryType })) },
      },
      retryConfig: retryConfig.value,
    }

    if (editId && existing) {
      updateCard(editId, cardData)
      dismiss({ saved: true, cardId: editId })
    } else {
      const card = createCardSync(cardData)
      dismiss({ saved: true, cardId: card.id })
    }
  }

  const handleDelete = () => {
    if (!editId) return
    // 先关闭确认框，再执行同步删除
    setShowDeleteConfirm(false)
    const card = removeCardSync(editId)
    dismiss({ deleted: true, cardId: card?.id ?? editId })
  }

  return (
    <NavigationStack>
      <List
        navigationTitle={editId ? "编辑信用卡" : "添加信用卡"}
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarLeading: <Button title="取消" action={() => dismiss({ saved: false })} />,
          topBarTrailing: <Button title="保存" action={handleSave} />,
        }}
        confirmationDialog={{
          title: "删除信用卡",
          titleVisibility: "visible",
          message: <Text>确定删除「{existing?.bankName} 尾号{existing?.last4Digits}」吗？关联的闹钟也会被删除。</Text>,
          isPresented: showDeleteConfirm,
          onChanged: setShowDeleteConfirm,
          actions: (
            <>
              <Button title="删除" role="destructive" action={handleDelete} />
              <Button title="取消" role="cancel" action={() => setShowDeleteConfirm(false)} />
            </>
          ),
        }}
        toast={{
          message: toastMsg,
          isPresented: toastShown,
          onChanged: setToastShown,
        }}
      >
        <Section header={<Text>银行信息</Text>}>
          <Picker
            title="银行"
            value={pickerValue}
            onChanged={(val: string) => {
              if (val === CUSTOM_TAG) {
                isCustom.setValue(true)
                bankName.setValue("")
              } else {
                isCustom.setValue(false)
                bankName.setValue(val)
              }
            }}
          >
            {bankLabels.map((label) => <Text key={label} tag={label}>{label}</Text>)}
            <Text key={CUSTOM_TAG} tag={CUSTOM_TAG}>自定义</Text>
          </Picker>
          {isCustom.value && (
            <TextField title="银行名称" value={bankName} prompt="输入银行名称" />
          )}
          <TextField title="卡号尾4位" value={last4Digits} prompt="如 8888" keyboardType="numberPad" />
        </Section>

        <Section header={<Text>日期设置</Text>}>
          <Stepper
            onIncrement={() => statementDay.setValue(Math.min(31, statementDay.value + 1))}
            onDecrement={() => statementDay.setValue(Math.max(1, statementDay.value - 1))}
          >
            <HStack alignment="center">
              <Text>账单日</Text>
              <Spacer />
              <Text foregroundStyle="secondaryLabel">{statementDay.value}号</Text>
            </HStack>
          </Stepper>
          <Stepper
            onIncrement={() => graceDays.setValue(Math.min(30, graceDays.value + 1))}
            onDecrement={() => graceDays.setValue(Math.max(15, graceDays.value - 1))}
          >
            <HStack alignment="center">
              <Text>账单到还款日</Text>
              <Spacer />
              <Text foregroundStyle="secondaryLabel">{graceDays.value}天</Text>
            </HStack>
          </Stepper>
          <Stepper
            onIncrement={() => bufferDays.setValue(Math.min(7, bufferDays.value + 1))}
            onDecrement={() => bufferDays.setValue(Math.max(0, bufferDays.value - 1))}
          >
            <HStack alignment="center">
              <Text>宽限期</Text>
              <Spacer />
              <Text foregroundStyle="secondaryLabel">{bufferDays.value}天</Text>
            </HStack>
          </Stepper>
          <Stepper
            onIncrement={() => remindDaysBefore.setValue(Math.min(10, remindDaysBefore.value + 1))}
            onDecrement={() => remindDaysBefore.setValue(Math.max(1, remindDaysBefore.value - 1))}
          >
            <HStack alignment="center">
              <Text>提前提醒</Text>
              <Spacer />
              <Text foregroundStyle="secondaryLabel">{remindDaysBefore.value}天</Text>
            </HStack>
          </Stepper>
        </Section>

        <Section header={<Text>提醒类型</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">点击时间可修改提醒时刻，选择闹钟或通知方式。关闭的不会生成提醒。可添加多个时间点，左滑删除。</Text>}>
          {/* 账单已出 */}
          <Toggle title="账单已出" value={stmEnabled} />
          {stmEnabled.value && (
            <>
              <HStack alignment="center" spacing={8}>
                <DatePicker title="时间" displayedComponents={["hourAndMinute"]} value={stmTime} datePickerStyle="compact" />
                <Picker title="方式" value={stmType.value} onChanged={(v: string) => stmType.setValue(v)}>
                  <Text key="alarm" tag="alarm">闹钟</Text>
                  <Text key="notification" tag="notification">通知</Text>
                </Picker>
              </HStack>
              <ForEach
                data={stmExtras}
                editActions="delete"
                builder={(item: { id: string; hour: number; minute: number; type: string }) => {
                  const d = new Date(); d.setHours(item.hour, item.minute, 0, 0)
                  return (
                    <HStack key={item.id} alignment="center" spacing={8}>
                      <DatePicker title="" displayedComponents={["hourAndMinute"]} value={d.getTime()} datePickerStyle="compact"
                        onChanged={(ts: number) => { const nd = new Date(ts); stmExtras.setValue(stmExtras.value.map(t => t.id === item.id ? { ...t, hour: nd.getHours(), minute: nd.getMinutes() } : t)) }}
                      />
                      <Picker title="" value={item.type}
                        onChanged={(v: string) => { stmExtras.setValue(stmExtras.value.map(t => t.id === item.id ? { ...t, type: v } : t)) }}
                      >
                        <Text key="alarm" tag="alarm">闹钟</Text>
                        <Text key="notification" tag="notification">通知</Text>
                      </Picker>
                    </HStack>
                  )
                }}
              />
              <Button title="添加时间点" systemImage="plus.circle.fill" action={() => addExtraTime(stmExtras)} />
            </>
          )}

          {/* 提前提醒 */}
          <Toggle title={`提前${remindDaysBefore.value}天提醒`} value={advEnabled} />
          {advEnabled.value && (
            <>
              <HStack alignment="center" spacing={8}>
                <DatePicker title="时间" displayedComponents={["hourAndMinute"]} value={advTime} datePickerStyle="compact" />
                <Picker title="方式" value={advType.value} onChanged={(v: string) => advType.setValue(v)}>
                  <Text key="alarm" tag="alarm">闹钟</Text>
                  <Text key="notification" tag="notification">通知</Text>
                </Picker>
              </HStack>
              <ForEach
                data={advExtras}
                editActions="delete"
                builder={(item: { id: string; hour: number; minute: number; type: string }) => {
                  const d = new Date(); d.setHours(item.hour, item.minute, 0, 0)
                  return (
                    <HStack key={item.id} alignment="center" spacing={8}>
                      <DatePicker title="" displayedComponents={["hourAndMinute"]} value={d.getTime()} datePickerStyle="compact"
                        onChanged={(ts: number) => { const nd = new Date(ts); advExtras.setValue(advExtras.value.map(t => t.id === item.id ? { ...t, hour: nd.getHours(), minute: nd.getMinutes() } : t)) }}
                      />
                      <Picker title="" value={item.type}
                        onChanged={(v: string) => { advExtras.setValue(advExtras.value.map(t => t.id === item.id ? { ...t, type: v } : t)) }}
                      >
                        <Text key="alarm" tag="alarm">闹钟</Text>
                        <Text key="notification" tag="notification">通知</Text>
                      </Picker>
                    </HStack>
                  )
                }}
              />
              <Button title="添加时间点" systemImage="plus.circle.fill" action={() => addExtraTime(advExtras)} />
            </>
          )}

          {/* 还款截止日 */}
          <Toggle title="还款截止日" value={dueEnabled} />
          {dueEnabled.value && (
            <>
              <HStack alignment="center" spacing={8}>
                <DatePicker title="时间" displayedComponents={["hourAndMinute"]} value={dueTime} datePickerStyle="compact" />
                <Picker title="方式" value={dueType.value} onChanged={(v: string) => dueType.setValue(v)}>
                  <Text key="alarm" tag="alarm">闹钟</Text>
                  <Text key="notification" tag="notification">通知</Text>
                </Picker>
              </HStack>
              <ForEach
                data={dueExtras}
                editActions="delete"
                builder={(item: { id: string; hour: number; minute: number; type: string }) => {
                  const d = new Date(); d.setHours(item.hour, item.minute, 0, 0)
                  return (
                    <HStack key={item.id} alignment="center" spacing={8}>
                      <DatePicker title="" displayedComponents={["hourAndMinute"]} value={d.getTime()} datePickerStyle="compact"
                        onChanged={(ts: number) => { const nd = new Date(ts); dueExtras.setValue(dueExtras.value.map(t => t.id === item.id ? { ...t, hour: nd.getHours(), minute: nd.getMinutes() } : t)) }}
                      />
                      <Picker title="" value={item.type}
                        onChanged={(v: string) => { dueExtras.setValue(dueExtras.value.map(t => t.id === item.id ? { ...t, type: v } : t)) }}
                      >
                        <Text key="alarm" tag="alarm">闹钟</Text>
                        <Text key="notification" tag="notification">通知</Text>
                      </Picker>
                    </HStack>
                  )
                }}
              />
              <Button title="添加时间点" systemImage="plus.circle.fill" action={() => addExtraTime(dueExtras)} />
            </>
          )}

          {/* 宽限期最后一天 */}
          <Toggle title="宽限期最后一天" value={bufEnabled} />
          {bufEnabled.value && (
            <>
              <HStack alignment="center" spacing={8}>
                <DatePicker title="时间" displayedComponents={["hourAndMinute"]} value={bufTime} datePickerStyle="compact" />
                <Picker title="方式" value={bufType.value} onChanged={(v: string) => bufType.setValue(v)}>
                  <Text key="alarm" tag="alarm">闹钟</Text>
                  <Text key="notification" tag="notification">通知</Text>
                </Picker>
              </HStack>
              <ForEach
                data={bufExtras}
                editActions="delete"
                builder={(item: { id: string; hour: number; minute: number; type: string }) => {
                  const d = new Date(); d.setHours(item.hour, item.minute, 0, 0)
                  return (
                    <HStack key={item.id} alignment="center" spacing={8}>
                      <DatePicker title="" displayedComponents={["hourAndMinute"]} value={d.getTime()} datePickerStyle="compact"
                        onChanged={(ts: number) => { const nd = new Date(ts); bufExtras.setValue(bufExtras.value.map(t => t.id === item.id ? { ...t, hour: nd.getHours(), minute: nd.getMinutes() } : t)) }}
                      />
                      <Picker title="" value={item.type}
                        onChanged={(v: string) => { bufExtras.setValue(bufExtras.value.map(t => t.id === item.id ? { ...t, type: v } : t)) }}
                      >
                        <Text key="alarm" tag="alarm">闹钟</Text>
                        <Text key="notification" tag="notification">通知</Text>
                      </Picker>
                    </HStack>
                  )
                }}
              />
              <Button title="添加时间点" systemImage="plus.circle.fill" action={() => addExtraTime(bufExtras)} />
            </>
          )}
        </Section>

        <Section header={<Text>重复提醒</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">开启后，提醒触发时若未确认，将按间隔重复提醒，直到达到最大次数</Text>}>
          <Toggle title="未确认重复提醒" value={retryConfig.value.enabled as any} onChanged={(v: boolean) => retryConfig.setValue({ ...retryConfig.value, enabled: v })} />
          {retryConfig.value.enabled && (
            <>
              <Stepper
                onIncrement={() => retryConfig.setValue({ ...retryConfig.value, intervalMinutes: Math.min(60, retryConfig.value.intervalMinutes + 5) })}
                onDecrement={() => retryConfig.setValue({ ...retryConfig.value, intervalMinutes: Math.max(1, retryConfig.value.intervalMinutes - 5) })}
              >
                <HStack alignment="center">
                  <Text>重试间隔</Text>
                  <Spacer />
                  <Text foregroundStyle="secondaryLabel">{retryConfig.value.intervalMinutes}分钟</Text>
                </HStack>
              </Stepper>
              <Stepper
                onIncrement={() => retryConfig.setValue({ ...retryConfig.value, maxRetries: Math.min(10, retryConfig.value.maxRetries + 1) })}
                onDecrement={() => retryConfig.setValue({ ...retryConfig.value, maxRetries: Math.max(1, retryConfig.value.maxRetries - 1) })}
              >
                <HStack alignment="center">
                  <Text>最大次数</Text>
                  <Spacer />
                  <Text foregroundStyle="secondaryLabel">{retryConfig.value.maxRetries}次</Text>
                </HStack>
              </Stepper>
              <Picker
                title="重试方式"
                value={retryConfig.value.type as string}
                onChanged={(v: string) => retryConfig.setValue({ ...retryConfig.value, type: v as RetryType })}
              >
                <Text key="alarm" tag="alarm">闹钟</Text>
                <Text key="notification" tag="notification">通知</Text>
              </Picker>
            </>
          )}
        </Section>

        <Section header={<Text>外观</Text>}>
          <Picker
            title="颜色"
            value={tintColor}
          >
            {COLOR_OPTIONS.map((c) => <Text key={c.value} tag={c.value}>{c.label}</Text>)}
          </Picker>
        </Section>

        {!!editId && (
          <Section>
            <Button title="删除信用卡" tint="systemRed" action={() => setShowDeleteConfirm(true)} />
          </Section>
        )}
      </List>
    </NavigationStack>
  )
}
