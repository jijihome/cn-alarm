// Settings.tsx - 设置页
import { useObservable, NavigationStack, List, Section, Text, Toggle, Picker, Button, NavigationLink, HStack, Spacer } from "scripting"
import { loadSettings, saveSettings, loadGroups } from "../lib/alarm-store"
import { loadHolidays, resetYearToDefault } from "../lib/holiday"
import { AppSettings, HolidayCalendar } from "../lib/constants"
import { HolidayEditor } from "./HolidayEditor"
import { GroupManager } from "./GroupManager"

const PRE_ALERT_OPTIONS = [300, 600, 900, 1800]
const PRE_ALERT_LABELS = ["5分钟", "10分钟", "15分钟", "30分钟"]
const REMIND_BEFORE_OPTIONS = [1, 2, 3, 5, 7]
const REMIND_BEFORE_LABELS = ["1天", "2天", "3天", "5天", "7天"]

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
        <Section header={<Text>调休日历</Text>} footer={<Text>在闹钟的重复设置中选择调休动作（跳过/顺延），法定节假日当天自动处理</Text>}>
          <NavigationLink destination={<HolidayEditor />}>
            <HStack alignment="center">
              <Text>节假日安排</Text>
              <Spacer />
              <Text foregroundStyle="secondaryLabel">{holidayCount}假 {workdayCount}补</Text>
            </HStack>
          </NavigationLink>
        </Section>

        {/* 默认设置 */}
        <Section header={<Text>默认设置</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">渐进唤醒：在正式响铃前先发轻提醒，逐步唤醒，避免被突然的大音量吓醒</Text>}>
          <Toggle
            title="新闹钟默认渐进唤醒"
            value={settings.value.defaultGradualWake ? true : false}
            onChanged={(v: boolean) => updateSetting({ defaultGradualWake: v })}
          />
          <Picker
            title="默认提前提醒"
            value={(() => {
              const idx = PRE_ALERT_OPTIONS.indexOf(settings.value.defaultPreAlert)
              return idx >= 0 ? idx : 0
            })()}
            onChanged={(idx: number) => updateSetting({ defaultPreAlert: PRE_ALERT_OPTIONS[idx] })}
          >
            {PRE_ALERT_LABELS.map((label, idx) => <Text key={label} tag={idx}>{label}</Text>)}
          </Picker>
          <Picker
            title="信用卡默认提前"
            value={(() => {
              const idx = REMIND_BEFORE_OPTIONS.indexOf(settings.value.defaultRemindDaysBefore)
              return idx >= 0 ? idx : 0
            })()}
            onChanged={(idx: number) => updateSetting({ defaultRemindDaysBefore: REMIND_BEFORE_OPTIONS[idx] })}
          >
            {REMIND_BEFORE_LABELS.map((label, idx) => <Text key={label} tag={idx}>{label}</Text>)}
          </Picker>
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
          <Button title="重置调休日历为默认值" action={handleResetHolidays} />
          <Text font={13} foregroundStyle="secondaryLabel">中国闹钟 v1.0.0</Text>
        </Section>
      </List>
    </NavigationStack>
  )
}
