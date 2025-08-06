import { CampaignCodexBaseSheet } from './base-sheet.js';
import { TemplateComponents } from './template-components.js';
// import { DescriptionEditor } from './editors/description-editor.js';
import { CampaignCodexLinkers } from './linkers.js';

export class NPCSheet extends CampaignCodexBaseSheet {
  // Convert defaultOptions to DEFAULT_OPTIONS
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: [...(super.DEFAULT_OPTIONS?.classes || []), "npc-sheet", "themed"],
    actions: {
      removeLocation: NPCSheet.#onRemoveLocation,
      removeActor: NPCSheet.#onRemoveActor,
      removeShop: NPCSheet.#onRemoveShop,
      removeAssociate: NPCSheet.#onRemoveAssociate,
      openActor: NPCSheet.#onOpenActor,
      openLocation: NPCSheet.#onOpenLocation,
      openShop: NPCSheet.#onOpenShop,
      openNpc: NPCSheet.#onOpenNpc,
      openAssociate: NPCSheet.#onOpenAssociate,
      refreshLocations: NPCSheet.#onRefreshLocations,
      dropNpcToMap: NPCSheet.#onDropNpcToMap
    }
  });

  get template() {
    return "modules/campaign-codex/templates/base-sheet.html";
  }

  // Convert getData to _prepareContext
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const npcData = this.document.getFlag("campaign-codex", "data") || {};

    context.linkedActor = npcData.linkedActor ? await CampaignCodexLinkers.getLinkedActor(npcData.linkedActor) : null;
    context.allLocations = await CampaignCodexLinkers.getAllLocations(this.document, npcData.linkedLocations || []);
    context.linkedShops = await CampaignCodexLinkers.getLinkedShopsWithLocation(this.document, npcData.linkedShops || []);
    context.associates = await CampaignCodexLinkers.getAssociates(this.document, npcData.associates || []);

    context.sheetType = "npc";
    context.sheetTypeLabel = context.linkedActor?.type === 'character' ? "Player Journal" : "NPC Journal";
    context.defaultImage = TemplateComponents.getAsset('image','npc');
    context.customImage = this.document.getFlag("campaign-codex", "image") || context.linkedActor?.img || TemplateComponents.getAsset('image','npc');
    
    context.tabs = [
      { key: 'info', label: 'Info', icon: 'fas fa-info-circle', active: this._currentTab === 'info' },
      { key: 'locations', label: 'Locations', icon: 'fas fa-map-marker-alt', active: this._currentTab === 'locations',
      statistic: {
        value: context.allLocations.length,
        color: '#28a745'
      } },
      { key: 'shops', label: 'Entries', icon: 'fas fa-book-open', active: this._currentTab === 'shops' ,
      statistic: {
        value: context.linkedShops.length,
        color: '#6f42c1'
      }},
      { key: 'associates', label: 'Associates', icon: 'fas fa-users', active: this._currentTab === 'associates',
      statistic: {
        value: context.associates.length,
        color: '#fd7e14'
      } },
      { key: 'notes', label: 'Notes', icon: 'fas fa-sticky-note', active: this._currentTab === 'notes' }
    ];
    
    context.statistics = [
      { icon: 'fas fa-map-marker-alt', value: context.allLocations.length, label: 'LOCATIONS', color: '#28a745' },
      { icon: 'fas fa-book-open', value: context.linkedShops.length, label: 'ENTRIES', color: '#6f42c1' },
      { icon: 'fas fa-users', value: context.associates.length, label: 'ASSOCIATES', color: '#fd7e14' }
    ];

    const sources = [
      { data: context.allLocations, type: 'location' },
      { data: context.linkedShops, type: 'shop' },
      { data: context.associates, type: 'npc' }
    ];

    context.quickLinks = CampaignCodexLinkers.createQuickLinks(sources);

    if (context.linkedActor) {
      context.customHeaderContent = `
        <div class="actor-stats">
        </div>
      `;
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
        key: 'shops', 
        active: this._currentTab === 'shops',
        content: this._generateShopsTab(context)
      },
      {
        key: 'associates',
        active: this._currentTab === 'associates', 
        content: this._generateAssociatesTab(context)
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
    let actorSection = '';
    let dropToMapBtn = '';

    dropToMapBtn = (canvas.scene && data.linkedActor) ? `
      <button type="button" data-action="dropNpcToMap" class="refresh-btn npcs-to-map-button" title="Drop to current scene">
        <i class="fas fa-map"></i>
        Drop NPC
      </button>
    ` : '';

    if (data.linkedActor) {
      actorSection = `
        <div class="form-section">
          <h3><i class="fas fa-link"></i> Linked Actor</h3>
          ${this._generateActorLinkCardWithActions(data.linkedActor)}
        </div>
      `;
    } else {
      actorSection = `
        <div class="form-section">
          ${TemplateComponents.dropZone('actor', 'fas fa-user-plus', 'Link Actor', 'Drag an NPC actor here to link')}
        </div>
      `;
    }
    
    return `
      ${TemplateComponents.contentHeader('fas fas fa-info-circle', 'Information', dropToMapBtn)}
      ${actorSection}
      ${TemplateComponents.richTextSection('Description', 'fas fa-align-left', data.sheetData.enrichedDescription, 'description')}
    `;
  }

  _generateLocationsTab(data) {
    const refreshBtn = `
      <button type="button" data-action="refreshLocations" class="refresh-btn refresh-locations" title="Refresh location data">
        <i class="fas fa-sync-alt"></i>
        Refresh
      </button>
    `;

    return `
      ${TemplateComponents.contentHeader('fas fa-map-marker-alt', 'Locations', refreshBtn)}
      ${TemplateComponents.dropZone('location', 'fas fa-map-marker-alt', 'Add Locations', 'Drag location journals here to associate this NPC with them')}
      ${this._generateLocationsBySource(data)}
    `;
  }

  _generateLocationsBySource(data) {
    const directLocations = data.allLocations.filter(loc => loc.source === 'direct');
    const shopLocations = data.allLocations.filter(loc => loc.source === 'shop');

    let content = '';

    if (directLocations.length > 0) {
      content += `
        <div class="location-section">
          <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
            <i class="fas fa-map-marker-alt" style="color: var(--cc-accent); margin-right: 8px;"></i>
            Direct Locations (${directLocations.length})
          </h3>
          ${this._generateEntityGridWithActions(directLocations, 'location', true)}
        </div>
      `;
    }

    if (shopLocations.length > 0) {
      content += `
        <div class="location-section">
          <h3 style="color: var(--cc-main-text); font-family: var(--cc-font-heading); font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 16px 0; border-bottom: 1px solid var(--cc-border-light); padding-bottom: 8px;">
            <i class="fas fa-book-open" style="color: var(--cc-accent); margin-right: 8px;"></i>
            Shop Locations (${shopLocations.length})
          </h3>
          ${TemplateComponents.infoBanner('Locations where this NPC works through shop associations.')}
          ${this._generateEntityGridWithActions(shopLocations, 'location', false)}
        </div>
      `;
    }

    if (data.allLocations.length === 0) {
      content = TemplateComponents.emptyState('location');
    }

    return content;
  }

  _generateShopsTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fa-book-open', 'Associated Entries')}
      ${TemplateComponents.dropZone('shop', 'fas fa-book-open', 'Add Entries', 'Drag entry journals here to associate this NPC with them')}
      ${this._generateEntityGridWithActions(data.linkedShops, 'shop', true)}
    `;
  }

  _generateAssociatesTab(data) {
    return `
      ${TemplateComponents.contentHeader('fas fa-users', 'Associates & Contacts')}
      ${TemplateComponents.dropZone('associate', 'fas fa-user-friends', 'Add Associates', 'Drag NPC journals or actors here to create relationships')}
      ${this._generateEntityGridWithActions(data.associates, 'associate', true)}
    `;
  }

  // Helper method to generate entity grids with action attributes
  _generateEntityGridWithActions(entities, type, showRemove = true) {
    if (entities.length === 0) {
      return TemplateComponents.emptyState(type);
    }

    const entityCards = entities.map(entity => {
      let actionButtons = '';
      
      // Determine if this is a shop-based location that shouldn't be removable
      const isShopLocation = entity.source === 'shop';
      const removeDisabled = (type === 'location' && isShopLocation);
      
      if (type === 'location') {
        actionButtons = `
          <button type="button" data-action="openLocation" class="action-btn open-location" data-location-uuid="${entity.uuid}" title="Open Location">
            <i class="fas fa-external-link-alt"></i>
          </button>
          ${showRemove ? `
            <button type="button" data-action="removeLocation" class="action-btn remove-location" 
                    data-location-uuid="${entity.uuid}" title="${removeDisabled ? 'Cannot remove shop-based locations' : 'Remove Location'}"
                    ${removeDisabled ? 'style="opacity: 0.3; cursor: not-allowed;"' : ''}>
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
      } else if (type === 'associate') {
        actionButtons = `
          <button type="button" data-action="openAssociate" class="action-btn open-associate" data-associate-uuid="${entity.uuid}" title="Open Associate">
            <i class="fas fa-external-link-alt"></i>
          </button>
          ${showRemove ? `
            <button type="button" data-action="removeAssociate" class="action-btn remove-associate" data-associate-uuid="${entity.uuid}" title="Remove Associate">
              <i class="fas fa-trash"></i>
            </button>
          ` : ''}
        `;
      }

      return `
        <div class="entity-card" data-source="${entity.source || ''}">
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

  // Helper method to generate actor link card with actions
  _generateActorLinkCardWithActions(actor) {
    return `
      <div class="linked-actor-card">
        <div class="actor-image">
          <img src="${actor.img}" alt="${actor.name}">
        </div>
        <div class="actor-content">
          <h4 class="actor-name">${actor.name}</h4>
          <p class="actor-type">${actor.type.charAt(0).toUpperCase() + actor.type.slice(1)}</p>
        </div>
        <div class="actor-actions">
          <button type="button" data-action="openActor" class="action-btn open-actor" data-actor-uuid="${actor.uuid}" title="Open Actor">
            <i class="fas fa-external-link-alt"></i>
          </button>
          <button type="button" data-action="removeActor" class="action-btn remove-actor" title="Unlink Actor">
            <i class="fas fa-unlink"></i>
          </button>
        </div>
      </div>
    `;
  }

  // Action handlers (converted from jQuery event handlers)
  static async #onRemoveLocation(event, target) {
    event.stopPropagation();
    
    if (target.style.opacity === '0.3' || target.style.cursor === 'not-allowed') {
      ui.notifications.warn("Cannot remove shop-based locations directly. Remove the NPC from the shop instead.");
      return;
    }
    
    const locationCard = target.closest('.entity-card');
    const isShopLocation = locationCard.getAttribute('data-source') === 'shop';
    
    if (isShopLocation) {
      ui.notifications.warn("Cannot remove shop-based locations directly. Remove the NPC from the shop instead.");
      return;
    }
    
    await this._onRemoveFromList(event, 'linkedLocations');
  }

  static async #onRemoveActor(event, target) {
    await this._saveFormData();
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    currentData.linkedActor = null;
    await this.document.setFlag("campaign-codex", "data", currentData);
    this.render(false);
  }

  static async #onRemoveShop(event, target) {
    await this._onRemoveFromList(event, 'linkedShops');
  }

  static async #onRemoveAssociate(event, target) {
    await this._onRemoveFromList(event, 'associates');
  }

  static async #onOpenActor(event, target) {
    await this._onOpenDocument(event, 'actor');
  }

  static async #onOpenLocation(event, target) {
    await this._onOpenDocument(event, 'location');
  }

  static async #onOpenShop(event, target) {
    await this._onOpenDocument(event, 'shop');
  }

  static async #onOpenNpc(event, target) {
    await this._onOpenDocument(event, 'npc');
  }

  static async #onOpenAssociate(event, target) {
    await this._onOpenDocument(event, 'associate');
  }

  static async #onRefreshLocations(event, target) {
    console.log(`Campaign Codex | Manual refresh requested for NPC: ${this.document.name}`);
    
    const npcData = this.document.getFlag("campaign-codex", "data") || {};
    const linkedShops = npcData.linkedShops || [];
    console.log(`Campaign Codex | Current linked shops:`, linkedShops);
    
    this.render(false);
    ui.notifications.info("Location data refreshed! Shop-based locations have been recalculated.");
  }

  static async #onDropNpcToMap(event, target) {
    event.preventDefault();
    
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
  }

  // Keep existing methods that don't need major changes
  async _forceLocationRecalculation() {
    console.log(`Campaign Codex | Forcing location recalculation for NPC: ${this.document.name}`);
    
    const npcData = this.document.getFlag("campaign-codex", "data") || {};
    const directLocations = npcData.linkedLocations || [];
    const linkedShops = npcData.linkedShops || [];
    
    console.log(`Campaign Codex | Direct locations:`, directLocations);
    console.log(`Campaign Codex | Linked shops:`, linkedShops);
    
    for (const shopUuid of linkedShops) { 
      const shop = await fromUuid(shopUuid); 
      if (shop) {
        const shopData = shop.getFlag("campaign-codex", "data") || {};
        const shopNPCs = shopData.linkedNPCs || [];
        const shopLocation = shopData.linkedLocation;
        
        console.log(`Campaign Codex | Shop ${shop.name}:`, {
          linksToThisNPC: shopNPCs.includes(this.document.uuid), 
          location: shopLocation,
          allNPCs: shopNPCs
        });
      }
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
    let journalUuid = data.uuid;
    if (!journalUuid && data.id) {
      journalUuid = `JournalEntry.${data.id}`;
    }
    
    if (!journalUuid) {
      ui.notifications.warn("Could not determine journal UUID");
      return;
    }
    
    const journal = await fromUuid(journalUuid);
    if (!journal || journal.id === this.document.id) return; 

    const journalType = journal.getFlag("campaign-codex", "type");
    
    if (journalType === "location") {
      await this._saveFormData();
      await game.campaignCodex.linkLocationToNPC(journal, this.document);
      this.render(false);
    } else if (journalType === "shop") {
      await this._saveFormData();
      await game.campaignCodex.linkShopToNPC(journal, this.document);
      this.render(false);
    } else if (journalType === "npc") {
      await this._saveFormData();
      await game.campaignCodex.linkNPCToNPC(this.document, journal);
      this.render(false);
    }
  }

  getSheetType() {
    return "npc";
  }
}