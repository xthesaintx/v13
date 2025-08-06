// scripts/sheets/template-components.js - COMPLETE V13 VERSION
export class TemplateComponents {

  static getAsset(assetType, entityType, currentImg = null) {
    const myModulePath = "/modules/campaign-codex/";
    const ASSET_MAP = {
      region:   { icon: 'fas fa-globe',          image: myModulePath+'ui/region.webp' },
      location: { icon: 'fas fa-map-marker-alt', image: myModulePath+'ui/location.webp' },
      shop:     { icon: 'fas fa-house',          image: myModulePath+'ui/shop.webp' },
      npc:      { icon: 'fas fa-user',           image: myModulePath+'ui/npc.webp' },
      item:     { icon: 'fas fa-tag',            image: myModulePath+'ui/item.webp' },
      group:    { icon: 'fas fa-sitemap',        image: myModulePath+'ui/group.webp' },
      default:  { icon: 'fas fa-question',       image: myModulePath+'ui/default.webp' }
    };

    const assets = ASSET_MAP[entityType] || ASSET_MAP.default;

    if (assetType === 'image') {
      return currentImg || assets.image;
    }
    
    if (assetType === 'icon') {
      return assets.icon;
    }

    return ASSET_MAP.default.image;
  }

  // V13: ProseMirror rich text section with toggle functionality
  static richTextSection(label, icon, enrichedValue, fieldName, documentUuid) {
    const systemClass = game.system.id === 'dnd5e' ? ' dnd5e' : '';
    const journalClass = game.system.id === 'dnd5e' ? 'journal-entry-content' : ''; 

    if (!game.user.isGM) {
      return `
        <div class="form-section${systemClass}">
          <label class="form-label">
            <i class="${icon}"></i>
            ${label}
          </label>
          <div class="${journalClass}">
            ${enrichedValue || '<p><em>No content available.</em></p>'}
          </div>
        </div>
      `;
    }

    // V13: ProseMirror element that starts closed and can be toggled
    return `
      <div class="form-section${systemClass}">
        <label class="form-label">
          <i class="${icon}"></i>
          ${label}
          <a data-action="toggleEditor" data-field="${fieldName}" title="Toggle Editor" style="margin-left: 8px; cursor: pointer;">
            <i class="fas fa-edit"></i>
          </a>
        </label>
        <prose-mirror 
          name="flags.campaign-codex.data.${fieldName}"
          class="${journalClass}"
          style="min-height: 100px; display: block;">
          ${enrichedValue || '<p></p>'}
        </prose-mirror>
      </div>
    `;
  }
  
  static formSection(label, icon, name, placeholder, value = "", rows = 4) {
    return `
      <div class="form-section">
        <label class="form-label">
          <i class="${icon}"></i>
          ${label}
        </label>
        <textarea name="${name}" class="form-textarea" rows="${rows}" placeholder="${placeholder}">${value}</textarea>
      </div>
    `;
  }

  static dropZone(type, icon, title, description) {
    return `
      <div class="drop-zone" data-drop-type="${type}">
        <div class="drop-content">
          <h3><i class="${icon}"></i> ${title}</h3>
          <p>${description}</p>
        </div>
      </div>
    `;
  }

  static entityGrid(entities, type, showActorButton = false) {
    if (!entities || entities.length === 0) {
      return this.emptyState(type);
    }

    return `
      <div class="entity-grid">
        ${entities.map(entity => this.entityCard(entity, type, showActorButton)).join('')}
      </div>
    `;
  }

  static entityCard(entity, type, showActorButton = false) {
    const actorButton = showActorButton && entity.actor ? `
      <button type="button" class="action-btn" data-action="openActor" data-actor-uuid="${entity.actor.uuid}" data-uuid="${entity.actor.uuid}" title="Open Actor Sheet">
        <i class="fas fa-user"></i>
      </button>
    ` : '';

    const isShopSource = entity.source === 'shop';
    const sourceAttr = entity.source ? `data-source="${entity.source}"` : '';
    
    // Determine the proper action and data attributes based on type
    const removeAction = type === 'location' ? 'removeLocation' :
                        type === 'shop' ? 'removeShop' :
                        type === 'npc' ? 'removeNpc' :
                        type === 'associate' ? 'removeAssociate' :
                        type === 'item' ? 'removeItem' :
                        'removeFromList';
    
    const listName = type === 'location' ? 'linkedLocations' :
                    type === 'shop' ? 'linkedShops' :
                    type === 'npc' ? 'linkedNPCs' :
                    type === 'associate' ? 'associates' :
                    type === 'item' ? 'inventory' :
                    type + 's';
    
    let removeButton = '';
    if (isShopSource && (type === 'location' || type === 'npc')) {
      const entityTypeName = type === 'location' ? 'shop-based locations' : 'entry NPCs';
      removeButton = `
        <button type="button" class="action-btn remove-${type}" 
                data-action="${removeAction}" 
                data-list="${listName}"
                data-${type}-uuid="${entity.uuid}"
                data-uuid="${entity.uuid}" 
                title="Cannot remove ${entityTypeName} directly" 
                style="opacity: 0.3; cursor: not-allowed; background: #dc3545; color: white; border-color: #dc3545;">
          <i class="fas fa-ban"></i>
        </button>
      `;
    } else {
      removeButton = `
        <button type="button" class="action-btn remove-${type}" 
                data-action="${removeAction}"
                data-list="${listName}"
                data-${type}-uuid="${entity.uuid}"
                data-uuid="${entity.uuid}" 
                title="Remove ${type}">
          <i class="fas fa-times"></i>
        </button>
      `;
    }

    // Determine open action based on type
    const openAction = type === 'location' ? 'openLocation' :
                      type === 'shop' ? 'openShop' :
                      type === 'npc' ? 'openNpc' :
                      type === 'associate' ? 'openAssociate' :
                      type === 'item' ? 'openItem' :
                      'openDocument';

    return `
      <div class="entity-card ${type}-card" ${sourceAttr}>
        <div class="entity-image">
          <img src="${entity.img}" alt="${entity.name}">
        </div>
        <div class="entity-content">
          <h4 class="entity-name">${entity.name}</h4>
          <div class="entity-meta">
            ${entity.meta || `<span class="entity-type">${type}</span>`}
          </div>
          ${entity.locations && entity.locations.length > 0 ? `
            <div class="entity-locations">
              <i class="fas fa-map-marker-alt"></i>
              ${entity.locations.map(loc => `<span class="location-tag">${loc}</span>`).join('')}
            </div>
          ` : ''}
          ${entity.shops && entity.shops.length > 0 ? `
            <div class="entity-locations shop-tags">
              <i class="fas fa-book-open"></i>
              ${entity.shops.map(shop => `<span class="location-tag shop-tag">${shop}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="entity-actions">
          <button type="button" class="action-btn open-${type}" 
                  data-action="${openAction}"
                  data-${type}-uuid="${entity.uuid}"
                  data-uuid="${entity.uuid}" 
                  title="Open ${type}">
            <i class="fas fa-external-link-alt"></i>
          </button>
          ${removeButton}
          ${actorButton}
        </div>
      </div>
    `;
  }

  static emptyState(type) {
    const icons = {
      location: 'fas fa-map-marker-alt',
      shop: 'fas fa-book-open',
      npc: 'fas fa-users',
      associate: 'fas fa-users',
      item: 'fas fa-boxes'
    };

    const messages = {
      location: 'No Locations',
      shop: 'No Entries', 
      npc: 'No NPCs',
      associate: 'No Associates',
      item: 'No Items'
    };

    const descriptions = {
      location: 'Drag location journals here to add them',
      shop: 'Drag entry journals here to add them',
      npc: 'Drag NPCs here to add them',
      associate: 'Drag NPCs here to create relationships',
      item: 'Drag items here to add to inventory'
    };

    return `
      <div class="empty-state">
        <i class="${icons[type] || 'fas fa-question'}"></i>
        <h3>${messages[type] || 'No Items'}</h3>
        <p>${descriptions[type] || 'Drag items here'}</p>
      </div>
    `;
  }

  static contentHeader(icon, title, button = null) {
    return `
      <div class="content-header">
        <h2><i class="${icon}"></i> ${title}</h2>
        ${button || ''}
      </div>
    `;
  }

  static actorLinkCard(actor, showActions = true) {
    const actions = showActions ? `
      <div class="actor-actions">
        <button type="button" class="action-btn open-actor" 
                data-action="openActor"
                data-actor-uuid="${actor.uuid}"
                data-uuid="${actor.uuid}" 
                title="Open Actor Sheet">
          <i class="fas fa-external-link-alt"></i>
        </button>
        <button type="button" class="action-btn remove-actor" 
                data-action="removeActor" 
                title="Unlink Actor">
          <i class="fas fa-unlink"></i>
        </button>
      </div>
    ` : '';

    return `
      <div class="linked-actor-card">
        <div class="actor-image">
          <img src="${actor.img}" alt="${actor.name}">
        </div>
        <div class="actor-content">
          <h4 class="actor-name">${actor.name}</h4>
        </div>
        ${actions}
      </div>
    `;
  }

  static inventoryTable(inventory, isLootMode = false) {
    if (!inventory || inventory.length === 0) {
      return this.emptyState('item');
    }

    const inventoryRows = inventory.map(item => {
      const priceColumns = isLootMode ? '' : `
        <div class="item-base-price" style="text-align:center">
          ${item.basePrice} ${item.currency}
        </div>
        <div class="item-final-price" style="text-align:center">
          <input type="number" class="price-input" 
                 data-action="priceChange" 
                 data-item-uuid="${item.itemUuid}" 
                 value="${item.finalPrice}" 
                 step="0.01" 
                 min="0">
          <span class="price-currency">${item.currency}</span>
        </div>
      `;

      const gridColumns = isLootMode ? 
        'grid-template-columns: 60px minmax(100px, 2fr) minmax(100px, 120px) 68px' : 
        'grid-template-columns: 60px minmax(100px, 2fr) minmax(80px, 100px) minmax(80px, 100px) minmax(100px, 120px) 68px';

      return `
        <div class="inventory-item" draggable="true" data-item-uuid="${item.itemUuid}" data-item-name="${item.name}" style="${gridColumns}">
          <div class="item-image">
            <img src="${item.img}" alt="${item.name}">
          </div>
          <div class="item-details">
            <div class="item-name">${item.name}</div>
          </div>
          ${priceColumns}
          <div class="quantity-control" style="text-align:center">
            <button type="button" class="quantity-btn" 
                    data-action="quantityDecrease" 
                    data-item-uuid="${item.itemUuid}">
              <i class="fas fa-minus"></i>
            </button>
            <input type="number" class="quantity-input" 
                   data-action="quantityChange" 
                   data-item-uuid="${item.itemUuid}" 
                   value="${item.quantity}" 
                   min="0">
            <button type="button" class="quantity-btn" 
                    data-action="quantityIncrease" 
                    data-item-uuid="${item.itemUuid}">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <div class="item-actions" style="text-align:center">
            <button type="button" class="action-btn" 
                    data-action="openItem" 
                    data-item-uuid="${item.itemUuid}"
                    data-uuid="${item.itemUuid}" 
                    title="Open Item Sheet">
              <i class="fas fa-external-link-alt"></i>
            </button>
            <button type="button" class="action-btn" 
                    data-action="sendToPlayer" 
                    data-item-uuid="${item.itemUuid}" 
                    title="Send to Player">
              <i class="fas fa-paper-plane"></i>
            </button>
            <button type="button" class="action-btn" 
                    data-action="removeItem" 
                    data-item-uuid="${item.itemUuid}"
                    data-uuid="${item.itemUuid}" 
                    title="Remove Item">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    const headerGridColumns = isLootMode ? 
        'grid-template-columns: 60px minmax(100px, 2fr) minmax(100px, 120px) 68px' : 
        'grid-template-columns: 60px minmax(100px, 2fr) minmax(80px, 100px) minmax(80px, 100px) minmax(100px, 120px) 68px';

    return `
      <div class="inventory-table">
        <div class="table-header" style="${headerGridColumns}">
          <div>Image</div>
          <div>Item Name</div>
          ${isLootMode ? '' : '<div style="text-align:center">Base Price</div><div style="text-align:center">Final Price</div>'}
          <div style="text-align:center">Quantity</div>
          <div style="text-align:center">Actions</div>
        </div>
        ${inventoryRows}
      </div>
    `;
  }

  static async createPlayerSelectionDialog(itemName, onPlayerSelected) {
    const playerCharacters = game.actors.filter(actor => actor.type === "character");

    if (playerCharacters.length === 0) {
      ui.notifications.warn("No player characters found");
      return;
    }

    const content = `
      <div class="player-selection">
        <p>Send <strong>${itemName}</strong> to which player character?</p>
        <div class="player-list">
          ${playerCharacters.map(char => {
            const assignedUser = game.users.find(u => u.character?.uuid === char.uuid); 
            const userInfo = assignedUser ? ` (${assignedUser.name})` : ' (Unassigned)';
            
            return `
              <div class="player-option" data-actor-uuid="${char.uuid}">
                <img src="${char.img}" alt="${char.name}" style="width: 32px; height: 32px; border-radius: 4px; margin-right: 8px;">
                <div class="player-info">
                  <span class="character-name">${char.name}</span>
                  <span class="user-info">${userInfo}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // V13: Use Dialog (DialogV2 can be used but Dialog still works)
    new Dialog({
      title: "Send Item to Player Character",
      content: content,
      buttons: {
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      render: (html) => {
        // V13: Use vanilla JS
        const dialog = html[0] || html;
        dialog.querySelectorAll('.player-option').forEach(option => {
          option.addEventListener('click', async (event) => {
            const actorUuid = event.currentTarget.dataset.actorUuid;
            const actor = await fromUuid(actorUuid);
            if (actor) {
              onPlayerSelected(actor);
            }
            // Close the dialog
            dialog.closest('.dialog').querySelector('.dialog-button.cancel button').click();
          });
        });
      }
    }).render(true);
  }

  static markupControl(markup) {
    return `
      <div class="markup-control">
        <h3><i class="fas fa-percentage"></i> Global Price Markup</h3>
        <div class="markup-input-group">
          <input type="number" class="markup-input" 
                 data-action="markupChange" 
                 value="${markup}" 
                 min="0" 
                 max="10" 
                 step="0.1">
          <span class="markup-label">x base price</span>
        </div>
        <p class="markup-help">Items without custom prices will use base price × markup</p>
      </div>
    `;
  }

  static infoBanner(message) {
    return `
      <div class="info-banner">
        <i class="fas fa-info-circle"></i>
        <p>${message}</p>
      </div>
    `;
  }

  static groupMemberCard(member, children = []) {
    const childrenCount = children.length;
    const hasChildren = childrenCount > 0;
    
    return `
      <div class="group-member-card" data-uuid="${member.uuid}" data-type="${member.type}">
        <div class="member-header ${hasChildren ? 'expandable' : ''}" 
             data-action="toggleExpand" 
             data-uuid="${member.uuid}">
          ${hasChildren ? '<i class="fas fa-chevron-right expand-icon"></i>' : '<i class="member-spacer"></i>'}
          <img src="${member.img}" class="member-icon" alt="${member.name}">
          <div class="member-info">
            <span class="member-name">${member.name}</span>
            <span class="member-type">${member.type}</span>
            ${hasChildren ? `<span class="member-count">(${childrenCount})</span>` : ''}
          </div>
          <div class="member-actions">
            <button type="button" class="btn-open-sheet" 
                    data-action="openDocument" 
                    data-uuid="${member.uuid}" 
                    title="Open Sheet">
              <i class="fas fa-external-link-alt"></i>
            </button>
            <button type="button" class="btn-remove-member" 
                    data-action="removeMember" 
                    data-uuid="${member.uuid}" 
                    title="Remove from Group">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        ${hasChildren ? `
          <div class="member-children" style="display: none;">
            ${children.map(child => `
              <div class="child-member" data-uuid="${child.uuid}">
                <img src="${child.img}" class="child-icon" alt="${child.name}">
                <span class="child-name">${child.name}</span>
                <span class="child-type">${child.type}</span>
                <div class="child-actions">
                  <button type="button" class="btn-open-sheet" 
                          data-action="openDocument" 
                          data-uuid="${child.uuid}" 
                          title="Open Sheet">
                    <i class="fas fa-external-link-alt"></i>
                  </button>
                  <button type="button" class="btn-focus-item" 
                          data-action="focusItem" 
                          data-uuid="${child.uuid}" 
                          title="Focus in Tab">
                    <i class="fas fa-search"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  static statCard(icon, value, label, color = null) {
    return `
      <div class="stat-card">
        <div class="stat-icon" ${color ? `style="background: ${color};"` : ''}>
          <i class="${icon}"></i>
        </div>
        <div class="stat-content">
          <div class="stat-number">${value}</div>
          <div class="stat-label">${label}</div>
        </div>
      </div>
    `;
  }

  static filterButtons(filters) {
    return `
      <div class="filter-buttons">
        ${filters.map((filter, index) => `
          <button type="button" class="filter-btn ${index === 0 ? 'active' : ''}" 
                  data-action="filterChange" 
                  data-filter="${filter.key}">
            ${filter.label}
          </button>
        `).join('')}
      </div>
    `;
  }
}