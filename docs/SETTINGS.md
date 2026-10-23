# Table Tools settings

Every Table Tools option, its stored key, and its default. Open **Settings → Table Tools** to change them.

!!! note "How to read the tables"
    The **Key** column is the name stored in the plugin's `data.json`. "empty" means an empty string, not a missing value. Rows marked "button" store nothing.

## Assistant (Google Gemini)

The assistant sends your question and the selected context to Google Gemini when an API key is set.

| Setting | Key | Default | Use it to |
| --- | --- | --- | --- |
| **API key** | `apiKey` | empty | Authenticate requests to Google. Stored locally in `data.json`; never commit it. |
| **Model** | `model` | `gemini-3.8-flash` | Pick the model for answers, after **Fetch list** confirms what the key can use. |
| **Fetch list** | `models` | `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.5-flash-lite`, `gemini-2.5-pro`, `gemini-2.5-flash` | Refresh the Model dropdown from the models available to the key. |
| **Temperature** | `temperature` | `0.8` | Vary answers from 0 to 1.5; lower is more predictable. |
| **System prompt** | `systemPrompt` | the built-in **You co-run a tabletop RPG session** GM prompt | Set the assistant's standing role, brevity, canon, scene, NPC, mechanics, and read-aloud rules. |
| **Context limit (characters)** | `maxContext` | `24000` | Limit the note text included in one question. |
| **Retrieval budget (tokens)** | `contextBudgetTokens` | `6000` | Cap pinned plus retrieved context, using a character-to-token estimate. |
| **Maximum tool steps** | `maxToolSteps` | `5` | Cap read-only tool rounds for one answer. |

### Active run paths

Leave these alone unless your vault layout differs from the defaults.

| Setting | Key | Default | Use it to |
| --- | --- | --- | --- |
| **Active run pointer** | `activePointerPath` | `Active.md` | Name the note that points to the active run. |
| **Campaign note override** | `campaignPath` | empty | Use another campaign than the active run's. Empty uses the current run. |
| **World-day note override** | `worldDayPath` | empty | Use another world-day note. Empty uses the current run. |

### Assistant view toggles

These switches sit in the assistant view and decide what each request includes.

| Toggle | Key | Default | Includes |
| --- | --- | --- | --- |
| **Run** | `includeCampaign` | `true` | Campaign, run, and state context |
| **Today** | `includeWorldDay` | `true` | World date, moon, and season |
| **Note** | `includeActiveNote` | `true` | The active Markdown note |
| **Combat** | `includeCombat` | `true` | The combat tracker summary |
| **Search** | `contextRetrieval` | `true` | Relevant notes found in scope; off means only pinned context and attachments |

### Semantic search (embeddings)

Optional. Without it the assistant still searches your notes with local keyword search.

| Setting | Key | Default | Use it to |
| --- | --- | --- | --- |
| **Embedding provider** | `embeddingProvider` | `none` | Choose `none` (keyword search only), `local` (a model running inside Obsidian), `ollama` (local service), or `gemini` (sends note text to Google). |
| **Local embedding model** | `localModel` | `Xenova/multilingual-e5-small` | The Hugging Face model used by `local`. The default understands Polish, English and about 100 other languages. |
| **Local model** | `localModelApproved` | empty | Shows whether the model is downloaded. **Download model** asks first and records the approved model; **Delete downloaded model** removes it and turns local search off. |
| **Ollama URL** | `ollamaUrl` | `http://127.0.0.1:11434` | Point at your Ollama service. Note text is sent there. |
| **Ollama embedding model** | `ollamaModel` | `embeddinggemma` | Match the model you pulled into Ollama. |
| **Gemini embedding model** | `geminiEmbeddingModel` | `gemini-embedding-001` | Pick the Gemini embedding model from the dropdown. |
| **Fetch list** (embedding models) | `embeddingModels` | `gemini-embedding-001` | Fill that dropdown with the models your key can use for embeddings. |
| **Embedding dimensions** | `embeddingDimensions` | `768` | Set the Gemini vector size; change only with a compatible model. |
| **Test embedding provider** | button | — | Check the provider; it reports the returned dimensions or the exact error. |

!!! tip
    After changing provider, URL, model, or dimensions, press **Test embedding provider**. The index is rebuilt automatically for the new model. [Assistant](ASSISTANT.md) explains the setup step by step.

## Updates

| Setting | Key | Default | What it does |
| --- | --- | --- | --- |
| **Check for updates** | button | — | Asks the release host in `_system/manifest.json` (or `_local/release.json`) whether a newer GMVault exists, records the answer in `.gmvault/state.json`, and downloads nothing. |
| **Check once a day** | `checkForUpdatesOnStart` | `false` | Asks at most once every 24 hours after Obsidian restores the layout; speaks up only when a newer release exists and stays silent when the host is unreachable. |

Home shows the recorded result as its update banner. Installing and recovering are covered in [Keeping a vault up to date](UPDATING.md).

## Home

| Setting | Key | Default | What it does |
| --- | --- | --- | --- |
| **Open Home on startup** | `openHomeOnStartup` | `true` | Opens the home view after Obsidian restores the layout. |

## Combat

| Setting | Key | Default | What it does |
| --- | --- | --- | --- |
| **Bestiary folder override** | `bestiaryPath` | empty | Replaces the shared and campaign homebrew bestiary folders. |
| **Party folder override** | `partyPath` | empty | Replaces the party folder taken from the active run. |
| **Average enemy hit points** | `useAverageHitPoints` | `true` | Uses statblock HP; off rolls `hit_dice`. |
| **Shared initiative for groups** | `groupInitiative` | `true` | Lets identical creatures act together. |
| **Attack bonus phrases** | `attackBonusPhrases` | `to hit` | Comma-separated phrases after attack bonuses that turn them into clickable rolls. |

## Related pages

- [Combat tracker and dice](TABLE-TOOLS.md): the controls these settings affect
- [Assistant](ASSISTANT.md): scope, requests, tools, indexing, and providers
- Use **Assistant: rebuild index** after large changes to your notes or embedding setup.
