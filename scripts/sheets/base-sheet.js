// scripts/sheets/base-sheet.js - COMPLETE V13 CONVERSION
import { CampaignCodexLinkers } from './linkers.js';
import { TemplateComponents } from './template-components.js';

// V13: Import ApplicationV2 mixins
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { DocumentSheetV2 } = foundry.applications.api;

// V13: Extend DocumentSheetV2 instead of JournalSheet
export class CampaignCodexBaseSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  constructor(options = {}) {
    super(options);
    this._currentTab = 'info';
    this._dropping = false;
  }

  // V13: Convert defaultOptions to DEFAULT_OPTIONS static field
  static DEFAULT_OPTIONS = {
    classes: ["sheet", "journal-sheet", "campaign-codex", "themed"],
    position: {
      width: 1000,
      height: 700
    },
    window: {
      resizable: true,
      minimizable: true,
      title: "Campaign Codex Sheet"
    },
    // V13: CRITICAL - Add form configuration for ProseMirror
    form: {
      submitOnChange: true,  // Auto-save on change
      closeOnSubmit: false,
      handler: CampaignCodexBaseSheet.#onSubmit
    },
    // V13: Define actions declaratively
    actions: {
      // Tab actions
      tabSwitch: CampaignCodexBaseSheet.#onTabSwitch,
      
      // Edit actions
      toggleEditor: CampaignCodexBaseSheet.#onToggleEditor,
      nameEdit: CampaignCodexBaseSheet.#onNameEdit,
      imageChange: CampaignCodexBaseSheet.#onImageChange,
      
      // Save action
      saveData: CampaignCodexBaseSheet.#onSaveData,
      
      // Document actions
      openDocument: CampaignCodexBaseSheet.#onOpenDocument,
      openActor: CampaignCodexBaseSheet.#onOpenActor,
      openLocation: CampaignCodexBaseSheet.#onOpenLocation,
      openShop: CampaignCodexBaseSheet.#onOpenShop,
      openNpc: CampaignCodexBaseSheet.#onOpenNpc,
      openAssociate: CampaignCodexBaseSheet.#onOpenAssociate,
      openItem: CampaignCodexBaseSheet.#onOpenItem,
      
      // Remove actions
      removeFromList: CampaignCodexBaseSheet.#onRemoveFromList,
      removeLocation: CampaignCodexBaseSheet.#onRemoveLocation,
      removeActor: CampaignCodexBaseSheet.#onRemoveActor,
      removeShop: CampaignCodexBaseSheet.#onRemoveShop,
      removeAssociate: CampaignCodexBaseSheet.#onRemoveAssociate,
      removeNpc: CampaignCodexBaseSheet.#onRemoveNpc,
      removeItem: CampaignCodexBaseSheet.#onRemoveItem,
      removeFromRegion: CampaignCodexBaseSheet.#onRemoveFromRegion,
      
      // Refresh actions
      refreshLocations: CampaignCodexBaseSheet.#onRefreshLocations,
      
      // Map actions
      dropNPCsToMap: CampaignCodexBaseSheet.#onDropNPCsToMapClick
    }
  };

  // V13: Define template parts with form tag
  static PARTS = {
    form: {
      template: "modules/campaign-codex/templates/base-sheet.html",
      tag: "form"  // CRITICAL for form submission
    }
  };

  // V13: Convert getData() to _prepareContext()
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sheetData = this.document.getFlag("campaign-codex", "data") || {};

    context.sheetData = {
      description: sheetData.description || "",
      notes: sheetData.notes || "",
      ...sheetData
    };
    
    // V13: Use TextEditor.enrichHTML
    context.sheetData.enrichedDescription = await TextEditor.enrichHTML(
      context.sheetData.description, 
      { 
        async: true, 
        secrets: this.document.isOwner,
        relativeTo: this.document
      }
    );
    context.sheetData.enrichedNotes = await TextEditor.enrichHTML(
      context.sheetData.notes, 
      { 
        async: true, 
        secrets: this.document.isOwner,
        relativeTo: this.document
      }
    );

    context.canEdit = this.document.canUserModify(game.user, "update");
    context.currentTab = this._currentTab;
    context.document = this.document;
    context.isGM = game.user.isGM;

    return context;
  }

  // V13: Replace activateListeners with _onRender
  async _onRender(context, options) {
    await super._onRender(context, options);
    
    const html = this.element;
    
    // Setup core functionality
    this._setupTabs();
    this._setupDropZones();
    this._setupNameEditing();
    this._setupDragAndDrop();
    this._setupProseMirrorEditors();
    
    // Setup sheet-specific listeners (for child classes)
    this._activateSheetSpecificListeners(html);
  }

  // V13: Setup ProseMirror editors properly
  _setupProseMirrorEditors() {
    const html = this.element;
    
    // Find all prose-mirror elements
    html.querySelectorAll('prose-mirror').forEach(editor => {
      // Make sure editor starts closed (not in edit mode)
      if (!editor.hasAttribute('name')) return;
      
      // Listen for changes
      editor.addEventListener('change', (event) => {
        // The form will auto-save due to submitOnChange: true
        console.log('ProseMirror content changed:', editor.name);
      });
    });
  }

  // V13: Tab management with vanilla JS
  _setupTabs() {
    // Show initial tab
    this._showTab(this._currentTab);
  }

  static async #onTabSwitch(event, target) {
    event.preventDefault();
    const tabName = target.dataset.tab;
    if (tabName) {
      this._currentTab = tabName;
      this._showTab(tabName);
    }
  }

  _showTab(tabName) {
    const html = this.element;
    
    // V13: Use vanilla JS instead of jQuery
    html.querySelectorAll('.sidebar-tabs .tab-item').forEach(tab => {
      tab.classList.remove('active');
    });
    html.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const activeTab = html.querySelector(`.sidebar-tabs .tab-item[data-tab="${tabName}"]`);
    const activePanel = html.querySelector(`.tab-panel[data-tab="${tabName}"]`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activePanel) activePanel.classList.add('active');
  }

  // V13: Toggle ProseMirror editor
  static async #onToggleEditor(event, target) {
    event.preventDefault();
    const fieldName = target.dataset.field;
    const editor = this.element.querySelector(`prose-mirror[name="flags.campaign-codex.data.${fieldName}"]`);
    
    if (editor) {
      // Toggle the editor open/closed
      if (editor.hasAttribute('open')) {
        editor.removeAttribute('open');
      } else {
        editor.setAttribute('open', '');
        // Focus the editor when opening
        setTimeout(() => {
          const editableDiv = editor.querySelector('.editor-content[contenteditable="true"]');
          if (editableDiv) editableDiv.focus();
        }, 100);
      }
    }
  }

  // V13: Drop zone setup with vanilla JS
  _setupDropZones() {
    const html = this.element;
    html.addEventListener('drop', this._onDrop.bind(this));
    html.addEventListener('dragover', this._onDragOver.bind(this));
  }

  // V13: Setup drag and drop
  _setupDragAndDrop() {
    const html = this.element;
    
    // Make draggable items draggable
    html.querySelectorAll('[draggable="true"]').forEach(item => {
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', JSON.stringify({
          uuid: item.dataset.uuid,
          type: item.dataset.type
        }));
      });
    });
  }

  // V13: Name editing setup
  _setupNameEditing() {
    const html = this.element;
    
    // Handle blur and keypress on name inputs
    html.addEventListener('blur', (event) => {
      if (event.target.classList.contains('name-input')) {
        this._onNameSave(event);
      }
    }, true);
    
    html.addEventListener('keypress', (event) => {
      if (event.target.classList.contains('name-input') && event.which === 13) {
        event.preventDefault();
        event.target.blur();
      }
    });
  }

  // V13: Name edit action handler
  static async #onNameEdit(event, target) {
    event.preventDefault();
    const nameElement = target;
    const currentName = nameElement.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.value = currentName;
    input.style.cssText = `background: transparent; border: 1px solid rgba(255,255,255,0.3); 
                           color: white; padding: 4px 8px; border-radius: 4px; 
                           font-family: 'Modesto Condensed', serif; font-size: 28px; 
                           font-weight: 700; text-transform: uppercase; letter-spacing: 2px; width: 100%;`;
    
    nameElement.replaceWith(input);
    input.focus();
    input.select();
  }

  async _onNameSave(event) {
    const input = event.target;
    const newName = input.value.trim();
    
    if (newName && newName !== this.document.name) {
      await this.document.update({ name: newName });
    }
    
    const nameElement = document.createElement('h1');
    nameElement.className = 'sheet-title';
    nameElement.textContent = this.document.name;
    nameElement.setAttribute('data-action', 'nameEdit');
    input.replaceWith(nameElement);
  }

  // V13: Image change handler
  static async #onImageChange(event, target) {
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

  // V13: Form submission handler
  static async #onSubmit(event, form, formData) {
    // This is called automatically when form changes due to submitOnChange: true
    console.log('Form auto-saving...', formData);
    // The document will be updated automatically by DocumentSheetV2
  }

  // V13: Manual save handler
  static async #onSaveData(event, target) {
    event.preventDefault();
    // Trigger a manual save
    const form = this.element.querySelector('form');
    if (form) {
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
    }
    
    ui.notifications.info(`${this.constructor.name.replace('Sheet', '')} saved successfully!`);
    
    target.classList.add('success');
    setTimeout(() => target.classList.remove('success'), 1500);
  }

  _onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "link";
  }

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

  // V13: Document open handlers
  static async #onOpenDocument(event, target) {
    event.stopPropagation();
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    
    try {
      const doc = await fromUuid(uuid);
      if (doc?.sheet) {
        doc.sheet.render(true);
      }
    } catch (error) {
      console.error(`Campaign Codex | Error opening document:`, error);
    }
  }

  static async #onOpenActor(event, target) {
    return CampaignCodexBaseSheet.#onOpenDocument.call(this, event, target);
  }

  static async #onOpenLocation(event, target) {
    return CampaignCodexBaseSheet.#onOpenDocument.call(this, event, target);
  }

  static async #onOpenShop(event, target) {
    return CampaignCodexBaseSheet.#onOpenDocument.call(this, event, target);
  }

  static async #onOpenNpc(event, target) {
    return CampaignCodexBaseSheet.#onOpenDocument.call(this, event, target);
  }

  static async #onOpenAssociate(event, target) {
    return CampaignCodexBaseSheet.#onOpenDocument.call(this, event, target);
  }

  static async #onOpenItem(event, target) {
    return CampaignCodexBaseSheet.#onOpenDocument.call(this, event, target);
  }

  // V13: Remove handlers
  static async #onRemoveFromList(event, target) {
    event.preventDefault();
    const listName = target.dataset.list;
    const itemUuid = target.dataset.uuid;
    
    const myDoc = this.document;
    const myData = myDoc.getFlag("campaign-codex", "data") || {};
    const myType = myDoc.getFlag("campaign-codex", "type");
    
    if (!myData[listName]) return;

    if (Array.isArray(myData[listName])) {
      myData[listName] = myData[listName].filter(uuid => uuid !== itemUuid);
    } else {
      myData[listName] = null;
    }

    await myDoc.setFlag("campaign-codex", "data", myData);

    // Handle bidirectional relationships
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
      try {
        const targetDoc = await fromUuid(itemUuid);
        if (targetDoc && targetDoc.getFlag("campaign-codex", "type") === reverseLink.targetType) {
          const targetData = targetDoc.getFlag("campaign-codex", "data") || {};
          
          if (reverseLink.isArray) {
            targetData[reverseLink.reverseField] = (targetData[reverseLink.reverseField] || [])
              .filter(uuid => uuid !== myDoc.uuid);
          } else if (targetData[reverseLink.reverseField] === myDoc.uuid) {
            targetData[reverseLink.reverseField] = null;
          }
          
          await targetDoc.setFlag("campaign-codex", "data", targetData);
        }
      } catch (error) {
        console.error("Campaign Codex | Error in bidirectional cleanup:", error);
      }
    }

    this.render(false);
    ui.notifications.info(`Removed link`);
  }

  static async #onRemoveLocation(event, target) {
    return CampaignCodexBaseSheet.#onRemoveFromList.call(this, event, 
      { ...target, dataset: { ...target.dataset, list: 'linkedLocations' } });
  }

  static async #onRemoveActor(event, target) {
    event.preventDefault();
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    currentData.linkedActor = null;
    await this.document.setFlag("campaign-codex", "data", currentData);
    this.render(false);
  }

  static async #onRemoveShop(event, target) {
    return CampaignCodexBaseSheet.#onRemoveFromList.call(this, event, 
      { ...target, dataset: { ...target.dataset, list: 'linkedShops' } });
  }

  static async #onRemoveAssociate(event, target) {
    return CampaignCodexBaseSheet.#onRemoveFromList.call(this, event, 
      { ...target, dataset: { ...target.dataset, list: 'associates' } });
  }

  static async #onRemoveNpc(event, target) {
    return CampaignCodexBaseSheet.#onRemoveFromList.call(this, event, 
      { ...target, dataset: { ...target.dataset, list: 'linkedNPCs' } });
  }

  static async #onRemoveItem(event, target) {
    return CampaignCodexBaseSheet.#onRemoveFromList.call(this, event, 
      { ...target, dataset: { ...target.dataset, list: 'inventory' } });
  }

  static async #onRemoveFromRegion(event, target) {
    event.preventDefault();
    event.stopPropagation();

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
      const locationUuid = target.dataset.locationUuid || target.dataset.uuid;
      if (locationUuid) {
        locationDoc = await fromUuid(locationUuid);
      }
    }

    if (!locationDoc || !regionDoc) {
      ui.notifications.warn("Could not find the linked region or location.");
      this.render(false);
      return;
    }

    const regionData = regionDoc.getFlag("campaign-codex", "data") || {};
    if (regionData.linkedLocations) {
      regionData.linkedLocations = regionData.linkedLocations.filter(uuid => uuid !== locationDoc.uuid);
      await regionDoc.setFlag("campaign-codex", "data", regionData);
    }

    await locationDoc.unsetFlag("campaign-codex", "data.parentRegion");

    ui.notifications.info(`Removed "${locationDoc.name}" from region "${regionDoc.name}"`);

    for (const app of Object.values(ui.windows)) {
      if (app.document && (app.document.uuid === regionDoc.uuid || app.document.uuid === locationDoc.uuid)) {
        app.render(false);
      }
    }
  }

  static async #onRefreshLocations(event, target) {
    console.log(`Campaign Codex | Manual refresh requested`);
    this.render(false);
    ui.notifications.info("Location data refreshed!");
  }

  // V13: Drop NPCs to map handler
  static async #onDropNPCsToMapClick(event, target) {
    event.preventDefault();
    
    const sheetType = this.getSheetType();
    
    // Override this in child classes for specific functionality
    if (sheetType === 'npc') {
      const npcData = this.document.getFlag("campaign-codex", "data") || {};
      
      if (!npcData.linkedActor) {
        ui.notifications.warn("This NPC has no linked actor to drop!");
        return;
      }
      
      try {
        const linkedActor = await fromUuid(npcData.linkedActor);
        if (!linkedActor) {
          ui.notifications.warn("Linked actor not found!");
          return;
        }
        
        const npcForDrop = {
          id: this.document.id,
          uuid: this.document.uuid,
          name: this.document.name,
          img: this.document.getFlag("campaign-codex", "image") || linkedActor.img || "icons/svg/mystery-man.svg",
          actor: linkedActor
        };
        
        await this._onDropNPCsToMap([npcForDrop], { 
          title: `Drop ${this.document.name} to Map`,
          showHiddenToggle: true
        });
        
      } catch (error) {
        console.error('Campaign Codex | Error dropping NPC to map:', error);
        ui.notifications.error("Failed to drop NPC to map!");
      }
    } else {
      ui.notifications.warn(`Drop to map not implemented for ${sheetType} sheets`);
    }
  }

  // Helper method for dropping NPCs to map
  async _onDropNPCsToMap(npcs, options = {}) {
    if (!npcs || npcs.length === 0) {
      ui.notifications.warn("No NPCs available to drop to map!");
      return;
    }

    try {
      const result = await game.campaignCodexNPCDropper?.dropNPCsToScene(npcs, options);
      
      if (result && result.success > 0) {
        console.log(`Campaign Codex | Successfully dropped ${result.success} NPCs to scene`);
      }
      
      return result;
    } catch (error) {
      console.error('Campaign Codex | Error dropping NPCs to map:', error);
      ui.notifications.error("Failed to drop NPCs to map. Check console for details.");
    }
  }

  // Handle actor drops
  async _handleActorDrop(data, event) {
    const sourceActor = await fromUuid(data.uuid);
    if (!sourceActor) {
      ui.notifications.warn("Could not find the dropped actor.");
      return;
    }

    const sheetType = this.getSheetType();

    switch (sheetType) {
      case 'location': {
        const npcJournal = await game.campaignCodex.findOrCreateNPCJournalForActor(sourceActor);
        if (npcJournal) {
          await game.campaignCodex.linkLocationToNPC(this.document, npcJournal);
          ui.notifications.info(`Linked "${sourceActor.name}" to location "${this.document.name}"`);
        }
        break;
      }

      case 'shop': {
        const npcJournal = await game.campaignCodex.findOrCreateNPCJournalForActor(sourceActor);
        if (npcJournal) {
          await game.campaignCodex.linkShopToNPC(this.document, npcJournal);
          ui.notifications.info(`Linked "${sourceActor.name}" to shop "${this.document.name}"`);
        }
        break;
      }

      case 'npc': {
        const dropZone = event.target.closest('.drop-zone');
        const dropType = dropZone?.dataset.dropType;

        if (dropType === 'actor') {
          const myData = this.document.getFlag("campaign-codex", "data") || {};
          myData.linkedActor = sourceActor.uuid;
          await this.document.setFlag("campaign-codex", "data", myData);
          ui.notifications.info(`Linked actor "${sourceActor.name}" to this journal.`);
        } else if (dropType === 'associate') {
          const associateJournal = await game.campaignCodex.findOrCreateNPCJournalForActor(sourceActor);
          if (associateJournal && associateJournal.uuid !== this.document.uuid) {
            await game.campaignCodex.linkNPCToNPC(this.document, associateJournal);
            ui.notifications.info(`Linked "${sourceActor.name}" as an associate.`);
          } else if (associateJournal?.uuid === this.document.uuid) {
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

  async _handleDrop(data, event) {
    if (data.type === "Actor") {
      await this._handleActorDrop(data, event);
    } else if (data.type === "JournalEntry") {
      await this._handleJournalDrop(data, event);
    }
  }

  async _handleJournalDrop(data, event) {
    // Override in child classes
  }

  async close(options = {}) {
    return super.close(options);
  }

  // Methods for child classes to override
  _activateSheetSpecificListeners(html) {
    // Override in child classes
  }

  getSheetType() {
    return "base";
  }

  async _isRelatedDocument(changedDocUuid) {
    if (!this.document.getFlag) return false;
    
    const data = this.document.getFlag("campaign-codex", "data") || {};
    const myDocUuid = this.document.uuid;
    const myType = this.document.getFlag("campaign-codex", "type");
    
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
    
    try {
      const changedDoc = await fromUuid(changedDocUuid);
      if (changedDoc) {
        const changedData = changedDoc.getFlag("campaign-codex", "data") || {};
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
      }
    } catch (error) {
      console.warn(`Campaign Codex | Could not resolve UUID ${changedDocUuid}:`, error);
    }
    
    return false;
  }

  // Static tab generation methods
  static generateNotesTab(data) {
    if (!game.user.isGM) {
      return `
        ${TemplateComponents.contentHeader('fas fa-sticky-note', 'GM Notes')}
        <p>GM notes are not visible to players.</p>
      `;
    }
    return `
      ${TemplateComponents.contentHeader('fas fa-sticky-note', 'GM Notes')}
      ${TemplateComponents.richTextSection('Private Notes', 'fas fa-eye-slash', data.sheetData.enrichedNotes, 'notes', data.document.uuid)}
    `;
  }
}