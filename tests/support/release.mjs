


import { createServer } from "node:http"
import { crc32 } from "node:zlib"
import { cp, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"

export const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

const encode = value => Buffer.from(value, "utf8")

const dosStamp = () => {
  const time = ((12 & 31) << 11) | ((0 & 63) << 5) | 0
  const date = (((2026 - 1980) & 127) << 9) | ((1 & 15) << 5) | 1
  return { time, date }
}


export function zipArchive(entries) {
  const { time, date } = dosStamp()
  const locals = []
  const central = []
  let offset = 0
  for (const entry of entries) {
    const name = encode(entry.name)
    const data = Buffer.isBuffer(entry.data) ? entry.data : encode(String(entry.data))
    const sum = crc32(data) >>> 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(10, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(sum, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, name, data)
    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(10, 6)
    header.writeUInt16LE(0, 8)
    header.writeUInt16LE(0, 10)
    header.writeUInt16LE(time, 12)
    header.writeUInt16LE(date, 14)
    header.writeUInt32LE(sum, 16)
    header.writeUInt32LE(data.length, 20)
    header.writeUInt32LE(data.length, 24)
    header.writeUInt16LE(name.length, 28)
    header.writeUInt32LE(entry.name.endsWith("/") ? 0x10 : 0, 38)
    header.writeUInt32LE(offset, 42)
    central.push(header, name)
    offset += local.length + name.length + data.length
  }
  const body = Buffer.concat(locals)
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(body.length, 16)
  return Buffer.concat([body, directory, end])
}



const skipped = item => item.split(path.sep).some((segment, index, segments) =>
  segment === '.git' || segment === 'node_modules' || (segment === 'backups' && segments[index - 1] === '.gmvault'))


export async function archiveEntries(directory, prefix = "") {
  const entries = []
  const walk = async current => {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const item = path.join(current, entry.name)
      if (skipped(item)) continue
      if (entry.isDirectory()) await walk(item)
      else if (entry.isFile()) entries.push({ name: prefix + path.relative(directory, item).split(path.sep).join("/"), data: await readFile(item) })
    }
  }
  if ((await stat(directory)).isDirectory()) await walk(directory)
  return entries
}


export async function releaseHost(options = {}) {
  const requests = []
  const assetName = options.assetName ?? "GMVault.zip"
  const server = createServer((request, response) => {
    requests.push(request.url)
    if (request.url.endsWith(`/download/${assetName}`)) {
      if (!options.asset) { response.writeHead(404); response.end("no asset"); return }
      response.writeHead(200, { "content-type": "application/zip", "content-length": String(options.asset.length) })
      response.end(options.asset)
      return
    }
    if (request.url.includes("/releases/latest")) {
      const status = options.status ?? (options.release ? 200 : 404)
      response.writeHead(status, { "content-type": "application/json" })
      response.end(options.body ?? JSON.stringify(options.release ?? { message: "Not Found" }))
      return
    }
    response.writeHead(404)
    response.end("not found")
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  return { base, requests, downloadUrl: `${base}/download/${assetName}`, close: () => new Promise(resolve => server.close(resolve)) }
}

export const releaseBody = (tag, downloadUrl, assetName = "GMVault.zip") => ({
  tag_name: tag,
  name: tag,
  draft: false,
  prerelease: false,
  assets: [{ name: assetName, browser_download_url: downloadUrl, size: 1 }],
})

export const CLONE_VERSION = "1.0.0"

export async function cloneVault(prefix) {
  const vault = await mkdtemp(path.join(os.tmpdir(), prefix))
  await cp(repository, vault, { recursive: true, filter: item => !skipped(item) })
  await writeFile(path.join(vault, "_system/VERSION"), `${CLONE_VERSION}\n`)
  const state = JSON.parse(await readFile(path.join(vault, ".gmvault/state.json"), "utf8"))
  await writeFile(path.join(vault, ".gmvault/state.json"), `${JSON.stringify({ ...state, installedVersion: CLONE_VERSION }, null, 2)}\n`)
  await mkdir(path.join(vault, "Campaigns/User"), { recursive: true })
  await mkdir(path.join(vault, "_local/templates"), { recursive: true })
  await writeFile(path.join(vault, "Campaigns/User/Campaign.md"), "owner content\n")
  await writeFile(path.join(vault, "_local/templates/campaign.md"), "local override\n")
  return vault
}

export function cli(vault, args, env = {}, timeout = 120000) {
  return new Promise(resolve => {
    execFile("node", [path.join(vault, "_system/bin/gmvault.mjs"), ...args], { cwd: vault, timeout, env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr })
    })
  })
}

export async function snapshot(directory) {
  const lines = []
  const walk = async current => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const item = path.join(current, entry.name)
      if (skipped(item)) continue
      if (entry.isDirectory()) await walk(item)
      else if (entry.isFile()) lines.push(`${path.relative(directory, item)} ${createHash("sha1").update(await readFile(item)).digest("hex")}`)
    }
  }
  await walk(directory)
  return lines.sort().join("\n")
}

export async function hangingHost() {
  const sockets = []
  const server = createServer(() => {})
  server.on("connection", socket => sockets.push(socket))
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  return {
    base,
    downloadUrl: `${base}/download/GMVault.zip`,
    close: () => new Promise(resolve => { for (const socket of sockets) socket.destroy(); server.close(resolve) }),
  }
}
