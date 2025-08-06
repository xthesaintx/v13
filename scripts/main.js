import campaigncodexSettings, {MODULE_NAME} from "./settings.js";
import {contentCard} from "./welcome-message.js"
import { CampaignManager } from './campaign-manager.js';
import { LocationSheet } from './sheets/location-sheet.js';
import { ShopSheet } from './sheets/shop-sheet.js';
import { NPCSheet } from './sheets/npc-sheet.js';
import { RegionSheet } from './sheets/region-sheet.js';
import { CleanUp } from './cleanup.js';
import { CampaignCodexJournalConverter } from './campaign-codex-convertor.js';
import { NPCDropper } from './npc-dropper.js';
import { CampaignCodexTokenPlacement } from './token-placement.js';
import { GroupSheet } from './sheets/group-sheet.js';
import { TemplateComponents } from './sheets/template-components.js'; 
import { GroupLinkers } from './sheets/group-linkers.js';
import { 
    handleCampaignCodexClick,
    ensureCampaignCodexFolders, 
    getFolderColor, 
    getCampaignCodexFolder, 
    showAddToGroupDialog,
    addJournalDirectoryUI 
} from "./helper.js";


Hooks.once('init', async function() {
    console.log('Campaign Codex | Initializing');
    await campaigncodexSettings();
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
    DocumentSheetConfig.registerSheet(JournalEntry, "campaign-codex", GroupSheet, {
        makeDefault: false,
        label: "Campaign Codex: Group Overview"
    });

    Handlebars.registerHelper('getIcon', function(entityType) {
        return TemplateComponents.getAsset('icon', entityType);
    });

    Handlebars.registerHelper("if_system", function(systemId, options) {
        if (game.system.id === systemId) {
            return options.fn(this);
        }
        return options.inverse(this);
    });

    console.log('Campaign Codex | Sheets registered');
});

Hooks.once('ready', async function() {
    console.log('Campaign Codex | Ready');
    
    game.campaignCodex = new CampaignManager();
    game.campaignCodexCleanup = new CleanUp();
    game.campaignCodexNPCDropper = NPCDropper;
    game.campaignCodexTokenPlacement = CampaignCodexTokenPlacement;
    window.CampaignCodexTokenPlacement = CampaignCodexTokenPlacement;

    // These are now handled by the helper.js for the UI, but might be needed globally for other parts
    // window.SimpleCampaignCodexExporter = SimpleCampaignCodexExporter;
    // window.SimpleCampaignCodexImporter = SimpleCampaignCodexImporter;

    if (game.settings.get("campaign-codex", "useOrganizedFolders")) {
        await ensureCampaignCodexFolders(); // Call the imported function
    }

    if (game.user.isGM) {
        if (game.settings.get(MODULE_NAME, "runonlyonce") === false) { 
            await ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker(),
                content: contentCard,
                }, {})
            await game.settings.set(MODULE_NAME, "runonlyonce", true);      
        }
    }
});

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
                await showAddToGroupDialog(journal); // Call the imported function
            }
        }
    });
});

Hooks.on('renderJournalDirectory', (app, html, data) => {
    // Call the single function that handles all UI additions for the directory
    addJournalDirectoryUI(html); 
});

Hooks.on('createJournalEntry', async (document, options, userId) => {
    if (game.user.id !== userId || 
        document.pack || 
        options.skipRelationshipUpdates ||
        options.campaignCodexImport) return;
    
    const journalType = document.getFlag("campaign-codex", "type");
    if (!journalType) return;

    const folder = getCampaignCodexFolder(journalType); // Call the imported function
    if (folder) {
        await document.update({ folder: folder.id });
    }

    let sheetClass = null;
    switch (journalType) {
        case "location": sheetClass = "campaign-codex.LocationSheet"; break;
        case "shop":      sheetClass = "campaign-codex.ShopSheet";      break;
        case "npc":       sheetClass = "campaign-codex.NPCSheet";      break;
        case "region":    sheetClass = "campaign-codex.RegionSheet";    break;
        case "group":     sheetClass = "campaign-codex.GroupSheet";     break;     
    }
    
    if (sheetClass) {
        await document.update({
            "flags.core.sheetClass": sheetClass
        });

        document.sheet.render(true);
    }
});


Hooks.on('createScene', async (scene, options, userId) => {
    if (options.campaignCodexImport) {
        return;
    }
});


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
        await Promise.resolve(); 
        
        journal.sheet.close();
        const sheet = new targetSheet(journal);
        sheet.render(true);
        journal._campaignCodexSheet = sheet;
    }
});

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

    const linkedNPCs = game.journal.filter(j => j.getFlag("campaign-codex", "data")?.linkedActor === actor.uuid);
    if (linkedNPCs.length === 0) return;

    const linkedNpcUuids = new Set(linkedNPCs.map(j => j.uuid));
    console.log(`Campaign Codex | Actor image updated for ${actor.name}. Found ${linkedNPCs.length} linked NPC journals.`);

    const sheetsToRefresh = new Set();

    for (const app of Object.values(ui.windows)) {
        if (!app.document?.getFlag) continue;
        const docType = app.document.getFlag("campaign-codex", "type");
        if (!docType) continue;

        if (docType === 'npc' && linkedNpcUuids.has(app.document.uuid)) {
            sheetsToRefresh.add(app);
            continue;
        }

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

        if (app._isRelatedDocument) {
            for (const npcUuid of linkedNpcUuids) {
                if (await app._isRelatedDocument(npcUuid)) {
                    sheetsToRefresh.add(app);
                    break; 
                }
            }
        }
    }

    if (sheetsToRefresh.size > 0) {
        console.log(`Campaign Codex | Refreshing ${sheetsToRefresh.size} sheets.`);
        for (const app of sheetsToRefresh) {
            app.render(false);
        }
    }
});


// Register the hook to listen for clicks on chat messages
Hooks.on('renderChatMessage', (app, html, data) => {
    html.find(`[data-campaign-codex-handler^="${MODULE_NAME}|"]`).click(handleCampaignCodexClick);
});



// This is now exported from helper.js
// window.getCampaignCodexFolder = getCampaignCodexFolder; 
