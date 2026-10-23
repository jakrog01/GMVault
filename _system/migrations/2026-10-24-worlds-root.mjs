import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const id = '2026-10-24-worlds-root'

export const up = async context => {
  const keep = 'Worlds/.gmvault-keep'
  const report = { id, created: [] }
  if (await context.exists(keep)) return report
  report.created.push(keep)
  if (context.dryRun) return report
  await mkdir(path.join(context.vaultRoot, 'Worlds'), { recursive: true })
  await writeFile(path.join(context.vaultRoot, keep), '')
  return report
}
