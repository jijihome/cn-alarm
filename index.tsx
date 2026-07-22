// index.tsx - 主入口
import { Script, Navigation, TabView, Tab, useObservable } from "scripting"
import { AlarmList } from "./pages/AlarmList"
import { CreditCardList } from "./pages/CreditCardList"
import { SearchView } from "./pages/SearchView"
import { initializeDefaults, loadSettings } from "./lib/alarm-store"

function RootView() {
  // Tab 选择状态——各页面订阅它，切回来时重新加载数据
  const selection = useObservable<number>(0)

  return (
    <TabView
      selection={selection}
      tabViewSearchActivation="searchTabSelection"
    >
      <Tab title="闹钟" systemImage="alarm.fill" value={0}>
        <AlarmList selection={selection} />
      </Tab>
      <Tab title="信用卡" systemImage="creditcard.fill" value={1}>
        <CreditCardList selection={selection} />
      </Tab>
      <Tab
        title="搜索"
        systemImage="magnifyingglass"
        value={2}
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

// app 回前台时，释放保活请求（队列里可能还有其他脚本，真正停止取决于队列是否空）
Script.onResume(() => {
  BackgroundKeeper.stopKeepAlive()
})

async function run() {
  // 初始化默认数据
  initializeDefaults()

  await Navigation.present(<RootView />)
  Script.exit()
}

run()
