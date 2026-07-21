// AlarmList.tsx - 闹钟列表页
import { useState, useObservable, NavigationStack, List, Section, Text, Button, EditButton, ContentUnavailableView, VStack, Navigation, ForEach } from "scripting"
import { AlarmItem } from "../lib/constants"
import { loadAlarms, updateAlarm, removeAlarm } from "../lib/alarm-store"
import { getNextAlarmFromList, formatCountdown, formatRepeatDescription } from "../lib/scheduler"
import { scheduleAlarm, cancelAlarm } from "../lib/alarm-bridge"
import { AlarmRow } from "../components/AlarmRow"
import { AddAlarm } from "./AddAlarm"

declare function alert(options: { title?: string; message: string }): Promise<void>

interface GroupedAlarms {
  groupName: string
  alarms: AlarmItem[]
}

function groupAlarms(alarms: AlarmItem[]): GroupedAlarms[] {
  const groups: Record<string, AlarmItem[]> = {}
  for (const a of alarms) {
    const g = a.groupName || "未分组"
    if (!groups[g]) groups[g] = []
    groups[g].push(a)
  }
  return Object.entries(groups).map(([groupName, alarms]) => ({ groupName, alarms }))
}

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
  const [refreshKey, setRefreshKey] = useState(0)
  // 删除确认对话框：待删除的 alarm id（null=不显示）
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const refresh = () => {
    alarms.setValue(loadAlarms())
    setRefreshKey((k) => k + 1)
  }

  // 弹出添加/编辑闹钟模态页，关闭后刷新列表
  const presentEditor = async (editId?: string) => {
    await Navigation.present({
      element: <AddAlarm editId={editId} />,
      modalPresentationStyle: "fullScreen",
    })
    refresh()
  }

  const handleAdd = () => presentEditor()
  const handleEdit = (id: string) => presentEditor(id)

  const handleToggle = async (id: string, enabled: boolean) => {
    const alarm = alarms.value.find((a) => a.id === id)
    if (!alarm) return

    if (enabled) {
      // 启用：创建系统闹钟
      const alarmId = await scheduleAlarm(alarm)
      if (alarmId) {
        updateAlarm(id, { enabled: true, alarmIds: [...alarm.alarmIds, alarmId] })
      } else {
        // 创建失败：提示用户（可能是 iOS < 26 或 AlarmManager 不可用）
        await alert({ title: "无法启用闹钟", message: "系统闹钟创建失败。请确认设备为 iOS 26+ 且已授权闹钟权限。" })
      }
    } else {
      // 停用：取消所有系统闹钟
      for (const aid of alarm.alarmIds) {
        await cancelAlarm(aid)
      }
      updateAlarm(id, { enabled: false, alarmIds: [] })
    }

    refresh()
  }

  // 左滑删除：先弹确认框
  const requestDelete = (id: string) => {
    setDeleteTargetId(id)
  }

  const confirmDelete = async () => {
    const id = deleteTargetId
    setDeleteTargetId(null)
    if (!id) return
    const alarm = alarms.value.find((a) => a.id === id)
    if (alarm) {
      // 取消所有系统闹钟
      for (const aid of alarm.alarmIds) {
        await cancelAlarm(aid)
      }
    }
    removeAlarm(id)
    refresh()
  }

  const grouped = groupAlarms(alarms.value)
  // 待删除的 alarm 对象（用于确认框显示信息）
  const deleteTarget = deleteTargetId ? alarms.value.find((a) => a.id === deleteTargetId) : null

  return (
    <NavigationStack>
      <List
        navigationTitle="闹钟"
        key={refreshKey}
        toolbar={{
          topBarLeading: <EditButton />,
          topBarTrailing: <Button title="添加" systemImage="plus" action={handleAdd} />,
        }}
        confirmationDialog={{
          title: "删除闹钟",
          titleVisibility: "visible",
          message: deleteTarget ? (
            <Text>确定删除「{deleteTarget.title}」吗？</Text>
          ) : <Text>确定删除吗？</Text>,
          isPresented: deleteTargetId !== null,
          onChanged: (v) => { if (!v) setDeleteTargetId(null) },
          actions: (
            <>
              <Button title="删除" role="destructive" action={confirmDelete} />
              <Button title="取消" role="cancel" action={() => setDeleteTargetId(null)} />
            </>
          ),
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
          grouped.map((group) => (
            <Section key={group.groupName} header={<Text>{group.groupName}</Text>}>
              {/* 用 deprecated ForEach 形式以支持 onDelete 左滑删除 */}
              <ForEach
                count={group.alarms.length}
                itemBuilder={(index) => {
                  const alarm = group.alarms[index]
                  return (
                    <AlarmRow
                      key={alarm.id}
                      alarm={alarm}
                      onToggle={handleToggle}
                      onEdit={handleEdit}
                    />
                  )
                }}
                onDelete={(indices) => {
                  // indices 是相对当前 group 的索引
                  const target = indices[0]
                  if (target !== undefined && group.alarms[target]) {
                    requestDelete(group.alarms[target].id)
                  }
                }}
              />
            </Section>
          ))
        )}
      </List>
    </NavigationStack>
  )
}
