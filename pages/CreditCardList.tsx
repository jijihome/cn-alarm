// CreditCardList.tsx - 信用卡列表页
import { useState, useObservable, NavigationStack, List, Section, Text, ForEach, Button, HStack, VStack, Toggle, ContentUnavailableView, Navigation, useEffect } from "scripting"
import { CreditCard, CardSortKey } from "../lib/constants"
import { loadCards, updateCard, getNextDueDate, formatDateCN, syncCardAlarmsById, cancelCardAlarmsById, getCardUnconfirmedCount, getCardUnconfirmedDetails, confirmCardReminders, unconfirmCardReminders, removeCardSync } from "../lib/credit-card"
import { sortCards, CARD_SORT_OPTIONS } from "../lib/sort"
import { loadSettings, saveSettings } from "../lib/alarm-store"
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
  if (card.retryConfig?.enabled) {
    summary += ` · 重复${card.retryConfig.maxRetries}次/${card.retryConfig.intervalMinutes}分`
  }
  return summary
}

/** 按指定维度和方向排序加载信用卡 */
const loadSortedCards = (sortBy: CardSortKey, ascending: boolean): CreditCard[] =>
  sortCards(loadCards(), sortBy, ascending)

function CardRow({ card, onEdit, onToggle, onConfirm, onUnconfirm }: { card: CreditCard; onEdit: (id: string) => void; onToggle: (id: string, enabled: boolean) => void; onConfirm: (card: CreditCard) => void; onUnconfirm: (card: CreditCard) => void }) {
  const nextDue = getNextDueDate(card)
  const dueStr = formatDateCN(nextDue)
  const now = new Date()
  const daysUntilDue = Math.ceil((nextDue.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

  // 确认状态
  const unconfirmedCount = getCardUnconfirmedCount(card)
  const unconfirmedDetail = getCardUnconfirmedDetails(card)
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
          <Text font={13} foregroundStyle="secondaryLabel">免息期{card.graceDays}天</Text>
        </HStack>
        <HStack spacing={8}>
          <Text font={14} fontWeight="semibold" foregroundStyle="systemOrange">下次还款: {dueStr}</Text>
          {daysUntilDue <= 3 && daysUntilDue >= 0 && (
            <Text font={12} foregroundStyle="systemRed">仅剩{daysUntilDue}天!</Text>
          )}
        </HStack>
        <Text font={12} foregroundStyle="tertiaryLabel">{reminderSummary(card)}</Text>
        {hasUnconfirmed && (
          <Text font={12} foregroundStyle="systemOrange">待确认: {unconfirmedDetail}</Text>
        )}
        {allConfirmed && (
          <Text font={12} foregroundStyle="systemGreen">今日已全部确认</Text>
        )}
      </VStack>
    </Toggle>
  )
}

export function CreditCardList({ selection }: { selection: Observable<number> }) {
  // 从设置读取排序偏好
  const currentSort = useObservable<CardSortKey>(() => loadSettings().cardSortBy ?? "bank")
  const sortAsc = useObservable<boolean>(() => loadSettings().cardSortAsc ?? true)
  const cards = useObservable<CreditCard[]>(() => loadSortedCards(currentSort.value, sortAsc.value))
  // toast 状态
  const [toastMsg, setToastMsg] = useState("")
  const [toastShown, setToastShown] = useState(false)

  // 排序对话框状态
  const editMode = useObservable(() => EditMode.inactive())
  const sortShown = useObservable<boolean>(() => false)

  // 执行排序切换（维度）
  const applySort = (key: CardSortKey) => {
    const opt = CARD_SORT_OPTIONS.find(o => o.key === key)
    const newAsc = opt?.reversible ? (opt.defaultAsc) : (opt?.defaultAsc ?? true)
    currentSort.setValue(key)
    sortAsc.setValue(newAsc)
    const settings = loadSettings()
    saveSettings({ ...settings, cardSortBy: key, cardSortAsc: newAsc })
    cards.setValue(loadSortedCards(key, newAsc))
    setToastMsg(`排序: ${opt?.label ?? key}`)
    setToastShown(true)
  }

  // 切换排序方向
  const toggleSortDir = () => {
    const opt = CARD_SORT_OPTIONS.find(o => o.key === currentSort.value)
    if (!opt?.reversible) {
      setToastMsg(`当前排序不支持切换方向`)
      setToastShown(true)
      return
    }
    const newAsc = !sortAsc.value
    sortAsc.setValue(newAsc)
    const settings = loadSettings()
    saveSettings({ ...settings, cardSortAsc: newAsc })
    cards.setValue(loadSortedCards(currentSort.value, newAsc))
    setToastMsg(`${opt?.label ?? currentSort.value} ${newAsc ? "升序" : "降序"}`)
      setToastShown(true)
  }

  // 监听 Tab 切换：切回信用卡 Tab 时重新加载
  useEffect(() => {
    if (selection.value === 1) {
      cards.setValue(loadSortedCards(currentSort.value, sortAsc.value))
    }
  }, [selection.value])

  // 同步 cards Observable → Storage（编辑模式左滑删除后自动触发）
  const prevCardIdsRef = useObservable<string[]>(() => cards.value.map(c => c.id))
  useEffect(() => {
    const currentIds = new Set(cards.value.map(c => c.id))
    const prevIds = prevCardIdsRef.value
    const deletedIds = prevIds.filter(id => !currentIds.has(id))
    if (deletedIds.length > 0) {
      for (const delId of deletedIds) {
        // 同步删除 Storage 中的卡+关联闹钟记录
        removeCardSync(delId)
        // 异步取消系统闹钟（fire-and-forget）
        cancelCardAlarmsById(delId).catch(() => {})
      }
      setToastMsg(deletedIds.length === 1 ? "信用卡已删除" : `已删除${deletedIds.length}张信用卡`)
      setToastShown(true)
    }
    prevCardIdsRef.setValue(cards.value.map(c => c.id))
  }, [cards.value])

  // 弹出添加/编辑信用卡模态页，关闭后刷新+异步同步闹钟
  const presentEditor = (editId?: string) => {
    Navigation.present({
      element: <AddCreditCard editId={editId} />,
      modalPresentationStyle: "pageSheet",
    }).then((result: any) => {
      if (result?.deleted && result?.cardId) {
        // 异步取消系统闹钟（fire-and-forget）
        cancelCardAlarmsById(result.cardId).catch(() => {})
        setToastMsg("信用卡已删除")
        setToastShown(true)
        cards.setValue(loadSortedCards(currentSort.value, sortAsc.value))
      } else if (result?.saved && result?.cardId) {
        // 先刷新列表显示新卡，再异步同步闹钟
        cards.setValue(loadSortedCards(currentSort.value, sortAsc.value))
        syncCardAlarmsById(result.cardId)
          .then(() => {
            setToastMsg(editId ? "信用卡已更新并同步闹钟" : "信用卡已添加并同步闹钟")
            setToastShown(true)
            cards.setValue(loadSortedCards(currentSort.value, sortAsc.value))
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
    cards.setValue(loadSortedCards(currentSort.value, sortAsc.value))
  }

  // 取消确认：恢复为待确认状态
  const handleUnconfirm = (card: CreditCard) => {
    unconfirmCardReminders(card)
    setToastMsg(`已取消确认: ${card.bankName} 尾号${card.last4Digits}`)
    setToastShown(true)
    cards.setValue(loadSortedCards(currentSort.value, sortAsc.value))
  }

  const handleToggle = (id: string, enabled: boolean) => {
    // 先同步更新本地状态
    updateCard(id, { enabled })
    cards.setValue(loadSortedCards(currentSort.value, sortAsc.value))
    if (enabled) {
      // 启用：异步同步闹钟
      syncCardAlarmsById(id)
        .then(() => {
          setToastMsg("信用卡已启用，闹钟已同步")
          setToastShown(true)
          cards.setValue(loadSortedCards(currentSort.value, sortAsc.value))
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
          cards.setValue(loadSortedCards(currentSort.value, sortAsc.value))
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
          topBarLeading: (
            <HStack spacing={0}>
              <Button title="" systemImage={editMode.value.isEditing ? "checkmark.circle" : "pencil.circle"} action={() => editMode.setValue(editMode.value.isEditing ? EditMode.inactive() : EditMode.active())} />
              <Button title="" systemImage="plus" action={handleAdd} />
            </HStack>
          ),
          topBarTrailing: (
            <HStack spacing={0}>
              <Button title="" systemImage="arrow.up.arrow.down" action={() => sortShown.setValue(true)} />
              <Button title="" systemImage={sortAsc.value ? "chevron.up" : "chevron.down"} action={toggleSortDir} />
              <Button title="" systemImage="gearshape" action={presentSettings} />
            </HStack>
          ),
        }}
        environments={{ editMode }}
        toast={{
          message: toastMsg,
          isPresented: toastShown,
          onChanged: setToastShown,
        }}
        confirmationDialog={{
          title: "排序方式",
          isPresented: sortShown,
          actions: <>{CARD_SORT_OPTIONS.map(o =>
            <Button key={o.key} title={o.key === currentSort.value ? `✓ ${o.label}` : o.label} action={() => applySort(o.key)} />
          )}</>,
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
              editActions="delete"
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
