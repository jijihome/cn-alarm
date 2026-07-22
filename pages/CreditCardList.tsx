// CreditCardList.tsx - 信用卡列表页
import { useState, useObservable, NavigationStack, List, Section, Text, ForEach, Button, HStack, VStack, Toggle, ContentUnavailableView, Navigation, useEffect } from "scripting"
import { CreditCard } from "../lib/constants"
import { loadCards, updateCard, getNextDueDate, formatDateCN, syncCardAlarmsById, cancelCardAlarmsById } from "../lib/credit-card"
import { AddCreditCard } from "./AddCreditCard"

/** 按银行名拼音排序加载信用卡 */
const loadSortedCards = (): CreditCard[] =>
  loadCards().sort((a, b) => a.bankName.localeCompare(b.bankName, "zh"))

function CardRow({ card, onEdit, onToggle }: { card: CreditCard; onEdit: (id: string) => void; onToggle: (id: string, enabled: boolean) => void }) {
  const nextDue = getNextDueDate(card)
  const dueStr = formatDateCN(nextDue)
  const now = new Date()
  const daysUntilDue = Math.ceil((nextDue.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

  return (
    <Toggle
      value={card.enabled}
      onChanged={(val: boolean) => onToggle(card.id, val)}
    >
      <VStack alignment="leading" spacing={4} onTapGesture={() => onEdit(card.id)}>
        <HStack alignment="center" spacing={8}>
          <Text font={16} fontWeight="bold">{card.bankName}</Text>
          <Text font={13} foregroundStyle="secondaryLabel">尾号{card.last4Digits}</Text>
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
          topBarTrailing: <Button title="添加" systemImage="plus" action={handleAdd} />,
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
                />
              )}
            />
          </Section>
        )}
      </List>
    </NavigationStack>
  )
}
