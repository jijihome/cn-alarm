// index.tsx - 主入口
import { Script, Navigation, TabView, Tab, Text } from "scripting"
import { AlarmList } from "./pages/AlarmList"
import { CreditCardList } from "./pages/CreditCardList"
import { Settings } from "./pages/Settings"
import { initializeDefaults } from "./lib/alarm-store"

async function run() {
  // 初始化默认数据
  initializeDefaults()

  // AlarmList/CreditCardList 页面内部管理自己的添加/编辑流程（Navigation.present 模态）

  await Navigation.present(
    <TabView>
      <Tab title="闹钟" systemImage="alarm.fill">
        <AlarmList />
      </Tab>
      <Tab title="信用卡" systemImage="creditcard.fill">
        <CreditCardList />
      </Tab>
      <Tab title="设置" systemImage="gearshape.fill">
        <Settings />
      </Tab>
    </TabView>
  )
  Script.exit()
}

run()
