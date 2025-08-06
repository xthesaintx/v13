import { CampaignCodexBaseSheet } from './base-sheet.js';
import { TemplateComponents } from './template-components.js';
import { DescriptionEditor } from './editors/description-editor.js';
import { CampaignCodexLinkers } from './linkers.js';

export class ShopSheet extends CampaignCodexBaseSheet {
  // Convert defaultOptions to DEFAULT_OPTIONS
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: [...(super.DEFAULT_OPTIONS?.classes || []), "shop-sheet", "themed"],
    actions: {
      // Toggle actions
      markupChange: ShopSheet.#onMarkupChange,
      lootToggle: ShopSheet.#onLootToggle,
      hideInventoryToggle: ShopSheet.#onHideInventoryToggle,
      
      // Item management actions
      removeItem: ShopSheet.#onRemoveItem,
      quantityDecrease: ShopSheet.#onQuantityDecrease,
      quantityIncrease: ShopSheet.#onQuantityIncrease,
      quantityChange: ShopSheet.#onQuantityChange,
      priceChange: ShopSheet.#onPriceChange,
      
      // NPC and location actions
      removeNpc: ShopSheet.#onRemoveNpc,
      removeLocation: ShopSheet.#onRemoveLocation,
      
      // Open document actions
      openNpc: ShopSheet.#onOpenNpc,
      openLocation: ShopSheet.#onOpenLocation,
      openItem: ShopSheet.#onOpenItem,
      openActor: ShopSheet.#onOpenActor,
      
      // Item transfer actions
      sendToPlayer: ShopSheet.#onSendToPlayer,
      
      // Scene actions
      openScene: ShopSheet.#onOpenScene,
      removeScene: ShopSheet.#onRemoveScene,
      
      // Map actions
      dropNpcsToMap: ShopSheet.#onDropNpcsToMap
    }
  });

  get template() {
    return "modules/campaign-codex/templates/base-sheet.html";
  }

  // Convert getData to _prepareContext
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const shopData = this.document.getFlag("campaign-codex", "data") || {};
    
    context.isLoot = shopData.isLoot || false;
    context.hideInventory = shopData.hideInventory || false;

    context.linkedScene = null;
    if (shopData.linkedScene) {
      try {
        const scene = await fromUuid(shopData.linkedScene);
        if (scene) {
          context.linkedScene = {
            uuid: scene.uuid,
            name: scene.name,
            img: scene.thumb || "icons/svg/map.svg"
          };
        }
      } catch (error) {
        console.warn(`Campaign Codex | Linked scene not found: ${shopData.linkedScene}`);
      }
    }
    
    context.linkedNPCs = await CampaignCodexLinkers.getLinkedNPCs(this.document, shopData.linkedNPCs || []);
    context.linkedLocation = shopData.linkedLocation ? await CampaignCodexLinkers.getLinkedLocation(shopData.linkedLocation) : null;
    context.inventory = await CampaignCodexLinkers.getInventory(this.document, shopData.inventory || []);
    
    context.sheetType = "shop";
    context.sheetTypeLabel = "Entry";
    context.customImage = this.document.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image','shop');
    context.markup = shopData.markup || 1.0;
    
    context.tabs = [
      { key: 'info', label: 'Info', icon: 'fas fa-info-circle', active: this._currentTab === 'info' },
      ...(context.hideInventory ? [] : [{ key: 'inventory', label: 'Inventory', icon: 'fas fa-boxes', active: this._currentTab === 'inventory',
      statistic: {
        value: context.inventory.length,
        color: '#28a745'
      } }]),
      { key: 'npcs', label: 'NPCs', icon: 'fas fa-users', active: this._currentTab === 'npcs',
      statistic: {
        value: context.linkedNPCs.length,
        color: '#fd7e14'
      } },
      { key: 'notes', label: 'Notes', icon: 'fas fa-sticky-note', active: this._currentTab === 'notes' }
    ];
    
    context.statistics = [
      { icon: 'fas fa-boxes', value: context.inventory.length, label: 'ITEMS', color: '#28a745' },
      { icon: 'fas fa-users', value: context.linkedNPCs.length, label: 'NPCS', color: '#fd7e14' },
      { icon: 'fas fa-percentage', value: `${context.markup}x`, label: 'MARKUP', color: '#d4af37' }
    ];
    
    const sources = [
      { data: context.linkedLocation, type: 'location' },
      { data: context.linkedNPCs, type: 'npc' }
    ];
    
    context.quickLinks = CampaignCodexLinkers.createQuickLinks(sources);
    
    let headerContent = '';
    
    if (context.linkedLocation) {
      headerContent += `
        <div class="region-info">
          <span class="region-label">Located:</span>
          <span class="region-name region-link" data-action="openLocation" data-location-uuid="${context.linkedLocation.uuid}" style="cursor: pointer; color: var(--cc-accent);">${context.linkedLocation.name}</span>
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

    headerContent += `
      <div class="shop-toggles" style="margin-top: 8px; display: flex; gap: 12px; align-items: center; justify-content: center;">
        <span class="stat-label">Hide Inventory</span>
        <label class="toggle-control">
          <input type="checkbox" data-action="hideInventoryToggle" class="hide-inventory-toggle" ${context.hideInventory ? 'checked' : ''} style="margin: 0;">
          <span class="slider"></span>
        </label>
      </div>
    `;
    
    context.customHeaderContent = headerContent;
    
    context.tabPanels = [
      {
        key: 'info',
        active: this._currentTab === 'info',
        content: this._generateInfoTab(context)
      },
      ...(context.hideInventory ? [] : [{
        key: 'inventory', 
        active: this._currentTab === 'inventory',
        content: this._generateInventoryTab(context)
      }]),
      {
        key: 'npcs', 
        active: this._currentTab === 'npcs',
        content: this._generateNPCsTab(context)
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
    
    if (data.linkedLocation) {
      locationSection = `
        <div class="form-section">
          <h3><i class="fas fa-map-marker-alt"></i> Location</h3>
          <div class="linked-actor-card">
            <div class="actor-image">
              <img src="${data.linkedLocation.img}" alt="${data.linkedLocation.name}">
            </div>
            <div class="actor-content">
              <h4 class="actor-name">${data.linkedLocation.name}</h4>
              <div class="actor-details">
                <span class="actor-race-class">Location</span>
              </div>
            </div>
            <div class="actor-actions">
              <button type="button" data-action="openLocation" class="action-btn open-location" data-location-uuid="${data.linkedLocation.uuid}" title="Open Location">
                <i class="fas fa-external-link-alt"></i>
              </button>
              <button type="button" data-action="removeLocation" class="action-btn remove-location" title="Remove Location">
                <i class="fas fa-unlink"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      locationSection = `
        <div class="form-section">
          ${TemplateComponents.dropZone('location', 'fas fa-map-marker-alt', 'Set Location', 'Drag a location journal here to set where this entry is located')}
        </div>
      `;
    }
    
    return `
      ${TemplateComponents.contentHeader('fas fas fa-info-circle', 'Information')}
      ${locationSection}
      ${TemplateComponents.richTextSection('Description', 'fas fa-align-left', data.sheetData.enrichedDescription, 'description')}
    `;
  }

  _generateInventoryTab(data) {
    const markupSection = data.isLoot ? '' : this._generateMarkupControlWithActions(data.markup);
    
    return `
      ${TemplateComponents.contentHeader('fas fa-boxes', data.isLoot ? 'Loot' : 'Inventory')}
      <div class="shop-toggles">
        <span class="stat-label">Loot Mode</span>
        <label class="toggle-control">
          <input type="checkbox" data-action="lootToggle" class="shop-loot-toggle" ${data.isLoot ? 'checked' : ''} style="margin: 0;">
          <span class="slider"></span>
        </label>
      </div>
      ${TemplateComponents.dropZone('item', 'fas fa-plus-circle', 'Add Items', 'Drag items from the items directory to add them to inventory')}
      ${markupSection}
      ${this._generateInventoryTableWithActions(data.inventory, data.isLoot)}
    `;
  }

  _generateNPCsTab(data) {
    const dropToMapBtn = canvas.scene ? `
      <button type="button" data-action="dropNpcsToMap" class="refresh-btn npcs-to-map-button" title="Drop NPCs to current scene">
        <i class="fas fa-map"></i>
        Drop to Map
      </button>
    ` : '';

    return `
      ${TemplateComponents.contentHeader('fas fa-users', 'NPCs', dropToMapBtn)}
      ${TemplateComponents.dropZone('npc', 'fas fa-user-plus', 'Add NPCs', 'Drag NPCs or actors here to associate them with this location')}
      ${this._generateEntityGridWithActions(data.linkedNPCs, 'npc', true)}
    `;
  }

  // Helper method to generate markup control with actions
  _generateMarkupControlWithActions(markup) {
    return `
      <div class="form-section">
        <label class="form-label">
          <i class="fas fa-percentage"></i>
          Markup Multiplier
        </label>
        <input type="number" 
               data-action="markupChange" 
               class="markup-input" 
               value="${markup}" 
               step="0.1" 
               min="0" 
               style="width: 100px;">
      </div>
    `;
  }

  // Helper method to generate inventory table with actions
  _generateInventoryTableWithActions(inventory, isLoot) {
    if (inventory.length === 0) {
      return `<div class="empty-state">No items in ${isLoot ? 'loot' : 'inventory'}</div>`;
    }

    const inventoryRows = inventory.map(item => {
      const quantityControls = `
        <div class="quantity-controls">
          <button type="button" data-action="quantityDecrease" data-item-uuid="${item.uuid}" class="quantity-btn">-</button>
          <input type="number" 
                 data-action="quantityChange" 
                 data-item-uuid="${item.uuid}" 
                 value="${item.quantity}" 
                 min="0" 
                 class="quantity-input">
          <button type="button" data-action="quantityIncrease" data-item-uuid="${item.uuid}" class="quantity-btn">+</button>
        </div>
      `;

      const priceControl = isLoot ? '' : `
        <input type="number" 
               data-action="priceChange" 
               data-item-uuid="${item.uuid}" 
               value="${item.customPrice || item.price}" 
               step="0.01" 
               min="0" 
               class="price-input">
      `;

      const actionButtons = `
        <div class="item-actions">
          <button type="button" data-action="openItem" data-item-uuid="${item.uuid}" title="Open Item">
            <i class="fas fa-external-link-alt"></i>
          </button>
          <button type="button" data-action="sendToPlayer" data-item-uuid="${item.uuid}" title="Send to Player">
            <i class="fas fa-share"></i>
          </button>
          <button type="button" data-action="removeItem" data-item-uuid="${item.uuid}" title="Remove Item">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;

      return `
        <tr class="inventory-item" draggable="true" data-item-uuid="${item.uuid}">
          <td><img src="${item.img}" alt="${item.name}" class="item-image"></td>
          <td>${item.name}</td>
          <td>${quantityControls}</td>
          ${isLoot ? '' : `<td>${priceControl}</td>`}
          <td>${actionButtons}</td>
        </tr>
      `;
    }).join('');

    const headers = isLoot ? 
      '<th>Image</th><th>Name</th><th>Quantity</th><th>Actions</th>' :
      '<th>Image</th><th>Name</th><th>Quantity</th><th>Price</th><th>Actions</th>';

    return `
      <table class="inventory-table">
        <thead>
          <tr>${headers}</tr>
        </thead>
        <tbody>
          ${inventoryRows}
        </tbody>
      </table>
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
  static async #onMarkupChange(event, target) {
    const markup = parseFloat(target.value) || 1.0;
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    currentData.markup = markup;
    await this.document.setFlag("campaign-codex", "data", currentData);
    this.render(false);
  }

  static async #onLootToggle(event, target) {
    const isLoot = target.checked;
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    currentData.isLoot = isLoot;
    await this.document.setFlag("campaign-codex", "data", currentData);
    this.render(false);
    ui.notifications.info(`${isLoot ? 'Enabled' : 'Disabled'} loot mode`);
  }

  static async #onHideInventoryToggle(event, target) {
    const hideInventory = target.checked;
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    currentData.hideInventory = hideInventory;
    await this.document.setFlag("campaign-codex", "data", currentData);
    
    if (hideInventory && this._currentTab === 'inventory') {
      this._currentTab = 'info';
    }
    
    this.render(false);
    ui.notifications.info(`${hideInventory ? 'Hidden' : 'Shown'} inventory in sidebar`);
  }

  static async #onRemoveItem(event, target) {
    const itemUuid = target.dataset.itemUuid;
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    
    currentData.inventory = (currentData.inventory || []).filter(i => i.itemUuid !== itemUuid);
    await this.document.setFlag("campaign-codex", "data", currentData);
    
    this.render(false);
  }

  static async #onQuantityDecrease(event, target) {
    const itemUuid = target.dataset.itemUuid;
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    const inventory = currentData.inventory || [];
    const item = inventory.find(i => i.itemUuid === itemUuid);
    
    if (item && item.quantity > 0) {
      await this._updateInventoryItem(itemUuid, { quantity: item.quantity - 1 });
    }
  }

  static async #onQuantityIncrease(event, target) {
    const itemUuid = target.dataset.itemUuid;
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    const inventory = currentData.inventory || [];
    const item = inventory.find(i => i.itemUuid === itemUuid);
    
    if (item) {
      await this._updateInventoryItem(itemUuid, { quantity: item.quantity + 1 });
    }
  }

  static async #onQuantityChange(event, target) {
    const quantity = parseInt(target.value) || 1;
    const itemUuid = target.dataset.itemUuid;
    await this._updateInventoryItem(itemUuid, { quantity });
  }

  static async #onPriceChange(event, target) {
    const price = parseFloat(target.value) || null;
    const itemUuid = target.dataset.itemUuid;
    await this._updateInventoryItem(itemUuid, { customPrice: price });
  }

  static async #onRemoveNpc(event, target) {
    await this._onRemoveFromList(event, 'linkedNPCs');
  }

  static async #onRemoveLocation(event, target) {
    await this._onRemoveLocation(event);
  }

  static async #onOpenNpc(event, target) {
    await this._onOpenDocument(event, 'npc');
  }

  static async #onOpenLocation(event, target) {
    await this._onOpenDocument(event, 'location');
  }

  static async #onOpenItem(event, target) {
    event.stopPropagation();
    const itemUuid = target.dataset.itemUuid;
    const item = await fromUuid(itemUuid) || game.items.get(itemUuid);
    
    if (item) {
      item.sheet.render(true);
    } else {
      ui.notifications.warn("Item not found in world items");
    }
  }

  static async #onOpenActor(event, target) {
    await this._onOpenDocument(event, 'actor');
  }

  static async #onSendToPlayer(event, target) {
    event.stopPropagation();
    const itemUuid = target.dataset.itemUuid;
    const item = await fromUuid(itemUuid) || game.items.get(itemUuid);
    
    if (!item) {
      ui.notifications.warn("Item not found");
      return;
    }

    TemplateComponents.createPlayerSelectionDialog(item.name, async (targetActor) => {
      await this._transferItemToActor(item, targetActor);
    });
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

  static async #onDropNpcsToMap(event, target) {
    event.preventDefault();
    
    const shopData = this.document.getFlag("campaign-codex", "data") || {};
    const linkedNPCs = await CampaignCodexLinkers.getLinkedNPCs(this.document, shopData.linkedNPCs || []);
    
    if (linkedNPCs && linkedNPCs.length > 0) {
      await this._onDropNPCsToMap(linkedNPCs, { 
        title: `Drop ${this.document.name} NPCs to Map` 
      });
    } else {
      ui.notifications.warn("No NPCs with linked actors found to drop!");
    }
  }

  // Keep existing methods that don't need major changes
  async _updateInventoryItem(itemUuid, updates) {
    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    const inventory = currentData.inventory || [];
    const itemIndex = inventory.findIndex(i => i.itemUuid === itemUuid);
    
    if (itemIndex !== -1) {
      inventory[itemIndex] = { ...inventory[itemIndex], ...updates };
      currentData.inventory = inventory;
      await this.document.setFlag("campaign-codex", "data", currentData);
      this.render(false);
    }
  }

  async _onRemoveLocation(event) {
    const shopDoc = this.document;
    const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
    const locationUuid = shopData.linkedLocation;

    if (!locationUuid) return;

    try {
      const locationDoc = await fromUuid(locationUuid);
      if (locationDoc) {
        const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
        if (locationData.linkedShops) {
          locationData.linkedShops = locationData.linkedShops.filter(uuid => uuid !== shopDoc.uuid);
          
          locationDoc._skipRelationshipUpdates = true;
          await locationDoc.setFlag("campaign-codex", "data", locationData);
          delete locationDoc._skipRelationshipUpdates;

          for (const app of Object.values(ui.windows)) {
            if (app.document?.uuid === locationDoc.uuid) {
              app.render(false);
            }
          }
        }
      }

      shopDoc._skipRelationshipUpdates = true;
      await shopDoc.update({ "flags.campaign-codex.data.linkedLocation": null });
      delete shopDoc._skipRelationshipUpdates;

    } catch (error) {
      console.error("Campaign Codex | Error removing location link:", error);
      ui.notifications.error("Failed to remove location link.");
    } finally {
      this.render(false);
    }
  }

  async _transferItemToActor(item, targetActor) {
    try {
      const itemData = item.toObject();
      delete itemData._id;
      
      const currentData = this.document.getFlag("campaign-codex", "data") || {};
      const inventory = currentData.inventory || [];
      const shopItem = inventory.find(i => i.itemUuid === item.uuid);
      const quantity = shopItem ? shopItem.quantity : 1;
      
      itemData.system.quantity = Math.min(quantity, 1);
      
      await targetActor.createEmbeddedDocuments("Item", [itemData]);
      
      if (shopItem && shopItem.quantity > 1) {
        await this._updateInventoryItem(item.uuid, { quantity: shopItem.quantity - 1 });
      } else {
        await this.#onRemoveItem({ currentTarget: { dataset: { itemUuid: item.uuid } } });
      }
      
      ui.notifications.info(`Sent "${item.name}" to ${targetActor.name}`);
      
      const targetUser = game.users.find(u => u.character?.id === targetActor.id);
      if (targetUser && targetUser.active) {
        ChatMessage.create({
          content: `<p><strong>${game.user.name}</strong> sent you <strong>${item.name}</strong> from ${this.document.name}!</p>`,
          whisper: [targetUser.id]
        });
      }
      
    } catch (error) {
      console.error("Error transferring item:", error);
      ui.notifications.error("Failed to transfer item");
    }
  }

  // Drag/drop event handlers (need special handling for actions system)
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Set up drag/drop handlers that can't use actions system
    const inventoryItems = this.element.querySelectorAll('.inventory-item');
    inventoryItems.forEach(item => {
      item.addEventListener('dragstart', this._onItemDragStart.bind(this));
      item.addEventListener('dragend', this._onItemDragEnd.bind(this));
    });
  }

  _onItemDragStart(event) {
    const itemUuid = event.currentTarget.dataset.itemUuid;
    
    const dragData = {
      type: "Item",
      uuid: itemUuid,
      source: "shop",
      shopId: this.document.id
    };
    
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    event.currentTarget.style.opacity = "0.5";
  }

  _onItemDragEnd(event) {
    event.currentTarget.style.opacity = "1";
  }

  async _handleDrop(data, event) {
    if (data.type === "Scene") {
      await this._handleSceneDrop(data, event);
    } else if (data.type === "Item") {
      await this._handleItemDrop(data, event);
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

  async _handleItemDrop(data, event) {
    if (!data.uuid) {
      ui.notifications.warn("Could not find item to add to entry");
      return;
    }

    const item = await fromUuid(data.uuid);
    if (!item) {
      ui.notifications.warn("Could not find item to add to entry");
      return;
    }

    const currentData = this.document.getFlag("campaign-codex", "data") || {};
    const inventory = currentData.inventory || [];
    
    if (inventory.find(i => i.itemUuid === item.uuid)) {
      ui.notifications.warn("Item already exists in inventory!");
      return;
    }

    await game.campaignCodex.addItemToShop(this.document, item, 1);
    this.render(false);
    ui.notifications.info(`Added "${item.name}" to entry inventory`);
  }

  async _handleJournalDrop(data, event) {
    const journal = await fromUuid(data.uuid);
    if (!journal || journal.id === this.document.id) return;

    const journalType = journal.getFlag("campaign-codex", "type");
    
    if (journalType === "npc") {
      await this._saveFormData();
      await game.campaignCodex.linkShopToNPC(this.document, journal);
      this.render(false);
    } else if (journalType === "location") {
      await this._saveFormData();
      await game.campaignCodex.linkLocationToShop(journal, this.document);
      this.render(false);
    }
  }

  getSheetType() {
    return "shop";
  }
}