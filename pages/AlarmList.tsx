// AlarmList.tsx - 闹钟列表页
import { useState, useObservable, NavigationStack, List, Section, Text, Button, EditButton, ContentUnavailableView, VStack, Navigation, ForEach, useEffect } from "scripting"
import { AlarmItem } from "../lib/constants"
import { loadAlarms, saveAlarms, updateAlarm } from "../lib/alarm-store"
import { getNextAlarmFromList, formatCountdown, formatRepeatDescription } from "../lib/scheduler"
import { scheduleAlarm, cancelAlarm } from "../lib/alarm-bridge"
import { AlarmRow } from "../components/AlarmRow"
import { AddAlarm } from "./AddAlarm"

function NextAlarmCard({ alarms }: { alarms: AlarmItem[] }) {
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
  const timeStr = `${String(next.alarm.hour).padStart(2, "0")}:${String(next.alarm.minute).padStart(2, "0")}`

  return (
    <VStack alignment="leading" spacing={4}>
      <Text font={13} foregroundStyle="secondaryLabel">下一个闹钟</Text>
      <Text font={28} fontWeight="bold" foregroundStyle="label">{countdown}</Text>
      <Text font={14} foregroundStyle="secondaryLabel">
        {next.alarm.title} · {timeStr} · {formatRepeatDescription(next.alarm.repeat)}
      </Text>
    </VStack>
  )
}

export function AlarmList() {
  const alarms = useObservable<AlarmItem[]>(() => loadAlarms())
  // toast 状态
  const [toastMsg, setToastMsg] = useState("")
  const [toastShown, setToastShown] = useState(false)

  // 同步 alarms Observable → Storage（swipe 删除后自动触发）
  const prevAlarmIdsRef = useObservable<string[]>(() => alarms.value.map(a => a.id))
  useEffect(() => {
    const currentIds = new Set(alarms.value.map(a => a.id))
    const prevIds = prevAlarmIdsRef.value
    // 找出被删除的 id
    const deletedIds = prevIds.filter(id => !currentIds.has(id))
    if (deletedIds.length > 0) {
      // 取消被删闹钟的系统提醒（从 storage 读旧数据取 alarmIds）
      const oldAlarms = loadAlarms()
      for (const delId of deletedIds) {
        const oldAlarm = oldAlarms.find(a => a.id === delId)
        if (oldAlarm) {
          for (const aid of oldAlarm.alarmIds) {
            cancelAlarm(aid)
          }
        }
      }
      // 同步到 storage
      saveAlarms(alarms.value)
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
      modalPresentationStyle: "fullScreen",
    }).then((result: any) => {
      // 只有真正保存才处理调度和 toast
      if (result?.saved && result?.alarmId) {
        const alarm = loadAlarms().find(a => a.id === result.alarmId)
        if (alarm && alarm.enabled) {
          // 先取消旧的系统闹钟（编辑场景）
          if (alarm.alarmIds.length > 0) {
            Promise.all(alarm.alarmIds.map((aid: string) => cancelAlarm(aid))).catch(() => {})
          }
          // 重新调度系统闹钟
          scheduleAlarm(alarm).then((newAlarmId: string | null) => {
            if (newAlarmId) {
              updateAlarm(alarm.id, { alarmIds: [newAlarmId] })
              setToastMsg(editId ? "闹钟已更新并调度" : "闹钟已添加并调度")
            } else {
              setToastMsg("闹钟已保存，但系统调度失败")
            }
            setToastShown(true)
            alarms.setValue(loadAlarms())
          })
        } else {
          setToastMsg(editId ? "闹钟已更新" : "闹钟已添加")
          setToastShown(true)
        }
      }
      alarms.setValue(loadAlarms())
    })
  }

  const handleAdd = () => presentEditor()
  const handleEdit = (id: string) => presentEditor(id)

  const handleToggle = (id: string, enabled: boolean) => {
    const alarm = alarms.value.find((a) => a.id === id)
    if (!alarm) return

    if (enabled) {
      // 启用：先立即更新本地状态，再异步创建系统闹钟
      updateAlarm(id, { enabled: true, alarmIds: [] })
      alarms.setValue(loadAlarms())
      scheduleAlarm(alarm).then((alarmId: string | null) => {
        if (alarmId) {
          updateAlarm(id, { alarmIds: [alarmId] })
          setToastMsg("闹钟已启用")
          setToastShown(true)
        } else {
          // 系统提醒创建失败，回滚启用状态
          updateAlarm(id, { enabled: false })
          setToastMsg("系统提醒创建失败，闹钟未启用")
          setToastShown(true)
        }
        alarms.setValue(loadAlarms())
      })
    } else {
      // 停用：先立即更新本地状态，再异步取消系统闹钟
      const oldAlarmIds = [...alarm.alarmIds]
      updateAlarm(id, { enabled: false, alarmIds: [] })
      alarms.setValue(loadAlarms())
      setToastMsg("闹钟已停用")
      setToastShown(true)
      // 异步取消系统闹钟（fire-and-forget，失败不影响本地状态）
      Promise.all(oldAlarmIds.map((aid: string) => cancelAlarm(aid))).catch(() => {})
    }
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="闹钟"
        toolbar={{
          topBarLeading: <EditButton />,
          topBarTrailing: <Button title="添加" systemImage="plus" action={handleAdd} />,
        }}
        toast={{
          message: toastMsg,
          isPresented: toastShown,
          onChanged: setToastShown,
        }}
      >
        <Section>
          <NextAlarmCard alarms={alarms.value} />
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
                onToggle={handleToggle}
                onEdit={handleEdit}
              />
            )}
          />
        )}
      </List>
    </NavigationStack>
  )
}
