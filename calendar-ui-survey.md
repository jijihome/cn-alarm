# 6 项目日历/网格/日期 UI 代码浏览报告

## 1. 工作日闹钟 ⭐⭐⭐（最精美日历网格）

**关键发现**：拥有完整的月历网格页面 `CalendarPage`，是6个项目中最精美的日历UI。

### 核心组件

#### MonthPickerPopover — 年月滚轮选择器
```tsx
function MonthPickerPopover(props: {
  year: number; month: number; currentYear: number
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
}) {
  const years = Array.from({ length: 21 }, (_, i) => props.currentYear - 10 + i)
  return (
    <VStack spacing={0} padding={10} frame={{ width: 260, height: 174 }}>
      <HStack spacing={8} frame={{ height: 160 }}>
        <Picker title="年份" value={props.year} onChanged={(v: number) => props.onYearChange(v)}
          pickerStyle="wheel" frame={{ width: 136, height: 154 }}>
          {years.map((y) => (
            <Text key={`year-${y}`} tag={y}>{`${y}年`}</Text>
          ))}
        </Picker>
        <Picker title="月份" value={props.month} onChanged={(v: number) => props.onMonthChange(v)}
          pickerStyle="wheel" frame={{ width: 96, height: 154 }}>
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1
            return <Text key={`month-${m}`} tag={m}>{`${m}月`}</Text>
          })}
        </Picker>
      </HStack>
    </VStack>
  )
}
```

#### CalendarPage — 月历网格（核心日历UI）
```tsx
// 月份导航栏
<Section>
  <HStack buttonStyle="plain">
    <Button action={handlePrevMonth}>
      <Image systemName="chevron.left" foregroundStyle="#007AFF" font="body" />
    </Button>
    <Spacer />
    <HStack spacing={8} buttonStyle="plain">
      <Button action={handleToday}>
        <Image systemName={`${today.getDate()}.calendar`} foregroundStyle="#007AFF" font="body" />
      </Button>
      <Button action={() => setShowMonthPicker(true)}
        popover={{
          isPresented: showMonthPicker, onChanged: (v) => setShowMonthPicker(v),
          content: monthPickerContent, arrowEdge: "top",
          presentationCompactAdaptation: "popover",
        }}>
        <Text font="headline">{`${year}年${month}月`}</Text>
      </Button>
      <Button action={handleRefresh}>
        <Image systemName={refreshing ? "arrow.triangle.2.circlepath.circle.fill" : "arrow.triangle.2.circlepath"}
          foregroundStyle="#007AFF" font="body" />
      </Button>
    </HStack>
    <Spacer />
    <Button action={handleNextMonth}>
      <Image systemName="chevron.right" foregroundStyle="#007AFF" font="body" />
    </Button>
  </HStack>
</Section>

// 星期标题行
<Section>
  <VStack spacing={8}>
    <HStack spacing={dayCellSpacing} padding={5}>
      {weekLabels.map((label, i) => (
        <Text key={`wh-${i}`} font="callout" fontWeight="semibold"
          foregroundStyle={i === 0 || i === 6 ? "#8E8E93" : "#3C3C43"}
          frame={{ width: dayCellSize }} multilineTextAlignment="center">
          {label}
        </Text>
      ))}
    </HStack>

    // 日历网格 — LazyVGrid 7列
    <LazyVGrid columns={gridColumns} alignment="center" spacing={dayCellSpacing} buttonStyle="plain">
    {cells.map((day, idx) => {
      if (day === null) {
        return <Text key={`e-${idx}`} frame={{ width: dayCellSize, height: dayCellSize }}>{" "}</Text>
      }
      const key = dateStr(year, month, day)
      const type = getDayType(key, props.subDays, props.overrides, props.restRule)
      const isToday = key === todayStr
      const holidayLabel = getHolidayLabel(key, props.subDays)
      const isRest = isRestDay(type)
      const isWorkdayOverride = type === "workday"
      const cardBackground: `#${string}` = isWorkdayOverride ? "#FF9500" : isRest ? "#34C759" : "#FFFFFF"
      const textColor: `#${string}` = isRest || isWorkdayOverride ? "#FFFFFF" : "#1C1C1E"
      const todayOutline = isToday ? (
        <RoundedRectangle cornerRadius={8}
          stroke={{ shapeStyle: "#007AFF", strokeStyle: { lineWidth: 2 } }} />
      ) : undefined

      return (
        <VStack key={`d-${idx}`} spacing={2}
          frame={{ width: dayCellSize, height: dayCellSize }}
          padding={{ horizontal: 2, vertical: 4 }}
          background={cardBackground}
          clipShape={{ type: "rect", cornerRadius: 8 }}
          contentShape={{ type: "rect", cornerRadius: 8 }}
          overlay={todayOutline}
          onTapGesture={() => handleTapDay(day)}>
          <Text font="callout" fontWeight={isToday ? "bold" : "regular"}
            foregroundStyle={isToday && !isRest && !isWorkdayOverride ? "#007AFF" : textColor}>
            {day.toString()}
          </Text>
          <Text font="caption2" fontWeight="semibold"
            foregroundStyle={isToday && !isRest && !isWorkdayOverride ? "#007AFF" : textColor}>
            {holidayLabel || " "}
          </Text>
        </VStack>
      )
    })}
    </LazyVGrid>
  </VStack>
</Section>
```

#### WeekdaySelector — 星期选择胶囊按钮
```tsx
function WeekdaySelector(props: { days: number[]; onChange: (days: number[]) => void }) {
  const labels = ["日", "一", "二", "三", "四", "五", "六"]
  return (
    <HStack spacing={8} buttonStyle="plain">
      {labels.map((label, index) => {
        const selected = props.days.includes(index)
        return (
          <Button key={`weekday-${index}-${selected ? "on" : "off"}`}
            action={() => props.onChange(
              selected ? props.days.filter((d) => d !== index) : [...props.days, index].sort((a, b) => a - b)
            )}>
            <Text font="body"
              foregroundStyle={selected ? "#FFFFFF" : "#1C1C1E"}
              frame={{ maxWidth: "infinity", minHeight: 40 }}
              background={selected ? "#34C759" : undefined}
              clipShape="capsule">
              {label}
            </Text>
          </Button>
        )
      })}
    </HStack>
  )
}
```

**设计亮点**：
- `LazyVGrid` 7列网格，每格 42×42，间距 8
- 三色状态：绿色=休息日、橙色=补班、白色=普通工作日
- 今天蓝色描边 `RoundedRectangle overlay`
- 点击日期三态循环：休息→上班→还原
- Popover 年月滚轮选择器
- 月份导航：左右箭头+今天按钮+刷新按钮
- 节假日名称小字标注

---

## 2. Daily Money ⭐（图表+列表，无日历网格）

**关键发现**：没有日历网格UI。日期展示用 `Section header` + `Chart/BarStackChart` 柱状图。

### 日期相关代码

#### date.ts — 纯工具函数
```tsx
export function isToday(time: number) { /* 比较年月日 */ }
export function isThisMonth(time: number) { /* 比较年月 */ }
export function getYYYYMM(time: number) { /* "2026/07" */ }
export function getYYYYMMDD(time: number) { /* "2026/07/23" */ }
export function getDateLabel(time: number) { /* "今天, 07/23" 或 "星期三, 07/23" */ }
export function getMonthLabel(month: number) { /* "一月"~"十二月" */ }
```

#### DateGroupView — 按日期分组的记录列表
```tsx
export function DateGroupView({ dateGroup }: { dateGroup: RecordsOfDate }) {
  return <Section header={
    <HStack>
      <Text>{getDateLabel(dateGroup.date.getTime())}</Text>
      <Spacer />
      <Text foregroundStyle="systemBlue">-{totalExpenses.toLocaleString()}</Text>
      <Text foregroundStyle="systemGreen">+{totleIncome.toLocaleString()}</Text>
    </HStack>
  }>
    {dateGroup.records.map((record) => ( /* 记录行 */ ))}
  </Section>
}
```

#### ThisMonthListView — 月度柱状图
```tsx
<Chart chartScrollableAxes="horizontal" chartXVisibleDomain={15}>
  <BarStackChart marks={
    chartDataExpensesList.map((total, index) => ({
      category: i18n.expenses, value: total, label: domainLabels[index]
    })).concat(chartDataIncomeList.map((total, index) => ({
      category: i18n.income, value: total, label: domainLabels[index]
    })))
  }/>
</Chart>
```

#### NewRecordPage — DatePicker（系统组件）
```tsx
<DatePicker title={i18n.time} value={time} onChanged={setTime}
  displayedComponents={["date", "hourAndMinute"]} />
```

**设计亮点**：
- `BarStackChart` 按日/月/年的收支柱状图（可横向滚动）
- 日期分组 Section header 带收支汇总
- 无自定义日历网格，日期选择用系统 DatePicker

---

## 3. Health Center ⭐（纯 Widget，无日历/网格UI）

**关键发现**：纯 Widget 项目（无交互页面），只有小组件渲染。无日历、无网格、无日期选择。

### 组件结构
- `small_widget.tsx` — 单指标圆形小组件
- `medium_widget.tsx` — HRV+心率双卡片横排
- `large_widget.tsx` — HRV+心率+活动三区大组件

#### MediumWidget — 双卡片横排布局
```tsx
<HStack spacing={12}>
  {/* HRV 卡片 */}
  <VStack padding={{ leading: 14, trailing: 14, top: 12, bottom: 12 }}
    background={{ color: "white", opacity: 0.28 }}
    clipShape={{ type: "rect", cornerRadius: 16 }} spacing={4}>
    <HStack spacing={8} alignment="center">
      <Image systemName="bolt.heart.fill" font={{ name: "system", size: 20 }} foregroundStyle="white" />
      <HStack spacing={4} alignment="firstTextBaseline">
        <Text font={{ name: "system", size: 28 }} fontWeight="bold" foregroundStyle="white">
          {hrvValue != null ? hrvValue.toFixed(0) : "—"}
        </Text>
        <Text font={{ name: "system", size: 13 }} foregroundStyle="white" opacity={0.95}>ms</Text>
      </HStack>
    </HStack>
  </VStack>
  {/* 心率卡片 — 同结构 */}
</HStack>
```

**设计亮点**：
- 渐变背景按压力等级变色（绿→青→橙→红）
- 半透明白色卡片 + 圆角
- 无日历/日期/网格相关UI

---

## 4. 比亚迪车机控制 ⭐⭐（精美图标宫格，非日历）

**关键发现**：有精美的 `LazyVGrid` 图标宫格选择器，但不是日历/日期相关。

### IconPicker — 图标宫格选择器
```tsx
// 宫格列定义 — 4列自适应
const gridColumns = Array.from({ length: 4 }, () => ({
  size: { type: "adaptive" as const, min: 110, max: 150 },
  spacing: 14,
}))

// 图标格子组件
function IconCell({ item, onTap }: { item: IconItem; onTap: () => void }) {
  return (
    <VStack alignment="center" spacing={4} frame={{ maxWidth: "infinity" as const }}>
      <Group contentShape="rect" onTapGesture={onTap}
        background={{ style: { light: "rgba(255,255,255,0.50)", dark: "rgba(255,255,255,0.10)" }, shape: iconBoxShape }}
        clipShape={iconBoxShape} overlay={iconBoxBorder}
        frame={{ maxWidth: "infinity" as const, alignment: "center" as const }} padding={0}>
        <Image systemName={item.name} frame={{ width: 52, height: 52 }}
          symbolRenderingMode="hierarchical" foregroundStyle="label" />
      </Group>
      <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}
        minScaleFactor={0.5} frame={{ maxWidth: "infinity" as const, alignment: "center" as const }}>
        {item.label}
      </Text>
    </VStack>
  )
}

// 分类标签
function CategoryTag({ title, icon, isActive, onTap }) {
  return (
    <Group contentShape="rect" onTapGesture={onTap}
      glassEffect={isActive ? undefined : rowGlass}
      clipShape={{ type: "rect", cornerRadius: tagRadius, style: "continuous" }}
      overlay={isActive ? undefined : tagBorder}
      background={isActive ? "accentColor" : undefined}
      padding={{ horizontal: 10, vertical: 5 }}>
      <HStack spacing={3}>
        <Image systemName={icon} frame={{ width: 13, height: 13 }}
          foregroundStyle={isActive ? "white" : "secondaryLabel"} />
        <Text font="caption2" foregroundStyle={isActive ? "white" : "label"}>{title}</Text>
      </HStack>
    </Group>
  )
}

// 主布局 — GlassList + Section + LazyVGrid
<Section key={cat.title} header={<Text font="headline" foregroundStyle="label">{cat.title}</Text>}>
  <Group {...sectionHeaderProps} padding={{ horizontal: 12 }}>
    <LazyVGrid columns={gridColumns} spacing={10}>
      {icons.map(item => <IconCell key={item.name} item={item} onTap={() => handleSelect(item.name)} />)}
    </LazyVGrid>
  </Group>
</Section>
```

**设计亮点**：
- 4列自适应 `LazyVGrid`（min:110, max:150）
- 毛玻璃风格 `GlassList` + `glassEffect`
- 半透明圆角方块 + 描边 overlay
- 分类标签胶囊（选中=accentColor，未选=毛玻璃+描边）
- searchable 搜索过滤
- **不是日历网格，但宫格布局模式可复用**

---

## 5. 今日飞机 - 糖心（无日历/网格UI）

**关键发现**：纯 Widget 项目，index.tsx 为空文件。只有转盘式 Widget。

### WheelView — 旋转转盘
```tsx
function WheelView({ list, status, result }: { list: string[]; status: boolean; result: number }) {
  const d = 360 / list.length
  return (
    <ZStack clockHandRotationEffect={status ? 1 : undefined}>
      <Circle fill={"secondarySystemBackground"} />
      {list.map((item, idx) => {
        const degree = (idx + ((list.length / 2) % 2 === 0 ? 0.5 : 0)) * d
        return (
          <>
            <Text foregroundStyle={"secondaryLabel"} offset={{ x: 0, y: 40 }}
              rotationEffect={(result + idx) * d} font={12} frame={{ width: 12 }}>{item}</Text>
            <VStack spacing={0}>
              <HStack><Divider rotationEffect={{ degrees: degree, anchor: "bottom" }} /></HStack>
              <Rectangle opacity={0} rotationEffect={degree} />
            </VStack>
          </>
        )
      })}
    </ZStack>
  )
}
```

**设计亮点**：
- `clockHandRotationEffect` 旋转动画
- `rotationEffect` 环形文字排列
- 无日历/日期/网格相关UI

---

## 6. Ai-health-assistant ⭐⭐（精美指标网格+玻璃材质）

**关键发现**：有精美的 `LazyVGrid` 健康指标网格和指标选择网格，iOS 26 玻璃材质风格。

### 今日指标网格 — 2列 LazyVGrid
```tsx
const metricColumns = [
  { size: { type: "flexible" as const }, spacing: 10 },
  { size: { type: "flexible" as const }, spacing: 10 }
]

// 主卡片内
<VStack spacing={14} alignment="leading" padding={18} frame={{ maxWidth: "infinity" }}
  glassEffect={glassCard}>
  <HStack>
    <Text font={17} fontWeight="bold" foregroundStyle={primaryText}>今日与最近测量</Text>
    <Spacer />
    <Text font={11} foregroundStyle={subtleText}>完整睡眠与身体指标</Text>
  </HStack>
  <LazyVGrid columns={metricColumns} spacing={14}>
    {[
      { icon: "figure.walk", color: "systemOrange", title: "步数", value: metricValue(stepsToday, "步") },
      { icon: "flame.fill", color: "systemPink", title: "活跃能量", value: metricValue(caloriesToday, "千卡") },
      { icon: "moon.fill", color: "systemIndigo", title: "昨晚睡眠", value: metricValue(sleepToday, "小时") },
      { icon: "heart.fill", color: "systemRed", title: "平均心率", value: metricValue(hrToday, "bpm") },
      { icon: "scalemass.fill", color: "systemGreen", title: "体重", value: metricValue(weightLatest, "kg") },
      },
      { icon: "figure.arms.open", color: "systemGreen", title: "体脂率", value: metricValue(bodyFatLatest, "%") },
      { icon: "waveform.path.ecg", color: "systemMint", title: "HRV", value: metricValue(hrvToday, "ms") },
      { icon: "figure.walk.motion", color: "systemOrange", title: "步行距离", value: metricValue(distanceToday, "公里") },
      { icon: "lungs.fill", color: "systemCyan", title: "血氧", value: metricValue(oxygenLatest, "%") },
      { icon: "heart.circle.fill", color: "systemRed", title: "静息心率", value: metricValue(restingHrLatest, "bpm") }
    ].map(item => (
      <HStack key={item.title} spacing={9} alignment="center">
        <Image systemName={item.icon} foregroundStyle={item.color as any} font={17} />
        <VStack spacing={2} alignment="leading">
          <Text font={11} foregroundStyle={supportingText}>{item.title}</Text>
          <Text font={15} fontWeight="semibold" foregroundStyle={primaryText}>{item.value}</Text>
        </VStack>
      </HStack>
    ))}
  </LazyVGrid>
</VStack>
```

### 指标选择网格 — LazyVGrid + 玻璃按钮
```tsx
<LazyVGrid columns={metricColumns} spacing={8}>
  {Object.entries(metricLabels).map(([key, meta]) => {
    const selected = Boolean(selectedMetrics[key])
    return <Button key={key} action={() => setSelectedMetrics(previous => ({ ...previous, [key]: !selected }))}
      disabled={loading} buttonStyle="plain">
      <HStack spacing={8} padding={{ vertical: 7, horizontal: 9 }} frame={{ maxWidth: "infinity" }}
        glassEffect={selected
          ? { glass: UIGlass.regular().interactive(false).tint("systemPink"), shape: { type: "rect", cornerRadius: 12 } }
          : { ...modalInsetGlass, shape: { type: "rect", cornerRadius: 12 } }}>
        <Image systemName={selected ? "checkmark.circle.fill" : meta.icon}
          foregroundStyle={selected ? "white" : meta.color as any} font={15} />
        <Text font={12} foregroundStyle={selected ? "white" : primaryText}>{meta.name}</Text>
        <Spacer />
      </HStack>
    </Button>
  })}
</LazyVGrid>
```

### 日期范围选择 — 按钮行
```tsx
<HStack spacing={7}>
  {dateRangeOptions.map(days => 
    <Button key={days} title={`${days} 天`} action={() => setDateRangeDays(days)}
      disabled={isBusy} buttonStyle={dateRangeDays === days ? "glassProminent" : "glass"}
      tint={dateRangeDays === days ? "systemPink" : undefined} />
  )}
</HStack>
```

### 玻璃材质定义
```tsx
const glassCard = {
  glass: UIGlass.regular().interactive(false).tint(isDark ? "rgba(42,45,57,0.62)" : "rgba(231,238,248,0.56)"),
  shape: { type: "rect", cornerRadius: 20 } as const
}
const glassSubtle = {
  glass: UIGlass.clear().interactive(false).tint(isDark ? "rgba(42,45,57,0.36)" : "rgba(237,242,250,0.34)"),
  shape: { type: "rect", cornerRadius: 18 } as const
}
const modalGlass = {
  glass: UIGlass.regular().interactive(false).tint(isDark ? "rgba(42,45,57,0.18)" : "rgba(237,242,250,0.18)"),
  shape: { type: "rect", cornerRadius: 28 } as const
}
```

**设计亮点**：
- iOS 26 `UIGlass` 玻璃材质（regular/clear 两级）
- 2列 flexible `LazyVGrid` 指标网格
- 指标选择用玻璃按钮（选中=pink tint，未选=clear glass）
- 日期范围用 `glassProminent`/`glass` 按钮行
- 深色/浅色自适应颜色体系
- **无日历网格，但玻璃材质+网格布局模式可复用**

---

## 总结对比

| 项目 | 日历网格 | 日期选择 | 网格布局 | 设计风格 | 可借鉴度 |
|------|---------|---------|---------|---------|---------|
| 工作日闹钟 | ✅ 完整月历 | ✅ Popover年月滚轮 | ✅ LazyVGrid 7列 | 三色状态+描边 | ⭐⭐⭐ 最高 |
| Daily Money | ❌ | ✅ 系统DatePicker | ❌ | Chart柱状图 | ⭐ 图表可参考 |
| Health Center | ❌ | ❌ | ❌ | 渐变Widget卡片 | ⭐ Widget风格 |
| 比亚迪车机控制 | ❌ | ❌ | ✅ LazyVGrid 4列图标宫格 | 毛玻璃+描边 | ⭐⭐ 宫格模式 |
| 今日飞机-糖心 | ❌ | ❌ | ❌ | 旋转转盘Widget | ⭐ 动画创意 |
| Ai-health-assistant | ❌ | ✅ 按钮行选天数 | ✅ LazyVGrid 2列指标 | iOS 26玻璃材质 | ⭐⭐ 玻璃风格 |

**对中国闹钟项目的借鉴价值**：
1. **工作日闹钟的 CalendarPage** — 最直接参考，LazyVGrid 7列+三色状态+Popover月份选择
2. **比亚迪 IconPicker** — 毛玻璃宫格+分类标签+搜索，可复用网格布局模式
3. **Ai-health-assistant** — iOS 26 `UIGlass` 玻璃材质+2列指标网格，可提升视觉质感
