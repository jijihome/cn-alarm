// CreditCardList.tsx - 信用卡列表页
import { useState, useObservable, NavigationStack, List, Section, Text, ForEach, Button, HStack, VStack, Toggle, ContentUnavailableView, Navigation, useEffect } from "scripting"
import { CreditCard } from "../lib/constants"
import { loadCards, updateCard, getNextDueDate, formatDateCN, syncCardAlarmsById, cancelCardAlarmsById, getCardUnconfirmedCount, confirmCardReminders, unconfirmCardReminders } from "../lib/credit-card"
import { AddCreditCard } from "./AddCreditCard"
import { Settings } from "./Settings"

/** 模态弹出设置页 */
const presentSettings = () =>
  Navigation.present({ element: <Settings />, modalPresentationStyle: "pageSheet" })

/** 格式化时间 HH:MM */
function fmtTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** 生成提醒类型摘要文字（含方式标识） */
function reminderSummary(card: CreditCard): string {
  const rt = card.reminderTypes
  const parts: string[] = []
  const typeLabel = (t?: string) => t === "notification" ? "[通知]" : "[闹钟]"
  const extraCount = (et?: any[]) => et && et.length > 0 ? `+${et.length}` : ""
  if (rt) {
    if (rt.statement.enabled) parts.push(`出账${fmtTime(rt.statement.hour, rt.statement.minute)}${typeLabel(rt.statement.type)}${extraCount(rt.statement.extraTimes)}`)
    if (rt.advance.enabled) parts.push(`提前${fmtTime(rt.advance.hour, rt.advance.minute)}${typeLabel(rt.advance.type)}${extraCount(rt.advance.extraTimes)}`)
    if (rt.due.enabled) parts.push(`截止${fmtTime(rt.due.hour, rt.due.minute)}${typeLabel(rt.due.type)}${extraCount(rt.due.extraTimes)}`)
    if (rt.buffer.enabled) parts.push(`宽限${fmtTime(rt.buffer.hour, rt.buffer.minute)}${typeLabel(rt.buffer.type)}${extraCount(rt.buffer.extraTimes)}`)
  }
  let summary = parts.length ? parts.join(" · ") : "无提醒"
  // 重试状态
  if (card.retryConfig?.enabled) {
    summary += ` · 重复${card.retryConfig.maxRetries}次/${card.retryConfig.intervalMinutes}分`
  }
  return summary
}

/** 按银行名拼音排序加载信用卡 */
const loadSortedCards = (): CreditCard[] =>
  loadCards().sort((a, b) => a.bankName.localeCompare(b.bankName, "zh"))

function CardRow({ card, onEdit, onToggle, onConfirm, onUnconfirm }: { card: CreditCard; onEdit: (id: string) => void; onToggle: (id: string, enabled: boolean) => void; onConfirm: (card: CreditCard) => void; onUnconfirm: (card: CreditCard) => void }) {
  const nextDue = getNextDueDate(card)
  const dueStr = formatDateCN(nextDue)
  const now = new Date()
  const daysUntilDue = Math.ceil((nextDue.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

  // 确认状态
  const unconfirmedCount = getCardUnconfirmedCount(card)
  const hasRetry = !!card.retryConfig?.enabled
  const hasUnconfirmed = hasRetry && unconfirmedCount > 0
  const allConfirmed = hasRetry && unconfirmedCount === 0

  // 左滑操作按钮（仅 retryConfig 启用时显示）
  const leadingActions: { allowsFullSwipe?: boolean; actions: any[] } | undefined =
    hasRetry ? {
      actions: hasUnconfirmed
        ? [<Button key="confirm" title="确认" tint="systemGreen" action={() => onConfirm(card)} />]
        : [<Button key="unconfirm" title="取消确认" tint="systemOrange" action={() => onUnconfirm(card)} />]
    } : undefined

  return (
    <Toggle
      value={card.enabled}
      onChanged={(val: boolean) => onToggle(card.id, val)}
    >
      <VStack alignment="leading" spacing={4} onTapGesture={() => onEdit(card.id)}
        leadingSwipeActions={leadingActions}
      >
        <HStack alignment="center" spacing={8}>
          <Text font={14} foregroundStyle={card.tintColor as any}>●</Text>
          <Text font={20} fontWeight="bold">{card.bankName}</Text>
          <Text font={16} foregroundStyle="secondaryLabel">尾号{card.last4Digits}</Text>
        </HStack>
        <HStack spacing={12}>
          <Text font={13} foregroundStyle="secondaryLabel">账单日{card.statementDay}号</Text>
          <Text font={13} foregroundStyle="secondaryLabel">还款日约{card.graceDays}天后</Text>
        </HStack>
        <HStack spacing={8}>
          <Text font={14} fontWeight="semibold" foregroundStyle="systemOrange">下次还款: {dueStr}</Text>
          {daysUntilDue <= 3 && daysUntilDue >= 0 && (
            <Text font={12} foregroundStyle="systemRed">仅剩{daysUntilDue}天!</Text>
          )}
        </HStack>
        <Text font={12} foregroundStyle="tertiaryLabel">{reminderSummary(card)}</Text>
        {hasUnconfirmed && (
          <Text font={12} foregroundStyle="systemOrange">待确认: {unconfirmedCount}条提醒</Text>
        )}
        {allConfirmed && (
          <Text font={12} foregroundStyle="systemGreen">今日已全部确认</Text>
        )}
      </VStack>
    </Toggle>
  )
}

export function CreditCardList({ selection }: { selection: Observable<number> }) {
  const cards = useObservable<CreditCard[]>(() => loadSortedCards())
  // toast 状态
  const [toastMsg, setToastMsg] = useState("")
  const [toastShown, setToastShown] = useState(false)

  // 监听 Tab 切换：切回信用卡 Tab 时重新加载
  useEffect(() => {
    if (selection.value === 1) {
      cards.setValue(loadSortedCards())
    }
  }, [selection.value])

  // 弹出添加/编辑信用卡模态页，关闭后刷新+异步同步闹钟
  const presentEditor = (editId?: string) => {
    Navigation.present({
      element: <AddCreditCard editId={editId} />,
      modalPresentationStyle: "fullScreen",
    }).then((result: any) => {
      if (result?.deleted && result?.cardId) {
        // 异步取消系统闹钟（fire-and-forget）
        cancelCardAlarmsById(result.cardId).catch(() => {})
        setToastMsg("信用卡已删除")
        setToastShown(true)
        cards.setValue(loadSortedCards())
      } else if (result?.saved && result?.cardId) {
        // 先刷新列表显示新卡，再异步同步闹钟
        cards.setValue(loadSortedCards())
        syncCardAlarmsById(result.cardId)
          .then(() => {
            setToastMsg(editId ? "信用卡已更新并同步闹钟" : "信用卡已添加并同步闹钟")
            setToastShown(true)
            cards.setValue(loadSortedCards())
          })
          .catch(() => {
            setToastMsg("信用卡已保存，但闹钟同步失败")
            setToastShown(true)
          })
      }
    })
  }

  const handleAdd = () => presentEditor()
  const handleEdit = (id: string) => presentEditor(id)

  // 确认信用卡提醒：标记已确认 + 取消重试闹钟
  const handleConfirm = (card: CreditCard) => {
    confirmCardReminders(card)
    setToastMsg(`已确认: ${card.bankName} 尾号${card.last4Digits}`)
    setToastShown(true)
    cards.setValue(loadSortedCards())
  }

  // 取消确认：恢复为待确认状态
  const handleUnconfirm = (card: CreditCard) => {
    unconfirmCardReminders(card)
    setToastMsg(`已取消确认: ${card.bankName} 尾号${card.last4Digits}`)
    setToastShown(true)
    cards.setValue(loadSortedCards())
  }

  const handleToggle = (id: string, enabled: boolean) => {
    // 先同步更新本地状态
    updateCard(id, { enabled })
    cards.setValue(loadSortedCards())
    if (enabled) {
      // 启用：异步同步闹钟
      syncCardAlarmsById(id)
        .then(() => {
          setToastMsg("信用卡已启用，闹钟已同步")
          setToastShown(true)
          cards.setValue(loadSortedCards())
        })
        .catch(() => {
          setToastMsg("信用卡已启用，但闹钟同步失败")
          setToastShown(true)
        })
    } else {
      // 停用：异步取消系统闹钟
      cancelCardAlarmsById(id)
        .then(() => {
          setToastMsg("信用卡已停用")
          setToastShown(true)
          cards.setValue(loadSortedCards())
        })
        .catch(() => {
          setToastMsg("信用卡已停用")
          setToastShown(true)
        })
    }
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="信用卡"
        toolbar={{
          topBarTrailing: (
            <HStack spacing={0}>
              <Button title="" systemImage="gearshape" action={presentSettings} />
              <Button title="添加" systemImage="plus" action={handleAdd} />
            </HStack>
          ),
        }}
        toast={{
          message: toastMsg,
          isPresented: toastShown,
          onChanged: setToastShown,
        }}
      >
        {cards.value.length === 0 ? (
          <Section>
            <ContentUnavailableView
              title="还没有信用卡"
              systemImage="creditcard.fill"
              description="点击右上角 + 添加你的信用卡，自动管理账单日和还款日提醒"
            />
          </Section>
        ) : (
          <Section>
            <ForEach
              data={cards}
              builder={(card: CreditCard) => (
                <CardRow
                  key={card.id}
                  card={card}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                  onConfirm={handleConfirm}
                  onUnconfirm={handleUnconfirm}
                />
              )}
            />
          </Section>
        )}
      </List>
    </NavigationStack>
  )
}
