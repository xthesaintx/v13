import { CampaignManager } from './campaign-manager.js';
import { LocationSheet } from './sheets/location-sheet.js';
import { ShopSheet } from './sheets/shop-sheet.js';
import { NPCSheet } from './sheets/npc-sheet.js';
import { RegionSheet } from './sheets/region-sheet.js';
import { CleanUp } from './cleanup.js';
import { SimpleCampaignCodexExporter } from './campaign-codex-exporter.js';
import { CampaignCodexJournalConverter } from './campaign-codex-convertor.js';
import { NPCDropper } from './npc-dropper.js';
import { CampaignCodexTokenPlacement } from './token-placement.js';
import { GroupSheet } from './sheets/group-sheet.js';
import { TemplateComponents } from './sheets/template-components.js';
import { GroupLinkers } from './sheets/group-linkers.js';
import { SimpleCampaignCodexImporter } from './campaign-codex-importer.js';

Hooks.once('init', async function() {
  console.log('Campaign Codex | Initializing');
  // CONFIG.debug.hooks = true;

  // Register sheet classes - v13: These remain the same as they register ApplicationV2 classes
  DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", LocationSheet, {
    makeDefault: false,
    label: "Campaign Codex: Location"
  });

  DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", ShopSheet, {
    makeDefault: false,
    label: "Campaign Codex: Shop"
  });

  DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", NPCSheet, {
    makeDefault: false,
    label: "Campaign Codex: NPC"
  });

  DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", RegionSheet, {
    makeDefault: false,
    label: "Campaign Codex: Region"
  });

  // Register Group Sheet
  DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", GroupSheet, {
    makeDefault: false,
    label: "Campaign Codex: Group Overview"
  });

  // Register Handlebars helpers
  Handlebars.registerHelper('getIcon', function(entityType) {
    // This calls your existing static method to get the correct CSS class
    return TemplateComponents.getAsset('icon', entityType);
  });

  Handlebars.registerHelper("if_system", function(systemId, options) {
    if (game.system.id === systemId) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  // Register game settings
  game.settings.register("campaign-codex", "useOrganizedFolders", {
    name: "Organize in Folders",
    hint: "Automatically create and organise Campaign Codex journals in folders",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("campaign-codex", "itemPricePath", {
    name: "Item Price Path",
    hint: "Path to item price value (e.g., 'system.price.value' for D&D5e)",
    scope: "world",
    config: true,
    type: String,
    default: "system.price.value"
  });

  game.settings.register("campaign-codex", "itemDenominationPath", {
    name: "Item Currency Path", 
    hint: "Path to item currency denomination (e.g., 'system.price.denomination' for D&D5e)",
    scope: "world",
    config: true,
    type: String,
    default: "system.price.denomination"
  });

  game.settings.register("campaign-codex", "resetItemPathsButton", {
    name: "Reset Item Paths to Defaults",
    hint: "Enable this option and save to reset item price and currency paths to D&D5e defaults (system.price.value and system.price.denomination)",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: async (value) => {
      if (value) {
        // Reset the paths
        await game.settings.set("campaign-codex", "itemPricePath", "system.price.value");
        await game.settings.set("campaign-codex", "itemDenominationPath", "system.price.denomination");
        
        // Reset the checkbox back to false
        await game.settings.set("campaign-codex", "resetItemPathsButton", false);
        
        ui.notifications.info("Item price paths reset to D&D5e defaults");
      }
    }
  });

  console.log('Campaign Codex | Sheets registered');
});

Hooks.once('ready', async function() {
  console.log('Campaign Codex | Ready');
  
  // Initialize the campaign manager
  game.campaignCodex = new CampaignManager();
  game.campaignCodexCleanup = new CleanUp();
  game.campaignCodexNPCDropper = NPCDropper;
  game.campaignCodexTokenPlacement = CampaignCodexTokenPlacement;
  window.CampaignCodexTokenPlacement = CampaignCodexTokenPlacement;

  window.SimpleCampaignCodexExporter = SimpleCampaignCodexExporter;
  window.SimpleCampaignCodexImporter = SimpleCampaignCodexImporter;

  // Create organization folders if setting is enabled
  if (game.settings.get("campaign-codex", "useOrganizedFolders")) {
    await ensureCampaignCodexFolders();
  }
});

// Ensure Campaign Codex folders exist
async function ensureCampaignCodexFolders() {
  const folderNames = {
    "Campaign Codex - Locations": "location",
    "Campaign Codex - Entries": "shop", 
    "Campaign Codex - NPCs": "npc",
    "Campaign Codex - Regions": "region",
    "Campaign Codex - Groups": "group"
  };

  for (const [folderName, type] of Object.entries(folderNames)) {
    let folder = game.folders.find(f => f.name === folderName && f.type === "JournalEntry");
    
    if (!folder) {
      await Folder.create({
        name: folderName,
        type: "JournalEntry",
        color: getFolderColor(type),
        flags: {
          "campaign-codx": {
            type: type,
            autoOrganize: true
          }
        }
      });
      console.log(`Campaign Codex | Created folder: ${folderName}`);
    }
  }
}

function getFolderColor(type) {
  const colors = {
    location: "#28a745",
    shop: "#6f42c1", 
    npc: "#fd7e14",
    region: "#20c997",
    group: "#17a2b8"
  };
  return colors[type] || "#999999";
}

// Get appropriate folder for document type
function getCampaignCodexFolder(type) {
  if (!game.settings.get("campaign-codex", "useOrganizedFolders")) return null;
  
  const folderNames = {
    location: "Campaign Codex - Locations",
    shop: "Campaign Codex - Entries",
    npc: "Campaign Codex - NPCs", 
    region: "Campaign Codex - Regions",
    group: "Campaign Codex - Groups"
  };
  
  const folderName = folderNames[type];
  return game.folders.find(f => f.name === folderName && f.type === "JournalEntry");
}

// Add context menu options to actors
Hooks.on('getActorDirectoryEntryContext', (html, options) => {
  options.push({
    name: "Create NPC Journal",
    icon: '<i class="fas fa-user"></i>',
    condition: li => {
      const actorUuid = li.data("uuid") || `Actor.${li.data("documentId")}`;
      const actor = fromUuidSync(actorUuid);
      return actor && actor.type === "npc" && !game.journal.find(j => {
        const npcData = j.getFlag("campaign-codex", "data");
        return npcData && npcData.linkedActor === actor.uuid;
      });
    },
    callback: async li => {
      const actorUuid = li.data("uuid") || `Actor.${li.data("documentId")}`;
      const actor = await fromUuid(actorUuid);
      if (actor) {
        await game.campaignCodex.createNPCJournal(actor);
      }
    }
  });
});

Hooks.on('preDeleteScene', async (scene, options, userId) => {
  try {
    const allCCDocuments = game.journal.filter(j => j.getFlag("campaign-codex", "type"));
    const updatePromises = await game.campaignCodexCleanup.cleanupSceneRelationships(scene.uuid, allCCDocuments);
    if (updatePromises.length > 0) {
      await Promise.allSettled(updatePromises);
      console.log(`Campaign Codex | Scene cleanup completed for: ${scene.name}`);
    }
  } catch (error) {
    console.warn(`Campaign Codex | Scene cleanup failed for ${scene.name}:`, error);
  }
});

// Add journal entry creation buttons
Hooks.on('getJournalDirectoryEntryContext', (html, options) => {
  options.push({
    name: "Export to Standard Journal",
    icon: '<i class="fas fa-book"></i>',
    condition: li => {
      const journalUuid = li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
      const journal = fromUuidSync(journalUuid);
      return journal && journal.getFlag("campaign-codex", "type");
    },
    callback: async li => {
      const journalUuid = li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
      const journal = await fromUuid(journalUuid);
      if (journal) {
        await CampaignCodexJournalConverter.showExportDialog(journal);
      }
    }
  });

  options.push({
    name: "Add to Group",
    icon: '<i class="fas fa-plus-circle"></i>',
    condition: li => {
      const journalUuid = li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
      const journal = fromUuidSync(journalUuid);
      const journalType = journal?.getFlag("campaign-codex", "type");
      return journalType && ['region', 'location', 'shop', 'npc'].includes(journalType) && game.user.isGM;
    },
    callback: async li => {
      const journalUuid = li.data("uuid") || `JournalEntry.${li.data("documentId")}`;
      const journal = await fromUuid(journalUuid);
      if (journal) {
        await showAddToGroupDialog(journal);
      }
    }
  });
});

// v13: Convert legacy Dialog to DialogV2.wait() for add to group functionality
async function showAddToGroupDialog(journal) {
  const groupJournals = game.journal.filter(j => j.getFlag("campaign-codex", "type") === "group");
  
  if (groupJournals.length === 0) {
    ui.notifications.warn("No group overviews found. Create one first.");
    return;
  }

  const options = groupJournals.map(group => 
    `<option value="${group.uuid}">${group.name}</option>`
  ).join('');

  try {
    const result = await foundry.applications.api.DialogV2.wait({
      window: { 
        title: "Add to Group"
      },
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label>Select Group:</label>
            <select name="groupUuid" style="width: 100%;">
              ${options}
            </select>
          </div>
          <p style="font-size: 12px; color: #666; margin: 8px 0;">
            This will add "${journal.name}" to the selected group overview.
          </p>
        </form>
      `,
      buttons: [
        {
          action: "add",
          icon: '<i class="fas fa-plus"></i>',
          label: "Add to Group",
          default: true,
          callback: (event, button, dialog) => {
            const formData = new FormDataExtended(button.form).object;
            return { confirmed: true, groupUuid: formData.groupUuid };
          }
        },
        {
          action: "cancel",
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      ],
      rejectClose: false
    });

    if (result?.confirmed) {
      const groupJournal = await fromUuid(result.groupUuid);
      
      if (groupJournal) {
        const groupData = groupJournal.getFlag("campaign-codex", "data") || {};
        const members = groupData.members || [];
        
        if (!members.includes(journal.uuid)) {
          members.push(journal.uuid);
          groupData.members = members;
          await groupJournal.setFlag("campaign-codx", "data", groupData);
          ui.notifications.info(`Added "${journal.name}" to group "${groupJournal.name}"`);
          
          // Refresh any open group sheets
          for (const app of Object.values(ui.windows)) {
            if (app.document && app.document.uuid === groupJournal.uuid) {
              app.render(false);
              break;
            }
          }
        } else {
          ui.notifications.warn(`"${journal.name}" is already in this group.`);
        }
      }
    }
  } catch (error) {
    console.error("Campaign Codex | Error showing add to group dialog:", error);
  }
}

// v13: Convert jQuery-based button rendering to vanilla JavaScript event delegation
Hooks.on('renderJournalDirectory', (app, html, data) => {
  if (!game.user.isGM) return;

  // Remove existing buttons to prevent duplicates
  const existingButtons = html.querySelector('.campaign-codex-export-buttons');
  if (existingButtons) {
    existingButtons.remove();
  }

  const hasCampaignCodex = game.journal.some(j => j.getFlag("campaign-codex", "type"));

  // Create button container using vanilla JavaScript
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'campaign-codex-export-buttons';
  buttonContainer.style.cssText = 'margin: 8px; display: flex; gap: 4px; flex-direction: column;';
  
  buttonContainer.innerHTML = `
    ${hasCampaignCodex ? `
      <button class="cc-export-btn" type="button" title="Export all Campaign Codx content to compendium" style="flex: 1; padding: 4px 8px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; height: auto">
        <i class="fas fa-download"></i> Export Campaign Codex
      </button>
    ` : ''}
    <button class="cc-import-btn" type="button" title="Import Campaign Codex content from compendium" style="flex: 1; padding: 4px 8px; font-size: 11px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; height: auto">
      <i class="fas fa-upload"></i> Import Campaign Codex
    </button>
  `;

  // Find footer and append buttons
  const footer = html.querySelector('.directory-footer');
  if (footer) {
    footer.appendChild(buttonContainer);
  } else {
    const directoryList = html.querySelector('.directory-list');
    if (directoryList) {
      directoryList.insertAdjacentElement('afterend', buttonContainer);
    }
  }

  // v13: Use vanilla JavaScript event listeners instead of jQuery
  const exportBtn = buttonContainer.querySelector('.cc-export-btn');
  const importBtn = buttonContainer.querySelector('.cc-import-btn');
  
  if (exportBtn) {
    exportBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      SimpleCampaignCodexExporter.exportCampaignCodexToCompendium();
    });
  }
  
  if (importBtn) {
    importBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      SimpleCampaignCodexImporter.importCampaignCodexFromCompendium();
    });
  }

  // Create the creation button container
  const buttonGroupHead = document.createElement('div');
  buttonGroupHead.className = 'campaign-codex-buttons';
  buttonGroupHead.style.cssText = 'margin: 8px 0; display: flex; gap: 4px; flex-wrap: wrap;';
  
  buttonGroupHead.innerHTML = `
    <button class="create-region-btn" type="button" title="Create New Region" style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; background: #20c997; color: white; border: none; border-radius: 4px; cursor: pointer;">
      <i class="fas fa-globe"></i>
    </button>
    <button class="create-location-btn" type="button" title="Create New Location" style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
      <i class="fas fa-map-marker-alt"></i>
    </button>
    <button class="create-shop-btn" type="button" title="Create New Entry" style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; background: #6f42c1; color: white; border: none; border-radius: 4px; cursor: pointer;">
      <i class="fas fa-book-open"></i>
    </button>
    <button class="create-npc-btn" type="button" title="Create New NPC Journal" style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; background: #fd7e14; color: white; border: none; border-radius: 4px; cursor: pointer;">
      <i class="fas fa-user"></i>
    </button>
    <button class="create-group-btn" type="button" title="Create New Group Overview" style="flex: 1; min-width: 0; padding: 4px 8px; font-size: 11px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer;">
      <i class="fas fa-layer-group"></i>
    </button>
  `;

  // Insert into the directory header
  const directoryHeader = html.querySelector('.directory-header');
  if (directoryHeader) {
    directoryHeader.appendChild(buttonGroupHead);
  }

  // v13: Event listeners using vanilla JavaScript
  buttonGroupHead.querySelector('.create-location-btn')?.addEventListener('click', async () => {
    const name = await promptForName("Location");
    if (name) await game.campaignCodex.createLocationJournal(name);
  });

  buttonGroupHead.querySelector('.create-shop-btn')?.addEventListener('click', async () => {
    const name = await promptForName("Entry");
    if (name) await game.campaignCodex.createShopJournal(name);
  });

  buttonGroupHead.querySelector('.create-npc-btn')?.addEventListener('click', async () => {
    const name = await promptForName("NPC Journal");
    if (name) await game.campaignCodex.createNPCJournal(null, name);
  });

  buttonGroupHead.querySelector('.create-region-btn')?.addEventListener('click', async () => {
    const name = await promptForName("Region");
    if (name) await game.campaignCodex.createRegionJournal(name);
  });

  buttonGroupHead.querySelector('.create-group-btn')?.addEventListener('click', async () => {
    const name = await promptForName("Group Overview");
    if (name) await game.campaignCodex.createGroupJournal(name);
  });
});

Hooks.on('createJournalEntry', async (document, options, userId) => {
  if (game.user.id !== userId || 
      document.pack || 
      options.skipRelationshipUpdates ||
      options.campaignCodexImport) return;
  
  const journalType = document.getFlag("campaign-codex", "type");
  if (!journalType) return;

  // Move to appropriate folder
  const folder = getCampaignCodexFolder(journalType);
  if (folder) {
    await document.update({ folder: folder.id });
  }

  // Determine the correct sheet class string
  let sheetClass = null;
  switch (journalType) {
    case "location": sheetClass = "campaign-codex.LocationSheet"; break;
    case "shop":     sheetClass = "campaign-codex.ShopSheet";     break;
    case "npc":      sheetClass = "campaign-codex.NPCSheet";      break;
    case "region":   sheetClass = "campaign-codex.RegionSheet";   break;
    case "group":    sheetClass = "campaign-codex.GroupSheet";    break;  
  }
  
  if (sheetClass) {
    // Update the document to set its default sheet
    await document.update({
      "flags.core.sheetClass": sheetClass
    });

    // Render the sheet using the class we just set
    document.sheet.render(true);
  }
});

// Prevent scenes from opening during import
Hooks.on('createScene', async (scene, options, userId) => {
  if (options.campaignCodexImport) {
    // Don't activate or view the scene during import
    return;
  }
});

// v13: Updated to handle ApplicationV2 sheet creation
Hooks.on('renderJournalEntry', async (journal, html, data) => {
  const journalType = journal.getFlag("campaign-codex", "type");
  if (!journalType) return;

  const currentSheetName = journal.sheet.constructor.name;
  let targetSheet = null;

  switch (journalType) {
    case "location":
      if (currentSheetName !== "LocationSheet") targetSheet = LocationSheet;
      break;
    case "shop":
      if (currentSheetName !== "ShopSheet") targetSheet = ShopSheet;
      break;
    case "npc":
      if (currentSheetName !== "NPCSheet") targetSheet = NPCSheet;
      break;
    case "region":
      if (currentSheetName !== "RegionSheet") targetSheet = RegionSheet;
      break;
    case "group":
      if (currentSheetName !== "GroupSheet") targetSheet = GroupSheet;
      break;
  }

  if (targetSheet) {
    // Wait for the current render to finish before proceeding
    await Promise.resolve(); 
    
    journal.sheet.close();
    // v13: ApplicationV2 constructor takes options object with document inside
    const sheet = new targetSheet({ document: journal });
    sheet.render(true);
    journal._campaignCodexSheet = sheet;
  }
});

// v13: Convert legacy Dialog to DialogV2.wait() for name prompting
async function promptForName(type) {
  try {
    const result = await foundry.applications.api.DialogV2.wait({
      window: { 
        title: `Create New ${type}`
      },
      content: `
        <form class="flexcol">
          <div class="form-group">
            <label>Name:</label>
            <input type="text" name="name" placeholder="Enter ${type.toLowerCase()} name..." autofocus style="width: 100%;" />
          </div>
        </form>
      `,
      buttons: [
        {
          action: "create",
          icon: '<i class="fas fa-check"></i>',
          label: "Create",
          default: true,
          callback: (event, button, dialog) => {
            const formData = new FormDataExtended(button.form).object;
            const name = formData.name?.trim();
            return { confirmed: true, name: name || `New ${type}` };
          }
        },
        {
          action: "cancel",
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      ],
      render: (event, button, dialog) => {
        // v13: dialog parameter is DialogV2 instance, use dialog.element
        const nameInput = dialog.element.querySelector('input[name="name"]');
        if (nameInput) {
          nameInput.focus();
          nameInput.addEventListener('keypress', (e) => {
            if (e.which === 13) {
              const createButton = dialog.element.querySelector('[data-action="create"]');
              if (createButton) createButton.click();
            }
          });
        }
      },
      rejectClose: false
    });

    return result?.confirmed ? result.name : null;
  } catch (error) {
    console.error("Campaign Codex | Error showing name prompt:", error);
    return null;
  }
}

Hooks.on('updateJournalEntry', async (document, changes, options, userId) => {
  if (document._skipRelationshipUpdates || 
      options.skipRelationshipUpdates || 
      game.user.id !== userId) return;

  const type = document.getFlag("campaign-codex", "type");
  if (!type) return;

  try {
    await game.campaignCodex.handleRelationshipUpdates(document, changes, type);
  } catch (error) {
    console.error('Campaign Codex | Error in updateJournalEntry hook:', error);
  }
});

Hooks.on('updateActor', async (actor, changes, options, userId) => {
  if (game.user.id !== userId || !changes.img) return;

  // Find all NPC journals that link to this actor
  const linkedNPCs = game.journal.filter(j => j.getFlag("campaign-codex", "data")?.linkedActor === actor.uuid);
  if (linkedNPCs.length === 0) return;

  const linkedNpcUuids = new Set(linkedNPCs.map(j => j.uuid));
  console.log(`Campaign Codex | Actor image updated for ${actor.name}. Found ${linkedNPCs.length} linked NPC journals.`);

  const sheetsToRefresh = new Set();

  // Iterate through all open application windows to find sheets that need refreshing
  for (const app of Object.values(ui.windows)) {
    if (!app.document?.getFlag) continue;
    const docType = app.document.getFlag("campaign-codex", "type");
    if (!docType) continue;

    // Case 1: The NPC's own sheet is open
    if (docType === 'npc' && linkedNpcUuids.has(app.document.uuid)) {
      sheetsToRefresh.add(app);
      continue;
    }

    // Case 2: A GroupSheet is open, check if it contains the NPC
    if (docType === 'group' && app.constructor.name === 'GroupSheet') {
      const groupData = app.document.getFlag("campaign-codex", "data") || {};
      const groupMembers = await GroupLinkers.getGroupMembers(groupData.members || []);
      const nestedData = await GroupLinkers.getNestedData(groupMembers);
      
      const containsNpc = nestedData.allNPCs.some(npc => linkedNpcUuids.has(npc.uuid));
      if (containsNpc) {
        sheetsToRefresh.add(app);
      }
      continue;
    }

    // Case 3: Any other related sheet (Location, Shop, etc.)
    if (app._isRelatedDocument) {
      for (const npcUuid of linkedNpcUuids) {
        if (await app._isRelatedDocument(npcUuid)) {
          sheetsToRefresh.add(app);
          break; // This app is related, no need to check other NPCs
        }
      }
    }
  }

  // Render all unique sheets that were found
  if (sheetsToRefresh.size > 0) {
    console.log(`Campaign Codex | Refreshing ${sheetsToRefresh.size} sheets.`);
    for (const app of sheetsToRefresh) {
      app.render(false);
    }
  }
});

// Export folder management functions for use in campaign manager
window.getCampaignCodexFolder = getCampaignCodexFolder;
