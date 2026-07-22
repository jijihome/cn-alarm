// SearchView.tsx - 全局搜索页（Tab role="search"）
import { useState, useObservable, NavigationStack, List, Section, Text, HStack, VStack, ContentUnavailableView, Navigation, useEffect } from "scripting"
import { AlarmItem, CreditCard } from "../lib/constants"
import { loadAlarms } from "../lib/alarm-store"
import { loadCards } from "../lib/credit-card"
import { scheduleAlarm, cancelAllAlarms, cancelRetryAlarms, ScheduleResult } from "../lib/alarm-bridge"
import { updateAlarm, confirmReminder, unconfirmAllReminders, getUnconfirmedTimes } from "../lib/alarm-store"
import { AlarmRow } from "../components/AlarmRow"
import { AddAlarm } from "./AddAlarm"
import { AddCreditCard } from "./AddCreditCard"

/** 搜索结果类型 */
interface AlarmResult {
  type: "alarm"
  alarm: AlarmItem
}

interface CardResult {
  type: "card"
  card: CreditCard
}

type SearchResult = AlarmResult | CardResult

/** 刷新搜索结果 */
function refreshResults(query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (q === "") return []

  const alarms = loadAlarms().filter(a => a.source !== "credit_card")
  const cards = loadCards()

  const matchedAlarms: SearchResult[] = alarms
    .filter(a => a.title.toLowerCase().includes(q) || a.note.toLowerCase().includes(q) || a.tag.toLowerCase().includes(q))
    .map(a => ({ type: "alarm" as const, alarm: a }))

  const matchedCards: SearchResult[] = cards
    .filter(c => c.bankName.toLowerCase().includes(q) || c.last4Digits.includes(q))
    .map(c => ({ type: "card" as const, card: c }))

  return [...matchedAlarms, ...matchedCards]
}

export function SearchView() {
  const [query, setQuery] = useState("")
  const results = useObservable<SearchResult[]>(() => [])

  // 搜索逻辑
  useEffect(() => {
    results.setValue(refreshResults(query))
  }, [query])

  // 闹钟操作回调
  const handleToggle = (id: string, enabled: boolean) => {
    const alarm = loadAlarms().find(a => a.id === id)
    if (!alarm) return
    if (enabled) {
      updateAlarm(id, { enabled: true, alarmIds: [], retryAlarmIds: [] })
      scheduleAlarm(alarm).then((result: ScheduleResult | null) => {
        if (result) updateAlarm(id, { alarmIds: result.allAlarmIds, retryAlarmIds: result.retryIds })
      })
    } else {
      const oldAlarm = loadAlarms().find(a => a.id === id) ?? alarm
      updateAlarm(id, { enabled: false, alarmIds: [], retryAlarmIds: [] })
      cancelAllAlarms(oldAlarm).catch(() => {})
    }
    results.setValue(refreshResults(query))
  }

  const handleEdit = (id: string) => {
    Navigation.present({
      element: <AddAlarm editId={id} />,
      modalPresentationStyle: "fullScreen",
    }).then(() => {
      results.setValue(refreshResults(query))
    })
  }

  const handleConfirm = (alarm: AlarmItem) => {
    const today = new Date()
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    if (alarm.retryConfig?.confirmAll) {
      const unconfirmed = getUnconfirmedTimes(alarm, today)
      for (const t of unconfirmed) confirmReminder(alarm.id, today, t.hour, t.minute)
    } else {
      const unconfirmed = getUnconfirmedTimes(alarm, today)
      const triggered = unconfirmed.filter(t => t.hour * 60 + t.minute <= currentMinutes)
      for (const t of (triggered.length > 0 ? triggered : unconfirmed.slice(0, 1))) {
        confirmReminder(alarm.id, today, t.hour, t.minute)
      }
    }
    cancelRetryAlarms(alarm).catch(() => {})
    results.setValue(refreshResults(query))
  }

  const handleUnconfirm = (alarm: AlarmItem) => {
    unconfirmAllReminders(alarm.id, new Date())
    results.setValue(refreshResults(query))
  }

  const handleEditCard = (id: string) => {
    Navigation.present({
      element: <AddCreditCard editId={id} />,
      modalPresentationStyle: "fullScreen",
    }).then(() => {
      results.setValue(refreshResults(query))
    })
  }

  const alarmResults = results.value.filter((r): r is AlarmResult => r.type === "alarm")
  const cardResults = results.value.filter((r): r is CardResult => r.type === "card")

  return (
    <NavigationStack>
      <List
        navigationTitle="搜索"
        searchable={{
          value: query,
          onChanged: setQuery,
          prompt: "搜索闹钟或信用卡",
        }}
      >
        {query.trim() === "" ? (
          <Section>
            <ContentUnavailableView
              title="搜索闹钟和信用卡"
              systemImage="magnifyingglass"
              description="输入关键词搜索闹钟标题、备注或信用卡银行名"
            />
          </Section>
        ) : results.value.length === 0 ? (
          <Section>
            <ContentUnavailableView
              title="未找到结果"
              systemImage="magnifyingglass"
              description="没有匹配的闹钟或信用卡，试试其他关键词"
            />
          </Section>
        ) : (
          <>
            {alarmResults.length > 0 && (
              <Section title={`闹钟 (${alarmResults.length})`}>
                {alarmResults.map(r => (
                  <AlarmRow
                    key={r.alarm.id}
                    alarm={r.alarm}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onConfirm={handleConfirm}
                    onUnconfirm={handleUnconfirm}
                  />
                ))}
              </Section>
            )}
            {cardResults.length > 0 && (
              <Section title={`信用卡 (${cardResults.length})`}>
                {cardResults.map(r => (
                  <CardSearchRow key={r.card.id} card={r.card} onEdit={handleEditCard} />
                ))}
              </Section>
            )}
          </>
        )}
      </List>
    </NavigationStack>
  )
}

/** 信用卡搜索结果行 */
function CardSearchRow({ card, onEdit }: { card: CreditCard; onEdit: (id: string) => void }) {
  return (
    <VStack alignment="leading" spacing={4} onTapGesture={() => onEdit(card.id)}>
      <HStack alignment="center" spacing={8}>
        <Text font={14} foregroundStyle={card.tintColor as any}>●</Text>
        <Text font={18} fontWeight="bold">{card.bankName}</Text>
        <Text font={15} foregroundStyle="secondaryLabel">尾号{card.last4Digits}</Text>
      </HStack>
      <Text font={13} foregroundStyle="secondaryLabel">
        账单日{card.statementDay}号 · 还款日约{card.graceDays}天后
      </Text>
    </VStack>
  )
}
