// icon-data.ts - SF Symbol 图标和颜色数据（快捷指令风格选择器用）
// 图标名来源：本地 SF Symbol 7 项目（已验证存在的标准名）

// ==================== 颜色 ====================
// 15 个互不相同的颜色（hex 色值，参考 iOS 系统颜色 + 扩展）
export interface ColorOption {
  label: string
  value: string
}

export const COLOR_OPTIONS: ColorOption[] = [
  { label: "红", value: "#FF3B30" },
  { label: "橙", value: "#FF9500" },
  { label: "黄", value: "#FFCC00" },
  { label: "绿", value: "#34C759" },
  { label: "青", value: "#5AC8FA" },
  { label: "蓝", value: "#007AFF" },
  { label: "靛蓝", value: "#5856D6" },
  { label: "紫", value: "#AF52DE" },
  { label: "粉", value: "#FF2D55" },
  { label: "玫红", value: "#E91E63" },
  { label: "棕", value: "#A2845E" },
  { label: "薄荷", value: "#00C795" },
  { label: "青柠", value: "#C6FF00" },
  { label: "灰", value: "#8E8E93" },
  { label: "黑", value: "#1C1C1E" },
]

// ==================== 图标分类 ====================
// 只保留基础名和 .fill 变体，去掉 badge/circle 等复杂变体
export interface IconCategory {
  name: string
  icons: string[]
}

export const ICON_CATEGORIES: IconCategory[] = [
  {
    name: "时间",
    icons: [
      "clock", "clock.fill", "alarm", "alarm.fill",
      "deskclock", "deskclock.fill", "stopwatch", "stopwatch.fill",
      "calendar", "list.bullet", "timer",
      "hourglass", "hourglass.circle.fill",
      "bell", "bell.fill", "bell.badge", "bell.badge.fill",
    ],
  },
  {
    name: "工作",
    icons: [
      "briefcase", "briefcase.fill", "folder", "folder.fill",
      "document", "document.fill", "text.document", "text.document.fill",
      "tray", "tray.fill", "envelope", "envelope.fill",
      "creditcard", "creditcard.fill", "percent",
      "chart.bar", "chart.bar.fill", "chart.pie", "chart.pie.fill",
      "gear", "wrench.and.screwdriver", "wrench.and.screwdriver.fill", "hammer", "hammer.fill",
    ],
  },
  {
    name: "出行",
    icons: [
      "car", "car.fill", "bus", "bus.fill", "tram", "tram.fill",
      "airplane", "bicycle",
      "figure.walk", "location", "location.fill",
      "map", "map.fill", "mappin", "mappin.circle.fill",
      "location.north", "location.north.fill", "globe", "fuelpump", "fuelpump.fill",
    ],
  },
  {
    name: "生活",
    icons: [
      "house", "house.fill", "cup.and.saucer", "cup.and.saucer.fill",
      "fork.knife", "cart", "cart.fill", "bag", "bag.fill",
      "gift", "gift.fill", "music.note",
      "tv", "tv.fill", "gamecontroller", "gamecontroller.fill",
      "book", "book.fill", "pencil", "camera", "camera.fill",
    ],
  },
  {
    name: "天气",
    icons: [
      "sun.max", "sun.max.fill", "moon", "moon.fill",
      "cloud", "cloud.fill", "cloud.rain", "cloud.rain.fill",
      "cloud.bolt", "cloud.bolt.fill", "snowflake", "thermometer.medium",
      "umbrella", "wind", "sparkles", "flame", "flame.fill",
      "drop", "drop.fill", "leaf", "leaf.fill", "tropicalstorm",
    ],
  },
  {
    name: "人物",
    icons: [
      "person", "person.fill", "person.2", "person.2.fill",
      "person.3", "person.3.fill", "figure.walk", "figure.wave",
      "star", "star.fill", "heart", "heart.fill",
      "bookmark", "bookmark.fill", "flag", "flag.fill",
      "tag", "tag.fill", "crown", "crown.fill",
    ],
  },
  {
    name: "符号",
    icons: [
      "circle", "circle.fill", "square", "square.fill",
      "rectangle", "rectangle.fill", "triangle", "triangle.fill",
      "diamond", "diamond.fill", "hexagon", "hexagon.fill",
      "star", "star.fill", "bolt", "bolt.fill",
      "key", "key.fill", "shield", "shield.fill",
      "trophy", "trophy.fill", "lock", "lock.fill",
    ],
  },
]

// 所有图标平铺（用于搜索过滤）
export const ALL_ICONS: string[] = ICON_CATEGORIES.flatMap((c) => c.icons)
