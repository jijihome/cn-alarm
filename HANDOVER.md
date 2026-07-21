# 中国闹钟项目 — 交接文档

> 交接时间：2026-07-21
> 交接给：新代理会话

## 1. 项目概述

符合中国国情的个人闹钟管理程序，基于 Scripting app 的 iOS 26+ AlarmManager API。

**用户需求**（已通过头脑风暴确认）：
- 朝九晚五上班族自用
- 场景：上班/上学/放学/下班/培训班/信用卡管理闹钟
- 痛点：法定节假日/调休、不好分类管理、没有多种周期、没有中国农历
- 培训班：周六固定但法定节假日要顺延
- 信用卡：账单日+还款日提醒，自动计算跨月

## 2. 项目位置

```
脚本目录：/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripts/中国闹钟/
设计文档：/var/mobile/Containers/Shared/AppGroup/694F45C2-41B9-4F68-B720-0A0284ACA1E6/Documents/scripting-agent/workspace/default/alarm-design/
```

## 3. 当前状态

**编码已完成（Phase 1-5），TS 诊断零错误。**

### 已完成文件清单（17个）

```
中国闹钟/
├── script.json              ✅ 脚本描述
├── index.tsx                ✅ 主入口 TabView
├── lib/
│   ├── constants.ts         ✅ 常量+类型+默认调休数据+银行预设
│   ├── alarm-bridge.ts      ✅ Shell.run 桥接 ios-alarm skill
│   ├── alarm-store.ts       ✅ 闹钟 CRUD + Storage
│   ├── holiday.ts           ✅ 调休日历判断
│   ├── scheduler.ts         ✅ 7种调度引擎+倒计时+重复描述
│   ├── lunar.ts             ✅ 农历-公历转换
│   ├── solar-term.ts        ✅ 24节气计算
│   └── credit-card.ts       ✅ 信用卡还款日计算+闹钟生成
├── pages/
│   ├── AlarmList.tsx        ✅ 闹钟列表+下一闹钟卡片
│   ├── AddAlarm.tsx         ✅ 添加/编辑闹钟表单
│   ├── CreditCardList.tsx   ✅ 信用卡列表
│   ├── AddCreditCard.tsx    ✅ 添加/编辑信用卡
│   ├── Settings.tsx         ✅ 设置页
│   └── HolidayEditor.tsx    ✅ 调休日历查看
└── components/
    ├── AlarmRow.tsx         ✅ 闹钟列表行
    └── WeekdayPicker.tsx    ✅ 星期选择器
```

### 已实现功能
- ✅ 闹钟 CRUD（创建/编辑/删除/开关）
- ✅ 7种重复周期（一次性/每天/每周/每月/每年/农历/工作日）
- ✅ 智能调休联动（节假日跳过、补班日补响）
- ✅ 信用卡管理（账单日+还款日+宽限期+提前提醒）
- ✅ 农历支持（农历-公历转换）
- ✅ 24节气计算
- ✅ 渐进唤醒（preAlert）
- ✅ 分组管理（6个默认分组）
- ✅ 调休日历查看/重置
- ✅ 全局设置

## 4. 设计文档

位于 `alarm-design/` 目录：
- `01-设计规格.md` — 项目定位、痛点、功能清单、架构方案
- `02-数据模型与调度.md` — RepeatRule模型、所有数据结构、调度逻辑
- `03-实现计划-Phase1基础骨架.md` — Task 1-4
- `04-实现计划-Phase2调度引擎.md` — Task 5-8
- `05-实现计划-Phase3-UI页面.md` — Task 9-11
- `06-实现计划-Phase4-5信用卡与高级功能.md` — Task 12-18

## 5. 已知未完成/待改进项

### ⚠️ 功能层面
1. **AlarmList 的添加/编辑入口未接通** — index.tsx 中 `onEditAlarm` 是空函数，需要接入 NavigationLink 跳转 AddAlarm 页面
2. **CreditCardList 的添加/编辑入口未接通** — 同上，`onAddCard`/`onEditCard` 是空函数
3. **AddAlarm 的 Stepper 控件缺失** — interval/dayOfMonth/lunarMonth 等数值调整目前只显示 Text，没有实际的 Stepper 控件（因为 Stepper API 只有 onIncrement/onDecrement）
4. **删除确认对话框** — AlarmList 的左滑删除和 AddCreditCard 的删除用的是简化 alert，应该用 confirmationDialog
5. **ForEach 的 data 需要 {id:string}** — AlarmList 和 CreditCardList 中 ForEach 的 data 需要确保 items 有 id 属性（AlarmItem 有 id，CreditCard 也有 id，但 Observable 类型可能需要 as any）

### ⚠️ 运行时潜在问题
1. **Shell.run 桥接未实际测试** — alarm-bridge.ts 的 scheduleAlarm/cancelAlarm 还没有在真机上跑过
2. **AlarmManager 可能不可用** — 需要检测 AlarmManager.isAvailable，当前代码没有做这个检查
3. **农历数据表只覆盖 2020-2030** — 超出范围会报错
4. **节气公式精度** — 寿星公式可能有 ±1天偏差，特殊年份未修正

### ⚠️ UI 层面
1. **TabView 页面间导航** — 添加闹钟应该从 AlarmList 的 NavigationLink 进入，而不是单独 Tab。当前 index.tsx 的 Tab 结构需要调整
2. **AlarmRow 缺少 NavigationLink** — 点击行应该跳转编辑页，当前 NavigationLink destination 是 null
3. **ColorPicker** — AddAlarm 的颜色选择用的是 Picker+文字，可以改用 ColorPicker 组件更直观

## 6. 关键技术决策

1. **用 countdown 替代 alarm** — Configuration.alarm() 被 AlarmKit 拒绝，用 Configuration.countdown + schedule
2. **Shell.run 桥接** — UI 脚本通过 Shell.run 调 ios-alarm skill
3. **双层数据** — Storage 存业务元数据，AlarmManager 存运行时闹钟，通过 alarmId 关联
4. **weekly + holidayAware** — 用 AlarmManager weekly schedule + App启动时调休预告补丁
5. **monthly/yearly/lunar** — 无法用 weekly，改为滚动创建一次性 fixed 闹钟

## 7. 关键 API 注意事项（已记录到 workspace memory）

- Picker 无 `Picker.Item`，用 children 放 Text
- Stepper 无 value/onChanged，只有 onIncrement/onDecrement
- TextField 无 placeholder，用 prompt
- foregroundStyle 用 "secondaryLabel" 不是 "secondary"
- fill/tintColor 传字符串需 as any
- alert() 是全局函数
- DatePicker value 是 Observable<Date> 或 timestamp(number)
- ForEach data 需要 {id: string}[]

## 8. 下一步建议

1. **先在 Scripting app 中运行** — 点击「中国闹钟」图标，看 UI 是否正常显示
2. **接通添加/编辑入口** — 在 AlarmList 中加 NavigationLink 跳转 AddAlarm
3. **测试 Shell.run 桥接** — 创建一个测试闹钟，确认 scheduleAlarm 能调通 ios-alarm skill
4. **补全 Stepper 控件** — AddAlarm 中的数值调整需要实际可交互的 Stepper
5. **添加 AlarmManager 可用性检查** — 在 index.tsx 启动时检测
