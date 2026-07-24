// Settings.tsx - 设置页（模态弹出）
import { useObservable, NavigationStack, List, Section, Text, Toggle, Stepper, Button, HStack, Spacer, Navigation, useEffect } from "scripting"
import { loadSettings, saveSettings, loadGroups } from "../lib/alarm-store"
import { loadHolidays, resetYearToDefault } from "../lib/holiday"
import { AppSettings, HolidayCalendar } from "../lib/constants"
import { HolidayEditor } from "./HolidayEditor"
import { GroupManager } from "./GroupManager"
import { HelpPage } from "./HelpPage"

export function Settings() {
  const dismiss = Navigation.useDismiss()
  const settings = useObservable<AppSettings>(() => loadSettings())
  const holidays = useObservable<HolidayCalendar[]>(() => loadHolidays())
  const groupCount = useObservable<number>(() => loadGroups().length)

  // 每次页面出现时刷新（push 回来后 useEffect 重新执行）
  useEffect(() => {
    settings.setValue(loadSettings())
    holidays.setValue(loadHolidays())
    groupCount.setValue(loadGroups().length)
  }, [])

  const updateSetting = (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings.value, ...updates }
    saveSettings(newSettings)
    settings.setValue(newSettings)
  }

  const currentYear = new Date().getFullYear()
  const currentYearCal = holidays.value.find((c) => c.year === currentYear)
  const holidayCount = currentYearCal?.holidays.length ?? 0
  const workdayCount = currentYearCal?.workdays.length ?? 0

  const handleResetHolidays = () => {
    resetYearToDefault(currentYear)
    holidays.setValue(loadHolidays())
  }

  // 导航到子页面，返回后刷新数据
  const presentPage = (element: JSX.Element) => {
    Navigation.present({ element, modalPresentationStyle: "pageSheet" }).then(() => {
      holidays.setValue(loadHolidays())
      groupCount.setValue(loadGroups().length)
    })
  }

  return (
    <NavigationStack>
      <List navigationTitle="设置" toolbar={{
        topBarTrailing: <Button title="关闭" systemImage="xmark" action={() => dismiss()} />,
      }}>
        {/* 使用说明 */}
      <Section>
        <Button action={() => presentPage(<HelpPage />)}>
          <HStack alignment="center">
            <Text>使用说明</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">ⓘ</Text>
          </HStack>
        </Button>
      </Section>

      {/* 调休日历 */}
      <Section header={<Text>调休日历</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">在闹钟的重复设置中选择调休动作（跳过/顺延），法定节假日当天自动处理</Text>}>
        <Button action={() => presentPage(<HolidayEditor />)}>
          <HStack alignment="center">
            <Text>节假日安排</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">{holidayCount}假 {workdayCount}补</Text>
          </HStack>
        </Button>
        <Button title="重置为默认值" action={handleResetHolidays} />
      </Section>

      {/* 默认设置 */}
      <Section header={<Text>默认设置</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">渐进唤醒：在正式响铃前先发轻提醒，逐步唤醒，避免被突然的大音量吓醒</Text>}>
        <Toggle
          title="新闹钟默认渐进唤醒"
          value={settings.value.defaultGradualWake ? true : false}
          onChanged={(v: boolean) => updateSetting({ defaultGradualWake: v })}
        />
        <Stepper
          onIncrement={() => updateSetting({ defaultPreAlert: settings.value.defaultPreAlert + 60 })}
          onDecrement={() => updateSetting({ defaultPreAlert: Math.max(60, settings.value.defaultPreAlert - 60) })}
        >
          <Text>轻提醒提前 {Math.floor(settings.value.defaultPreAlert / 60)} 分钟</Text>
        </Stepper>
        <Stepper
          onIncrement={() => updateSetting({ defaultRemindDaysBefore: settings.value.defaultRemindDaysBefore + 1 })}
          onDecrement={() => updateSetting({ defaultRemindDaysBefore: Math.max(1, settings.value.defaultRemindDaysBefore - 1) })}
        >
          <Text>提前 {settings.value.defaultRemindDaysBefore} 天</Text>
        </Stepper>
      </Section>

      {/* 后台保活 */}
      <Section
        header={<Text>后台保活</Text>}
        footer={
          <Text font="footnote" foregroundStyle="systemGray">
            {"仅影响「今日」页面的倒计时卡片刷新。闹钟和通知由 iOS 系统调度，与后台保活无关，关闭也不影响响铃。开启后 App 切后台时保持运行，倒计时实时刷新；回前台自动停止。持续后台运行会增加耗电。"}
          </Text>
        }
      >
        <Toggle
          title="后台保活"
          value={settings.value.backgroundKeepAlive ? true : false}
          onChanged={(v: boolean) => updateSetting({ backgroundKeepAlive: v })}
        />
      </Section>

      {/* 数据管理 */}
      <Section header={<Text>数据管理</Text>}>
        <Button action={() => presentPage(<GroupManager />)}>
          <HStack alignment="center">
            <Text>闹钟分类</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">{groupCount.value} 个分类</Text>
          </HStack>
        </Button>
        <Text font={15} foregroundStyle="secondaryLabel">中国闹钟 v1.0.0</Text>
      </Section>
    </List>
    </NavigationStack>
  )
}
