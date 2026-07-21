// Settings.tsx - 设置页
import { useObservable, NavigationStack, List, Section, Text, Toggle, Picker, Button, NavigationLink, ForEach } from "scripting"
import { loadSettings, saveSettings } from "../lib/alarm-store"
import { loadHolidays, resetYearToDefault } from "../lib/holiday"
import { AppSettings, HolidayCalendar } from "../lib/constants"
import { HolidayEditor } from "./HolidayEditor"

export function Settings() {
  const settings = useObservable<AppSettings>(() => loadSettings())
  const holidays = useObservable<HolidayCalendar[]>(() => loadHolidays())

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
        <Section header={<Text>调休日历</Text>} footer={<Text>开启后，法定节假日当天的重复闹钟将自动跳过，调休补班日会补响</Text>}>
          <NavigationLink
            title="查看/编辑节假日安排"
            destination={<HolidayEditor />}
          />
          <Toggle
            title="节假日自动跳过闹钟"
            value={settings.value.holidayAutoSkip ? true : false}
            onChanged={(v: boolean) => updateSetting({ holidayAutoSkip: v })}
          />
          <Text foregroundStyle="secondaryLabel">
            {currentYear}年: {holidayCount}个节假日, {workdayCount}个补班日
          </Text>
        </Section>

        {/* 默认设置 */}
        <Section header={<Text>默认设置</Text>}>
          <Toggle
            title="新闹钟默认渐进唤醒"
            value={settings.value.defaultGradualWake ? true : false}
            onChanged={(v: boolean) => updateSetting({ defaultGradualWake: v })}
          />
          <Text foregroundStyle="secondaryLabel">
            默认提前提醒: {Math.floor(settings.value.defaultPreAlert / 60)}分钟
          </Text>
          <Text foregroundStyle="secondaryLabel">
            信用卡默认提前: {settings.value.defaultRemindDaysBefore}天
          </Text>
        </Section>

        {/* 数据管理 */}
        <Section header={<Text>数据管理</Text>}>
          <Button title="重置调休日历为默认值" action={handleResetHolidays} />
          <Text font={13} foregroundStyle="secondaryLabel">中国闹钟 v1.0.0</Text>
        </Section>
      </List>
    </NavigationStack>
  )
}
