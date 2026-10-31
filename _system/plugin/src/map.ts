import { App, FuzzySuggestModal, ItemView, MarkdownRenderChild, Modal, Setting, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type TableTools from "./main";
import { createNote, linkTarget, noteFields, pathLink, resolveLink, wikilink } from "./notes";
import { LookupCard, LookupModal } from "./lookup";
import { MAP_TYPES } from "./contract";

export const MAP_VIEW = "tt-map";
interface Pin { note: string; x: number; y: number }
const imageTypes = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);
const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
const rounded = (value: number): number => Number(clamp(value, 0, 1).toFixed(4));
const pinsOf = (app: App, owner: TFile): Pin[] => {
  const pins = noteFields(app, owner).pins;
  return Array.isArray(pins) ? pins.filter(pin => pin && typeof pin.note === "string" && Number.isFinite(pin.x) && Number.isFinite(pin.y)) as Pin[] : [];
};
const hasMap = (app: App, file: TFile): boolean => !!linkTarget(noteFields(app, file).map);

export function mapOwnersFor(app: App, note: TFile): TFile[] {
  return app.vault.getMarkdownFiles().filter(owner => MAP_TYPES.includes(String(noteFields(app, owner).type)) && hasMap(app, owner)
    && pinsOf(app, owner).some(pin => resolveLink(app, pin.note, owner)?.path === note.path));
}

export function chooseMapOwner(app: App, plugin: TableTools, owners: TFile[], note: TFile): void {
  if (owners.length === 1) { void plugin.openMap(owners[0], note); return; }
  new MapOwnerPicker(app, plugin, owners, note).open();
}

class MapOwnerPicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private readonly plugin: TableTools, private readonly owners: TFile[], private readonly note: TFile) { super(app); this.setPlaceholder(plugin.strings.mapChooseOwner); }
  getItems(): TFile[] { return this.owners; }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile): void { void this.plugin.openMap(file, this.note); }
}

class MapImagePicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, plugin: TableTools, private readonly owner: TFile, private readonly done: () => void) { super(app); this.setPlaceholder(plugin.strings.mapChooseImage); }
  getItems(): TFile[] { return this.app.vault.getFiles().filter(file => imageTypes.has(file.extension.toLowerCase())).sort((a, b) => a.path.localeCompare(b.path)); }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile): void { void this.app.fileManager.processFrontMatter(this.owner, fields => { fields.map = `[[${file.path}]]`; }).then(this.done); }
}

class NewLocationModal extends Modal {
  private name = "";
  constructor(app: App, private readonly plugin: TableTools, private readonly owner: TFile, private readonly done: (file: TFile) => void) { super(app); }
  onOpen(): void {
    this.contentEl.createEl("h2", { text: this.plugin.strings.mapNewLocation });
    new Setting(this.contentEl).setName(this.plugin.strings.homeFieldName).addText(input => input.onChange(value => { this.name = value; }));
    new Setting(this.contentEl).addButton(button => button.setButtonText(this.plugin.strings.homeCreate).setCta().onClick(() => void this.create()));
  }
  private async create(): Promise<void> {
    const name = this.name.trim();
    if (!name || /[\\/:*?"<>|]/.test(name)) { this.contentEl.createDiv({ cls: "tt-muted", text: this.plugin.strings.homeInvalidName }); return; }
    const parent = this.owner.parent?.path ?? "";
    const folderNote = parent.split("/").at(-1) === this.owner.basename;
    const worldFolder = noteFields(this.app, this.owner).type === "world" ? parent : parent.includes("/Locations/") ? parent.split("/Locations/")[0] : parent.replace(/\/Locations$/, "");
    const folder = folderNote && noteFields(this.app, this.owner).type === "location" ? parent : `${worldFolder}/Locations`;
    const path = `${folder}/${name}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) { this.contentEl.createDiv({ cls: "tt-muted", text: this.plugin.strings.homeExists }); return; }
    const inferredWorld = this.app.vault.getAbstractFileByPath(`${worldFolder}/World.md`);
    const world = noteFields(this.app, this.owner).type === "world" ? this.owner : resolveLink(this.app, noteFields(this.app, this.owner).world, this.owner) ?? (inferredWorld instanceof TFile ? inferredWorld : null);
    const values: Record<string, string> = { type: "location", world: JSON.stringify(world ? wikilink(this.app, world, path) : ""), location: JSON.stringify(noteFields(this.app, this.owner).type === "location" ? wikilink(this.app, this.owner, path) : ""), campaign: '""' };
    const file = await createNote(this.app, { template: "location", folder, name, values, exact: true });
    this.close();
    this.done(file);
  }
}

export class MapPanel {
  private edit = false;
  private scale = 1;
  private x = 0;
  private y = 0;
  private width = 1000;
  private height = 1000;
  private timer?: number;
  private unsubscribe?: () => void;
  private viewport?: HTMLElement;
  private layer?: HTMLElement;
  private pinLayer?: HTMLElement;
  private imagePath = "";
  private menu?: HTMLElement;
  private pointer?: { x: number; y: number; startX: number; startY: number; pin?: number; onPin: boolean; moved: boolean };
  private suppressPinClick = false;
  constructor(readonly app: App, readonly plugin: TableTools, readonly container: HTMLElement, public owner: TFile, readonly inline = false, public highlight?: TFile) {}
  load(): void { this.plugin.mapPanels.add(this); this.unsubscribe = this.plugin.onNotesChanged(paths => paths.forEach(path => this.schedule(path))); this.render(); }
  unload(): void { this.unsubscribe?.(); this.plugin.mapPanels.delete(this); if (this.timer) clearTimeout(this.timer); }
  schedule(changedPath: string): void {
    const path = pathLink(changedPath).slice(2, -2);
    const basename = path.split("/").at(-1);
    if (changedPath !== this.owner.path && !pinsOf(this.app, this.owner).some(pin => { const link = linkTarget(pin.note); return link === path || link === basename; })) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const image = resolveLink(this.app, noteFields(this.app, this.owner).map, this.owner);
      if ((image?.path ?? "") === this.imagePath) this.renderPins();
      else this.render();
    }, 200) as unknown as number;
  }
  setOwner(file: TFile, highlight?: TFile): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined; this.owner = file; this.highlight = highlight; this.edit = false; this.scale = 1; this.x = 0; this.y = 0; this.render(); }
  private button(parent: HTMLElement, label: string, action: () => void): HTMLElement {
    const button = parent.createEl("button", { cls: "tt-btn", text: label, attr: { "aria-label": label } });
    button.onclick = action;
    return button;
  }
  private ancestors(): TFile[] {
    const chain: TFile[] = [];
    const seen = new Set([this.owner.path]);
    let file = this.owner;
    while (true) {
      const field = noteFields(this.app, file);
      const parent = resolveLink(this.app, field.type === "location" ? field.location || field.world : field.world, file);
      if (!parent || seen.has(parent.path)) break;
      seen.add(parent.path);
      chain.unshift(parent);
      file = parent;
    }
    return chain;
  }
  render(): void {
    const s = this.plugin.strings;
    this.menu = undefined;
    this.viewport = undefined;
    this.layer = undefined;
    this.pinLayer = undefined;
    this.container.empty();
    this.container.addClass("tt-map");
    if (this.inline) this.container.addClass("tt-map-inline");
    const head = this.container.createDiv("tt-map-head");
    head.createEl("h2", { text: s.mapTitle });
    const crumbs = head.createDiv("tt-map-crumbs");
    for (const ancestor of this.ancestors()) if (hasMap(this.app, ancestor)) this.button(crumbs, ancestor.basename, () => this.navigate(ancestor));
    crumbs.createSpan({ text: this.owner.basename });
    const actions = head.createDiv("tt-map-actions");
    if (this.inline) this.button(actions, s.mapOpen, () => void this.plugin.openMap(this.owner));
    const image = resolveLink(this.app, noteFields(this.app, this.owner).map, this.owner);
    this.imagePath = image?.path ?? "";
    if (!image || !imageTypes.has(image.extension.toLowerCase())) {
      this.container.createDiv({ cls: "tt-empty", text: s.mapNoImage });
      this.button(this.container, s.mapChooseImage, () => new MapImagePicker(this.app, this.plugin, this.owner, () => this.render()).open());
      return;
    }
    this.button(actions, s.mapZoomIn, () => this.zoom(1.3));
    this.button(actions, s.mapZoomOut, () => this.zoom(1 / 1.3));
    this.button(actions, s.mapFit, () => this.fit());
    const edit = this.button(actions, s.mapEditPins, () => { this.edit = !this.edit; edit.toggleClass("is-active", this.edit); edit.setAttribute("aria-pressed", String(this.edit)); this.renderPins(); });
    edit.toggleClass("is-active", this.edit);
    edit.setAttribute("aria-pressed", String(this.edit));
    const viewport = this.container.createDiv("tt-map-viewport");
    this.viewport = viewport;
    const layer = viewport.createDiv("tt-map-layer");
    this.layer = layer;
    const img = layer.createEl("img", { attr: { src: this.app.vault.getResourcePath(image), alt: this.owner.basename, draggable: "false" } });
    img.onload = () => { this.width = img.naturalWidth || 1000; this.height = img.naturalHeight || 1000; this.fit(); };
    this.pinLayer = layer.createDiv("tt-map-pins");
    this.applyTransform();
    this.renderPins();
    viewport.addEventListener("wheel", event => { if (this.inline && !event.ctrlKey && !event.metaKey) return; event.preventDefault(); this.zoom(event.deltaY < 0 ? 1.2 : 1 / 1.2, event.clientX, event.clientY); }, { passive: false });
    viewport.addEventListener("dblclick", event => { event.preventDefault(); this.zoom(1.6, event.clientX, event.clientY); });
    viewport.addEventListener("pointerdown", event => this.pointerDown(event));
    viewport.addEventListener("pointermove", event => this.pointerMove(event));
    viewport.addEventListener("pointerup", event => void this.pointerUp(event));
  }
  private navigate(file: TFile): void { if (this.inline) void this.plugin.openMap(file); else this.plugin.openMap(file); }
  private bounds(): DOMRect { return this.viewport?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1000, height: 1000 } as DOMRect; }
  private applyTransform(): void {
    if (!this.layer) return;
    this.layer.style.width = `${this.width}px`;
    this.layer.style.height = `${this.height}px`;
    this.layer.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
    this.layer.style.setProperty("--tt-map-inverse-scale", String(1 / this.scale));
    this.container.toggleClass("tt-map-labels", this.scale >= 2);
  }
  fit(): void { const bounds = this.bounds(); this.scale = clamp(Math.min(bounds.width / this.width, bounds.height / this.height), 0.2, 8); this.x = (bounds.width - this.width * this.scale) / 2; this.y = (bounds.height - this.height * this.scale) / 2; this.applyTransform(); }
  zoom(factor: number, clientX?: number, clientY?: number): void {
    const rect = this.bounds();
    const px = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const py = (clientY ?? rect.top + rect.height / 2) - rect.top;
    const next = clamp(this.scale * factor, 0.2, 8);
    this.x = px - (px - this.x) * next / this.scale;
    this.y = py - (py - this.y) * next / this.scale;
    this.scale = next;
    this.applyTransform();
  }
  private point(event: PointerEvent): { x: number; y: number } {
    const rect = this.bounds();
    return { x: rounded(((event.clientX - rect.left - this.x) / this.scale) / this.width), y: rounded(((event.clientY - rect.top - this.y) / this.scale) / this.height) };
  }
  private pointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const marker = (event.target as HTMLElement).closest(".tt-map-pin") as HTMLElement | null;
    const pin = marker?.dataset.index;
    this.pointer = { x: event.clientX, y: event.clientY, startX: this.x, startY: this.y, pin: this.edit && pin !== undefined ? Number(pin) : undefined, onPin: !!marker, moved: false };
  }
  private pointerMove(event: PointerEvent): void {
    if (!this.pointer) return;
    const dx = event.clientX - this.pointer.x;
    const dy = event.clientY - this.pointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 3 && !this.pointer.moved) { this.pointer.moved = true; this.viewport?.setPointerCapture?.(event.pointerId); }
    if (!this.pointer.moved) return;
    if (this.pointer.pin === undefined) { this.x = this.pointer.startX + dx; this.y = this.pointer.startY + dy; this.applyTransform(); }
    else {
      const pin = this.pinLayer?.querySelectorAll(".tt-map-pin")[this.pointer.pin] as HTMLElement | undefined;
      if (pin) { const point = this.point(event); pin.style.left = `${point.x * 100}%`; pin.style.top = `${point.y * 100}%`; }
    }
  }
  private async pointerUp(event: PointerEvent): Promise<void> {
    const pointer = this.pointer;
    this.pointer = undefined;
    if (!pointer) return;
    if (pointer.moved && pointer.onPin) { this.suppressPinClick = true; setTimeout(() => { this.suppressPinClick = false; }, 0); }
    if (pointer.pin !== undefined && pointer.moved) {
      const point = this.point(event);
      await this.writePins(pins => { if (pins[pointer.pin!]) pins[pointer.pin!] = { ...pins[pointer.pin!], ...point }; });
      return;
    }
    if (pointer.moved || !this.edit || pointer.onPin) return;
    const rect = this.bounds();
    const imageX = (event.clientX - rect.left - this.x) / this.scale;
    const imageY = (event.clientY - rect.top - this.y) / this.scale;
    if (imageX < 0 || imageX > this.width || imageY < 0 || imageY > this.height) return;
    this.showMenu(this.point(event));
  }
  private showMenu(point: { x: number; y: number }): void {
    this.menu?.remove();
    const menu = this.viewport!.createDiv("tt-map-menu");
    this.menu = menu;
    const bounds = this.bounds();
    menu.style.left = `${clamp(this.x + point.x * this.width * this.scale, 0, Math.max(0, bounds.width - 180))}px`;
    menu.style.top = `${clamp(this.y + point.y * this.height * this.scale, 0, Math.max(0, bounds.height - 40))}px`;
    menu.addEventListener("pointerdown", event => event.stopPropagation());
    menu.addEventListener("pointerup", event => event.stopPropagation());
    this.button(menu, this.plugin.strings.mapAttachNote, () => { menu.remove(); new LookupModal(this.app, this.plugin, file => void this.addPin(file, point)).open(); });
    this.button(menu, this.plugin.strings.mapNewLocation, () => { menu.remove(); new NewLocationModal(this.app, this.plugin, this.owner, file => void this.addPin(file, point)).open(); });
  }
  private async addPin(file: TFile, point: { x: number; y: number }): Promise<void> { await this.writePins(pins => { pins.push({ note: wikilink(this.app, file, this.owner.path), ...point }); }); }
  private async writePins(change: (pins: Pin[]) => void): Promise<void> {
    await this.app.fileManager.processFrontMatter(this.owner, fields => {
      const pins = Array.isArray(fields.pins) ? fields.pins.map((pin: Pin) => ({ ...pin })) : [];
      change(pins);
      fields.pins = pins;
    });
    this.renderPins();
  }
  private renderPins(): void {
    if (!this.pinLayer) return;
    this.pinLayer.empty();
    pinsOf(this.app, this.owner).forEach((pin, index) => {
      const target = resolveLink(this.app, pin.note, this.owner);
      const type = target ? String(noteFields(this.app, target).type ?? "") : "";
      const icon = type === "location" ? "map-pin" : type === "npc" || type === "pc" ? "user" : type === "faction" ? "flag" : type === "event" ? "calendar" : "scroll";
      const marker = this.pinLayer!.createDiv({ cls: `tt-map-pin${target ? "" : " is-missing"}${target?.path === this.highlight?.path ? " is-highlighted" : ""}`, attr: { title: target?.basename ?? `${this.plugin.strings.mapMissingNote}: ${pin.note}`, "data-index": String(index), tabindex: "0", role: "button" } });
      marker.style.left = `${pin.x * 100}%`;
      marker.style.top = `${pin.y * 100}%`;
      const glyph = marker.createSpan("tt-map-pin-icon");
      setIcon(glyph, icon);
      marker.createSpan({ cls: "tt-map-pin-label", text: target?.basename ?? pin.note });
      if (this.edit) this.button(marker, this.plugin.strings.mapRemovePin, () => {}).onclick = event => { event.stopPropagation(); void this.writePins(pins => { pins.splice(index, 1); }); };
      marker.onclick = event => { event.stopPropagation(); if (this.suppressPinClick) return; if (target) new LookupCard(this.app, this.plugin, { file: target, type, context: "", names: [], tier: 0 }).open(); };
      marker.onkeydown = event => { if (event.target === marker && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); marker.click(); } };
    });
  }
}

export class MapView extends ItemView {
  private panel?: MapPanel;
  private ownerPath = "";
  constructor(leaf: WorkspaceLeaf, readonly plugin: TableTools) { super(leaf); }
  getViewType(): string { return MAP_VIEW; }
  getDisplayText(): string { return this.plugin.strings.mapTitle; }
  getIcon(): string { return "map"; }
  getState(): Record<string, unknown> { return { owner: this.ownerPath }; }
  async setState(state: Record<string, unknown>): Promise<void> { this.ownerPath = String(state.owner ?? ""); this.show(); }
  async onOpen(): Promise<void> { this.show(); }
  async onClose(): Promise<void> { this.panel?.unload(); }
  setOwner(file: TFile, highlight?: TFile): void { this.ownerPath = file.path; this.show(highlight); }
  private show(highlight?: TFile): void {
    const file = this.app.vault.getAbstractFileByPath(this.ownerPath);
    if (!(file instanceof TFile)) return;
    if (this.panel) this.panel.setOwner(file, highlight);
    else { this.panel = new MapPanel(this.app, this.plugin, this.contentEl, file, false, highlight); this.panel.load(); }
  }
}

export class MapBlock extends MarkdownRenderChild {
  private panel?: MapPanel;
  constructor(container: HTMLElement, private readonly app: App, private readonly plugin: TableTools, private readonly path: string) { super(container); }
  onload(): void { const file = this.app.vault.getAbstractFileByPath(this.path); if (file instanceof TFile) { this.panel = new MapPanel(this.app, this.plugin, this.containerEl, file, true); this.panel.load(); } }
  onunload(): void { this.panel?.unload(); }
}
