// AlarmList.tsx - 闹钟列表页
import { useState, useObservable, NavigationStack, List, Section, Text, Button, Menu, ContentUnavailableView, VStack, HStack, Navigation, ForEach, useEffect } from "scripting"
import { AlarmItem, AlarmSortKey } from "../lib/constants"
import { loadAlarms, saveAlarms, updateAlarm, confirmReminder, unconfirmAllReminders, isReminderConfirmed, getUnconfirmedTimes, makeConfirmKey, loadSettings, saveSettings, loadGroups } from "../lib/alarm-store"
import { getNextAlarmFromList, formatCountdown, formatRepeatDescription, getNextTrigger, getNextTriggerMulti } from "../lib/scheduler"
import { scheduleAlarm, cancelAlarm, cancelAllAlarms, cancelRetryAlarms, ScheduleResult } from "../lib/alarm-bridge"
import { sortAlarms, ALARM_SORT_OPTIONS, alarmSortTitle } from "../lib/sort"
import { AlarmRow } from "../components/AlarmRow"
import { AddAlarm } from "./AddAlarm"
import { Settings } from "./Settings"
import { AlarmFilterSheet, AlarmFilter, DEFAULT_FILTER, hasActiveFilter } from "../components/AlarmFilterSheet"

/** 模态弹出设置页 */
const presentSettings = () =>
  Navigation.present({ element: <Settings />, modalPresentationStyle: "pageSheet" })

/** 检查并禁用已到期闹钟（结束条件已过），返回是否有变更 */
function disableExpiredAlarms(): boolean {
  const now = new Date()
  const allAlarms = loadAlarms()
  let changed = false
  const updated = allAlarms.map(a => {
    if (a.enabled) {
      const next = getNextTriggerMulti(a, now)
      if (!next) {
        changed = true
        // 异步取消系统闹钟
        cancelAllAlarms(a).catch(() => {})
        return { ...a, enabled: false, alarmIds: [], retryAlarmIds: [], updatedAt: now.getTime() }
      }
    }
    return a
  })
  if (changed) saveAlarms(updated)
  return changed
}

/** 加载并排序用户闹钟（含到期自动禁用），可选筛选 */
const loadSortedUserAlarms = (sortBy: AlarmSortKey, ascending: boolean, filter?: AlarmFilter): AlarmItem[] => {
  disableExpiredAlarms()
  let result = sortAlarms(loadAlarms().filter((a) => a.source !== "credit_card"), sortBy, ascending)
  if (filter && hasActiveFilter(filter)) {
    result = result.filter(a => {
      if (filter.enabledFilter === "on" && !a.enabled) return false
      if (filter.enabledFilter === "off" && a.enabled) return false
      if (filter.groupFilter !== "") {
        if (filter.groupFilter === "__none__") {
          if (a.groupName !== "") return false
        } else {
          if (a.groupName !== filter.groupFilter) return false
        }
      }
      if (filter.modeFilter !== "" && a.repeat.mode !== filter.modeFilter) return false
      return true
    })
  }
  return result
}

/** 构建分类名→颜色映射 */
const buildGroupColorMap = (): Record<string, string> => {
  const map: Record<string, string> = {}
  for (const g of loadGroups()) {
    map[g.name] = g.tintColor
  }
  return map
}

function NextAlarmCard({ alarms }: { alarms: AlarmItem[] }) {
  // 倒计时定时器：每秒刷新（setTimeout 递归模拟 setInterval）
  const [, setTick] = useState(0)
  useEffect(() => {
    let timerId: number
    const tick = () => {
      setTick((t) => t + 1)
      timerId = setTimeout(tick, 1000)
    }
    timerId = setTimeout(tick, 1000)
    return () => clearTimeout(timerId)
  }, [])

  const enabled = alarms.filter((a) => a.enabled)
  if (enabled.length === 0) {
    return (
      <ContentUnavailableView
        title="暂无启用的闹钟"
        systemImage="alarm.fill"
        description="添加并启用闹钟后，这里会显示下一个闹钟的倒计时"
      />
    )
  }

  const next = getNextAlarmFromList(enabled, new Date())
  if (!next) {
    return <Text foregroundStyle="secondaryLabel">近期没有闹钟会响铃</Text>
  }

  const countdown = formatCountdown(next.date, new Date())
  const timeStr = `${String(next.hour).padStart(2, "0")}:${String(next.minute).padStart(2, "0")}`

  return (
    <VStack alignment="leading" spacing={4}>
      <Text font={15} foregroundStyle="secondaryLabel">下一个闹钟</Text>
      <Text font={28} fontWeight="bold" foregroundStyle="label">{countdown}</Text>
      <Text font={14} foregroundStyle="secondaryLabel">
        {next.alarm.title} · {timeStr} · {formatRepeatDescription(next.alarm.repeat)}
      </Text>
    </VStack>
  )
}

export function AlarmList({ selection }: { selection: Observable<number> }) {
  // 从设置读取排序偏好
  const currentSort = useObservable<AlarmSortKey>(() => loadSettings().alarmSortBy ?? "time")
  const sortAsc = useObservable<boolean>(() => loadSettings().alarmSortAsc ?? true)
  // 筛选状态（必须在 alarms 之前声明，因为 alarms initializer 引用 filterState）
  const filterState = useObservable<AlarmFilter>(() => ({ ...DEFAULT_FILTER }))
  const alarms = useObservable<AlarmItem[]>(() => loadSortedUserAlarms(currentSort.value, sortAsc.value, filterState.value))
  const groupColorMap = useObservable<Record<string, string>>(() => buildGroupColorMap())

  // toast 状态
  const [toastMsg, setToastMsg] = useState("")
  const [toastShown, setToastShown] = useState(false)

  // 排序对话框状态
  const editMode = useObservable(() => EditMode.inactive())

  // 执行排序切换（维度）
  const applySort = (key: AlarmSortKey) => {
    // 切换维度时，根据新维度的默认方向设置
    const opt = ALARM_SORT_OPTIONS.find(o => o.key === key)
    const newAsc = opt?.reversible ? (opt.defaultAsc) : (opt?.defaultAsc ?? true)
    currentSort.setValue(key)
    sortAsc.setValue(newAsc)
    const settings = loadSettings()
    saveSettings({ ...settings, alarmSortBy: key, alarmSortAsc: newAsc })
    skipDeleteCheck.setValue(true)
    alarms.setValue(loadSortedUserAlarms(key, newAsc, filterState.value))
    setToastMsg(`排序: ${opt?.label ?? key}`)
    setToastShown(true)
  }

  // 切换排序方向
  const toggleSortDir = () => {
    const opt = ALARM_SORT_OPTIONS.find(o => o.key === currentSort.value)
    // 不支持方向切换的维度（如 enabled）不处理
    if (!opt?.reversible) {
      setToastMsg("当前排序不支持切换方向")
      setToastShown(true)
      return
    }
    const newAsc = !sortAsc.value
    sortAsc.setValue(newAsc)
    const settings = loadSettings()
    saveSettings({ ...settings, alarmSortAsc: newAsc })
    skipDeleteCheck.setValue(true)
    alarms.setValue(loadSortedUserAlarms(currentSort.value, newAsc, filterState.value))
    setToastMsg(`${opt?.label ?? currentSort.value} ${newAsc ? "升序" : "降序"}`)
    setToastShown(true)
  }

  // 监听 Tab 切换：切回闹钟 Tab 时重新加载（其他页面可能改了调休/分类/闹钟数据）
  useEffect(() => {
    if (selection.value === 1) {
      skipDeleteCheck.setValue(true)
      alarms.setValue(loadSortedUserAlarms(currentSort.value, sortAsc.value, filterState.value))
      groupColorMap.setValue(buildGroupColorMap())
    }
  }, [selection.value])

  // 同步 alarms Observable → Storage（swipe 删除后自动触发）
  // 筛选变化时跳过删除检测（筛选只是隐藏，不是真删除）
  const skipDeleteCheck = useObservable<boolean>(() => false)
  const prevAlarmIdsRef = useObservable<string[]>(() => alarms.value.map(a => a.id))
  useEffect(() => {
    if (skipDeleteCheck.value) {
      skipDeleteCheck.setValue(false)
      prevAlarmIdsRef.setValue(alarms.value.map(a => a.id))
      return
    }
    const currentIds = new Set(alarms.value.map(a => a.id))
    const prevIds = prevAlarmIdsRef.value
    // 找出被删除的 id
    const deletedIds = prevIds.filter(id => !currentIds.has(id))
    if (deletedIds.length > 0) {
      // 取消被删闹钟的全部系统闹钟+重试提醒
      const oldAlarms = loadAlarms().filter(a => a.source !== "credit_card")
      for (const delId of deletedIds) {
        const oldAlarm = oldAlarms.find(a => a.id === delId)
        if (oldAlarm) {
          cancelAllAlarms(oldAlarm)
        }
      }
      // 同步到 storage（保留信用卡闹钟+被筛掉的闹钟，只更新用户闹钟部分）
      const cardAlarms = loadAlarms().filter(a => a.source === "credit_card")
      const filteredOutAlarms = loadAlarms().filter(a => a.source !== "credit_card" && !currentIds.has(a.id))
      saveAlarms([...alarms.value, ...filteredOutAlarms, ...cardAlarms])
      // 显示toast
      setToastMsg(deletedIds.length === 1 ? "闹钟已删除" : `已删除${deletedIds.length}个闹钟`)
      setToastShown(true)
    }
    // 更新 prev ref
    prevAlarmIdsRef.setValue(alarms.value.map(a => a.id))
  }, [alarms.value])

  // 弹出添加/编辑闹钟模态页，关闭后刷新列表
  const presentEditor = (editId?: string) => {
    Navigation.present({
      element: <AddAlarm editId={editId} />,
      modalPresentationStyle: "pageSheet",
    }).then((result: any) => {
      // 只有真正保存才处理调度和 toast
      if (result?.saved && result?.alarmId) {
        const alarm = loadAlarms().find(a => a.id === result.alarmId)
        if (alarm && alarm.enabled) {
          // 先取消旧的系统闹钟+重试（编辑场景）
          if (alarm.alarmIds.length > 0) {
            cancelAllAlarms(loadAlarms().find(a => a.id === result.alarmId) ?? alarm).catch(() => {})
          }
          // 重新调度系统闹钟
          scheduleAlarm(alarm).then((result: ScheduleResult | null) => {
            if (result) {
              updateAlarm(alarm.id, { alarmIds: result.allAlarmIds, retryAlarmIds: result.retryIds })
              setToastMsg(editId ? "闹钟已更新并调度" : "闹钟已添加并调度")
            } else {
              setToastMsg("闹钟已保存，但系统调度失败")
            }
            setToastShown(true)
            skipDeleteCheck.setValue(true)
            alarms.setValue(loadSortedUserAlarms(currentSort.value, sortAsc.value, filterState.value))
          })
        } else {
          setToastMsg(editId ? "闹钟已更新" : "闹钟已添加")
          setToastShown(true)
        }
      }
      skipDeleteCheck.setValue(true)
      alarms.setValue(loadSortedUserAlarms(currentSort.value, sortAsc.value, filterState.value))
    })
  }

  const handleAdd = () => presentEditor()
  const handleEdit = (id: string) => presentEditor(id)

  // 弹出筛选 Sheet
  const presentFilter = () => {
    Navigation.present({
      element: <AlarmFilterSheet initialFilter={filterState.value} />,
      modalPresentationStyle: "pageSheet",
    }).then((result: AlarmFilter | undefined) => {
      if (result) {
        filterState.setValue(result)
        // 筛选变化时跳过删除检测（只是视图过滤，不是真删除）
        skipDeleteCheck.setValue(true)
        const filtered = loadSortedUserAlarms(currentSort.value, sortAsc.value, result)
        alarms.setValue(filtered)
        // 显示筛选结果数量
        const total = loadSortedUserAlarms(currentSort.value, sortAsc.value).length
        if (hasActiveFilter(result)) {
          setToastMsg(filtered.length === total ? `筛选: 全部 ${total} 个闹钟` : `筛选: ${filtered.length} / ${total} 个闹钟`)
        } else {
          setToastMsg(`共 ${total} 个闹钟`)
        }
        setToastShown(true)
      }
    })
  }

  // 确认所有未确认时间点：取消重试提醒，标记已确认
  const handleConfirm = (alarm: AlarmItem) => {
    const today = new Date()
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    if (alarm.retryConfig?.confirmAll) {
      // 一次性确认全部时间点
      const unconfirmed = getUnconfirmedTimes(alarm, today)
      for (const t of unconfirmed) {
        confirmReminder(alarm.id, today, t.hour, t.minute)
      }
      cancelRetryAlarms(alarm).catch(() => {})
      setToastMsg(`已确认全部: ${alarm.title}`)
    } else {
      // 逐个确认：只确认已触发的时间点（当前时间之前或等于的时间点）
      const unconfirmed = getUnconfirmedTimes(alarm, today)
      const triggered = unconfirmed.filter(t => t.hour * 60 + t.minute <= currentMinutes)
      if (triggered.length === 0) {
        // 没有已触发的，确认最早的（容错）
        if (unconfirmed.length > 0) {
          const earliest = unconfirmed.reduce((a, b) => a.hour * 60 + a.minute < b.hour * 60 + b.minute ? a : b)
          confirmReminder(alarm.id, today, earliest.hour, earliest.minute)
          setToastMsg(`已确认 ${String(earliest.hour).padStart(2, "0")}:${String(earliest.minute).padStart(2, "0")}: ${alarm.title}`)
        }
      } else {
        for (const t of triggered) {
          confirmReminder(alarm.id, today, t.hour, t.minute)
        }
        const timesStr = triggered.map(t => `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`).join(", ")
        setToastMsg(`已确认 ${timesStr}: ${alarm.title}`)
      }
      cancelRetryAlarms(alarm).catch(() => {})
    }
    setToastShown(true)
    skipDeleteCheck.setValue(true)
    alarms.setValue(loadSortedUserAlarms(currentSort.value, sortAsc.value, filterState.value))
  }

  const handleUnconfirm = (alarm: AlarmItem) => {
    const today = new Date()
    unconfirmAllReminders(alarm.id, today)
    setToastMsg(`已取消确认: ${alarm.title}`)
    setToastShown(true)
    skipDeleteCheck.setValue(true)
    alarms.setValue(loadSortedUserAlarms(currentSort.value, sortAsc.value, filterState.value))
  }

  const handleToggle = (id: string, enabled: boolean) => {
    const alarm = alarms.value.find((a) => a.id === id)
    if (!alarm) return

    if (enabled) {
      // 启用：先立即更新本地状态，再异步创建系统闹钟
      updateAlarm(id, { enabled: true, alarmIds: [], retryAlarmIds: [] })
      skipDeleteCheck.setValue(true)
      alarms.setValue(loadSortedUserAlarms(currentSort.value, sortAsc.value, filterState.value))
      scheduleAlarm(alarm).then((result: ScheduleResult | null) => {
        if (result) {
          updateAlarm(id, { alarmIds: result.allAlarmIds, retryAlarmIds: result.retryIds })
          setToastMsg("闹钟已启用")
          setToastShown(true)
        } else {
          // 系统提醒创建失败，回滚启用状态
          updateAlarm(id, { enabled: false })
          setToastMsg("系统提醒创建失败，闹钟未启用")
          setToastShown(true)
        }
        skipDeleteCheck.setValue(true)
        alarms.setValue(loadSortedUserAlarms(currentSort.value, sortAsc.value, filterState.value))
      })
    } else {
      // 停用：先立即更新本地状态，再异步取消全部闹钟+重试
      const oldAlarm = loadAlarms().find(a => a.id === id) ?? alarm
      updateAlarm(id, { enabled: false, alarmIds: [], retryAlarmIds: [] })
      skipDeleteCheck.setValue(true)
      alarms.setValue(loadSortedUserAlarms(currentSort.value, sortAsc.value, filterState.value))
      setToastMsg("闹钟已停用")
      setToastShown(true)
      // 异步取消全部闹钟+重试（fire-and-forget）
      cancelAllAlarms(oldAlarm).catch(() => {})
    }
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="闹钟"
        toolbar={{
          topBarLeading: (
            <HStack spacing={0}>
              <Button title="" systemImage={editMode.value.isEditing ? "checkmark.circle" : "pencil.circle"} action={() => editMode.setValue(editMode.value.isEditing ? EditMode.inactive() : EditMode.active())} />
              <Button title="" systemImage="plus" action={handleAdd} />
            </HStack>
          ),
          topBarTrailing: (
            <HStack spacing={0}>
              <Button title="" systemImage={hasActiveFilter(filterState.value) ? "line.horizontal.3.decrease.circle.fill" : "line.horizontal.3.decrease.circle"} action={presentFilter} />
              <Menu title="" systemImage="arrow.up.arrow.down">
                {ALARM_SORT_OPTIONS.map(o =>
                  <Button key={o.key} title={o.key === currentSort.value ? `✓ ${o.label}` : o.label} action={() => applySort(o.key)} />
                )}
              </Menu>
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

      >
        <Section>
          <NextAlarmCard alarms={loadAlarms().filter(a => a.source !== "credit_card")} />
        </Section>

        {alarms.value.length === 0 ? (
          <Section>
            <ContentUnavailableView
              title="还没有闹钟"
              systemImage="alarm.fill"
              description="点击右上角 + 添加你的第一个闹钟"
            />
          </Section>
        ) : (
          <ForEach
            data={alarms}
            editActions="delete"
            builder={(alarm: AlarmItem) => (
              <AlarmRow
                key={alarm.id}
                alarm={alarm}
                groupTintColor={groupColorMap.value[alarm.groupName]}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onConfirm={handleConfirm}
                onUnconfirm={handleUnconfirm}
              />
            )}
          />
        )}
      </List>
    </NavigationStack>
  )
}
