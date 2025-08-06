// scripts/sheets/template-components.js
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

  // v13: Updated to render a ProseMirror element directly in the sheet
  static richTextSection(label, icon, enrichedValue, fieldName, documentUuid) {
    const systemClass = game.system.id === 'dnd5e' ? ' dnd5e' : '';
    const journalClass = game.system.id === 'dnd5e' ? 'journal-entry-content' : ''; 

    // For non-GM users, just show the enriched content without edit capability
    if (game.user.isGM) {
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

    // For GM users, render the ProseMirror editor
    // CRITICAL: The prose-mirror element needs:
    // 1. name attribute with the full path to the field
    // 2. Initial content inside the element
    // 3. No 'toggled' attribute initially (it should be closed by default)
    return `
      <div class="form-section${systemClass}">
        <label class="form-label">
          <i class="${icon}"></i>
          ${label}
        </label>
        <prose-mirror 
          name="flags.campaign-codex.data.${fieldName}" 
          class="${journalClass}"
          style="min-height: 100px;">
          ${enrichedValue || '<p></p>'}
        </prose-mirror>
      </div>
    `;
  }

  // Content header component
  static contentHeader(icon, title) {
    return `
      <h2 class="content-header">
        <i class="${icon}"></i>
        ${title}
      </h2>
    `;
  }
  
  // Standard form section for regular textareas (non-rich text)
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

  // Drop zone component
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

  // v13: Updated entity grid to use data-action attributes
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

  // v13: Updated entity card with data-action attributes instead of class-based selectors
  static entityCard(entity, type, showActorButton = false) {
    const actorButton = showActorButton && entity.actor ? 
      `<button class="actor-button" data-action="openActor" data-uuid="${entity.actor.uuid}" title="Open Actor">
        <i class="fas fa-user"></i>
      </button>` : '';

    const removeAction = type === 'npc' ? 'removeNpc' : 
                         type === 'location' ? 'removeLocation' : 
                         type === 'shop' ? 'removeShop' : 
                         'removeFromList';

    return `
      <div class="entity-card" data-uuid="${entity.uuid}">
        <img src="${entity.img || 'icons/svg/mystery-man.svg'}" alt="${entity.name}">
        <div class="entity-info">
          <h4>${entity.name}</h4>
          ${entity.subtitle ? `<p class="entity-subtitle">${entity.subtitle}</p>` : ''}
        </div>
        <div class="entity-actions">
          ${actorButton}
          <button class="open-button" data-action="openDocument" data-uuid="${entity.uuid}" title="Open">
            <i class="fas fa-external-link-alt"></i>
          </button>
          <button class="remove-button" data-action="${removeAction}" data-uuid="${entity.uuid}" title="Remove">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
  }

  // Empty state component
  static emptyState(type) {
    const messages = {
      npc: "No NPCs linked yet. Drag and drop NPC journal entries here.",
      location: "No locations linked yet. Drag and drop location journal entries here.",
      shop: "No shops linked yet. Drag and drop shop journal entries here.",
      item: "No items in inventory. Drag and drop items here.",
      associate: "No associates linked yet. Drag and drop NPC journal entries here."
    };

    return `
      <div class="empty-state">
        <i class="fas fa-inbox fa-3x"></i>
        <p>${messages[type] || "No items yet."}</p>
      </div>
    `;
  }

  // List component for simpler displays
  static entityList(entities, type, showRemove = true) {
    if (!entities || entities.length === 0) {
      return '<p class="no-items">No items to display.</p>';
    }

    return `
      <ul class="entity-list">
        ${entities.map(entity => `
          <li class="entity-list-item">
            <span class="entity-name" data-action="openDocument" data-uuid="${entity.uuid}">
              ${entity.name}
            </span>
            ${showRemove ? `
              <button class="remove-btn" data-action="removeFromList" data-type="${type}" data-uuid="${entity.uuid}">
                <i class="fas fa-times"></i>
              </button>
            ` : ''}
          </li>
        `).join('')}
      </ul>
    `;
  }
}