import { CampaignCodexBaseSheet } from './base-sheet.js';
import { TemplateComponents } from './template-components.js';
import { DescriptionEditor } from './editors/description-editor.js';
import { CampaignCodexLinkers } from './linkers.js';

export class LocationSheet extends CampaignCodexBaseSheet {
  // Convert defaultOptions to DEFAULT_OPTIONS
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: [...(super.DEFAULT_OPTIONS?.classes || []), "location-sheet", "themed"],
    actions: {
      removeNpc: LocationSheet.#onRemoveNpc,
      removeLocation: LocationSheet.#onRemoveLocation,
      removeShop: LocationSheet.#onRemoveShop,
      openNpc: LocationSheet.#onOpenNpc,
      openShop: LocationSheet.#onOpenShop,
      openActor: LocationSheet.#onOpenActor,
      openRegion: LocationSheet.#onOpenRegion,
      openScene: LocationSheet.#onOpenScene,
      removeScene: LocationSheet.#onRemoveScene,
      refreshNpcs: LocationSheet.#onRefreshNpcs,
      dropNpcsToMap: LocationSheet.#onDropNPCsToMap
    }
  });

  get template() {
    return "modules/campaign-codex/templates/base-sheet.html";
  }

  // Convert getData to _prepareContext
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const locationData = this.document.getFlag("campaign-codex", "data") || {};

    context.linkedScene = null;
    if (locationData.linkedScene) {
      try {
        const scene = await fromUuid(locationData.linkedScene);
        if (scene) {
          context.linkedScene = {
            uuid: scene.uuid,
            name: scene.name,
            img: scene.thumb || "icons/svg/map.svg"
          };
        }
      } catch (error) {
        console.warn(`Campaign Codex | Linked scene not found: ${locationData.linkedScene}`);
      }
    }

    context.directNPCs = await CampaignCodexLinkers.getDirectNPCs(this.document, locationData.linkedNPCs || []);
    context.shopNPCs = await CampaignCodexLinkers.getShopNPCs(this.document, locationData.linkedShops || []);
    context.allNPCs = [...context.directNPCs, ...context.shopNPCs];
    context.linkedShops = await CampaignCodexLinkers.getLinkedShops(this.document, locationData.linkedShops || []);
    context.linkedRegion = await CampaignCodexLinkers.getLinkedRegion(this.document);
    
    context.sheetType = "location";
    context.sheetTypeLabel = "Location";
    context.customImage = this.document.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image','location');
    
    context.tabs = [
      { key: 'info', label: 'Info', icon: 'fas fa-info-circle', active: this._currentTab === 'info' },
      { key: 'npcs', label: 'NPCs', icon: 'fas fa-users', active: this._currentTab === 'npcs', statistic: {value: context.allNPCs.length,color: '#fd7e14'} },
      { key: 'shops', label: 'Entries', icon: 'fas fa-book-open', active: this._currentTab === 'shops', statistic: {value: context.linkedShops.length, color: '#6f42c1'} },
      { key: 'notes', label: 'Notes', icon: 'fas fa-sticky-note', active: this._currentTab === 'notes' }
    ];
    
    context.statistics = [
      { icon: 'fas fa-users', value: context.allNPCs.length, label: 'NPCS', color: '#fd7e14' },
      { icon: 'fas fa-book-open', value: context.linkedShops.length, label: 'ENTRIES', color: '#6f42c1' }
    ];

    const sources = [
      { data: context.allNPCs, type: 'npc' },
      { data: context.linkedShops, type: 'shop' },
    ];

    context.quickLinks = CampaignCodexLinkers.createQuickLinks(sources);

    const allItems = [
      ...context.allNPCs.map(npc => ({ ...npc, type: 'npc' })),
      ...context.linkedShops.map(shop => ({ ...shop, type: 'shop' }))
    ];
    
    let headerContent = '';
    
    if (context.linkedRegion) {
      headerContent += `
        <div class="region-info">
          <span class="region-label">Region:</span>
          <span class="region-name region-link" data-action="openRegion" data-region-uuid="${context.linkedRegion.uuid}" style="cursor: pointer; color: var(--cc-accent);">${context.linkedRegion.name}</span>
        </div>
      `;
    }
    
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
    let locationSection = '';
    
    if (data.linkedRegion) {
      locationSection = `
        <div class="form-section">
          <h3><i class="${TemplateComponents.getAsset('icon','region')}"></i> Region</h3>
          <div class="linked-actor-card">
            <div class="actor-image">
              <img src="${data.linkedRegion.img}" alt="${data.linkedRegion.name}">
            </div>
            <div class="actor-content">
              <h4 class="actor-name">${data.linkedRegion.name}</h4>
            </div>
            <div class="actor-actions">
              <button type="button" data-action="openRegion" class="action-btn" data-region-uuid="${data.linkedRegion.uuid}" title="Open Region">
                <i class="fas fa-external-link-alt"></i>
              </button>
              <button type="button" data-action="removeLocation" class="action-btn" title="Remove from Region">
                <i class="fas fa-unlink"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      locationSection = `
      <div class="form-section">
        ${TemplateComponents.dropZone('region', 'fas fa-globe', 'Set Region', 'Drag a region journal here to add this location to a region')}
      </div>`;
    }
    
    return `
      ${TemplateComponents.contentHeader('fas fas fa-info-circle', 'Information')}
      ${locationSection}
      ${TemplateComponents.richTextSection('Description', 'fas fa-align-left', data.sheetData.enrichedDescription, 'description')}
    `;
  }

  _generateNPCsTab(data) {
    const dropToMapBtn = (canvas.scene && data.directNPCs && data.directNPCs.length > 0) ? `
      <button type="button" data-action="dropNpcsToMap" class="refresh-btn npcs-to-map-button" title="Drop direct NPCs to current scene">
        <i class="fas fa-map"></i>
        Drop Direct NPCs
      </button>
    ` : '';

    let content = `
      ${TemplateComponents.contentHeader('fas fa-users', 'NPCs at this Location', dropToMapBtn)}
      ${TemplateComponents.dropZone('npc', 'fas fa-user-plus', 'Add NPCs', 'Drag NPCs or actors here to add them directly to this location')}
    `;

    if (data.directNPCs.length > 0) {
      content += `
        <div class="npc-section">
          <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
            <i class="fas fa-user" style="color: var(--cc-accent); margin-right: 8px;"></i>
            Direct NPCs (${data.directNPCs.length}) 
           </h3>
          ${this._generateEntityGridWithActions(data.directNPCs, 'npc', true)}
        </div>
      `;
    }

    if (data.shopNPCs.length > 0) {
      content += `
        <div class="npc-section">
          <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
            <i class="fas fa-book-open" style="color: var(--cc-accent); margin-right: 8px;"></i>
            Entry NPCs (${data.shopNPCs.length})
           </h3>
          ${TemplateComponents.infoBanner('NPCs automatically populated from entries at this location. Manage them through their respective entries.')}
          ${this._generateEntityGridWithActions(data.shopNPCs, 'npc', true)}
        </div>
      `;
    }

    if (data.allNPCs.length === 0) {
      content += TemplateComponents.emptyState('npc');
    }

    return content;
  }

  _generateShopsTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fa-book-open', 'Entries at this Location')}
      ${TemplateComponents.dropZone('shop', 'fas fa-book-open', 'Add Entries', 'Drag entry journals here to add them to this location')}
      ${this._generateEntityGridWithActions(data.linkedShops, 'shop')}
    `;
  }

  // Helper method to generate entity grids with action attributes
  _generateEntityGridWithActions(entities, type, showRemove = false) {
    if (entities.length === 0) {
      return TemplateComponents.emptyState(type);
    }

    const entityCards = entities.map(entity => {
      let actionButtons = '';
      
      if (type === 'npc') {
        actionButtons = `
          <button type="button" data-action="openNpc" class="action-btn open-npc" data-npc-uuid="${entity.uuid}" title="Open NPC">
            <i class="fas fa-external-link-alt"></i>
          </button>
          ${entity.actor ? `
            <button type="button" data-action="openActor" class="action-btn open-actor" data-actor-uuid="${entity.actor.uuid}" title="Open Actor">
              <i class="fas fa-user"></i>
            </button>
          ` : ''}
          ${showRemove ? `
            <button type="button" data-action="removeNpc" class="action-btn remove-npc" data-npc-uuid="${entity.uuid}" title="Remove NPC">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        `;
      } else if (type === 'shop') {
        actionButtons = `
          <button type="button" data-action="openShop" class="action-btn open-shop" data-shop-uuid="${entity.uuid}" title="Open Entry">
            <i class="fas fa-external-link-alt"></i>
          </button>
          ${showRemove ? `
            <button type="button" data-action="removeShop" class="action-btn remove-shop" data-shop-uuid="${entity.uuid}" title="Remove Entry">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        `;
      }

      return `
        <div class="entity-card">
          <div class="entity-image">
            <img src="${entity.img}" alt="${entity.name}">
          </div>
          <div class="entity-content">
            <h4 class="entity-name">${entity.name}</h4>
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
  static async #onRemoveNpc(event, target) {
    const npcUuid = target.dataset.npcUuid;
    const npcCard = target.closest('.entity-card');
    const isShopNPC = npcCard.querySelector('.shop-tags');
    
    if (isShopNPC) {
      ui.notifications.warn("Cannot remove entry NPCs directly. Remove them from their entries instead.");
      return;
    }
    
    await this._onRemoveFromList(event, 'linkedNPCs');
  }

  static async #onRemoveLocation(event, target) {
    await this._onRemoveFromRegion(event);
  }

  static async #onRemoveShop(event, target) {
    await this._onRemoveFromList(event, 'linkedShops');
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

  static async #onOpenRegion(event, target) {
    await this._onOpenDocument(event, 'region');
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

  static async #onRefreshNpcs(event, target) {
    this.render(false);
    ui.notifications.info("Location data refreshed!");
  }

  static async #onDropNPCsToMap(event, target) {
    event.preventDefault();
    
    const locationData = this.document.getFlag("campaign-codex", "data") || {};
    const directNPCs = await CampaignCodexLinkers.getDirectNPCs(this.document, locationData.linkedNPCs || []);
    
    if (directNPCs && directNPCs.length > 0) {
      await this._onDropNPCsToMap(directNPCs, { 
        title: `Drop ${this.document.name} Direct NPCs to Map` 
      });
    } else {
      ui.notifications.warn("No direct NPCs with linked actors found to drop!");
    }
  }

  // Keep existing methods that don't need major changes
  async _handleDrop(data, event) {
    if (data.type === "Scene") {
      await this._handleSceneDrop(data, event);
    } else if (data.type === "JournalEntry") {
      await this._handleJournalDrop(data, event);
    } else if (data.type === "Actor") {
      await this._handleActorDrop(data, event);
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
    
    if (journalType === "npc") {
      await this._saveFormData();
      await game.campaignCodex.linkLocationToNPC(this.document, journal);
      this.render(false);
    } else if (journalType === "shop") {
      await this._saveFormData();
      await game.campaignCodex.linkLocationToShop(this.document, journal);
      this.render(false);
    } else if (journalType === "region") {
      await this._saveFormData();
      await game.campaignCodex.linkRegionToLocation(journal, this.document);
      ui.notifications.info(`Added "${this.document.name}" to region "${journal.name}"`);
      this.render(false);
    }
  }

  getSheetType() {
    return "location";
  }
}