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
      </List>
    </NavigationStack>
  )
}
