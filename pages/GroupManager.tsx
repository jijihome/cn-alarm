// GroupManager.tsx - 分类管理页（增删改，快捷指令风格图标/颜色选择）
import { useState, useObservable, NavigationStack, List, Section, Text, Button, HStack, Spacer, TextField, Navigation, EditButton, ForEach, ContentUnavailableView, Image, Circle, LazyVGrid, VStack, ZStack, RoundedRectangle, useEffect } from "scripting"
import { AlarmGroup } from "../lib/constants"
import { loadGroups, saveGroups, addGroup, updateGroup, removeGroup, createGroup } from "../lib/alarm-store"
import { COLOR_OPTIONS, ICON_CATEGORIES, ALL_ICONS } from "../lib/icon-data"

declare function alert(options: { title?: string; message: string }): Promise<void>

// 网格列定义：5 列自适应
const GRID_COLUMNS = [
  { size: { type: "adaptive" as const, min: 50, max: 60 } },
  { size: { type: "adaptive" as const, min: 50, max: 60 } },
  { size: { type: "adaptive" as const, min: 50, max: 60 } },
  { size: { type: "adaptive" as const, min: 50, max: 60 } },
  { size: { type: "adaptive" as const, min: 50, max: 60 } },
]

/** 颜色网格单元格 */
function ColorCell({ color, selected, onTap }: { color: string; selected: boolean; onTap: () => void }) {
  return (
    <Button action={onTap}>
      <ZStack frame={{ width: 44, height: 44 }}>
        <Circle fill={color as any} frame={{ width: 32, height: 32 }} />
        {selected && (
          <Circle stroke={{ shapeStyle: color as any, strokeStyle: { lineWidth: 3 } }} frame={{ width: 40, height: 40 }} />
        )}
      </ZStack>
    </Button>
  )
}

/** 图标网格单元格 */
function IconCell({ icon, color, selected, onTap }: { icon: string; color: string; selected: boolean; onTap: () => void }) {
  return (
    <Button action={onTap}>
      <ZStack frame={{ width: 50, height: 50 }}>
        {selected && (
          <RoundedRectangle fill={"systemGray5" as any} cornerRadius={10} frame={{ width: 46, height: 46 }} />
        )}
        <Image systemName={icon} foregroundStyle={color as any} frame={{ width: 28, height: 28 }} />
      </ZStack>
    </Button>
  )
}

/** 编辑单个分类的模态页（快捷指令风格图标/颜色选择） */
function GroupEditor({ editId }: { editId?: string }) {
  const dismiss = Navigation.useDismiss()
  const groups = loadGroups()
  const existing = editId ? groups.find((g) => g.id === editId) : null

  const name = useObservable(existing?.name ?? "新分类")
  const iconName = useObservable(existing?.icon ?? "tag.fill")
  const colorValue = useObservable(existing?.tintColor ?? "#007AFF")
  const [searchText, setSearchText] = useState("")

  const handleSave = () => {
    if (!name.value.trim()) {
      alert({ title: "提示", message: "请输入分类名称" })
      return
    }
    const data: Partial<AlarmGroup> = {
      name: name.value.trim(),
      icon: iconName.value,
      tintColor: colorValue.value,
    }
    if (editId && existing) {
      updateGroup(editId, data)
    } else {
      addGroup(createGroup(data))
    }
    dismiss({ saved: true })
  }

  // 搜索过滤：有搜索词时跨所有分类过滤，否则按分类展示
  const searchLower = searchText.trim().toLowerCase()
  const isSearching = searchLower.length > 0
  const filteredIcons = isSearching
    ? ALL_ICONS.filter((icon) => icon.toLowerCase().includes(searchLower))
    : []

  return (
    <NavigationStack>
      <List
        navigationTitle={editId ? "编辑分类" : "新建分类"}
        navigationBarTitleDisplayMode="inline"
        listStyle="insetGroup"
        toolbar={{
          topBarLeading: <Button title="取消" action={() => dismiss({ saved: false })} />,
          topBarTrailing: <Button title="保存" action={handleSave} />,
        }}
      >
        {/* 图标预览 */}
        <Section>
          <HStack alignment="center" spacing={16}>
            <Spacer />
            <ZStack frame={{ width: 72, height: 72 }}>
              <RoundedRectangle fill={colorValue.value as any} cornerRadius={18} frame={{ width: 72, height: 72 }} />
              <Image systemName={iconName.value} foregroundStyle="white" frame={{ width: 36, height: 36 }} />
            </ZStack>
            <Spacer />
          </HStack>
        </Section>

        {/* 名称 */}
        <Section header={<Text>名称</Text>}>
          <TextField
            title="分类名"
            value={name.value}
            onChanged={(v) => name.setValue(v)}
            prompt="输入分类名称"
          />
        </Section>

        {/* 颜色网格 */}
        <Section header={<Text>颜色</Text>}>
          <LazyVGrid columns={GRID_COLUMNS} spacing={8}>
            {COLOR_OPTIONS.map((c) => (
              <ColorCell
                key={c.value}
                color={c.value}
                selected={colorValue.value === c.value}
                onTap={() => colorValue.setValue(c.value)}
              />
            ))}
          </LazyVGrid>
        </Section>

        {/* 搜索栏 */}
        <Section>
          <TextField
            title="搜索"
            value={searchText}
            onChanged={setSearchText}
            prompt="搜索符号"
          />
        </Section>

        {/* 图标网格 */}
        {isSearching ? (
          <Section header={<Text>搜索结果 ({filteredIcons.length})</Text>}>
            {filteredIcons.length > 0 ? (
              <LazyVGrid columns={GRID_COLUMNS} spacing={8}>
                {filteredIcons.map((icon) => (
                  <IconCell
                    key={icon}
                    icon={icon}
                    color={colorValue.value}
                    selected={iconName.value === icon}
                    onTap={() => iconName.setValue(icon)}
                  />
                ))}
              </LazyVGrid>
            ) : (
              <Text foregroundStyle="secondaryLabel">无匹配图标</Text>
            )}
          </Section>
        ) : (
          ICON_CATEGORIES.map((cat) => (
            <Section key={cat.name} header={<Text>{cat.name}</Text>}>
              <LazyVGrid columns={GRID_COLUMNS} spacing={8}>
                {cat.icons.map((icon) => (
                  <IconCell
                    key={icon}
                    icon={icon}
                    color={colorValue.value}
                    selected={iconName.value === icon}
                    onTap={() => iconName.setValue(icon)}
                  />
                ))}
              </LazyVGrid>
            </Section>
          ))
        )}
      </List>
    </NavigationStack>
  )
}

export function GroupManager() {
  const groups = useObservable<AlarmGroup[]>(() => loadGroups())

  // 同步 groups Observable → Storage（swipe 删除后自动触发）
  const prevGroupIdsRef = useObservable<string[]>(() => groups.value.map(g => g.id))
  useEffect(() => {
    const currentIds = new Set(groups.value.map(g => g.id))
    const prevIds = prevGroupIdsRef.value
    const deletedIds = prevIds.filter(id => !currentIds.has(id))
    if (deletedIds.length > 0) {
      // 同步到 storage（removeGroup 会处理关联闹钟的 groupName 清理）
      for (const delId of deletedIds) {
        removeGroup(delId)
      }
      // 保存当前 Observable 状态（已删除后的）
      saveGroups(groups.value)
    }
    prevGroupIdsRef.setValue(groups.value.map(g => g.id))
  }, [groups.value])

  const presentEditor = async (editId?: string) => {
    await Navigation.present({
      element: <GroupEditor editId={editId} />,
      modalPresentationStyle: "fullScreen",
    })
    groups.setValue(loadGroups())
  }

  const handleAdd = () => presentEditor()
  const handleEdit = (id: string) => presentEditor(id)

  return (
    <NavigationStack>
      <List
        navigationTitle="分类管理"
        listStyle="insetGroup"
        toolbar={{
          topBarLeading: <EditButton />,
          topBarTrailing: <Button title="添加" systemImage="plus" action={handleAdd} />,
        }}
      >
        {groups.value.length === 0 ? (
          <Section>
            <ContentUnavailableView
              title="还没有分类"
              systemImage="tag.fill"
              description="点击右上角 + 添加分类"
            />
          </Section>
        ) : (
          <Section header={<Text>全部分类 ({groups.value.length})</Text>}>
            <ForEach
              data={groups}
              editActions="delete"
              builder={(g: AlarmGroup) => (
                <Button
                  key={g.id}
                  action={() => handleEdit(g.id)}
                >
                  <HStack alignment="center" spacing={10}>
                    <Image systemName={g.icon} foregroundStyle={g.tintColor as any} frame={{ width: 20, height: 20 }} />
                    <Text font={16}>{g.name}</Text>
                    <Spacer />
                    <Circle fill={g.tintColor as any} frame={{ width: 8, height: 8 }} />
                  </HStack>
                </Button>
              )}
            />
          </Section>
        )}
      </List>
    </NavigationStack>
  )
}
