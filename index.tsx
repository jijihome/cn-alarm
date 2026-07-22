// index.tsx - 主入口
import { Script, Navigation, TabView, Tab, Text, useObservable } from "scripting"
import { AlarmList } from "./pages/AlarmList"
import { CreditCardList } from "./pages/CreditCardList"
import { Settings } from "./pages/Settings"
import { initializeDefaults } from "./lib/alarm-store"

function RootView() {
  // Tab 选择状态——各页面订阅它，切回来时重新加载数据
  const selection = useObservable<number>(0)

  return (
    <TabView selection={selection}>
      <Tab title="闹钟" systemImage="alarm.fill" value={0}>
        <AlarmList selection={selection} />
      </Tab>
      <Tab title="信用卡" systemImage="creditcard.fill" value={1}>
        <CreditCardList selection={selection} />
      </Tab>
      <Tab title="设置" systemImage="gearshape.fill" value={2}>
        <Settings selection={selection} />
      </Tab>
    </TabView>
  )
}

async function run() {
  // 初始化默认数据
  initializeDefaults()

  await Navigation.present(<RootView />)
  Script.exit()
}

run()
