// Settings.tsx - 设置页
import { useObservable, NavigationStack, List, Section, Text, Toggle, Stepper, Button, NavigationLink, HStack, Spacer } from "scripting"
import { loadSettings, saveSettings, loadGroups } from "../lib/alarm-store"
import { loadHolidays, resetYearToDefault } from "../lib/holiday"
import { AppSettings, HolidayCalendar } from "../lib/constants"
import { HolidayEditor } from "./HolidayEditor"
import { GroupManager } from "./GroupManager"

export function Settings() {
  const settings = useObservable<AppSettings>(() => loadSettings())
  const holidays = useObservable<HolidayCalendar[]>(() => loadHolidays())
  const groupCount = loadGroups().length

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

  return (
    <NavigationStack>
      <List navigationTitle="设置">
        {/* 调休日历 */}
        <Section header={<Text>调休日历</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">在闹钟的重复设置中选择调休动作（跳过/顺延），法定节假日当天自动处理</Text>}>
          <NavigationLink destination={<HolidayEditor />}>
            <HStack alignment="center">
              <Text>节假日安排</Text>
              <Spacer />
              <Text foregroundStyle="secondaryLabel">{holidayCount}假 {workdayCount}补</Text>
            </HStack>
          </NavigationLink>
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

        {/* 数据管理 */}
        <Section header={<Text>数据管理</Text>}>
          <NavigationLink destination={<GroupManager />}>
            <HStack alignment="center">
              <Text>闹钟分类</Text>
              <Spacer />
              <Text foregroundStyle="secondaryLabel">{groupCount} 个分类</Text>
            </HStack>
          </NavigationLink>
          <Text font={13} foregroundStyle="secondaryLabel">中国闹钟 v1.0.0</Text>
        </Section>
      </List>
    </NavigationStack>
  )
}
