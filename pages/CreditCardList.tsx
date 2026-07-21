// CreditCardList.tsx - 信用卡列表页
import { useState, useObservable, NavigationStack, List, Section, Text, ForEach, Button, HStack, VStack, ContentUnavailableView, Navigation } from "scripting"
import { CreditCard } from "../lib/constants"
import { loadCards, updateCard, deleteCard, getNextDueDate, formatDateCN } from "../lib/credit-card"
import { AddCreditCard } from "./AddCreditCard"

function CardRow({ card, onEdit, onToggle }: { card: CreditCard; onEdit: (id: string) => void; onToggle: (id: string, enabled: boolean) => void }) {
  const nextDue = getNextDueDate(card)
  const dueStr = formatDateCN(nextDue)
  const now = new Date()
  const daysUntilDue = Math.ceil((nextDue.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

  return (
    <Button action={() => onEdit(card.id)}>
      <VStack alignment="leading" spacing={4}>
        <HStack alignment="center" spacing={8}>
          <Text font={16} fontWeight="bold">{card.bankName}</Text>
          <Text font={13} foregroundStyle="secondaryLabel">尾号{card.last4Digits}</Text>
          {!card.enabled && <Text font={12} foregroundStyle="secondaryLabel">（已停用）</Text>}
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
    </Button>
  )
}

export function CreditCardList() {
  const cards = useObservable<CreditCard[]>(() => loadCards())
  // toast 状态
  const [toastMsg, setToastMsg] = useState("")
  const [toastShown, setToastShown] = useState(false)

  // 弹出添加/编辑信用卡模态页，关闭后刷新
  const presentEditor = (editId?: string) => {
    Navigation.present({
      element: <AddCreditCard editId={editId} />,
      modalPresentationStyle: "fullScreen",
    }).then((result: any) => {
      if (result?.deleted) {
        setToastMsg("信用卡已删除")
        setToastShown(true)
      } else if (result?.saved) {
        setToastMsg(editId ? "信用卡已更新" : "信用卡已添加")
        setToastShown(true)
      }
      cards.setValue(loadCards())
    })
  }

  const handleAdd = () => presentEditor()
  const handleEdit = (id: string) => presentEditor(id)

  const handleToggle = (id: string, enabled: boolean) => {
    updateCard(id, { enabled })
    setToastMsg(enabled ? "信用卡已启用" : "信用卡已停用")
    setToastShown(true)
    cards.setValue(loadCards())
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
