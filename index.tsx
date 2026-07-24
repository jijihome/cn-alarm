// index.tsx - 主入口
import { Script, Navigation, TabView, Tab, useObservable } from "scripting"
import { TodayAlarms } from "./pages/TodayAlarms"
import { AlarmList } from "./pages/AlarmList"
import { CreditCardList } from "./pages/CreditCardList"
import { SearchView } from "./pages/SearchView"
import { initializeDefaults, loadSettings } from "./lib/alarm-store"
import { syncOnColdStart, syncOnResume } from "./lib/alarm-sync"

function RootView() {
  // Tab 选择状态——各页面订阅它，切回来时重新加载数据
  const selection = useObservable<number>(0)

  return (
    <TabView
      selection={selection}
      tabViewSearchActivation="searchTabSelection"
    >
      <Tab title="今日" systemImage="bell.badge.fill" value={0}>
        <TodayAlarms selection={selection} />
      </Tab>
      <Tab title="闹钟" systemImage="alarm.fill" value={1}>
        <AlarmList selection={selection} />
      </Tab>
      <Tab title="信用卡" systemImage="creditcard.fill" value={2}>
        <CreditCardList selection={selection} />
      </Tab>
      <Tab
        title="搜索"
        systemImage="magnifyingglass"
        value={3}
        role="search"
      >
        <SearchView />
      </Tab>
    </TabView>
  )
}

// 后台保活生命周期管理
// app 切后台时，若用户开启了 backgroundKeepAlive，请求 keepAlive
Script.onMinimize(() => {
  const settings = loadSettings()
  if (settings.backgroundKeepAlive) {
    BackgroundKeeper.keepAlive().then((ok) => {
      if (!ok) console.log("[BackgroundKeeper] keepAlive 被系统拒绝")
    })
  }
})

// app 回前台时：释放保活请求 + 一致性检查（带 5 分钟节流）
Script.onResume(() => {
  BackgroundKeeper.stopKeepAlive()
  // fire-and-forget：检查 Storage 闹钟是否在系统中存在，丢失的自动重新调度
  syncOnResume().catch(() => {})
})

async function run() {
  // 初始化默认数据
  initializeDefaults()

  await Navigation.present(<RootView />)

  // UI 已呈现后，异步检查 Storage 闹钟与系统 AlarmManager 的一致性
  // 发现 enabled=true 但 alarmIds 在系统中不存在的闹钟 → 自动重新调度
  // fire-and-forget：不阻塞 UI，下次 reload 会反映修复结果
  syncOnColdStart().catch(() => {})

  Script.exit()
}

run()
