import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type TableTools from "./main";
import { ConfirmModal } from "./combat-modals";
import { listEmbeddingModels, listModels } from "./gemini";
import { LOCAL_CACHE } from "./local-embeddings";
import { format } from "./strings";
import { DEFAULTS, Settings } from "./types";

export class TableToolsSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: TableTools) { super(app, plugin); }

  private confirmLocalDownload(then?: () => void): void {
    const settings = this.plugin.settings;
    const s = this.plugin.strings;
    new ConfirmModal(this.app, s, format(s.localDownloadConfirm, { model: settings.localModel }), s.settingsLocalDownloadButton, () => {
      settings.localModelApproved = settings.localModel;
      then?.();
      void this.plugin.applyEmbeddingSettings();
      this.display();
    }).open();
  }

  private async deleteLocalModel(): Promise<void> {
    const settings = this.plugin.settings;
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(LOCAL_CACHE)) await adapter.rmdir(LOCAL_CACHE, true);
    settings.localModelApproved = "";
    if (settings.embeddingProvider === "local") settings.embeddingProvider = "none";
    await this.plugin.applyEmbeddingSettings();
    new Notice(this.plugin.strings.localModelDeleted);
    this.display();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.strings;
    const settings = this.plugin.settings;
    const save = (): void => { void this.plugin.save(); };

    new Setting(containerEl).setName(s.settingsAssistantHeading).setHeading();
    new Setting(containerEl).setName(s.settingsApiKey).setDesc(s.settingsApiKeyDescription).addText(text => {
      text.inputEl.type = "password";
      text.setPlaceholder("AIza\u2026").setValue(settings.apiKey).onChange(value => { settings.apiKey = value.trim(); save(); });
    });
    const model = new Setting(containerEl).setName(s.settingsModel).setDesc(s.settingsModelDescription);
    const renderModel = (): void => {
      model.controlEl.empty();
      model.addDropdown(dropdown => {
        for (const name of settings.models) dropdown.addOption(name, name);
        if (!settings.models.includes(settings.model)) dropdown.addOption(settings.model, settings.model);
        dropdown.setValue(settings.model).onChange(value => { settings.model = value; save(); });
      });
      model.addButton(button => button.setButtonText(s.settingsFetchModels).onClick(async () => {
        if (!settings.apiKey) { new Notice(s.settingsNeedApiKey); return; }
        try {
          const models = await listModels(settings.apiKey, s);
          if (!models.length) { new Notice(s.settingsModelListEmpty); return; }
          settings.models = models;
          if (!models.includes(settings.model)) settings.model = models.find(name => /flash/.test(name) && !/lite/.test(name)) ?? models[0];
          save();
          renderModel();
          new Notice(format(s.settingsModelCount, { count: models.length }));
        } catch (error) {
          new Notice(error instanceof Error ? error.message : String(error));
        }
      }));
    };
    renderModel();
    new Setting(containerEl).setName(s.settingsTemperature).setDesc(s.settingsTemperatureDescription)
      .addSlider(slider => slider.setLimits(0, 1.5, 0.1).setValue(settings.temperature).setDynamicTooltip().onChange(value => { settings.temperature = value; save(); }));
    new Setting(containerEl).setName(s.settingsSystemPrompt).setDesc(s.settingsSystemPromptDescription).addTextArea(text => {
      text.inputEl.rows = 12;
      text.inputEl.style.width = "100%";
      text.setValue(settings.systemPrompt).onChange(value => { settings.systemPrompt = value; save(); });
    });
    new Setting(containerEl).setName(s.settingsContextLimit).setDesc(s.settingsContextLimitDescription)
      .addText(text => text.setValue(String(settings.maxContext)).onChange(value => { settings.maxContext = Number(value) || DEFAULTS.maxContext; save(); }));
    new Setting(containerEl).setName(s.settingsContextBudget).setDesc(s.settingsContextBudgetDescription)
      .addText(text => text.setValue(String(settings.contextBudgetTokens)).onChange(value => { settings.contextBudgetTokens = Number(value) || DEFAULTS.contextBudgetTokens; save(); }));
    new Setting(containerEl).setName(s.settingsToolSteps).setDesc(s.settingsToolStepsDescription)
      .addText(text => text.setValue(String(settings.maxToolSteps)).onChange(value => { settings.maxToolSteps = Number(value) || DEFAULTS.maxToolSteps; save(); }));
    new Setting(containerEl).setName(s.settingsEmbeddingProvider).setDesc(s.settingsEmbeddingProviderDescription).addDropdown(dropdown => {
      dropdown.addOption("none", "None").addOption("local", s.settingsLocalProvider).addOption("ollama", "Ollama").addOption("gemini", "Gemini");
      dropdown.setValue(settings.embeddingProvider).onChange(value => {
        if (value === "local" && settings.localModelApproved !== settings.localModel) {
          dropdown.setValue(settings.embeddingProvider);
          this.confirmLocalDownload(() => { settings.embeddingProvider = "local"; });
          return;
        }
        settings.embeddingProvider = value as Settings["embeddingProvider"];
        void this.plugin.applyEmbeddingSettings();
      });
    });
    new Setting(containerEl).setName(s.settingsLocalModel).setDesc(s.settingsLocalModelDescription).addText(text => text.setValue(settings.localModel).onChange(value => { settings.localModel = value.trim() || DEFAULTS.localModel; void this.plugin.applyEmbeddingSettings(); }));
    const approved = settings.localModelApproved === settings.localModel;
    new Setting(containerEl).setName(s.settingsLocalDownload).setDesc(approved ? s.settingsLocalDownloaded : s.settingsLocalNotDownloaded).addButton(button => approved
      ? button.setButtonText(s.settingsLocalDeleteButton).onClick(() => this.deleteLocalModel())
      : button.setButtonText(s.settingsLocalDownloadButton).onClick(() => this.confirmLocalDownload()));
    new Setting(containerEl).setName(s.settingsOllamaUrl).addText(text => text.setValue(settings.ollamaUrl).onChange(value => { settings.ollamaUrl = value.trim(); void this.plugin.applyEmbeddingSettings(); }));
    new Setting(containerEl).setName(s.settingsOllamaModel).addText(text => text.setValue(settings.ollamaModel).onChange(value => { settings.ollamaModel = value.trim(); void this.plugin.applyEmbeddingSettings(); }));
    const embeddingModel = new Setting(containerEl).setName(s.settingsGeminiEmbeddingModel).setDesc(s.settingsGeminiEmbeddingDescription);
    const renderEmbeddingModel = (): void => {
      embeddingModel.controlEl.empty();
      embeddingModel.addDropdown(dropdown => {
        for (const name of settings.embeddingModels) dropdown.addOption(name, name);
        if (!settings.embeddingModels.includes(settings.geminiEmbeddingModel)) dropdown.addOption(settings.geminiEmbeddingModel, settings.geminiEmbeddingModel);
        dropdown.setValue(settings.geminiEmbeddingModel).onChange(value => { settings.geminiEmbeddingModel = value; void this.plugin.applyEmbeddingSettings(); });
      });
      embeddingModel.addButton(button => button.setButtonText(s.settingsFetchModels).onClick(async () => {
        if (!settings.apiKey) { new Notice(s.settingsNeedApiKey); return; }
        try {
          const models = await listEmbeddingModels(settings.apiKey, s);
          if (!models.length) { new Notice(s.settingsModelListEmpty); return; }
          settings.embeddingModels = models;
          if (!models.includes(settings.geminiEmbeddingModel)) settings.geminiEmbeddingModel = models.includes("gemini-embedding-001") ? "gemini-embedding-001" : models[0];
          await this.plugin.applyEmbeddingSettings();
          renderEmbeddingModel();
          new Notice(format(s.settingsModelCount, { count: models.length }));
        } catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
      }));
    };
    renderEmbeddingModel();
    new Setting(containerEl).setName(s.settingsEmbeddingDimensions).addText(text => text.setValue(String(settings.embeddingDimensions)).onChange(value => { settings.embeddingDimensions = Number(value) || DEFAULTS.embeddingDimensions; void this.plugin.applyEmbeddingSettings(); }));
    new Setting(containerEl).setName(s.settingsEmbeddingTest).addButton(button => button.setButtonText(s.settingsEmbeddingTest).onClick(async () => {
      try {
        await this.plugin.applyEmbeddingSettings();
        const dimensions = await this.plugin.index.testEmbedding();
        new Notice(format(s.settingsEmbeddingTestSuccess, { dimensions: String(dimensions) }));
      } catch (error) { new Notice(error instanceof Error ? error.message : String(error)); }
    }));
    const path = (name: string, key: "activePointerPath" | "campaignPath" | "worldDayPath" | "bestiaryPath" | "partyPath", description = ""): void => {
      const setting = new Setting(containerEl).setName(name);
      if (description) setting.setDesc(description);
      setting.addText(text => text.setValue(settings[key]).onChange(value => { settings[key] = value.trim(); save(); }));
    };
    path(s.settingsActivePointer, "activePointerPath");
    path(s.settingsCampaignOverride, "campaignPath", s.settingsUseCurrentRun);
    path(s.settingsWorldDayOverride, "worldDayPath", s.settingsUseCurrentRun);

    new Setting(containerEl).setName(s.settingsUpdateHeading).setHeading();
    new Setting(containerEl).setName(s.settingsCheckForUpdates).setDesc(s.settingsCheckForUpdatesDescription)
      .addButton(button => button.setButtonText(s.settingsCheckForUpdates).onClick(async () => {
        try {
          const result = await this.plugin.checkForUpdates();
          new Notice(result.newer
            ? format(s.settingsUpdateAvailable, { version: result.latestVersion, installed: result.installedVersion })
            : format(s.settingsUpdateCurrent, { installed: result.installedVersion }));
        } catch (error) {
          new Notice(format(s.settingsUpdateFailed, { reason: error instanceof Error ? error.message : String(error) }));
        }
      }));
    new Setting(containerEl).setName(s.settingsCheckOnStart).setDesc(s.settingsCheckOnStartDescription)
      .addToggle(toggle => toggle.setValue(settings.checkForUpdatesOnStart).onChange(value => { settings.checkForUpdatesOnStart = value; save(); }));

    new Setting(containerEl).setName(s.settingsHomeHeading).setHeading();
    new Setting(containerEl).setName(s.settingsOpenHomeOnStartup).setDesc(s.settingsOpenHomeOnStartupDescription)
      .addToggle(toggle => toggle.setValue(settings.openHomeOnStartup).onChange(value => { settings.openHomeOnStartup = value; save(); }));

    new Setting(containerEl).setName(s.settingsCombatHeading).setHeading();
    path(s.settingsBestiaryOverride, "bestiaryPath", s.settingsBestiaryOverrideDescription);
    path(s.settingsPartyOverride, "partyPath", s.settingsUseCurrentRun);
    new Setting(containerEl).setName(s.settingsAverageHitPoints).setDesc(s.settingsAverageHitPointsDescription)
      .addToggle(toggle => toggle.setValue(settings.useAverageHitPoints).onChange(value => { settings.useAverageHitPoints = value; save(); }));
    new Setting(containerEl).setName(s.settingsGroupInitiative).setDesc(s.settingsGroupInitiativeDescription)
      .addToggle(toggle => toggle.setValue(settings.groupInitiative).onChange(value => { settings.groupInitiative = value; save(); }));
    new Setting(containerEl).setName(s.settingsAttackBonusPhrases).setDesc(s.settingsAttackBonusPhrasesDescription)
      .addText(text => text.setValue(settings.attackBonusPhrases).onChange(value => { settings.attackBonusPhrases = value; save(); }));
  }
}
