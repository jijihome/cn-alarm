// TodayAlarms.tsx - 今日闹铃页面：显示今日所有闹铃，分待确认/已响铃/未响铃
import { useState, useObservable, NavigationStack, List, Section, Text, HStack, VStack, Image, ContentUnavailableView, Button, useEffect } from "scripting"
import { AlarmItem } from "../lib/constants"
import { loadAlarms, isReminderConfirmed, confirmReminder, unconfirmAllReminders } from "../lib/alarm-store"
import { isAlarmToday, formatRepeatDescription } from "../lib/scheduler"
import { cancelRetryAlarms } from "../lib/alarm-bridge"

// ==================== 数据模型 ====================

/** 单个闹铃时间点 */
interface AlarmTimePoint {
  alarm: AlarmItem
  hour: number
  minute: number
  /** 是否已确认（仅 retryConfig 启用时有意义） */
  confirmed: boolean
  /** 来源：用户闹钟 / 信用卡 */
  source: "user" | "credit_card"
}

/** 格式化时间 */
function fmtTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** 收集一个闹钟今日所有时间点 */
function collectTimePoints(alarm: AlarmItem, today: Date): AlarmTimePoint[] {
  const source: "user" | "credit_card" = alarm.source === "credit_card" ? "credit_card" : "user"
  const points: AlarmTimePoint[] = []

  // 主时间点
  points.push({
    alarm,
    hour: alarm.hour,
    minute: alarm.minute,
    confirmed: isReminderConfirmed(alarm, today, alarm.hour, alarm.minute),
    source,
  })

  // 额外提醒时间点
  for (const rt of alarm.reminderTimes ?? []) {
    points.push({
      alarm,
      hour: rt.hour,
      minute: rt.minute,
      confirmed: isReminderConfirmed(alarm, today, rt.hour, rt.minute),
      source,
    })
  }

  return points
}

/** 加载今日所有闹铃时间点，按时间排序 */
function loadTodayAlarms(): AlarmTimePoint[] {
  const today = new Date()
  const allAlarms = loadAlarms()
  const todayAlarms = allAlarms.filter(a => a.enabled && isAlarmToday(a, today))

  const points: AlarmTimePoint[] = []
  for (const alarm of todayAlarms) {
    points.push(...collectTimePoints(alarm, today))
  }

  // 按时间排序
  points.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute))
  return points
}

/** 三段分组：待确认 / 已响铃 / 未响铃 */
function groupByStatus(points: AlarmTimePoint[]): {
  unconfirmed: AlarmTimePoint[]   // 已触发 + 未确认
  triggered: AlarmTimePoint[]     // 已触发 + 已确认/无需确认
  pending: AlarmTimePoint[]       // 时间还没到
} {
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const unconfirmed: AlarmTimePoint[] = []
  const triggered: AlarmTimePoint[] = []
  const pending: AlarmTimePoint[] = []

  for (const p of points) {
    if (p.hour * 60 + p.minute > currentMinutes) {
      pending.push(p)
    } else if (p.alarm.retryConfig?.enabled && !p.confirmed) {
      unconfirmed.push(p)
    } else {
      triggered.push(p)
    }
  }

  return { unconfirmed, triggered, pending }
}

// ==================== 行组件 ====================

interface AlarmTimeRowProps {
  point: AlarmTimePoint
  onConfirm?: (point: AlarmTimePoint) => void
  onUnconfirm?: (point: AlarmTimePoint) => void
}

function AlarmTimeRow({ point, onConfirm, onUnconfirm }: AlarmTimeRowProps) {
  const { alarm, hour, minute, confirmed, source } = point
  const timeStr = fmtTime(hour, minute)
  const isCreditCard = source === "credit_card"
  const desc = formatRepeatDescription(alarm.repeat)

  const hasRetry = alarm.retryConfig?.enabled
  const isUnconfirmed = hasRetry && !confirmed

  // 左滑操作：未确认→确认，已确认→取消确认
  const leadingActions = hasRetry ? {
    actions: isUnconfirmed
      ? [<Button key="confirm" title="确认" tint="systemGreen" action={() => { if (onConfirm) onConfirm(point) }} />]
      : [<Button key="unconfirm" title="取消确认" tint="systemOrange" action={() => { if (onUnconfirm) onUnconfirm(point) }} />]
  } : undefined

  return (
    <VStack alignment="leading" spacing={2}
      leadingSwipeActions={leadingActions}
    >
      <HStack alignment="center" spacing={8}>
        {isUnconfirmed ? (
          <Image
            systemName="exclamationmark.triangle.fill"
            foregroundStyle="systemOrange"
            imageScale="small"
          />
        ) : (
          <Image
            systemName={isCreditCard ? "creditcard.fill" : "alarm.fill"}
            foregroundStyle={isCreditCard ? "systemOrange" : (alarm.tintColor as any)}
            imageScale="small"
          />
        )}
        <HStack alignment="firstTextBaseline" spacing={6}>
          <Text font={20} fontWeight="bold" foregroundStyle={isUnconfirmed ? "systemOrange" : "label"}>{timeStr}</Text>
          <Text font={15} foregroundStyle="label">{alarm.title}</Text>
          {isCreditCard && (
            <Text font={12} foregroundStyle="systemOrange" fontWeight="semibold">信用卡</Text>
          )}
        </HStack>
      </HStack>
      <HStack spacing={4}>
        <Text font={13} foregroundStyle="secondaryLabel">{desc}</Text>
        {hasRetry && (
          <Text font={12} foregroundStyle={confirmed ? "systemGreen" : "systemOrange"} fontWeight={isUnconfirmed ? "semibold" : "regular"}>
            {confirmed ? "已确认" : "待确认"}
          </Text>
        )}
      </HStack>
    </VStack>
  )
}

// ==================== 页面组件 ====================

export function TodayAlarms({ selection }: { selection: Observable<number> }) {
  const allPoints = useObservable<AlarmTimePoint[]>(() => loadTodayAlarms())
  const [toastMsg, setToastMsg] = useState("")
  const [toastShown, setToastShown] = useState(false)

  // 定时刷新：每 30 秒检查一次（闹铃状态随时间变化）
  const [, setTick] = useState(0)
  useEffect(() => {
    let timerId: number
    const tick = () => {
      setTick(t => t + 1)
      allPoints.setValue(loadTodayAlarms())
      timerId = setTimeout(tick, 30000)
    }
    timerId = setTimeout(tick, 30000)
    return () => clearTimeout(timerId)
  }, [])

  // 监听 Tab 切换：切回今日 Tab 时重新加载
  useEffect(() => {
    if (selection.value === 0) {
      allPoints.setValue(loadTodayAlarms())
    }
  }, [selection.value])

  // 确认单个时间点
  const handleConfirm = (point: AlarmTimePoint) => {
    const today = new Date()
    confirmReminder(point.alarm.id, today, point.hour, point.minute)
    cancelRetryAlarms(point.alarm).catch(() => {})
    setToastMsg(`已确认 ${fmtTime(point.hour, point.minute)}: ${point.alarm.title}`)
    setToastShown(true)
    allPoints.setValue(loadTodayAlarms())
  }

  // 取消确认
  const handleUnconfirm = (point: AlarmTimePoint) => {
    const today = new Date()
    unconfirmAllReminders(point.alarm.id, today)
    setToastMsg(`已取消确认: ${point.alarm.title}`)
    setToastShown(true)
    allPoints.setValue(loadTodayAlarms())
  }

  const { unconfirmed, triggered, pending } = groupByStatus(allPoints.value)
  const hasAny = unconfirmed.length > 0 || triggered.length > 0 || pending.length > 0

  // 今日日期显示
  const today = new Date()
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
  const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"]
  const weekdayStr = `星期${weekdayLabels[today.getDay()]}`

  return (
    <NavigationStack>
      <List
        navigationTitle="今日闹铃"
        toast={{
          message: toastMsg,
          isPresented: toastShown,
          onChanged: setToastShown,
        }}
      >
        {/* 日期摘要 */}
        <Section header={<Text font={13} foregroundStyle="secondaryLabel">{dateStr} {weekdayStr}</Text>}>
          {hasAny ? (
            <VStack alignment="leading" spacing={4}>
              <HStack spacing={16}>
                <VStack alignment="center" spacing={2}>
                  <Text font={28} fontWeight="bold" foregroundStyle="systemBlue">{pending.length}</Text>
                  <Text font={12} foregroundStyle="systemBlue">未响铃</Text>
                </VStack>
                {unconfirmed.length > 0 && (
                  <VStack alignment="center" spacing={2}>
                    <Text font={28} fontWeight="bold" foregroundStyle="systemOrange">{unconfirmed.length}</Text>
                    <Text font={12} foregroundStyle="systemOrange">待确认</Text>
                  </VStack>
                )}
                <VStack alignment="center" spacing={2}>
                  <Text font={28} fontWeight="bold" foregroundStyle="secondaryLabel">{triggered.length}</Text>
                  <Text font={12} foregroundStyle="secondaryLabel">已响铃</Text>
                </VStack>
              </HStack>
            </VStack>
          ) : (
            <ContentUnavailableView
              title="今日没有闹铃"
              systemImage="moon.fill"
              description="今天没有设置闹钟或信用卡提醒"
            />
          )}
        </Section>

        {/* 未响铃 */}
        {pending.length > 0 && (
          <Section header={<Text font={14} foregroundStyle="systemBlue">未响铃</Text>}>
            {pending.map((p, idx) => (
              <AlarmTimeRow key={`p-${p.alarm.id}-${idx}`} point={p} onConfirm={handleConfirm} onUnconfirm={handleUnconfirm} />
            ))}
          </Section>
        )}

        {/* 待确认：已响铃但未确认的闹铃 */}
        {unconfirmed.length > 0 && (
          <Section header={<Text font={14} foregroundStyle="systemOrange">待确认</Text>}>
            {unconfirmed.map((p, idx) => (
              <AlarmTimeRow key={`u-${p.alarm.id}-${idx}`} point={p} onConfirm={handleConfirm} onUnconfirm={handleUnconfirm} />
            ))}
          </Section>
        )}

        {/* 已响铃 */}
        {triggered.length > 0 && (
          <Section header={<Text font={14} foregroundStyle="secondaryLabel">已响铃</Text>}>
            {triggered.map((p, idx) => (
              <AlarmTimeRow key={`t-${p.alarm.id}-${idx}`} point={p} onConfirm={handleConfirm} onUnconfirm={handleUnconfirm} />
            ))}
          </Section>
        )}
      </List>
    </NavigationStack>
  )
}
