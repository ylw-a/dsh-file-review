// 搜索结果：纯展示，数据来自 store。
import type { MouseEvent } from 'react'
import type { Entry } from '../../shared/contract'
import { Icon } from './Icon'

export interface SearchResultsProps {
  matches: Entry[]
  truncated: boolean
  searching: boolean
  searchError: string | null
  selected: string | null
  rootPath: string | null
  onSelect(path: string): void
  onOpen(entry: Entry): void
  onContextMenu(e: MouseEvent, entry: Entry): void
}

export function SearchResults(props: SearchResultsProps) {
  if (props.searching && !props.matches.length) return <div className="fe-empty">搜索中…</div>
  if (props.searchError) return <div className="fe-node-error">{props.searchError}</div>
  if (!props.matches.length) return <div className="fe-empty">没有匹配的文件</div>

  const base = props.rootPath ? props.rootPath.replace(/[\\/]+$/, '') : ''
  const rows = props.matches.map((m) => {
    const rel = base && m.path.indexOf(base) === 0 ? m.path.slice(base.length).replace(/^[\\/]+/, '') || '.' : m.path
    return (
      <div
        key={m.path}
        className={'fe-row' + (props.selected === m.path ? ' fe-row-selected' : '')}
        style={{ paddingLeft: 6 }}
        onClick={() => props.onSelect(m.path)}
        onDoubleClick={() => (m.type === 'directory' ? props.onSelect(m.path) : props.onOpen(m))}
        onContextMenu={(e) => props.onContextMenu(e, m)}
        title={m.path}
      >
        <span className={'fe-node-icon fe-node-' + (m.type === 'directory' ? 'dir' : 'file')}>
          <Icon name={m.type === 'directory' ? 'folder' : 'file'} size={14} />
        </span>
        <span className="fe-node-name" title={m.name}>{m.name}</span>
        <span className="fe-node-rel">{rel}</span>
      </div>
    )
  })
  if (props.truncated) rows.push(<div key="trunc" className="fe-node-error">结果过多，已截断（前 300 条）</div>)
  return <div>{rows}</div>
}
