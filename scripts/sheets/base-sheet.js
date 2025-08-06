import { DescriptionEditor } from './editors/description-editor.js';
import { CampaignCodexLinkers } from './linkers.js';
import { TemplateComponents } from './template-components.js';


export class CampaignCodexBaseSheet extends JournalSheet {
  constructor(document, options = {}) {
    super(document, options);
    this._currentTab = 'info';
  }

static get defaultOptions() {
  return foundry.utils.mergeObject(super.defaultOptions, {
    classes: ["sheet", "journal-sheet", "campaign-codex"],
    width: 1000,
    height: 700,
    resizable: true,
    minimizable: true 
  });
}

async getData() {
  const data = await super.getData();
  const sheetData = this.document.getFlag("campaign-codex", "data") || {};

  data.sheetData = {
    description: sheetData.description || "",
    notes: sheetData.notes || ""
  };
  
  data.sheetData.enrichedDescription = await TextEditor.enrichHTML(data.sheetData.description, { async: true, secrets: this.document.isOwner }); 
  data.sheetData.enrichedNotes = await TextEditor.enrichHTML(data.sheetData.notes, { async: true, secrets: this.document.isOwner }); 

  data.canEdit = this.document.canUserModify(game.user, "update");
  data.currentTab = this._currentTab;

  return data;
}

  activateListeners(html) {
    super.activateListeners(html);

    
    this._activateTabs(html);
    this._setupDropZones(html);
    this._setupNameEditing(html);
    this._setupImageChange(html);
    this._setupSaveButton(html);
    
    
    this._activateSheetSpecificListeners(html);
    html.find('.cc-edit-description').click(event => this._onEditDescription(event, 'description'));
    html.find('.cc-edit-notes').click(event => this._onEditDescription(event, 'notes'));
    html.find('.npcs-to-map-button').click(this._onDropNPCsToMapClick.bind(this));

  }



  _activateTabs(html) {
    html.find('.sidebar-tabs .tab-item').click(event => {
      event.preventDefault();
      const tab = event.currentTarget.dataset.tab;
      this._currentTab = tab;
      this._showTab(tab, html);
    });

    this._showTab(this._currentTab, html);
  }

  _showTab(tabName, html) {
    const $html = html instanceof jQuery ? html : $(html);
    
    $html.find('.sidebar-tabs .tab-item').removeClass('active');
    $html.find('.tab-panel').removeClass('active');

    $html.find(`.sidebar-tabs .tab-item[data-tab="${tabName}"]`).addClass('active');
    $html.find(`.tab-panel[data-tab="${tabName}"]`).addClass('active');
  }

  _setupDropZones(html) {
    html[0].addEventListener('drop', this._onDrop.bind(this));
    html[0].addEventListener('dragover', this._onDragOver.bind(this));
  }

  _setupNameEditing(html) {
    html.find('.sheet-title').click(this._onNameEdit.bind(this));
    
    html.on('blur', '.name-input', this._onNameSave.bind(this));
    html.on('keypress', '.name-input', this._onNameKeypress.bind(this));
  }

  _setupImageChange(html) {
    html.find('.image-change-btn').off('click').on('click', this._onImageClick.bind(this));
  }

  _setupSaveButton(html) {
    html.find('.save-data').click(this._onSaveData.bind(this));
  }

  
  async _onNameEdit(event) {
    const nameElement = $(event.currentTarget);
    const currentName = nameElement.text();
    
    const input = $(`<input type="text" class="name-input" value="${currentName}" style="background: transparent; border: 1px solid rgba(255,255,255,0.3); color: white; padding: 4px 8px; border-radius: 4px; font-family: 'Modesto Condensed', serif; font-size: 28px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; width: 100%;">`);
    
    nameElement.replaceWith(input);
    input.focus().select();
  }

  async _onNameSave(event) {
    const input = $(event.currentTarget);
    const newName = input.val().trim();
    
    if (newName && newName !== this.document.name) {
      await this.document.update({ name: newName });
    }
    
    const nameElement = $(`<h1 class="sheet-title">${this.document.name}</h1>`);
    input.replaceWith(nameElement);
    nameElement.click(this._onNameEdit.bind(this));
  }

  async _onNameKeypress(event) {
    if (event.which === 13) {
      event.currentTarget.blur();
    }
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
  

async _onSaveData(event) {
  event.preventDefault();
  
  const form = this.element.find('form')[0];
  const formData = new FormDataExtended(form);
  const data = formData.object;
  const currentData = this.document.getFlag("campaign-codex", "data") || {};
  
  const updatedData = {
    ...currentData
  };
  
  const proseEditedFields = new Set();
  this.element.find('[name="proseedited"]').each(function() {
    
    const editBtn = $(this).find('[class^="cc-edit-"]');
    if (editBtn.length) {
      const className = editBtn.attr('class');
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

  try {
    await this.document.setFlag("campaign-codex", "data", updatedData);
    ui.notifications.info(`${this.constructor.name.replace('Sheet', '')} saved successfully!`);
    
    const saveBtn = $(event.currentTarget);
    saveBtn.addClass('success');
    setTimeout(() => saveBtn.removeClass('success'), 1500);
    
  } catch (error) {
    console.error("Campaign Codex | Error saving data:", error);
    ui.notifications.error("Failed to save data!");
    
    const saveBtn = $(event.currentTarget);
    saveBtn.addClass('error');
    setTimeout(() => saveBtn.removeClass('error'), 1500);
  }
}

async _saveFormData() {
  const form = this.element?.find('form')[0];
  if (form) {
    try {
      const formData = new FormDataExtended(form);
      const data = formData.object;
      const currentData = this.document.getFlag("campaign-codex", "data") || {};
      
      const updatedData = {
        ...currentData
      };
      
      const proseEditedFields = new Set();
      this.element.find('[name="proseedited"]').each(function() {
        
        const editBtn = $(this).find('[class^="cc-edit-"]');
        if (editBtn.length) {
          const className = editBtn.attr('class');
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

  async _onOpenDocument(event, type) {
    event.stopPropagation();
    const uuid = event.currentTarget.dataset[`${type}Uuid`] || 
                 event.currentTarget.closest(`[data-${type}-uuid]`)?.dataset[`${type}Uuid`];
    
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
let actor;
actor = sourceActor;
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

  _activateSheetSpecificListeners(html) {
  }

  async _handleDrop(data, event) {
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
    if (!game.user.isGM)
  return `
      ${TemplateComponents.contentHeader('fas fa-sticky-note', 'GM Notes')}
      `;
return `
  ${TemplateComponents.contentHeader('fas fa-sticky-note', 'GM Notes')}
  ${TemplateComponents.richTextSection('Private Notes', 'fas fa-eye-slash', data.sheetData.enrichedNotes, 'notes')}
`;
}

async _onEditDescription(event, fromlocation) {
  event.preventDefault();
  event.stopPropagation();
  new DescriptionEditor(this.document, { field: fromlocation }).render(true);
}


/**
 * Drop NPCs to the current scene map
 * @param {Array} npcs - Array of NPC objects to drop
 * @param {Object} options - Options for the drop operation
 */
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