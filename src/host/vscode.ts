// 在 VS Code 中打开（文件或目录）。见 DESIGN.md §7.7。
import * as nodeFs from 'node:fs/promises'
import type { Services } from './services'

export interface OpenOutcome {
  ok: boolean
  error?: string
  exitCode?: number
}

export async function openInVscode(deps: Services, path: string): Promise<OpenOutcome> {
  const { subprocess, shell, fs } = deps

  // 优先：通过 subprocess 直接拉起真实的 Code.exe（无 shell 沙箱）。
  // Windows 上 `code` 通常解析成 .cmd shim，Node 无法直接 spawn，
  // 从 <install>\bin\code.cmd 推导 <install>\Code.exe 并用 fs.stat 验证。
  if (subprocess !== undefined) {
    let resolved: string | null = null
    try {
      resolved = await subprocess.resolveExecutable('code')
    } catch {
      /* not on PATH */
    }
    let program: string | null = null
    if (resolved) {
      if (/\.(cmd|bat)$/i.test(String(resolved))) {
        const derived = String(resolved).replace(/[\\/]bin[\\/][^\\/]*$/i, '') + '\\Code.exe'
        try {
          if (fs !== undefined) {
            const t = await fs.resolve(derived)
            const info = await fs.stat(t)
            if (info !== undefined && info.type === 'file') program = derived
          } else {
            await nodeFs.stat(derived)
            program = derived
          }
        } catch {
          /* derived exe absent */
        }
      } else {
        program = resolved
      }
    }
    if (program !== null) {
      const handle = subprocess.spawn({
        argv: [program, path],
        cwd: path,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } },
        graceMs: 8000,
      })
      const outcome = await handle.done
      return { ok: outcome.exitCode === 0, exitCode: outcome.exitCode }
    }
  }

  // 兜底：shell + Start-Process（立即分离）。
  if (shell !== undefined) {
    const quoted = '"' + path.replace(/"/g, '""') + '"'
    const command = 'Start-Process -FilePath code -ArgumentList ' + quoted
    const spec = shell.resolve({ command, timeoutMs: 10000 })
    const result = await shell.run(spec)
    if (result.exitCode === 0) return { ok: true }
  }

  return { ok: false, error: '未找到 VS Code（code 命令不在 PATH 中）' }
}
