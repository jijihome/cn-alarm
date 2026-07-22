// AddCreditCard.tsx - 添加/编辑信用卡页
import { useObservable, NavigationStack, List, Section, Text, Picker, TextField, Button, Stepper, Toggle, Navigation, useState, HStack, Spacer } from "scripting"
import { CreditCard, BANK_PRESETS } from "../lib/constants"
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

  // 提醒类型开关（兼容旧数据：缺失时全开）
  const defaultRT = existing?.reminderTypes ?? { statement: true, advance: true, due: true, buffer: true }
  const rtStatement = useObservable(defaultRT.statement)
  const rtAdvance = useObservable(defaultRT.advance)
  const rtDue = useObservable(defaultRT.due)
  const rtBuffer = useObservable(defaultRT.buffer)

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
        statement: rtStatement.value,
        advance: rtAdvance.value,
        due: rtDue.value,
        buffer: rtBuffer.value,
      },
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

        <Section header={<Text>提醒类型</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">选择需要提醒的日期，关闭的不会生成闹钟</Text>}>
          <Toggle title="账单已出" value={rtStatement} />
          <Toggle title={`提前${remindDaysBefore.value}天提醒`} value={rtAdvance} />
          <Toggle title="还款截止日" value={rtDue} />
          <Toggle title="宽限期最后一天" value={rtBuffer} />
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
