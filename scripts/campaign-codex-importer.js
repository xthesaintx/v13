export class SimpleCampaignCodexImporter {
  static CONSTANTS = {
    FLAG_SCOPE: "campaign-codex",
    FLAG_TYPE: "type",
    FLAG_DATA: "data",
  };


  static async importCampaignCodexFromCompendium() {
    try {
      const config = await this._getImportConfig();
      if (!config) return; 

      const compendiums = await this._findRelatedCompendiums(config.journalCompendium);
      if (!compendiums) return;

      ui.notifications.info("Collecting documents from compendiums...");
      const importData = await this._collectImportData(compendiums);
      if (importData.journals.size === 0) {
        ui.notifications.warn("No Campaign Codex documents found to import!");
        return;
      }

      const confirmed = await this._confirmImport(importData, config.baseName, config.skipExisting);
      if (!confirmed) return;

      ui.notifications.info(`Importing ${importData.journals.size} journals, ${importData.actors.size} actors, ${importData.items.size} items${importData.scenes ? `, ${importData.scenes.size} scenes` : ''}...`);
      const results = await this._performImport(importData, config.replaceExisting, config.skipExisting);

      delete this._folderMaps;

      this._showImportResults(results);

    } catch (error) {
      delete this._folderMaps;
      console.error("Campaign Codex | Import Error:", error);
      ui.notifications.error(`Import failed: ${error.message}`);
    }
  }


  static async _getImportConfig() {
    const ccCompendiums = [];
        
    for (const pack of game.packs) {
      if (pack.documentName === "JournalEntry") {
        try {
          const index = await pack.getIndex();
          const indexArray = Array.from(index); 
                    
          for (const entry of indexArray.slice(0, 5)) { 
            const doc = await pack.getDocument(entry._id);
            if (doc?.getFlag(this.CONSTANTS.FLAG_SCOPE, this.CONSTANTS.FLAG_TYPE)) {
              ccCompendiums.push({
                pack: pack,
                label: pack.metadata.label,
                name: pack.collection
              });
              break; 
            }
          }
        } catch (error) {
          console.warn(`Campaign Codex | Error checking compendium ${pack.metadata.label}:`, error);
          continue; 
        }
      }
    }
    if (ccCompendiums.length === 0) {
      ui.notifications.warn("No Campaign Codex compendiums found!");
      return null;
    }
    const options = ccCompendiums.map(comp => 
      `<option value="${comp.name}">${comp.label}</option>`
    ).join('');

    // v13: Convert Dialog to DialogV2.wait()
    const result = await foundry.applications.api.DialogV2.wait({
      window: { 
        title: "Import Campaign Codex",
        icon: "fas fa-upload"
      },
      content: `
        <div class="form-group" style="flex-direction: column;text-align: left;">
          <label>Select Journal Compendium to Import:</label>
          <select name="journalCompendium" style="width: 100%;">
            ${options}
          </select>
          <p style="font-size: 11px; color: #666; margin: 4px 0;">
            The importer will automatically find related actor, item, and scene compendiums.
          </p>
        </div>
        <div class="form-group" style="flex-direction: column;text-align: left;">
          <label>
            <input type="checkbox" name="skipExisting" checked />
            Skip existing documents (use world versions)
          </label>
          <p style="font-size: 11px; color: #666; margin: 4px 0;">
            <i class="fas fa-info-circle"></i> 
            If checked, existing actors and items with the same name will not be imported.
          </p>
        </div>
        <div class="form-group" style="flex-direction: column;text-align: left;">
          <label>
            <input type="checkbox" name="replaceExisting" />
            Replace existing journals
          </label>
          <p style="font-size: 11px; color: #666; margin: 4px 0;">
            <i class="fas fa-warning"></i> 
            If checked, existing Campaign Codex journals will be replaced.
          </p>
        </div>
      `,
      buttons: [
        {
          action: "import",
          icon: "fas fa-upload",
          label: "Import",
          default: true,
          callback: (event, button, dialog) => {
            // v13: Use vanilla DOM instead of jQuery
            const form = button.form;
            const journalCompendium = form.elements.journalCompendium?.value;
            const replaceExisting = form.elements.replaceExisting?.checked || false;
            const skipExisting = form.elements.skipExisting?.checked || false;
            const selectedComp = ccCompendiums.find(c => c.name === journalCompendium);
            
            return { 
              journalCompendium: selectedComp.pack,
              baseName: selectedComp.label.replace(' - CC Journals', ''),
              replaceExisting,
              skipExisting
            };
          }
        },
        {
          action: "cancel",
          icon: "fas fa-times",
          label: "Cancel",
          callback: () => null
        }
      ],
      rejectClose: false, // v13: Handle null return instead of exceptions
      modal: true
    });

    return result;
  }

  static async _findRelatedCompendiums(journalPack) {
    const baseName = journalPack.metadata.label.replace(' - CC Journals', '');
    const compendiums = { journals: journalPack };
    for (const pack of game.packs) {
      const label = pack.metadata.label;
      if (label.startsWith(baseName)) {
        if (label.includes('- CC Actors')) {
          compendiums.actors = pack;
        } else if (label.includes('- CC Items')) {
          compendiums.items = pack;
        } else if (label.includes('- CC Scenes')) {
          compendiums.scenes = pack;
        }
      }
    }
    console.log(`Campaign Codex | Found compendiums:`, {
      journals: compendiums.journals?.metadata.label,
      actors: compendiums.actors?.metadata.label,
      items: compendiums.items?.metadata.label,
      scenes: compendiums.scenes?.metadata.label
    });
    return compendiums;
  }

  static async _collectImportData(compendiums) {
    const importData = {
      journals: new Set(),
      actors: new Set(),
      items: new Set(),
      compendiums: compendiums 
    };
    if (compendiums.scenes) {
      importData.scenes = new Set();
    }
    if (compendiums.journals) {
      const journalDocs = await compendiums.journals.getDocuments();
      journalDocs.forEach(doc => {
        if (doc.getFlag(this.CONSTANTS.FLAG_SCOPE, this.CONSTANTS.FLAG_TYPE)) {
          importData.journals.add(doc);
        }
      });
    }
    if (compendiums.actors) {
      const actorDocs = await compendiums.actors.getDocuments();
      actorDocs.forEach(doc => importData.actors.add(doc));
    }
    if (compendiums.items) {
      const itemDocs = await compendiums.items.getDocuments();
      itemDocs.forEach(doc => importData.items.add(doc));
    }
    if (compendiums.scenes) {
      const sceneDocs = await compendiums.scenes.getDocuments();
      sceneDocs.forEach(doc => importData.scenes.add(doc));
    }
    return importData;
  }


  static async _importAllFolderStructures(compendiums) {
    this._folderMaps = {
      JournalEntry: new Map(),
      Actor: new Map(),
      Item: new Map(),
      Scene: new Map()
    };

    const packsToProcess = [
      compendiums.journals,
      compendiums.actors,
      compendiums.items,
      compendiums.scenes
    ].filter(p => p); 

    for (const pack of packsToProcess) {
      const documentType = pack.documentName;
      const folderMap = this._folderMaps[documentType];
      const compendiumFolders = Array.from(pack.folders);

      const sortedFolders = this._sortFoldersByDepth(compendiumFolders);
      
      for (const compendiumFolder of sortedFolders) {
        await this._importFolder(compendiumFolder, documentType, folderMap);
      }
    }
  }


  static _sortFoldersByDepth(folders) {
    const getDepth = (folder, allFolders) => {
      let depth = 0;
      let current = folder;
      while (current.folder) {
        depth++;
        current = allFolders.find(f => f.id === current.folder);
        if (!current) break;
      }
      return depth;
    };
    return folders.sort((a, b) => getDepth(a, folders) - getDepth(b, folders));
  }


  static async _importFolder(compendiumFolder, documentType, folderMap) {
    if (folderMap.has(compendiumFolder.id)) {
      return folderMap.get(compendiumFolder.id);
    }

    let parentId = null;
    if (compendiumFolder.folder) {
      parentId = folderMap.get(compendiumFolder.folder) || null;
    }

    let worldFolder = game.folders.find(f => 
      f.name === compendiumFolder.name &&
      f.type === documentType &&
      (f.folder?.id || null) === parentId
    );

    if (!worldFolder) {
      console.log(`Campaign Codex | Creating ${documentType} folder: ${compendiumFolder.name}`);
      const folderData = {
        name: compendiumFolder.name,
        type: documentType,
        color: compendiumFolder.color,
        sorting: compendiumFolder.sorting,
        folder: parentId
      };
      worldFolder = await Folder.create(folderData);
    } else {
      console.log(`Campaign Codex | Using existing ${documentType} folder: ${compendiumFolder.name}`);
    }

    folderMap.set(compendiumFolder.id, worldFolder.id);
    return worldFolder.id;
  }


  static async _performImport(importData, replaceExisting = false, skipExisting = true) {
    const uuidMap = new Map();
    const results = {
      imported: { actors: 0, items: 0, scenes: 0, journals: 0 },
      skipped: { actors: 0, items: 0, scenes: 0, journals: 0 },
      replaced: { actors: 0, items: 0, scenes: 0, journals: 0 },
      failed: { actors: 0, items: 0, scenes: 0, journals: 0 }
    };

    game.campaignCodexImporting = true;
    try {
      ui.notifications.info("Importing folder structures...");
      await this._importAllFolderStructures(importData.compendiums);

      for (const type of ['actors', 'items', 'scenes', 'journals']) {
          if (!importData[type]) continue;
          for (const doc of importData[type]) {
              const result = await this._importDocument(doc, replaceExisting, skipExisting);
              if (result.document) {
                  uuidMap.set(doc.uuid, result.document.uuid);
                  results[result.action][type]++;
              } else {
                  results.failed[type]++;
              }
          }
      }

      const updates = [];
      for (const [oldUuid, newUuid] of uuidMap) {
        const newDoc = await fromUuid(newUuid);
        if (newDoc && newDoc.documentName === "JournalEntry") {
          const updateData = this._prepareJournalUpdate(newDoc, uuidMap);
          if (updateData) {
            updates.push(updateData);
          }
        }
      }
      if (updates.length > 0) {
        await JournalEntry.updateDocuments(updates);
      }
      return results;
    } finally {
      delete game.campaignCodexImporting;
    }
  }


  static async _importDocument(compendiumDoc, replaceExisting, skipExisting) {
    try {
      const docType = compendiumDoc.documentName;
      const existingDoc = this._findExistingDocument(compendiumDoc);

      const folderMap = this._folderMaps[docType];
      const compendiumFolderId = compendiumDoc.folder?.id || compendiumDoc.folder;
      const targetFolderId = compendiumFolderId && folderMap?.has(compendiumFolderId) 
        ? folderMap.get(compendiumFolderId) 
        : null;

      if (existingDoc) {
        if (skipExisting && ["Actor", "Item"].includes(docType)) {
          if (targetFolderId && existingDoc.folder?.id !== targetFolderId) {
            await existingDoc.update({ folder: targetFolderId });
          }
          return { document: existingDoc, action: 'skipped' };
        }
        if (replaceExisting && ["JournalEntry", "Scene"].includes(docType)) {
          const newDoc = await this._replaceDocument(existingDoc, compendiumDoc, targetFolderId);
          return { document: newDoc, action: 'replaced' };
        }
        return { document: existingDoc, action: 'skipped' };
      }
      
      const newDoc = await this._createDocument(compendiumDoc, targetFolderId);
      return { document: newDoc, action: 'imported' };
    } catch (error) {
      console.error(`Campaign Codex | Failed to import ${compendiumDoc.documentName} "${compendiumDoc.name}":`, error);
      return { document: null, action: 'failed' };
    }
  }


  static async _createDocument(compendiumDoc, targetFolderId) {
    const docData = compendiumDoc.toObject();
    delete docData._id;
    delete docData.folder; 
    delete docData.flags?.[this.CONSTANTS.FLAG_SCOPE]?.originalUuid;

    const DocumentClass = getDocumentClass(compendiumDoc.documentName);
    const newDoc = await DocumentClass.create(docData, {
      campaignCodexImport: true,
      skipRelationshipUpdates: true
    });

    if (targetFolderId && newDoc) {
      await newDoc.update({ folder: targetFolderId });
    }
    
    return newDoc;
  }


  static async _replaceDocument(existingDoc, compendiumDoc, targetFolderId) {
    const updateData = compendiumDoc.toObject();
    updateData._id = existingDoc.id; 
    updateData.folder = targetFolderId || existingDoc.folder?.id || null; 
    delete updateData.flags?.[this.CONSTANTS.FLAG_SCOPE]?.originalUuid;

    const DocumentClass = getDocumentClass(compendiumDoc.documentName);
    const updatedDocs = await DocumentClass.updateDocuments([updateData]);
    return updatedDocs[0];
  }


  static _findExistingDocument(compendiumDoc) {
    const documentName = compendiumDoc.documentName;
    const name = compendiumDoc.name;
    const collection = game.collections.get(documentName);
    return collection?.find(doc => doc.name === name) || null;
  }
  

  static _prepareJournalUpdate(journal, uuidMap) {
    const updateData = { _id: journal.id };
    const codexData = journal.getFlag(this.CONSTANTS.FLAG_SCOPE, this.CONSTANTS.FLAG_DATA) || {};
    const newCodexData = foundry.utils.deepClone(codexData);
    const relink = (uuid) => uuidMap.get(uuid) || uuid;
    const singleLinkFields = ["linkedActor", "linkedLocation", "parentRegion", "linkedScene"];
    for (const field of singleLinkFields) {
        if (newCodexData[field]) {
          newCodexData[field] = relink(newCodexData[field]);
        }
    }
    const multiLinkFields = ["linkedNPCs", "linkedShops", "linkedLocations", "associates", "members"];
    for (const field of multiLinkFields) {
        if (Array.isArray(newCodexData[field])) {
            newCodexData[field] = newCodexData[field].map(relink);
        }
    }
    if (Array.isArray(newCodexData.inventory)) {
        newCodexData.inventory.forEach(item => {
            if (item.itemUuid) {
              item.itemUuid = relink(item.itemUuid);
            }
        });
    }
        
    foundry.utils.setProperty(updateData, `flags.${this.CONSTANTS.FLAG_SCOPE}.${this.CONSTANTS.FLAG_DATA}`, newCodexData);
    const newPages = journal.pages.map(page => {
        const pageData = page.toObject();
        if (pageData.text?.content) {
            pageData.text.content = pageData.text.content.replace(/@UUID\[([^\]]+)\]/g, (match, oldUuid) => {
                const newUuid = uuidMap.get(oldUuid);
                return newUuid ? `@UUID[${newUuid}]` : match;
            });
        }
        return pageData;
    });
    updateData.pages = newPages;
    return updateData;
  }

  static async _confirmImport(importData, baseName, skipExisting) {
    const sceneInfo = importData.scenes ? `<li><strong>${importData.scenes.size}</strong> scenes</li>` : '';
    const skipInfo = skipExisting ? 
      '<p style="font-size: 12px; color: #666;"><i class="fas fa-info-circle"></i> Existing actors and items will be used instead of imported.</p>' : '';
          
    // v13: Convert Dialog to DialogV2.wait()
    const result = await foundry.applications.api.DialogV2.wait({
      window: { 
        title: "Confirm Import",
        icon: "fas fa-check"
      },
      content: `
        <div class="flexcol">
          <p>Ready to import the following from "<strong>${baseName}</strong>" compendium set:</p>
          <ul style="margin: 0.5rem 0;">
            <li><strong>${importData.journals.size}</strong> Campaign Codex journals</li>
            <li><strong>${importData.actors.size}</strong> actors</li>
            <li><strong>${importData.items.size}</strong> items</li>
            ${sceneInfo}
          </ul>
          ${skipInfo}
          <p><em>All relationships and folder structures will be preserved.</em></p>
        </div>
      `,
      buttons: [
        { 
          action: "confirm",
          icon: "fas fa-check",
          label: "Import Now",
          default: true,
          callback: () => true 
        },
        { 
          action: "cancel",
          icon: "fas fa-times",
          label: "Cancel",
          callback: () => false 
        }
      ],
      rejectClose: false, // v13: Handle null return instead of exceptions
      modal: true
    });

    // v13: Handle null return (dialog closed)
    return result === true;
  }

  static _showImportResults(results) {
    const totalImported = results.imported.actors + results.imported.items +
                          results.imported.scenes + results.imported.journals;
    const totalSkipped = results.skipped.actors + results.skipped.items +
                         results.skipped.scenes + results.skipped.journals;
    const totalReplaced = results.replaced.actors + results.replaced.items +
                          results.replaced.scenes + results.replaced.journals;
    const totalFailed = results.failed.actors + results.failed.items +
                        results.failed.scenes + results.failed.journals;
    let message = `Import complete!\n`;
        
    if (totalImported > 0) {
      message += `✓ Imported: ${totalImported} documents\n`;
    }
    if (totalSkipped > 0) {
      message += `↻ Used existing: ${totalSkipped} documents\n`;
    }
    if (totalReplaced > 0) {
      message += `↺ Replaced: ${totalReplaced} documents\n`;
    }
    if (totalFailed > 0) {
      message += `✗ Failed: ${totalFailed} documents\n`;
    }
    if (totalImported + totalSkipped + totalReplaced > 0) {
      console.log("Campaign Codex | Import Results:", results);
    }
    ui.notifications.info(message.trim());
  }
}