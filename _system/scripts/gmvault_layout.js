const merge = (shipped, local, generic) => {
  const base = shipped || local || generic;
  return { ...base, ...local, layout: { ...generic.layout, ...(shipped?.layout || {}), ...(local?.layout || {}) } };
};

const readPackage = async (adapter, id) => {
  const read = async root => { try { return JSON.parse(await adapter.read(`${root}/systems/${id}/package.json`)); } catch { return null; } };
  let generic;
  try { generic = JSON.parse(await adapter.read(`_system/systems/${'generic'}/package.json`)); } catch { generic = { id: 'generic', name: 'Generic', layout: { mechanics: [], world: [], campaign: [], lore: [] } }; }
  const shipped = await read('_system');
  const local = await read('_local');
  return merge(shipped, local, generic);
};

const resolve = (file, packages, fallback = 'generic') => {
  const parts = file.replace(/\\/g, '/').split('/');
  let system = fallback, world = '', campaign = '', section = '', rest = [];
  if (parts[0] === 'Library' && parts[1] === 'Mechanics' && parts.length > 3) {
    system = parts[2]; section = 'mechanics'; rest = parts.slice(3);
  } else if (parts[0] === 'Library' && parts.length > 3) {
    system = parts[1];
    if (parts[2] === 'Mechanics') { section = 'mechanics'; rest = parts.slice(3); }
    if (parts[2] === 'Worlds' && parts[3]) { world = `Library/${system}/Worlds/${parts[3]}/World`; section = 'world'; rest = parts.slice(4); }
    if (parts[2] === 'Campaigns' && parts[3]) { campaign = `Library/${system}/Campaigns/${parts[3]}/Campaign`; section = 'campaign'; rest = parts.slice(4); }
  } else if (parts[0] === 'Worlds' && parts[1]) { world = `Worlds/${parts[1]}/World`; section = 'world'; rest = parts.slice(2); }
  else if (parts[0] === 'Campaigns' && parts[1]) { campaign = `Campaigns/${parts[1]}/Campaign`; section = 'campaign'; rest = parts.slice(2); }
  else if (parts[0] === 'Parties' && parts[1]) return { system: '', world: '', campaign: '', type: rest[0] === 'Party.md' ? 'party' : parts[2] === 'Party.md' ? 'party' : 'pc', template: parts[2] === 'Party.md' ? 'party' : 'pc', parent: '' };
  else if (parts[0] === 'Runs' && parts[1]) return { system: '', world: '', campaign: '', type: parts[2] === 'Run.md' ? 'run' : 'session', template: parts[2] === 'Run.md' ? 'run' : 'session', parent: '' };
  if (!section || !rest.length || !file.endsWith('.md')) return { system, world, campaign, type: '', template: '', parent: '' };
  if (rest.length === 1 && rest[0] === 'World.md' && world) return { system, world, campaign, type: 'world', template: 'world', parent: '' };
  if (rest.length === 1 && rest[0] === 'Campaign.md' && campaign) return { system, world, campaign, type: 'campaign', template: 'campaign', parent: '' };
  const pkg = packages[system] || packages[fallback];
  const entries = [...(pkg?.layout?.[section] || [])].sort((a, b) => b.folder.length - a.folder.length);
  let chosen = entries.find(entry => { const folder = entry.folder.split('/'); return folder.every((part, index) => rest[index] === part) && rest.length > folder.length; });
  if (!chosen && section === 'mechanics' && rest[0] === 'Bestiary' && rest.length > 1) chosen = { folder: 'Bestiary', type: 'creature' };
  if (!chosen) return { system, world, campaign, type: '', template: '', parent: '' };
  const tail = rest.slice(chosen.folder.split('/').length);
  let type = chosen.type, parent = '';
  if (chosen.nested && tail.length > 1 && tail[0] !== tail.at(-1).replace(/\.md$/, '')) {
    type = chosen.nested;
    parent = `[[${file.slice(0, file.length - tail.join('/').length)}${tail[0]}/${tail[0]}]]`;
  }
  return { system, world, campaign, type, template: type === 'race' ? 'race' : type, parent };
};

const dispatch = async (tp, field) => {
  const file = tp.file.path(true);
  const parts = file.split('/');
  const id = parts[0] === 'Library' ? (parts[1] === 'Mechanics' ? parts[2] : parts[1]) : 'generic';
  const adapter = app.vault.adapter;
  const root = parts[0] === 'Campaigns' ? `Campaigns/${parts[1]}/Campaign.md` : parts[0] === 'Worlds' ? `Worlds/${parts[1]}/World.md` : '';
  let legacySystem = id;
  if (root) { try { legacySystem = (await adapter.read(root)).match(/^system:\s*[\"']?([A-Za-z0-9_-]+)/m)?.[1] || id; } catch {} }
  const pkg = await readPackage(adapter, legacySystem);
  const resolved = resolve(file, { [legacySystem]: pkg, generic: await readPackage(adapter, 'generic') }, legacySystem);
  const link = name => resolved[name] ? `[[${resolved[name]}]]` : '';
  if (field === 'template') return resolved.template;
  if (field === 'type') return resolved.type;
  if (field === 'system') return resolved.system;
  if (field === 'world') {
    if (resolved.world) return link('world');
    if (resolved.campaign) {
      try { return (await app.vault.adapter.read(`${resolved.campaign}.md`)).match(/^world:\s*[\"']?(\[\[[^\]]+\]\])/)?.[1] || ''; } catch {}
    }
    return '';
  }
  if (field === 'campaign') return link('campaign');
  if (field === 'locationParent') {
    const parts = file.split('/');
    const i = parts.indexOf('Locations');
    if (i < 0) return '';
    const folders = parts.slice(i + 1, -1);
    const stem = parts.at(-1).replace(/\.md$/, '');
    const parent = folders.at(-1) === stem ? folders.at(-2) : folders.at(-1);
    return parent ? `[[${parent}]]` : '';
  }
  if (field === 'parent') return resolved.parent;
  if (field === 'subtype') return resolved.parent && resolved.type === 'race' ? 'subrace' : resolved.type === 'rules' && (resolved.world || resolved.campaign) ? 'house-rule' : '';
  return '';
};

module.exports = dispatch;
module.exports.resolve = resolve;
module.exports.merge = merge;
module.exports.readPackage = readPackage;
