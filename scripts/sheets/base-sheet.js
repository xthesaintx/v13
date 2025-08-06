// import { DescriptionEditor } from './editors/description-editor.js';
import { CampaignCodexLinkers } from './linkers.js';
import { TemplateComponents } from './template-components.js';

// v13 ApplicationV2 imports - CORRECT PATTERN
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { DocumentSheetV2 } = foundry.applications.api;

// Base sheet class with shared functionality - v13 ApplicationV2 conversion
export class CampaignCodexBaseSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
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
      minimizable: true,
      title: "CAMPAIGN_CODEX.SheetTitle"
    },
    // Define actions declaratively instead of using activateListeners
    actions: {
      tabSwitch: CampaignCodexBaseSheet.#onTabSwitch,
      toggleProseMirror: CampaignCodexBaseSheet.#onToggleProseMirror, // NEW action
      dropNPCsToMap: CampaignCodexBaseSheet.#onDropNPCsToMapClick,
      openDocument: CampaignCodexBaseSheet.#onOpenDocument,
      removeFromList: CampaignCodexBaseSheet.#onRemoveFromList,
      removeFromRegion: CampaignCodexBaseSheet.#onRemoveFromRegion,
      saveData: CampaignCodexBaseSheet.#onSaveData,
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
      template: "modules/campaign-codex/templates/base-sheet.html"
    }
  };

  // v13: Replace getData() with _prepareContext()
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sheetData = this.document.getFlag("campaign-codex", "data") || {};

    context.sheetData = {
      description: sheetData.description || "",
      notes: sheetData.notes || "",
      ...sheetData
    };

    context.currentTab = this._currentTab;
    context.isGM = game.user.isGM;
    
    // Enrich HTML content for display - Use v13 TextEditor
    if (context.sheetData.description) {
      context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        context.sheetData.description,
        { secrets: this.document.isOwner, rollData: {} }
      );
    }

    if (context.sheetData.notes) {
      context.enrichedNotes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        context.sheetData.notes,
        { secrets: this.document.isOwner, rollData: {} }
      );
    }

    return context;
  }

  // v13: Replace activateListeners with _onRender for DOM setup
  async _onRender(context, options) {
    await super._onRender(context, options);
    this._setupTabNavigation();
    this._setupDragDrop();
    this._setupSheetSpecificListeners();
  }

  // v13: Setup drag/drop with vanilla JavaScript
  _setupDragDrop() {
    const html = this.element;
    
    // Set up drop zones
    html.addEventListener('dragover', this._onDragOver.bind(this));
    html.addEventListener('drop', this._onDrop.bind(this));
    
    // Make items draggable if they have draggable="true"
    html.querySelectorAll('[draggable="true"]').forEach(item => {
      item.addEventListener('dragstart', this._onDragStart.bind(this));
      item.addEventListener('dragend', this._onDragEnd.bind(this));
    });
  }

  // v13: Setup tab navigation with vanilla JavaScript
  _setupTabNavigation() {
    // Tab clicks are now handled by the actions system via data-action="tabSwitch"
    // Just ensure the current tab is displayed
    this._showTab(this._currentTab);
  }

  // v13: Show/hide tabs with vanilla JavaScript
  _showTab(tabName) {
    const html = this.element;
    
    // Remove active class from all tabs and content
    html.querySelectorAll('[data-tab]').forEach(tab => {
      tab.classList.remove('active');
    });
    html.querySelectorAll('.tab-panel').forEach(content => {
      content.classList.remove('active');
    });
    
    // Add active class to selected tab and content
    const activeTab = html.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = html.querySelector(`[data-tab-content="${tabName}"], .tab-panel[data-tab="${tabName}"]`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
    
    this._currentTab = tabName;
  }

  // Override for subclasses to add specific listeners
  _setupSheetSpecificListeners() {
    // Subclasses can override this
  }

  // Tab switching logic
  _showTab(tabName) {
    const html = this.element;
    
    // Remove active class from all tabs and content
    html.querySelectorAll('[data-tab]').forEach(tab => {
      tab.classList.remove('active');
    });
    html.querySelectorAll('.tab-panel').forEach(content => {
      content.classList.remove('active');
    });
    
    // Add active class to selected tab and content
    const activeTab = html.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = html.querySelector(`[data-tab-content="${tabName}"], .tab-panel[data-tab="${tabName}"]`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
    
    this._currentTab = tabName;
  }

  // v13: Drag/drop handlers - DEFINE THESE FIRST
  _onDragStart(event) {
    const target = event.currentTarget;
    const dragData = this._getDragData(target);
    
    if (dragData) {
      event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
      target.style.opacity = "0.5";
    }
  }

  _onDragEnd(event) {
    event.currentTarget.style.opacity = "1";
  }

  _onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  async _onDrop(event) {
    event.preventDefault();
    
    try {
      const data = JSON.parse(event.dataTransfer.getData("text/plain"));
      await this._handleDrop(data, event);
    } catch (error) {
      // Also try the standard Foundry drag data format
      const data = TextEditor.getDragEventData(event);
      if (data) {
        await this._handleDrop(data, event);
      } else {
        console.error("Drop handling error:", error);
      }
    }
  }

  // Override in subclasses to provide drag data
  _getDragData(element) {
    return null;
  }

  // Override in subclasses to handle drops  
  async _handleDrop(data, event) {
    console.log("Drop handler not implemented in base class");
  }

  // Action handlers (all must be static private methods in v13)
  static async #onToggleProseMirror(event, target) {
    event.preventDefault();
    const field = target.dataset.field;
    const editorElement = this.element.querySelector(`prose-mirror[name="flags.campaign-codex.data.${field}"]`);
    if (editorElement) {
      editorElement.open = !editorElement.open;
    }
  }

  static async #onDropNPCsToMapClick(event, target) {
    event.preventDefault();
    // Implementation for dropping NPCs to map
    console.log("Drop NPCs to map functionality");
  }

  static async #onOpenDocument(event, target) {
    event.preventDefault();
    const uuid = target.dataset.documentUuid || target.dataset.uuid;
    
    if (uuid) {
      const document = await fromUuid(uuid);
      if (document) {
        document.sheet.render(true);
      }
    }
  }

  static async #onRemoveFromList(event, target) {
    event.preventDefault();
    const type = target.dataset.removeType;
    const uuid = target.dataset.uuid;
    
    if (type && uuid) {
      await this._removeFromList(type, uuid);
    }
  }

  static async #onRemoveFromRegion(event, target) {
    event.preventDefault();
    const uuid = target.dataset.uuid;
    
    if (uuid) {
      await this._removeFromRegion(uuid);
    }
  }

  static async #onSaveData(event, target) {
    event.preventDefault();
    // Save functionality
    await this._onSubmit(event);
  }

  static async #onTabSwitch(event, target) {
    event.preventDefault();
    const tabName = target.dataset.tab;
    
    if (tabName) {
      this._switchTab(tabName);
    }
  }

  static async #onNameEdit(event, target) {
    event.preventDefault();
    // Name editing functionality
    console.log("Name edit functionality");
  }

  static async #onImageClick(event, target) {
    event.preventDefault();
    // Image click functionality
    console.log("Image click functionality");
  }

  // Helper methods for removing items from lists
  async _removeFromList(type, uuid) {
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    
    // Remove from appropriate list based on type
    switch (type) {
      case 'npc':
        currentData.linkedNPCs = (currentData.linkedNPCs || []).filter(npc => npc.uuid !== uuid);
        break;
      case 'location':
        currentData.linkedLocations = (currentData.linkedLocations || []).filter(loc => loc !== uuid);
        break;
      case 'shop':
        currentData.linkedShops = (currentData.linkedShops || []).filter(shop => shop.uuid !== uuid);
        break;
    }
    
    await this.document.setFlag("campaign-codex", "data", currentData);
    this.render();
  }

  async _removeFromRegion(uuid) {
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    currentData.regionItems = (currentData.regionItems || []).filter(item => item.uuid !== uuid);
    
    await this.document.setFlag("campaign-codex", "data", currentData);
    this.render();
  }

  // Override close to handle cleanup
  async close(options = {}) {
    return super.close(options);
  }

  // Add missing static method that other sheets are calling
  static generateNotesTab(context) {
    return `
      ${TemplateComponents.contentHeader('fas fa-sticky-note', 'GM Notes')}
      ${TemplateComponents.richTextSection('Notes', 'fas fa-sticky-note', context.sheetData.enrichedNotes, 'notes', context.document.uuid)}
    `;
  }
}