// HelpPage.tsx - 使用说明
import { NavigationStack, List, Section, Text, Button, Navigation } from "scripting"

export function HelpPage() {
  const dismiss = Navigation.useDismiss()

  return (
    <NavigationStack>
      <List navigationTitle="使用说明" toolbar={{
        topBarTrailing: <Button title="关闭" systemImage="xmark" action={() => dismiss()} />,
      }}>
        <Section header={<Text>闹钟</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">闹钟由 iOS 系统调度，关闭 App 或重启手机后仍会按时响铃。</Text>}>
          <Text font={15}>在「闹钟」页面点右上角 + 新建闹钟。设置时间、重复方式（每天/每周/每月/每年/农历等），保存后自动注册到系统。</Text>
          <Text font={15}>闹钟开关关闭后再打开，会重新注册到系统。App 每次打开时会自动检查并修复丢失的闹钟。</Text>
        </Section>

        <Section header={<Text>调休联动</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">调休日历需逐年更新，在设置→节假日安排中查看。</Text>}>
          <Text font={15}>在闹钟的重复设置中选择调休动作：</Text>
          <Text font={15} foregroundStyle="secondaryLabel">• 跳过：节假日当天不响，补班日额外响</Text>
          <Text font={15} foregroundStyle="secondaryLabel">• 顺延：节假日当天顺延到下一个非节假日</Text>
          <Text font={15} foregroundStyle="secondaryLabel">• 无：不查调休，按计划执行</Text>
        </Section>

        <Section header={<Text>渐进唤醒</Text>} footer={<Text font="footnote" foregroundStyle="systemGray">渐进唤醒通过本地通知实现，同样由系统调度，无需保持 App 运行。</Text>}>
          <Text font={15}>开启后，在正式闹钟响铃前会先收到一条轻提醒通知，逐步唤醒避免被突然吓醒。提前时间在设置→默认设置中调整。</Text>
        </Section>

        <Section header={<Text>后台保活</Text>}>
          <Text font={15}>后台保活仅影响「今日」页面的倒计时卡片刷新。闹钟和通知由 iOS 系统调度，与后台保活无关，关闭也不影响响铃。</Text>
        </Section>

        <Section header={<Text>信用卡提醒</Text>}>
          <Text font={15}>在「信用卡」页面添加信用卡信息，设置账单日和还款日。程序会自动创建还款提醒闹钟，支持多次提醒和未确认重试。</Text>
        </Section>
      </List>
    </NavigationStack>
  )
}
