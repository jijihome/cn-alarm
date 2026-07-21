// constants.ts - 常量与默认值

// ==================== Storage Keys ====================
export const STORAGE_KEYS = {
  ITEMS: "cn_alarm_items",
  GROUPS: "cn_alarm_groups",
  CREDIT_CARDS: "cn_alarm_credit_cards",
  HOLIDAYS: "cn_alarm_holidays",
  SETTINGS: "cn_alarm_settings",
  TEMPLATES: "cn_alarm_templates",
} as const

// ==================== ios-alarm skill 路径 ====================
export const SKILL_DIR = "/var/mobile/Library/Mobile Documents/iCloud~com~thomfang~Scripting/Documents/scripting-skills/ios-alarm/scripts"

// ==================== 星期标签 ====================
// Apple weekday numbering: 1=Sun, 2=Mon, ..., 7=Sat
export const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

// ==================== 数据类型定义 ====================
export type RepeatMode = "once" | "daily" | "weekly" | "monthly" | "yearly" | "lunar_yearly" | "workday"

/** 调休动作三选一：none=不查调休 / skip=节假日跳过(补班日额外响) / defer=节假日当天顺延到下一个非节假日 */
export type HolidayAction = "none" | "skip" | "defer"

/** 每月/每年的子模式：按日期 vs 按第N周星期X */
export type MonthlySubMode = "day" | "weekday"
export type YearlySubMode = "date" | "weekday" | "solarTerm" | "nthWorkday"

export interface RepeatRule {
  mode: RepeatMode
  interval: number
  weekdays?: number[]
  dayOfMonth?: number
  monthOfYear?: number
  /** 每月/每年子模式 */
  monthlySubMode?: MonthlySubMode
  yearlySubMode?: YearlySubMode
  /** 每月/每年按星期X时：第几周（1=第一周, 2=第二周, ..., -1=最后一周） */
  weekOfMonth?: number
  /** 每月/每年按星期X时：星期几（Apple编号 1=日 2=一 ... 7=六） */
  weekdayOfMonth?: number
  /** 每年第N个工作日 */
  nthWorkdayOfYear?: number
  lunarMonth?: number
  lunarDay?: number
  solarTerm?: string
  /** 调休动作：none/skip/defer。旧数据 holidayAware 通过 normalizeRule 迁移 */
  holidayAction: HolidayAction
  anchorDate?: string
}

/** 把旧 RepeatRule（holidayAware: boolean）迁移到新 holidayAction 枚举 */
export function normalizeRule(rule: RepeatRule): RepeatRule {
  // 兼容旧字段：如果 holidayAction 缺失但有 holidayAware，做迁移
  const r = rule as any
  if (r.holidayAction === undefined) {
    r.holidayAction = r.holidayAware === true ? "skip" : "none"
  }
  delete r.holidayAware
  return r as RepeatRule
}

export interface AlarmItem {
  id: string
  alarmIds: string[]
  title: string
  hour: number
  minute: number
  repeat: RepeatRule
  enabled: boolean
  gradualWake: boolean
  preAlertSeconds: number
  sound: string
  groupName: string
  tag: string
  note: string
  tintColor: string
  createdAt: number
  updatedAt: number
}

export interface AlarmGroup {
  id: string
  name: string
  icon: string
  tintColor: string
  order: number
}

export interface CreditCard {
  id: string
  bankName: string
  last4Digits: string
  statementDay: number
  graceDays: number
  bufferDays: number
  remindDaysBefore: number
  enabled: boolean
  tintColor: string
  alarmItemIds: string[]
}

export interface HolidayEntry {
  date: string
  name: string
}

export interface HolidayCalendar {
  year: number
  holidays: HolidayEntry[]
  workdays: HolidayEntry[]
}

export interface AppSettings {
  activeTemplate: string | null
  defaultGradualWake: boolean
  defaultPreAlert: number
  defaultSound: string
  defaultRemindDaysBefore: number
}

// ==================== 默认分组 ====================
export const DEFAULT_GROUPS: AlarmGroup[] = [
  { id: "g-work", name: "上班", icon: "briefcase.fill", tintColor: "systemBlue", order: 0 },
  { id: "g-school", name: "上学", icon: "book.fill", tintColor: "systemTeal", order: 1 },
  { id: "g-training", name: "培训班", icon: "graduationcap.fill", tintColor: "systemPurple", order: 2 },
  { id: "g-credit", name: "信用卡", icon: "creditcard.fill", tintColor: "systemOrange", order: 3 },
  { id: "g-anniversary", name: "纪念日", icon: "heart.fill", tintColor: "systemPink", order: 4 },
  { id: "g-other", name: "其他", icon: "ellipsis.circle", tintColor: "systemGray", order: 5 },
]

// ==================== 默认设置 ====================
export const DEFAULT_SETTINGS: AppSettings = {
  activeTemplate: null,
  defaultGradualWake: false,
  defaultPreAlert: 300,
  defaultSound: "default",
  defaultRemindDaysBefore: 3,
}

// ==================== 银行预设 ====================
export const BANK_PRESETS: { name: string; graceDays: number }[] = [
  // 国有六大行
  { name: "中国银行", graceDays: 20 },
  { name: "建设银行", graceDays: 20 },
  { name: "工商银行", graceDays: 20 },
  { name: "农业银行", graceDays: 25 },
  { name: "交通银行", graceDays: 25 },
  { name: "邮储银行", graceDays: 20 },
  // 股份制银行（12家）
  { name: "招商银行", graceDays: 18 },
  { name: "中信银行", graceDays: 19 },
  { name: "光大银行", graceDays: 19 },
  { name: "民生银行", graceDays: 20 },
  { name: "兴业银行", graceDays: 20 },
  { name: "浦发银行", graceDays: 20 },
  { name: "平安银行", graceDays: 18 },
  { name: "广发银行", graceDays: 20 },
  { name: "华夏银行", graceDays: 20 },
  { name: "浙商银行", graceDays: 20 },
  { name: "渤海银行", graceDays: 20 },
  { name: "恒丰银行", graceDays: 20 },
  { name: "百信银行", graceDays: 20 },
  // 主要城商行
  { name: "北京银行", graceDays: 20 },
  { name: "上海银行", graceDays: 20 },
  { name: "江苏银行", graceDays: 20 },
  { name: "南京银行", graceDays: 20 },
  { name: "宁波银行", graceDays: 20 },
  { name: "杭州银行", graceDays: 20 },
  { name: "成都银行", graceDays: 20 },
  { name: "长沙银行", graceDays: 20 },
  { name: "重庆银行", graceDays: 20 },
  { name: "西安银行", graceDays: 20 },
  { name: "天津银行", graceDays: 20 },
  { name: "哈尔滨银行", graceDays: 20 },
  { name: "盛京银行", graceDays: 20 },
  { name: "中原银行", graceDays: 20 },
  { name: "郑州银行", graceDays: 20 },
  { name: "青岛银行", graceDays: 20 },
  { name: "齐鲁银行", graceDays: 20 },
  { name: "兰州银行", graceDays: 20 },
  { name: "贵阳银行", graceDays: 20 },
  { name: "苏州银行", graceDays: 20 },
  { name: "厦门银行", graceDays: 20 },
  { name: "东莞银行", graceDays: 20 },
  { name: "汉口银行", graceDays: 20 },
  { name: "江西银行", graceDays: 20 },
  { name: "贵州银行", graceDays: 20 },
  { name: "桂林银行", graceDays: 20 },
  { name: "柳州银行", graceDays: 20 },
  // 主要农商行
  { name: "重庆农商行", graceDays: 20 },
  { name: "上海农商行", graceDays: 20 },
  { name: "广州农商行", graceDays: 20 },
  { name: "北京农商行", graceDays: 20 },
  { name: "深圳农商行", graceDays: 20 },
  { name: "成都农商行", graceDays: 20 },
  { name: "东莞农商行", graceDays: 20 },
  { name: "佛山农商行", graceDays: 20 },
  // 民营银行
  { name: "微众银行", graceDays: 20 },
  { name: "网商银行", graceDays: 20 },
  { name: "新网银行", graceDays: 20 },
  { name: "亿联银行", graceDays: 20 },
  // 外资银行
  { name: "汇丰银行", graceDays: 20 },
  { name: "渣打银行", graceDays: 20 },
  { name: "花旗银行", graceDays: 20 },
  { name: "东亚银行", graceDays: 20 },
  { name: "星展银行", graceDays: 20 },
  { name: "恒生银行", graceDays: 20 },
  // 兜底
  { name: "其他", graceDays: 20 },
]

// ==================== 默认调休日历 ====================
export const DEFAULT_HOLIDAYS: HolidayCalendar[] = [
  {
    year: 2026,
    holidays: [
      { date: "2026-01-01", name: "元旦" },
      { date: "2026-02-17", name: "春节" },
      { date: "2026-02-18", name: "春节" },
      { date: "2026-02-19", name: "春节" },
      { date: "2026-02-20", name: "春节" },
      { date: "2026-02-21", name: "春节" },
      { date: "2026-02-22", name: "春节" },
      { date: "2026-02-23", name: "春节" },
      { date: "2026-04-04", name: "清明节" },
      { date: "2026-04-05", name: "清明节" },
      { date: "2026-04-06", name: "清明节" },
      { date: "2026-05-01", name: "劳动节" },
      { date: "2026-05-02", name: "劳动节" },
      { date: "2026-05-03", name: "劳动节" },
      { date: "2026-05-04", name: "劳动节" },
      { date: "2026-05-05", name: "劳动节" },
      { date: "2026-06-19", name: "端午节" },
      { date: "2026-06-20", name: "端午节" },
      { date: "2026-06-21", name: "端午节" },
      { date: "2026-10-01", name: "国庆节" },
      { date: "2026-10-02", name: "国庆节" },
      { date: "2026-10-03", name: "国庆节" },
      { date: "2026-10-04", name: "中秋节" },
      { date: "2026-10-05", name: "国庆节" },
      { date: "2026-10-06", name: "国庆节" },
      { date: "2026-10-07", name: "国庆节" },
      { date: "2026-10-08", name: "国庆节" },
    ],
    workdays: [
      { date: "2026-02-14", name: "春节调休" },
      { date: "2026-02-15", name: "春节调休" },
      { date: "2026-04-26", name: "劳动节调休" },
      { date: "2026-09-27", name: "国庆调休" },
      { date: "2026-10-10", name: "国庆调休" },
    ],
  },
  {
    year: 2027,
    holidays: [
      { date: "2027-01-01", name: "元旦" },
      { date: "2027-02-06", name: "春节" },
      { date: "2027-02-07", name: "春节" },
      { date: "2027-02-08", name: "春节" },
      { date: "2027-02-09", name: "春节" },
      { date: "2027-02-10", name: "春节" },
      { date: "2027-02-11", name: "春节" },
      { date: "2027-02-12", name: "春节" },
      { date: "2027-04-04", name: "清明节" },
      { date: "2027-04-05", name: "清明节" },
      { date: "2027-04-06", name: "清明节" },
      { date: "2027-05-01", name: "劳动节" },
      { date: "2027-05-02", name: "劳动节" },
      { date: "2027-05-03", name: "劳动节" },
      { date: "2027-05-04", name: "劳动节" },
      { date: "2027-05-05", name: "劳动节" },
      { date: "2027-06-09", name: "端午节" },
      { date: "2027-06-10", name: "端午节" },
      { date: "2027-06-11", name: "端午节" },
      { date: "2027-10-01", name: "国庆节" },
      { date: "2027-10-02", name: "国庆节" },
      { date: "2027-10-03", name: "国庆节" },
      { date: "2027-10-04", name: "国庆节" },
      { date: "2027-10-05", name: "国庆节" },
      { date: "2027-10-06", name: "国庆节" },
      { date: "2027-10-07", name: "国庆节" },
      { date: "2027-10-08", name: "国庆节" },
    ],
    workdays: [
      { date: "2027-02-20", name: "春节调休" },
      { date: "2027-09-26", name: "国庆调休" },
      { date: "2027-10-09", name: "国庆调休" },
    ],
  },
]
