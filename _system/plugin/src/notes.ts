import { App, TFile } from "obsidian";

export const noteFields = (app: App, file: TFile): Record<string, unknown> => app.metadataCache.getFileCache(file)?.frontmatter ?? {};
export const noteType = (app: App, file: TFile): string => String(noteFields(app, file).type ?? "");
export const linkTarget = (value: unknown): string => String(value ?? "").trim().replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("#")[0].trim();
export const resolveLink = (app: App, value: unknown, source: TFile | string): TFile | null => {
  const target = linkTarget(value);
  return target ? app.metadataCache.getFirstLinkpathDest(target, typeof source === "string" ? source : source.path) : null;
};
export const noteStem = (path: string): string => path.replace(/\.md$/, "");
export const pathLink = (file: TFile | string): string => `[[${noteStem(typeof file === "string" ? file : file.path)}]]`;
export const quotedLink = (file: TFile | string): string => JSON.stringify(pathLink(file));
export const wikilink = (app: App, file: TFile, sourcePath = ""): string => app.metadataCache.getFirstLinkpathDest(file.basename, sourcePath)?.path === file.path ? `[[${file.basename}]]` : pathLink(file);
export const isBuiltInExcluded = (path: string): boolean => /^(?:Archive|_system|_local|\.obsidian|\.gmvault)(?:\/|$)/.test(path);
export const isGameNotePath = (path: string): boolean => !isBuiltInExcluded(path) && !path.split("/").some(part => part.startsWith("."));

export async function ensureFolder(app: App, folder: string): Promise<void> {
  let current = "";
  for (const part of folder.split("/").filter(Boolean)) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}

export function uniqueName(app: App, folder: string, base: string): string {
  let name = base;
  for (let number = 2; app.vault.getAbstractFileByPath(`${folder}/${name}.md`); number++) name = `${base} ${number}`;
  return name;
}

export async function homeTemplate(app: App, kind: string): Promise<string> {
  for (const root of ["_local/", "_system/"]) {
    try { return await app.vault.adapter.read(`${root}templates/${kind}.md`); } catch { continue; }
  }
  return "";
}

function mergeHomeFrontmatter(frontmatter: string, values: Record<string, string>): string {
  const lines = frontmatter ? frontmatter.split("\n") : [];
  const output: string[] = [];
  const replaced = new Set<string>();
  for (let index = 0; index < lines.length;) {
    const field = lines[index].match(/^([A-Za-z][\w-]*):/);
    if (!field) { output.push(lines[index]); index++; continue; }
    let end = index + 1;
    while (end < lines.length && (/^[ \t]/.test(lines[end]) || /^\s*-/.test(lines[end]))) end++;
    const value = values[field[1]];
    if (value === undefined) output.push(...lines.slice(index, end));
    else { output.push(`${field[1]}: ${value}`); replaced.add(field[1]); }
    index = end;
  }
  for (const [key, value] of Object.entries(values)) if (!replaced.has(key)) output.push(`${key}: ${value}`);
  return output.join("\n");
}

export function mergeHomeTemplate(template: string, title: string, folder: string, values: Record<string, string>, date?: string): string {
  const rendered = template.replace(/<%\s*tp\.file\.title\s*%>/g, title)
    .replace(/<%\s*tp\.file\.folder\(true\)\s*%>/g, folder)
    .replace(/<%\s*tp\.date\.now\([^%]*?\)\s*%>/g, date ?? "")
    .replace(/<%[\s\S]*?%>/g, "");
  const match = rendered.match(/^---\n([\s\S]*?)\n---\n?/);
  const fields = mergeHomeFrontmatter(match?.[1] ?? "", values);
  const body = match ? rendered.slice(match[0].length) : rendered;
  return `---\n${fields}\n---\n\n${body}`;
}

interface CreateNoteOptions {
  template: string;
  folder: string;
  name: string;
  values: Record<string, string>;
  body?: string;
  bodyWhenEmpty?: boolean;
  title?: string;
  exact?: boolean;
  date?: string;
}

export async function createNote(app: App, options: CreateNoteOptions): Promise<TFile> {
  const name = options.exact ? options.name : uniqueName(app, options.folder, options.name);
  let content = mergeHomeTemplate(await homeTemplate(app, options.template), options.title ?? name, options.folder, options.values, options.date);
  if (options.body !== undefined) {
    const heading = content.match(/^# .+$/m);
    content = heading ? options.body || options.bodyWhenEmpty ? content.replace(heading[0], `${heading[0]}\n\n${options.body}`) : content : `${content}\n# ${options.title ?? name}\n${options.body || options.bodyWhenEmpty ? `\n${options.body}\n` : ""}`;
  }
  await ensureFolder(app, options.folder);
  return app.vault.create(`${options.folder}/${name}.md`, content);
}
