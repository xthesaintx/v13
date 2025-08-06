import { CampaignCodexBaseSheet } from './base-sheet.js';
import { TemplateComponents } from './template-components.js';
// import { DescriptionEditor } from './editors/description-editor.js';
import { CampaignCodexLinkers } from './linkers.js';

export class RegionSheet extends CampaignCodexBaseSheet {
  // Convert defaultOptions to DEFAULT_OPTIONS
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: [...(super.DEFAULT_OPTIONS?.classes || []), "region-sheet", "themed"],
    actions: {
      removeLocation: RegionSheet.#onRemoveLocation,
      openLocation: RegionSheet.#onOpenLocation,
      openNpc: RegionSheet.#onOpenNpc,
      openShop: RegionSheet.#onOpenShop,
      openActor: RegionSheet.#onOpenActor,
      refreshData: RegionSheet.#onRefreshData,
      openScene: RegionSheet.#onOpenScene,
      removeScene: RegionSheet.#onRemoveScene,
      dropToMap: RegionSheet.#onDropToMap
    }
  });

  get template() {
    return "modules/campaign-codex/templates/base-sheet.html";
  }

  // Convert getData to _prepareContext
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const regionData = this.document.getFlag("campaign-codex", "data") || {};

    context.linkedScene = null;
    if (regionData.linkedScene) {
      try {
        const scene = await fromUuid(regionData.linkedScene);
        if (scene) {
          context.linkedScene = {
            uuid: scene.uuid,
            name: scene.name,
            img: scene.thumb || "icons/svg/map.svg"
          };
        }
      } catch (error) {
        console.warn(`Campaign Codex | Linked scene not found: ${regionData.linkedScene}`);
      }
    }
   
    context.linkedLocations = await CampaignCodexLinkers.getLinkedLocations(this.document, regionData.linkedLocations || []);
    context.allNPCs = await CampaignCodexLinkers.getAllNPCs(regionData.linkedLocations || []);
    context.allShops = await CampaignCodexLinkers.getAllShops(regionData.linkedLocations || []);
    
    context.sheetType = "region";
    context.sheetTypeLabel = "Region";
    context.customImage = this.document.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image','region');
    
    context.tabs = [
      { key: 'info', label: 'Info', icon: 'fas fa-info-circle', active: this._currentTab === 'info' },
      { key: 'locations', label: 'Locations', icon: 'fas fa-map-marker-alt', active: this._currentTab === 'locations',
      statistic: {
        value: Array.isArray(context.linkedLocations) ? context.linkedLocations.length : 0,
        color: '#28a745'
      }},
      { key: 'npcs', label: 'NPCs', icon: 'fas fa-users', active: this._currentTab === 'npcs',
      statistic: {
        value: Array.isArray(context.allNPCs) ? context.allNPCs.length : 0,
        color: '#fd7e14'
      }},
      { key: 'shops', label: 'Entries', icon: 'fas fa-book-open', active: this._currentTab === 'shops',
      statistic: {
        value: Array.isArray(context.allShops) ? context.allShops.length : 0,
        color: '#6f42c1'
      }},
      { key: 'notes', label: 'Notes', icon: 'fas fa-sticky-note', active: this._currentTab === 'notes' }
    ];
    
    context.statistics = [
      { icon: 'fas fa-map-marker-alt', value: context.linkedLocations.length, label: 'LOCATIONS', color: '#28a745' },
      { icon: 'fas fa-users', value: context.allNPCs.length, label: 'NPCS', color: '#fd7e14' },
      { icon: 'fas fa-book-open', value: context.allShops.length, label: 'ENTRIES', color: '#6f42c1' }
    ];

    const sources = [
      { data: context.linkedLocations, type: 'location' },
    ];

    context.quickLinks = CampaignCodexLinkers.createQuickLinks(sources);

    let headerContent = '';
    
    if (context.linkedScene) {
      headerContent += `
        <div class="scene-info">
          <span class="scene-name" data-action="openScene" data-scene-uuid="${context.linkedScene.uuid}" title="Open Scene" style="cursor: pointer;"> 
            <i class="fas fa-map"></i> ${context.linkedScene.name}
          </span>
          <button type="button" data-action="removeScene" class="scene-btn remove-scene" title="Unlink Scene">
            <i class="fas fa-unlink"></i>
          </button>
        </div>
      `;
    } else {
      headerContent += `
        <div class="scene-info">
          <span class="scene-name" style="text-align:center;">
            <i class="fas fa-link"></i> Drop scene to link
          </span>
        </div>
      `;
    }
    
    if (headerContent) {
      context.customHeaderContent = headerContent;
    }

    context.tabPanels = [
      {
        key: 'info',
        active: this._currentTab === 'info',
        content: this._generateInfoTab(context)
      },
      {
        key: 'locations',
        active: this._currentTab === 'locations',
        content: this._generateLocationsTab(context)
      },
      {
        key: 'npcs',
        active: this._currentTab === 'npcs',
        content: this._generateNPCsTab(context)
      },
      {
        key: 'shops', 
        active: this._currentTab === 'shops',
        content: this._generateShopsTab(context)
      },
      {
        key: 'notes',
        active: this._currentTab === 'notes',
        content: CampaignCodexBaseSheet.generateNotesTab(context)
      }
    ];
    
    return context;
  }

  _generateInfoTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fas fa-info-circle', 'Information')}
      ${TemplateComponents.richTextSection('Description', 'fas fa-align-left', data.sheetData.enrichedDescription, 'description')}
    `;
  }

  _generateLocationsTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fa-map-marker-alt', 'Locations in this Region')}
      ${TemplateComponents.dropZone('location', 'fas fa-map-marker-alt', 'Add Locations', 'Drag location journals here to add them to this region')}
      ${this._generateEntityGridWithActions(data.linkedLocations, 'location', true)}
    `;
  }

  _generateNPCsTab(data) {
    const refreshBtn = `
      <button type="button" data-action="refreshData" class="refresh-btn refresh-npcs" title="Refresh auto-populated data">
        <i class="fas fa-sync-alt"></i>
        Refresh
      </button>
    `;

    return `
      ${TemplateComponents.contentHeader('fas fa-users', 'NPCs in this Region', refreshBtn)}
      ${TemplateComponents.infoBanner('NPCs are automatically populated from all locations and entries in this region.')}
      ${this._generateNPCsBySource(data)}
    `;
  }

  _generateNPCsBySource(data) {
    const directNPCs = data.allNPCs.filter(npc => npc.source === 'location');
    const shopNPCs = data.allNPCs.filter(npc => npc.source === 'shop');

    let content = '';

    if (directNPCs.length > 0) {
      content += `
        <div class="npc-section">
          <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
            <i class="fas fa-map-marker-alt" style="color: var(--cc-accent); margin-right: 8px;"></i>
            Location NPCs (${directNPCs.length})
          </h3>
          ${this._generateEntityGridWithActions(directNPCs, 'npc', false)}
        </div>
      `;
    }

    if (shopNPCs.length > 0) {
      content += `
        <div class="npc-section">
          <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
            <i class="fas fa-book-open" style="color: var(--cc-accent); margin-right: 8px;"></i>
            Entry NPCs (${shopNPCs.length})
          </h3>
          ${this._generateEntityGridWithActions(shopNPCs, 'npc', false)}
        </div>
      `;
    }

    if (data.allNPCs.length === 0) {
      content = TemplateComponents.emptyState('npc');
    }

    return content;
  }

  _generateShopsTab(data) {
    const refreshBtn = `
      <button type="button" data-action="refreshData" class="refresh-btn refresh-shops" title="Refresh auto-populated data">
        <i class="fas fa-sync-alt"></i>
        Refresh
      </button>
    `;

    return `
      ${TemplateComponents.contentHeader('fas fa-book-open', 'Entries in this Region', refreshBtn)}
      ${TemplateComponents.infoBanner('Entries are automatically populated from all locations in this region.')}
      ${this._generateEntityGridWithActions(data.allShops, 'shop', false)}
    `;
  }

  // Helper method to generate entity grids with action attributes
  _generateEntityGridWithActions(entities, type, showRemove = false) {
    if (entities.length === 0) {
      return TemplateComponents.emptyState(type);
    }

    const entityCards = entities.map(entity => {
      let actionButtons = '';
      
      if (type === 'location') {
        actionButtons = `
          <button type="button" data-action="openLocation" class="action-btn open-location" data-location-uuid="${entity.uuid}" title="Open Location">
            <i class="fas fa-external-link-alt"></i>
          </button>
          ${showRemove ? `
            <button type="button" data-action="removeLocation" class="action-btn remove-location" data-location-uuid="${entity.uuid}" title="Remove Location">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        `;
      } else if (type === 'npc') {
        actionButtons = `
          <button type="button" data-action="openNpc" class="action-btn open-npc" data-npc-uuid="${entity.uuid}" title="Open NPC">
            <i class="fas fa-external-link-alt"></i>
          </button>
          ${entity.actor ? `
            <button type="button" data-action="openActor" class="action-btn open-actor" data-actor-uuid="${entity.actor.uuid}" title="Open Actor">
              <i class="fas fa-user"></i>
            </button>
          ` : ''}
        `;
      } else if (type === 'shop') {
        actionButtons = `
          <button type="button" data-action="openShop" class="action-btn open-shop" data-shop-uuid="${entity.uuid}" title="Open Entry">
            <i class="fas fa-external-link-alt"></i>
          </button>
        `;
      }

      return `
        <div class="entity-card">
          <div class="entity-image">
            <img src="${entity.img}" alt="${entity.name}">
          </div>
          <div class="entity-content">
            <h4 class="entity-name">${entity.name}</h4>
            ${entity.location ? `<p class="entity-location">${entity.location}</p>` : ''}
          </div>
          <div class="entity-actions">
            ${actionButtons}
          </div>
        </div>
      `;
    }).join('');

    return `<div class="entity-grid">${entityCards}</div>`;
  }

  // Action handlers (converted from jQuery event handlers)
  static async #onRemoveLocation(event, target) {
    await this._onRemoveFromRegion(event);
  }

  static async #onOpenLocation(event, target) {
    await this._onOpenDocument(event, 'location');
  }

  static async #onOpenNpc(event, target) {
    await this._onOpenDocument(event, 'npc');
  }

  static async #onOpenShop(event, target) {
    await this._onOpenDocument(event, 'shop');
  }

  static async #onOpenActor(event, target) {
    await this._onOpenDocument(event, 'actor');
  }

  static async #onRefreshData(event, target) {
    this.render(false);
    ui.notifications.info("Region data refreshed!");
  }

  static async #onOpenScene(event, target) {
    event.preventDefault();
    await game.campaignCodex.openLinkedScene(this.document);
  }

  static async #onRemoveScene(event, target) {
    event.preventDefault();
    await this._saveFormData();
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    currentData.linkedScene = null;
    await this.document.setFlag("campaign-codex", "data", currentData);
    this.render(false);
    ui.notifications.info("Unlinked scene");
  }

  static async #onDropToMap(event, target) {
    const data = await this._prepareContext();
    await NPCDropper.dropNPCsToScene(data.linkedNPCs, {
      title: `Drop ${this.document.name} NPCs to Map`,
      showHiddenToggle: true
    });
  }

  // Keep existing methods that don't need major changes
  async _handleDrop(data, event) {
    if (data.type === "Scene") {
      await this._handleSceneDrop(data, event);
    } else if (data.type === "JournalEntry") {
      await this._handleJournalDrop(data, event);
    }
  }

  async _handleSceneDrop(data, event) {
    const scene = await fromUuid(data.uuid);
    if (!scene) {
      ui.notifications.warn("Could not find the dropped scene.");
      return;
    }
    
    await this._saveFormData();
    await game.campaignCodex.linkSceneToDocument(scene, this.document);
    ui.notifications.info(`Linked scene "${scene.name}" to ${this.document.name}`);
    this.render(false);
  }

  async _handleJournalDrop(data, event) {
    const journal = await fromUuid(data.uuid);
    if (!journal || journal.uuid === this.document.uuid) return;

    const journalType = journal.getFlag("campaign-codex", "type");
    
    if (journalType === "location") {
      await this._saveFormData();
      await game.campaignCodex.linkRegionToLocation(this.document, journal);
      this.render(false);
    }
  }

  getSheetType() {
    return "region";
  }
}