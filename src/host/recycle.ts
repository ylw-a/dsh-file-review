// 回收站删除：PowerShell + Microsoft.VisualBasic，走 subprocess 直接 spawn powershell.exe。
// 不走 shell（bash），Add-Type 会失败。见 DESIGN.md §7.6。
import type { Services } from './services'

export interface DeleteOutcome {
  ok: boolean
  error?: string
}

function psQuote(s: string): string {
  return "'" + String(s).replace(/'/g, "''") + "'"
}

export async function recycleBinDelete(
  deps: Services,
  absPath: string,
  isDir: boolean,
): Promise<DeleteOutcome> {
  const subprocess = deps.subprocess
  if (subprocess === undefined) return { ok: false, error: '缺少 subprocess 服务' }

  const method = isDir ? 'DeleteDirectory' : 'DeleteFile'
  const command =
    'Add-Type -AssemblyName Microsoft.VisualBasic; ' +
    '[Microsoft.VisualBasic.FileIO.FileSystem]::' + method +
    '(' + psQuote(absPath) + ", 'OnlyErrorDialogs', 'SendToRecycleBin')"

  let pwsh: string | null = null
  try {
    pwsh = await subprocess.resolveExecutable('powershell')
  } catch {
    /* absent */
  }
  if (!pwsh) {
    try {
      pwsh = await subprocess.resolveExecutable('powershell.exe')
    } catch {
      /* absent */
    }
  }
  if (!pwsh) return { ok: false, error: '未找到 powershell' }

  try {
    const handle = subprocess.spawn({
      argv: [pwsh, '-NoProfile', '-NonInteractive', '-Command', command],
      stdio: { stdin: 'ignore', stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } },
      graceMs: 20000,
    })
    const outcome = await handle.done
    if (outcome.exitCode === 0) return { ok: true }
    return { ok: false, error: '回收站删除失败（退出码 ' + outcome.exitCode + '）' }
  } catch (err) {
    return { ok: false, error: String((err as any)?.message || err) }
  }
}
