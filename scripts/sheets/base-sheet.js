import { DescriptionEditor } from './editors/description-editor.js';
import { CampaignCodexLinkers } from './linkers.js';
import { TemplateComponents } from './template-components.js';

// v13 ApplicationV2 imports
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { JournalSheetV2 } = foundry.applications.sheets;

// Base sheet class with shared functionality - v13 ApplicationV2 conversion
export class CampaignCodexBaseSheet extends HandlebarsApplicationMixin(JournalSheetV2) {
  constructor(options = {}) {
    super(options);
    this._currentTab = 'info';
  }

  // v13: Replace defaultOptions() with DEFAULT_OPTIONS static field
  static DEFAULT_OPTIONS = {
    classes: ["sheet", "journal-sheet", "campaign-codex", "themed"],
    position: { 
      width: 1000, 
      height: 700 
    },
    window: {
      resizable: true,
      minimizable: true
    },
    // Define actions declaratively instead of using activateListeners
    actions: {
      editDescription: CampaignCodexBaseSheet.#onEditDescription,
      editNotes: CampaignCodexBaseSheet.#onEditNotes,
      dropNPCsToMap: CampaignCodexBaseSheet.#onDropNPCsToMapClick,
      openDocument: CampaignCodexBaseSheet.#onOpenDocument,
      removeFromList: CampaignCodexBaseSheet.#onRemoveFromList,
      removeFromRegion: CampaignCodexBaseSheet.#onRemoveFromRegion,
      saveData: CampaignCodexBaseSheet.#onSaveData,
      tabSwitch: CampaignCodexBaseSheet.#onTabSwitch,
      nameEdit: CampaignCodexBaseSheet.#onNameEdit,
      imageClick: CampaignCodexBaseSheet.#onImageClick
    },
    // Define form handling
    form: {
      submitOnChange: false,
      closeOnSubmit: false
    }
  };

  // v13: Define template parts
  static PARTS = {
    form: {
      template: "" // Set by subclasses
    }
  };

  // v13: Replace getData() with _prepareContext()
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sheetData = this.document.getFlag("campaign-codex", "data") || {};

    context.sheetData = {
      description: sheetData.description || "",
      notes: sheetData.notes || ""
    };
    
    // Text enrichment in _prepareContext
    context.sheetData.enrichedDescription = await TextEditor.enrichHTML(
      context.sheetData.description, 
      { async: true, secrets: this.document.isOwner }
    );
    context.sheetData.enrichedNotes = await TextEditor.enrichHTML(
      context.sheetData.notes, 
      { async: true, secrets: this.document.isOwner }
    );

    context.canEdit = this.document.canUserModify(game.user, "update");
    context.currentTab = this._currentTab;

    return context;
  }

  // v13: Replace activateListeners with _onRender for DOM setup
  _onRender(context, options) {
    super._onRender(context, options);

    // Set up drop zones and other DOM interactions
    this._setupDropZones();
    this._setupNameEditing();
    this._setupImageChange();
    
    // Initialize current tab
    this._showTab(this._currentTab);
    
    // Let subclasses add their own listeners
    this._activateSheetSpecificListeners();
  }

  // Action handlers (all static methods with # prefix for private)
  static async #onEditDescription(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const field = target.dataset.field || 'description';
    new DescriptionEditor(this.document, { field }).render(true);
  }

  static async #onEditNotes(event, target) {
    event.preventDefault();
    event.stopPropagation();
    new DescriptionEditor(this.document, { field: 'notes' }).render(true);
  }

  static async #onDropNPCsToMapClick(event, target) {
    event.preventDefault();
    return this._onDropNPCsToMapClick(event);
  }

  static async #onOpenDocument(event, target) {
    event.stopPropagation();
    const type = target.dataset.type;
    return this._onOpenDocument(event, type);
  }

  static async #onRemoveFromList(event, target) {
    const listName = target.dataset.listName;
    return this._onRemoveFromList(event, listName);
  }

  static async #onRemoveFromRegion(event, target) {
    return this._onRemoveFromRegion(event);
  }

  static async #onSaveData(event, target) {
    return this._onSaveData(event);
  }

  static async #onTabSwitch(event, target) {
    event.preventDefault();
    const tab = target.dataset.tab;
    this._currentTab = tab;
    this._showTab(tab);
  }

  static async #onNameEdit(event, target) {
    return this._onNameEdit(event);
  }

  static async #onImageClick(event, target) {
    return this._onImageClick(event);
  }

  // v13: Convert jQuery-based tab handling to vanilla JavaScript
  _showTab(tabName) {
    const html = this.element;
    
    // Remove active class from all tabs and panels (vanilla JS)
    html.querySelectorAll('.sidebar-tabs .tab-item').forEach(tab => {
      tab.classList.remove('active');
    });
    html.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    // Add active class to selected tab and panel
    const activeTab = html.querySelector(`.sidebar-tabs .tab-item[data-tab="${tabName}"]`);
    const activePanel = html.querySelector(`.tab-panel[data-tab="${tabName}"]`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activePanel) activePanel.classList.add('active');
  }

  // v13: Convert jQuery drop zone setup to vanilla JavaScript
  _setupDropZones() {
    const html = this.element;
    html.addEventListener('drop', this._onDrop.bind(this));
    html.addEventListener('dragover', this._onDragOver.bind(this));
  }

  // v13: Convert jQuery name editing to vanilla JavaScript
  _setupNameEditing() {
    const html = this.element;
    const titleElement = html.querySelector('.sheet-title');
    if (titleElement) {
      titleElement.addEventListener('click', this._onNameEdit.bind(this));
    }
    
    // Event delegation for dynamically created inputs
    html.addEventListener('blur', (event) => {
      if (event.target.classList.contains('name-input')) {
        this._onNameSave(event);
      }
    });
    
    html.addEventListener('keypress', (event) => {
      if (event.target.classList.contains('name-input') && event.which === 13) {
        event.target.blur();
      }
    });
  }

  // v13: Convert jQuery image change setup to vanilla JavaScript
  _setupImageChange() {
    const html = this.element;
    const imageBtn = html.querySelector('.image-change-btn');
    if (imageBtn) {
      // Remove existing listeners and add new one
      imageBtn.removeEventListener('click', this._onImageClick);
      imageBtn.addEventListener('click', this._onImageClick.bind(this));
    }
  }

  // Name editing functionality - converted to vanilla JavaScript
  async _onNameEdit(event) {
    const nameElement = event.currentTarget;
    const currentName = nameElement.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.value = currentName;
    input.style.cssText = `
      background: transparent; 
      border: 1px solid rgba(255,255,255,0.3); 
      color: white; 
      padding: 4px 8px; 
      border-radius: 4px; 
      font-family: 'Modesto Condensed', serif; 
      font-size: 28px; 
      font-weight: 700; 
      text-transform: uppercase; 
      letter-spacing: 2px; 
      width: 100%;
    `;
    
    nameElement.replaceWith(input);
    input.focus();
    input.select();
  }

  async _onNameSave(event) {
    const input = event.currentTarget;
    const newName = input.value.trim();
    
    if (newName && newName !== this.document.name) {
      await this.document.update({ name: newName });
    }
    
    const nameElement = document.createElement('h1');
    nameElement.className = 'sheet-title';
    nameElement.textContent = this.document.name;
    nameElement.addEventListener('click', this._onNameEdit.bind(this));
    
    input.replaceWith(nameElement);
  }

  async _onImageClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const current = this.document.getFlag("campaign-codex", "image") || this.document.img;
    const fp = new FilePicker({
      type: "image",
      current: current,
      callback: async (path) => {
        try {
          await this.document.setFlag("campaign-codex", "image", path);
          this.render(false);
          ui.notifications.info("Image updated successfully!");
        } catch (error) {
          console.error("Failed to update image:", error);
          ui.notifications.error("Failed to update image");
        }
      },
      top: this.position.top + 40,
      left: this.position.left + 10
    });
    
    return fp.browse();
  }

  _onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "link";
  }

  // v13: Updated drop handling with vanilla JavaScript
  async _onDrop(event) {
    event.preventDefault();
    if (this._dropping) return;
    this._dropping = true;
    
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
      this._dropping = false;
      return;
    }

    try {
      await this._saveFormData();
      await this._handleDrop(data, event);
      
      // Refresh related sheets
      const sheetsToRefresh = new Set();
      const myDocUuid = this.document.uuid;
      sheetsToRefresh.add(this);
      
      for (const app of Object.values(ui.windows)) {
        if (!app.document?.getFlag || app === this) continue;
        
        const appType = app.document.getFlag("campaign-codex", "type");
        if (appType && app._isRelatedDocument && await app._isRelatedDocument(myDocUuid)) {
          sheetsToRefresh.add(app);
        }
      }

      for (const app of sheetsToRefresh) {
        console.log(`Campaign Codex | Refreshing sheet: ${app.document.name}`);
        app.render(false);
      }
      
    } catch (error) {
      console.error('Campaign Codex | Error handling drop:', error);
    } finally {
      this._dropping = false;
    }
  }

  // v13: Convert jQuery form handling to vanilla JavaScript
  async _onSaveData(event) {
    event.preventDefault();
    
    const form = this.element.querySelector('form');
    const formData = new FormDataExtended(form);
    const data = formData.object;
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    
    const updatedData = { ...currentData };
    
    // Get prosemirror-edited fields
    const proseEditedFields = new Set();
    this.element.querySelectorAll('[name="proseedited"]').forEach(element => {
      const editBtn = element.querySelector('[class^="cc-edit-"]');
      if (editBtn) {
        const className = editBtn.className;
        const fieldMatch = className.match(/cc-edit-(\w+)/);
        if (fieldMatch) {
          proseEditedFields.add(fieldMatch[1]);
        }
      }
    });
    
    // Only update non-prosemirror fields
    Object.keys(data).forEach(fieldName => {
      if (!proseEditedFields.has(fieldName)) {
        updatedData[fieldName] = data[fieldName] || "";
      }
    });

    try {
      await this.document.setFlag("campaign-codex", "data", updatedData);
      ui.notifications.info(`${this.constructor.name.replace('Sheet', '')} saved successfully!`);
      
      const saveBtn = event.currentTarget;
      saveBtn.classList.add('success');
      setTimeout(() => saveBtn.classList.remove('success'), 1500);
      
    } catch (error) {
      console.error("Campaign Codex | Error saving data:", error);
      ui.notifications.error("Failed to save data!");
      
      const saveBtn = event.currentTarget;
      saveBtn.classList.add('error');
      setTimeout(() => saveBtn.classList.remove('error'), 1500);
    }
  }

  // v13: Convert jQuery form data saving to vanilla JavaScript
  async _saveFormData() {
    const form = this.element?.querySelector('form');
    if (form) {
      try {
        const formData = new FormDataExtended(form);
        const data = formData.object;
        const currentData = this.document.getFlag("campaign-codex", "data") || {};
        
        const updatedData = { ...currentData };
        
        // Get prosemirror-edited fields
        const proseEditedFields = new Set();
        this.element.querySelectorAll('[name="proseedited"]').forEach(element => {
          const editBtn = element.querySelector('[class^="cc-edit-"]');
          if (editBtn) {
            const className = editBtn.className;
            const fieldMatch = className.match(/cc-edit-(\w+)/);
            if (fieldMatch) {
              proseEditedFields.add(fieldMatch[1]);
            }
          }
        });
        
        Object.keys(data).forEach(fieldName => {
          if (!proseEditedFields.has(fieldName)) {
            updatedData[fieldName] = data[fieldName] || "";
          }
        });
        
        await this.document.setFlag("campaign-codex", "data", updatedData);
      } catch (error) {
        console.warn("Campaign Codex | Could not auto-save form data:", error);
      }
    }
  }

  // Updated document opening with vanilla JavaScript
  async _onOpenDocument(event, type) {
    event.stopPropagation();
    const target = event.currentTarget;
    const uuid = target.dataset[`${type}Uuid`] || 
                 target.closest(`[data-${type}-uuid]`)?.dataset[`${type}Uuid`];
    
    if (!uuid) {
      console.warn(`Campaign Codex | No UUID found for ${type}`);
      return;
    }
    
    try {
      const doc = await fromUuid(uuid);
      if (doc) {
        doc.sheet.render(true);
      } else {
        ui.notifications.warn(`${type} document not found`);
      }
    } catch (error) {
      console.error(`Campaign Codex | Error opening ${type}:`, error);
      ui.notifications.error(`Failed to open ${type}`);
    }
  }

  async _onRemoveFromList(event, listName) {
    await this._saveFormData();

    const itemUuid = event.currentTarget.dataset[Object.keys(event.currentTarget.dataset)[0]];
    const myDoc = this.document;
    const myData = myDoc.getFlag("campaign-codex", "data") || {};
    const myType = myDoc.getFlag("campaign-codex", "type");
    
    if (!myData[listName]) return;

    // Update data on current document
    const originalLength = Array.isArray(myData[listName]) ? myData[listName].length : (myData[listName] ? 1 : 0);
    
    if (Array.isArray(myData[listName])) {
      myData[listName] = myData[listName].filter(uuid => uuid !== itemUuid);
    } else {
      myData[listName] = null;
    }

    const newLength = Array.isArray(myData[listName]) ? myData[listName].length : (myData[listName] ? 1 : 0);

    if (originalLength === newLength) {
      this.render(false);
      return;
    }

    await myDoc.setFlag("campaign-codex", "data", myData);

    // Handle bidirectional cleanup
    let targetDoc;
    try {
      const relationshipMap = {
        'npc:linkedShops':    { targetType: 'shop',     reverseField: 'linkedNPCs',      isArray: true  },
        'npc:linkedLocations':{ targetType: 'location', reverseField: 'linkedNPCs',      isArray: true  },
        'npc:associates':     { targetType: 'npc',      reverseField: 'associates',      isArray: true  },
        'location:linkedNPCs':{ targetType: 'npc',      reverseField: 'linkedLocations', isArray: true  },
        'location:linkedShops': { targetType: 'shop',     reverseField: 'linkedLocation',  isArray: false },
        'shop:linkedNPCs':    { targetType: 'npc',      reverseField: 'linkedShops',      isArray: true  },
      };

      const relationshipKey = `${myType}:${listName}`;
      const reverseLink = relationshipMap[relationshipKey];

      if (reverseLink) {
        targetDoc = await fromUuid(itemUuid);
        if (!targetDoc || targetDoc.getFlag("campaign-codex", "type") !== reverseLink.targetType) {
          return;
        }

        const targetData = targetDoc.getFlag("campaign-codex", "data") || {};
        const reverseField = reverseLink.reverseField;
        let targetUpdated = false;

        if (reverseLink.isArray) {
          const originalTargetLength = (targetData[reverseField] || []).length;
          targetData[reverseField] = (targetData[reverseField] || []).filter(uuid => uuid !== myDoc.uuid);
          if (targetData[reverseField].length < originalTargetLength) {
            targetUpdated = true;
          }
        } else {
          if (targetData[reverseField] === myDoc.uuid) {
            targetData[reverseField] = null;
            targetUpdated = true;
          }
        }

        if (targetUpdated) {
          await targetDoc.setFlag("campaign-codex", "data", targetData);
        }
      }
    } catch (error) {
      console.error("Campaign Codex | Error in bidirectional cleanup:", error);
    }

    // Refresh UI for affected documents
    this.render(false);
    if (targetDoc) {
      for (const app of Object.values(ui.windows)) {
        if (app.document && app.document.uuid === targetDoc.uuid) {
          app.render(false);
          break;
        }
      }
    }

    const targetName = targetDoc ? targetDoc.name : 'item';
    ui.notifications.info(`Removed link to "${targetName}"`);
  }

  async _handleActorDrop(data, event) {
    const sourceActor = await fromUuid(data.uuid);
    if (!sourceActor) {
      ui.notifications.warn("Could not find the dropped actor.");
      return;
    }

    const actor = sourceActor;
    if (!actor) return;
    await this._saveFormData();

    const sheetType = this.getSheetType();

    switch (sheetType) {
      case 'location': {
        const npcJournal = await game.campaignCodex.findOrCreateNPCJournalForActor(actor);
        if (npcJournal) {
          await game.campaignCodex.linkLocationToNPC(this.document, npcJournal);
          ui.notifications.info(`Linked "${actor.name}" to location "${this.document.name}"`);
        }
        break;
      }

      case 'shop': {
        const npcJournal = await game.campaignCodex.findOrCreateNPCJournalForActor(actor);
        if (npcJournal) {
          await game.campaignCodex.linkShopToNPC(this.document, npcJournal);
          ui.notifications.info(`Linked "${actor.name}" to shop "${this.document.name}"`);
        }
        break;
      }

      case 'npc': {
        const dropZone = event.target.closest('.drop-zone');
        const dropType = dropZone?.dataset.dropType;

        if (dropType === 'actor') {
          const myData = this.document.getFlag("campaign-codex", "data") || {};
          myData.linkedActor = actor.uuid;
          await this.document.setFlag("campaign-codex", "data", myData);
          ui.notifications.info(`Linked actor "${actor.name}" to this journal.`);
        } else if (dropType === 'associate') {
          const associateJournal = await game.campaignCodex.findOrCreateNPCJournalForActor(actor);
          if (associateJournal && associateJournal.uuid !== this.document.uuid) {
            await game.campaignCodex.linkNPCToNPC(this.document, associateJournal);
            ui.notifications.info(`Linked "${actor.name}" as an associate.`);
          } else if (associateJournal.uuid === this.document.uuid) {
            ui.notifications.warn("Cannot link an NPC to itself as an associate.");
          }
        }
        break;
      }

      default:
        ui.notifications.warn(`Actor drop not configured for "${sheetType}" sheets.`);
        return;
    }

    this.render(false);
  }

  async _onRemoveFromRegion(event) {
    event.preventDefault();
    event.stopPropagation();
    await this._saveFormData();

    const myType = this.getSheetType();
    let locationDoc, regionDoc;

    if (myType === 'location') {
      locationDoc = this.document;
      const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
      const regionUuid = locationData.parentRegion;
      if (regionUuid) {
        regionDoc = await fromUuid(regionUuid);
      }
    } else if (myType === 'region') {
      regionDoc = this.document;
      const locationUuid = event.currentTarget.dataset.locationUuid;
      if (locationUuid) {
        locationDoc = await fromUuid(locationUuid);
      }
    }

    if (!locationDoc || !regionDoc) {
      ui.notifications.warn("Could not find the linked region or location.");
      this.render(false);
      return;
    }

    // Remove link from Region
    const regionData = regionDoc.getFlag("campaign-codex", "data") || {};
    if (regionData.linkedLocations) {
      regionData.linkedLocations = regionData.linkedLocations.filter(uuid => uuid !== locationDoc.uuid);
      await regionDoc.setFlag("campaign-codex", "data", regionData);
    }

    // Remove link from Location
    await locationDoc.unsetFlag("campaign-codex", "data.parentRegion");

    ui.notifications.info(`Removed "${locationDoc.name}" from region "${regionDoc.name}"`);

    // Refresh UI for both documents
    for (const app of Object.values(ui.windows)) {
      if (app.document && (app.document.uuid === regionDoc.uuid || app.document.uuid === locationDoc.uuid)) {
        app.render(false);
      }
    }
  }

  // Override close to save on close
  async close(options = {}) {
    if (this._forceClose) {
      return super.close(options);
    }

    const documentExists = this.document && game.journal.get(this.document.id);
    
    if (documentExists && !this.document._pendingDeletion) {
      await this._saveFormData();
    }
    
    return super.close(options);
  }

  // Abstract methods to be implemented by subclasses
  _activateSheetSpecificListeners() {
    // Override in subclasses
  }

  async _handleDrop(data, event) {
    // Override in subclasses
  }

  getSheetType() {
    // Override in subclasses
    return "base";
  }

  // Updated relationship checking with async support
  async _isRelatedDocument(changedDocUuid) {
    if (!this.document.getFlag) return false;
    
    const data = this.document.getFlag("campaign-codex", "data") || {};
    const myDocUuid = this.document.uuid;
    const myType = this.document.getFlag("campaign-codex", "type");
    
    // Direct relationships
    const directLinkedUuids = [
      ...(data.linkedNPCs || []),
      ...(data.linkedShops || []),
      ...(data.linkedLocations || []),
      ...(data.associates || []),
      data.linkedLocation,
      data.linkedActor
    ].filter(Boolean);
    
    if (directLinkedUuids.includes(changedDocUuid)) {
      return true;
    }
    
    // Reverse relationships
    try {
      const changedDoc = await fromUuid(changedDocUuid);
      if (changedDoc) {
        const changedData = changedDoc.getFlag("campaign-codex", "data") || {};
        const changedType = changedDoc.getFlag("campaign-codex", "type");
        const changedLinkedUuids = [
          ...(changedData.linkedNPCs || []),
          ...(changedData.linkedShops || []), 
          ...(changedData.linkedLocations || []),
          ...(changedData.associates || []),
          changedData.linkedLocation,
          changedData.linkedActor
        ].filter(Boolean);
        
        if (changedLinkedUuids.includes(myDocUuid)) {
          return true;
        }
        
        // Special case: Region-Location relationships
        if (myType === "location" && changedType === "region") {
          const regionLocations = changedData.linkedLocations || [];
          if (regionLocations.includes(myDocUuid)) {
            return true;
          }
        }
        
        if (myType === "region" && changedType === "location") {
          const myLinkedLocations = data.linkedLocations || [];
          if (myLinkedLocations.includes(changedDocUuid)) {
            return true;
          }
        }
      }
    } catch (error) {
      console.warn(`Campaign Codex | Could not resolve UUID ${changedDocUuid}:`, error);
      return false;
    }
    
    // Additional region check for locations
    if (myType === "location") {
      const allRegions = game.journal.filter(j => j.getFlag("campaign-codex", "type") === "region");
      for (const region of allRegions) {
        if (region.uuid === changedDocUuid) {
          const regionData = region.getFlag("campaign-codex", "data") || {};
          const linkedLocations = regionData.linkedLocations || [];
          if (linkedLocations.includes(myDocUuid)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  static generateNotesTab(data) {
    if (!game.user.isGM) {
      return `
        ${TemplateComponents.contentHeader('fas fa-sticky-note', 'GM Notes')}
      `;
    }
    return `
      ${TemplateComponents.contentHeader('fas fa-sticky-note', 'GM Notes')}
      ${TemplateComponents.richTextSection('Private Notes', 'fas fa-eye-slash', data.sheetData.enrichedNotes, 'notes')}
    `;
  }

  async _onDropNPCsToMap(npcs, options = {}) {
    if (!npcs || npcs.length === 0) {
      ui.notifications.warn("No NPCs available to drop to map!");
      return;
    }

    try {
      const result = await game.campaignCodexNPCDropper.dropNPCsToScene(npcs, options);
      
      if (result && result.success > 0) {
        console.log(`Campaign Codex | Successfully dropped ${result.success} NPCs to scene`);
      }
      
      return result;
    } catch (error) {
      console.error('Campaign Codex | Error dropping NPCs to map:', error);
      ui.notifications.error("Failed to drop NPCs to map. Check console for details.");
    }
  }

  async _onDropNPCsToMapClick(event) {
    event.preventDefault();
    
    const sheetType = this.getSheetType();
    ui.notifications.warn(`Drop to map not implemented for ${sheetType} sheets`);
  }
}
