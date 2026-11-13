import fs from 'node:fs/promises'
import path from 'node:path'
import layout from './gmvault_layout.js'

const field = (text, key) => text.match(new RegExp(`^${key}:\\s*["']?([^\\n"']+)["']?\\s*$`, 'm'))?.[1]?.trim() ?? ''
const target = value => value.replace(/^\[\[|\]\]$/g, '').replace(/\.md$/, '')

export const loadSystemPackage = async (vaultRoot, system) => layout.readPackage({ read: relative => fs.readFile(path.join(vaultRoot, relative), 'utf8') }, system)

const findCampaign = async (root, name) => {
  const direct = path.join(root, `${name.replace(/\.md$/, '')}.md`)
  if (await fs.access(direct).then(() => true).catch(() => false)) return direct
  const legacy = path.join(root, 'Campaigns', name, 'Campaign.md')
  if (await fs.access(legacy).then(() => true).catch(() => false)) return legacy
  for (const system of await fs.readdir(path.join(root, 'Library')).catch(() => [])) {
    const candidate = path.join(root, 'Library', system, 'Campaigns', name, 'Campaign.md')
    if (await fs.access(candidate).then(() => true).catch(() => false)) return candidate
  }
  return legacy
}

export const resolveRunContext = async (vaultRoot, runFile) => {
  const run = path.resolve(vaultRoot, runFile)
  const text = await fs.readFile(run, 'utf8')
  const campaignName = target(field(text, 'campaign'))
  const partyName = target(field(text, 'party'))
  const campaign = campaignName ? await findCampaign(vaultRoot, campaignName) : null
  const party = partyName ? path.join(vaultRoot, 'Parties', partyName, 'Party.md') : null
  const state = path.join(path.dirname(run), 'State.md')
  const campaignText = campaign ? await fs.readFile(campaign, 'utf8').catch(() => '') : ''
  const system = field(campaignText, 'system') || 'generic'
  return { run, campaign, party, state, system, package: await loadSystemPackage(vaultRoot, system) }
}
