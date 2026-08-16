// 文件树：懒加载、展开/折叠。数据来自 store.tree，动作回调由 ExplorerPanel 下发。
import type { MouseEvent, ReactNode } from 'react'
import type { Entry } from '../../shared/contract'
import type { TreeState } from '../store'
import { fmtSize } from '../format'
import { Icon } from './Icon'
import { InlineInput } from './InlineRename'

export interface RenameState { path: string; value: string }
export interface CreateState { parent: string; kind: 'file' | 'dir'; value: string }

export interface FileTreeProps {
  tree: TreeState
  renaming: RenameState | null
  creating: CreateState | null
  onToggle(path: string): void
  onSelect(path: string): void
  onOpen(entry: Entry): void
  onContextMenu(e: MouseEvent, entry: Entry): void
  onRenameChange(v: string): void
  onRenameCommit(): void
  onRenameCancel(): void
  onCreateChange(v: string): void
  onCreateCommit(): void
  onCreateCancel(): void
}

function TreeNode(props: {
  entry: Entry
  depth: number
  tree: TreeState
  renaming: RenameState | null
  creating: CreateState | null
  onToggle(path: string): void
  onSelect(path: string): void
  onOpen(entry: Entry): void
  onContextMenu(e: MouseEvent, entry: Entry): void
  onRenameChange(v: string): void
  onRenameCommit(): void
  onRenameCancel(): void
  onCreateChange(v: string): void
  onCreateCommit(): void
  onCreateCancel(): void
}) {
  const { entry, depth, tree } = props
  const isDir = entry.type === 'directory'
  const expanded = tree.expanded.has(entry.path)
  const loading = tree.loading.has(entry.path)
  const error = tree.errors[entry.path]
  const children = tree.cache.get(entry.path)
  const isRenaming = props.renaming !== null && props.renaming.path === entry.path

  const nodes: ReactNode[] = []
  nodes.push(
    <div
      key={entry.path}
      className={'fe-row' + (tree.selected === entry.path ? ' fe-row-selected' : '')}
      style={{ paddingLeft: 6 + depth * 14 }}
      onClick={() => (isDir ? props.onToggle(entry.path) : props.onSelect(entry.path))}
      onDoubleClick={() => (isDir ? props.onToggle(entry.path) : props.onOpen(entry))}
      onContextMenu={(e) => props.onContextMenu(e, entry)}
      title={entry.path}
    >
      <span className={'fe-chevron' + (isDir ? '' : ' fe-chevron-none')}>
        {isDir ? <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={12} /> : null}
      </span>
      <span className={'fe-node-icon fe-node-' + (isDir ? 'dir' : 'file')}>
        <Icon name={isDir ? 'folder' : 'file'} size={14} />
      </span>
      {isRenaming ? (
        <InlineInput
          className="fe-rename-input"
          value={props.renaming!.value}
          onChange={props.onRenameChange}
          onCommit={props.onRenameCommit}
          onCancel={props.onRenameCancel}
        />
      ) : (
        <span className="fe-node-name" title={entry.name}>{entry.name}</span>
      )}
      {isDir && loading ? <span className="fe-node-loading">…</span> : null}
      {!isDir && typeof entry.size === 'number' ? <span className="fe-node-size">{fmtSize(entry.size)}</span> : null}
    </div>,
  )

  if (isDir && expanded && props.creating !== null && props.creating.parent === entry.path) {
    nodes.push(
      <div key="__new" className="fe-row" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>
        <span className="fe-chevron fe-chevron-none" />
        <span className={'fe-node-icon fe-node-' + (props.creating.kind === 'dir' ? 'dir' : 'file')}>
          <Icon name={props.creating.kind === 'dir' ? 'folder' : 'file'} size={14} />
        </span>
        <InlineInput
          className="fe-new-input"
          placeholder={props.creating.kind === 'dir' ? '文件夹名称' : '文件名称'}
          value={props.creating.value}
          onChange={props.onCreateChange}
          onCommit={props.onCreateCommit}
          onCancel={props.onCreateCancel}
        />
      </div>,
    )
  }

  if (isDir && expanded) {
    if (children) {
      for (const child of children) {
        nodes.push(
          <TreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            tree={tree}
            renaming={props.renaming}
            creating={props.creating}
            onToggle={props.onToggle}
            onSelect={props.onSelect}
            onOpen={props.onOpen}
            onContextMenu={props.onContextMenu}
            onRenameChange={props.onRenameChange}
            onRenameCommit={props.onRenameCommit}
            onRenameCancel={props.onRenameCancel}
            onCreateChange={props.onCreateChange}
            onCreateCommit={props.onCreateCommit}
            onCreateCancel={props.onCreateCancel}
          />,
        )
      }
    } else if (!loading && error) {
      nodes.push(
        <div key="__err" className="fe-node-error" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>{error}</div>,
      )
    }
  }

  return <div className="fe-node">{nodes}</div>
}

export function FileTree(props: FileTreeProps) {
  const { tree } = props
  if (!tree.rootPath) return <div className="fe-empty">未找到当前工作区</div>
  const rows: ReactNode[] = []

  rows.push(
    <div
      key="root"
      className="fe-row fe-row-root"
      style={{ paddingLeft: 6 }}
      onClick={() => props.onToggle(tree.rootPath!)}
      onContextMenu={(e) =>
        props.onContextMenu(e, { path: tree.rootPath!, name: tree.rootName || tree.rootPath!, type: 'directory', size: null })
      }
      title={tree.rootPath!}
    >
      <span className="fe-chevron">
        <Icon name={tree.expanded.has(tree.rootPath!) ? 'chevronDown' : 'chevronRight'} size={12} />
      </span>
      <span className="fe-node-icon fe-node-dir"><Icon name="folder" size={14} /></span>
      <span className="fe-node-name" title={tree.rootName}>{tree.rootName || tree.rootPath}</span>
      {tree.loading.has(tree.rootPath!) ? <span className="fe-node-loading">…</span> : null}
    </div>,
  )

  if (tree.expanded.has(tree.rootPath!)) {
    if (props.creating !== null && props.creating.parent === tree.rootPath) {
      rows.push(
        <div key="__new" className="fe-row" style={{ paddingLeft: 20 }}>
          <span className="fe-chevron fe-chevron-none" />
          <span className={'fe-node-icon fe-node-' + (props.creating.kind === 'dir' ? 'dir' : 'file')}>
            <Icon name={props.creating.kind === 'dir' ? 'folder' : 'file'} size={14} />
          </span>
          <InlineInput
            className="fe-new-input"
            placeholder={props.creating.kind === 'dir' ? '文件夹名称' : '文件名称'}
            value={props.creating.value}
            onChange={props.onCreateChange}
            onCommit={props.onCreateCommit}
            onCancel={props.onCreateCancel}
          />
        </div>,
      )
    }
    const children = tree.cache.get(tree.rootPath!)
    if (children) {
      for (const child of children) {
        rows.push(
          <TreeNode
            key={child.path}
            entry={child}
            depth={1}
            tree={tree}
            renaming={props.renaming}
            creating={props.creating}
            onToggle={props.onToggle}
            onSelect={props.onSelect}
            onOpen={props.onOpen}
            onContextMenu={props.onContextMenu}
            onRenameChange={props.onRenameChange}
            onRenameCommit={props.onRenameCommit}
            onRenameCancel={props.onRenameCancel}
            onCreateChange={props.onCreateChange}
            onCreateCommit={props.onCreateCommit}
            onCreateCancel={props.onCreateCancel}
          />,
        )
      }
    } else if (!tree.loading.has(tree.rootPath!) && tree.errors[tree.rootPath!]) {
      rows.push(
        <div key="err" className="fe-node-error" style={{ paddingLeft: 20 }}>{tree.errors[tree.rootPath!]}</div>,
      )
    }
  }

  return <div>{rows}</div>
}
