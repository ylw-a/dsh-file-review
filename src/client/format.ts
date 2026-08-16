// 小工具：字节数格式化。
export function fmtSize(n: number | null | undefined): string {
  if (n === null || n === undefined) return ''
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB'
  return (n / 1073741824).toFixed(1) + ' GB'
}
