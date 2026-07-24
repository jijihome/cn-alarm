// HolidayEditor.tsx - 调休日历编辑页
import { useObservable, NavigationStack, List, Section, Text, Button, HStack } from "scripting"
import { HolidayCalendar } from "../lib/constants"
import { loadHolidays, resetYearToDefault } from "../lib/holiday"

export function HolidayEditor() {
  const currentYear = new Date().getFullYear()
  const holidays = useObservable<HolidayCalendar[]>(() => loadHolidays())
  const yearCal = holidays.value.find((c) => c.year === currentYear)

  if (!yearCal) {
    return (
      <NavigationStack>
        <List navigationTitle="调休日历">
          <Section>
            <Text foregroundStyle="secondaryLabel">{currentYear}年无调休数据</Text>
          </Section>
        </List>
      </NavigationStack>
    )
  }

  const handleReset = () => {
    resetYearToDefault(currentYear)
    holidays.setValue(loadHolidays())
  }

  const isNetwork = yearCal.source === "network"
  const syncTime = yearCal.syncedAt
    ? new Date(yearCal.syncedAt).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null
  const sourceLabel = isNetwork && syncTime
    ? `数据来源：联网同步 · ${syncTime}`
    : "数据来源：内置默认"

  return (
    <NavigationStack>
      <List
        navigationTitle={`${currentYear}年调休`}
        toolbar={{
          topBarTrailing: <Button title="重置" action={handleReset} />,
        }}
      >
        <Section header={<Text>法定节假日 ({yearCal.holidays.length}天)</Text>}>
          {yearCal.holidays.map((h, idx) => (
            <HStack key={`h-${idx}`}>
              <Text font={14} foregroundStyle="secondaryLabel">{h.date}</Text>
              <Text font={16}>{h.name}</Text>
            </HStack>
          ))}
        </Section>

        <Section header={<Text>调休补班日 ({yearCal.workdays.length}天)</Text>}>
          {yearCal.workdays.map((w, idx) => (
            <HStack key={`w-${idx}`}>
              <Text font={14} foregroundStyle="secondaryLabel">{w.date}</Text>
              <Text font={16}>{w.name}</Text>
            </HStack>
          ))}
        </Section>

        <Section footer={<Text font="footnote" foregroundStyle="systemGray">{sourceLabel}</Text>}>
        </Section>
      </List>
    </NavigationStack>
  )
}