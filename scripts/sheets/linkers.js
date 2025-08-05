import { TemplateComponents } from './template-components.js';

// Campaign Codex Linkers - Handles all document linking and relationship resolution
// v13: This utility class is already v13 compatible as it doesn't use jQuery or ApplicationV2
export class CampaignCodexLinkers {
  /**
   * Clear broken references from a document
   * @param {Document} document - The document to clean
   * @param {Array} brokenUuids - Array of broken reference UUIDs
   * @param {string} fieldName - The field name to clean (e.g., 'linkedLocations', 'linkedNPCs')
   */
  static async clearBrokenReferences(document, brokenUuids, fieldName) {
    if (!document || !brokenUuids || brokenUuids.length === 0 || game.campaignCodexImporting) return;
    
    try {
      const currentData = document.getFlag("campaign-codex", "data") || {};
      const currentArray = currentData[fieldName] || [];
      
      // Remove broken UUIDs from the array
      const cleanedArray = currentArray.filter(uuid => !brokenUuids.includes(uuid));
      
      if (cleanedArray.length !== currentArray.length) {
        currentData[fieldName] = cleanedArray;
        await document.setFlag("campaign-codex", "data", currentData);
        
        const removedCount = currentArray.length - cleanedArray.length;
        ui.notifications.warn(`Removed ${removedCount} broken ${fieldName} references from ${document.name}`);
      }
    } catch (error) {
      console.error(`Campaign Codex | Error clearing broken ${fieldName} references:`, error);
    }
  }

  // QUICK LINKS
  static createQuickLinks(sources, uniqueKey = 'id') {
    // Return an empty array if sources is invalid
    if (!sources || !Array.isArray(sources)) {
      return [];
    }
    
    // Combine all items from all sources into a single array
    const allItems = sources.flatMap(source => {
      // Skip if a source has no data array
      if (!Array.isArray(source.data)) return [];
      // Map each item to a new object with the added 'type'
      return source.data.map(item => ({ ...item, type: source.type }));
    });
    
    // Filter out duplicates, keeping the first occurrence of each unique item
    const seen = new Set();
    return allItems.filter(item => {
      const identifier = item[uniqueKey];
      // If the identifier has been seen before, it's a duplicate
      if (seen.has(identifier)) {
        return false;
      }
      // Otherwise, record it and keep the item
      seen.add(identifier);
      return true;
    });
  }

  // ===========================================
  // LOCATION METHODS
  // ===========================================
  static async getAllLocations(document, directLocationUuids) {
    if (!directLocationUuids || !Array.isArray(directLocationUuids)) return [];
    
    const locationMap = new Map();
    const brokenLocationUuids = [];
    const brokenShopUuids = [];
    
    // First, add directly linked locations
    for (const uuid of directLocationUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Linked location not found: ${uuid}`);
          brokenLocationUuids.push(uuid);
          continue;
        }
        
        const imageData = journal.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image', 'location');
        locationMap.set(journal.id, {
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          source: 'direct',
          meta: '<span class="entity-type">Direct Link</span>'
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing location ${uuid}:`, error);
        brokenLocationUuids.push(uuid);
      }
    }
    
    // Clear broken direct location references if any were found
    // Skip cleanup during import
    if (brokenLocationUuids.length > 0 && !game.campaignCodexImporting) {
      document._skipRelationshipUpdates = true;
      await this.clearBrokenReferences(document, brokenLocationUuids, 'linkedLocations');
      delete document._skipRelationshipUpdates;
    }
    
    // Then, discover locations through shop associations
    const npcData = document.getFlag("campaign-codex", "data") || {};
    const npcLinkedShopUuids = npcData.linkedShops || [];
    
    for (const shopUuid of npcLinkedShopUuids) {
      try {
        const shop = await fromUuid(shopUuid);
        if (!shop) {
          console.warn(`Campaign Codex | Shop not found during location discovery: ${shopUuid}`);
          brokenShopUuids.push(shopUuid);
          continue;
        }
        
        const shopData = shop.getFlag("campaign-codex", "data") || {};
        const linkedNPCUuids = shopData.linkedNPCs || [];
        
        if (linkedNPCUuids.includes(document.uuid)) {
          // Valid bidirectional relationship - proceed with location discovery
          const shopLocationUuid = shopData.linkedLocation;
          if (shopLocationUuid) {
            const location = await fromUuid(shopLocationUuid);
            if (location) {
              const locationData = location.getFlag("campaign-codex", "data") || {};
              const locationShopUuids = locationData.linkedShops || [];
              
              if (locationShopUuids.includes(shop.uuid)) {
                if (!locationMap.has(location.id)) {
                  locationMap.set(location.id, {
                    id: location.id,
                    uuid: location.uuid,
                    name: location.name,
                    img: location.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image', 'shop'),
                    source: 'shop',
                    shops: [shop.name],
                    meta: `<span class="entity-type">Via ${shop.name}</span>`
                  });
                } else {
                  const existingLocation = locationMap.get(location.id);
                  if (existingLocation.source === 'shop' && !existingLocation.shops.includes(shop.name)) {
                    existingLocation.shops.push(shop.name);
                    existingLocation.meta = `<span class="entity-type">Via ${existingLocation.shops.join(', ')}</span>`;
                  }
                }
              }
            }
          }
        } else {
          // Only log the warning if we're not importing (during import, links are expected to be broken temporarily)
          if (!game.campaignCodexImporting) {
            console.warn(`Campaign Codex | NPC ${document.name} thinks it's linked to shop ${shop.name}, but shop doesn't link back.`);
            brokenShopUuids.push(shopUuid);
          }
        }
      } catch (error) {
        console.error(`Campaign Codex | Error processing shop ${shopUuid} for location discovery:`, error);
      }
    }
    
    // Clear broken shop references on the NPC if any were found
    // Skip cleanup during import
    if (brokenShopUuids.length > 0 && !game.campaignCodexImporting) {
      document._skipRelationshipUpdates = true;
      await this.clearBrokenReferences(document, brokenShopUuids, 'linkedShops');
      delete document._skipRelationshipUpdates;
    }
    
    return Array.from(locationMap.values());
  }

  /**
   * Get a single linked location
   */
  static async getLinkedLocation(locationUuid) {
    if (!locationUuid) return null;
    
    try {
      const journal = await fromUuid(locationUuid);
      if (!journal) {
        console.warn(`Campaign Codex | Linked location not found: ${locationUuid}`);
        return null;
      }
      
      const imageData = journal.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image', 'location');
      
      return {
        id: journal.id,
        uuid: journal.uuid,
        name: journal.name,
        img: imageData
      };
    } catch (error) {
      console.error(`Campaign Codex | Error getting linked location ${locationUuid}:`, error);
      return null;
    }
  }

  /**
   * Get linked locations with stats (e.g., for a Region sheet)
   */
  static async getLinkedLocations(document, locationUuids) {
    if (!locationUuids || !Array.isArray(locationUuids)) return [];
    
    const locations = [];
    const brokenLocationUuids = [];
    
    for (const uuid of locationUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Linked location not found: ${uuid}`);
          brokenLocationUuids.push(uuid);
          continue;
        }
        
        const locationData = journal.getFlag("campaign-codex", "data") || {};
        const directNPCCount = (locationData.linkedNPCs || []).length;
        const imageData = journal.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image', 'location');
        
        let shopNPCCount = 0;
        const shopUuids = locationData.linkedShops || [];
        for (const shopUuid of shopUuids) {
          try {
            const shop = await fromUuid(shopUuid);
            if (shop) {
              const shopData = shop.getFlag("campaign-codex", "data") || {};
              shopNPCCount += (shopData.linkedNPCs || []).length;
            }
          } catch (e) {
            // Ignore errors for individual shops
          }
        }
        
        const totalNPCs = directNPCCount + shopNPCCount;
        const shopCount = shopUuids.length;
        
        locations.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          meta: `<span class="entity-stat">${totalNPCs}&nbsp;NPCs</span> <span class="entity-stat">${shopCount}&nbsp;Entries</span>`
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing location ${uuid}:`, error);
        brokenLocationUuids.push(uuid);
      }
    }
    
    // v13: Enhanced error handling for broken references
    if (brokenLocationUuids.length > 0 && !game.campaignCodexImporting) {
      document._skipRelationshipUpdates = true;
      await this.clearBrokenReferences(document, brokenLocationUuids, 'linkedLocations');
      delete document._skipRelationshipUpdates;
    }
    
    return locations;
  }

  // ===========================================
  // REGION METHODS
  // ===========================================
  /**
   * Get the region that contains a location using a direct two-way link.
   */
  static async getLinkedRegion(locationDoc) {
    const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
    const regionUuid = locationData.parentRegion;
    if (!regionUuid) return null;
    
    try {
      const region = await fromUuid(regionUuid);
      if (!region) {
        console.warn(`Campaign Codex | Broken parentRegion link from ${locationDoc.name}: ${regionUuid}`);
        // v13: Enhanced cleanup for broken region links
        if (!game.campaignCodexImporting) {
          await locationDoc.unsetFlag("campaign-codex", "data.parentRegion");
          ui.notifications.warn(`Removed broken parent region link from ${locationDoc.name}.`);
        }
        return null;
      }
      
      return {
        id: region.id,
        uuid: region.uuid,
        name: region.name,
        img: region.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image', 'region')
      };
    } catch (error) {
      console.error(`Campaign Codex | Error fetching linked region ${regionUuid}:`, error);
      return null;
    }
  }

  // ===========================================
  // ACTOR/NPC METHODS
  // ===========================================
  /**
   * Get a linked actor with stats
   */
  static async getLinkedActor(actorUuid) {
    if (!actorUuid) return null;
    
    try {
      const actor = await fromUuid(actorUuid);
      if (!actor) {
        console.warn(`Campaign Codex | Linked actor not found: ${actorUuid}`);
        return null;
      }
      
      // Try common paths for AC across different systems
      const ac = this.getValue(actor, 'system.attributes.ac.value') || 
                 this.getValue(actor, 'system.ac.value') || 
                 this.getValue(actor, 'system.armor') || 
                 this.getValue(actor, 'system.defense') ||
                 this.getValue(actor, 'system.stats.toughness.value'); // SWADE
      
      // Try common paths for HP across different systems
      const hp = this.getValue(actor, 'system.attributes.hp') || 
                 this.getValue(actor, 'system.hp') || 
                 this.getValue(actor, 'system.health') ||
                 this.getValue(actor, 'system.wounds'); // Some systems use wounds
      
      return {
        id: actor.id,
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        ac: ac || null,
        hp: hp || null,
        type: actor.type
      };
    } catch (error) {
      console.error(`Campaign Codex | Error getting linked actor ${actorUuid}:`, error);
      return null;
    }
  }

  /**
   * Get associate NPCs
   */
  static async getAssociates(document, associateUuids) {
    if (!associateUuids || !Array.isArray(associateUuids)) return [];
    
    const associates = [];
    const brokenAssociateUuids = [];
    
    for (const uuid of associateUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Associate journal not found: ${uuid}`);
          brokenAssociateUuids.push(uuid);
          continue;
        }
        
        const npcData = journal.getFlag("campaign-codex", "data") || {};
        const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor) : null;
        const imageData = journal.getFlag("campaign-codex", "image") || actor?.img || TemplateComponents.getAsset('image', 'npc');
        const allLocations = await this.getAllLocations(journal, npcData.linkedLocations || []);
        const linkedShops = await this.getLinkedShopsWithLocation(journal, npcData.linkedShops || []);
        
        associates.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          actor: actor,
          meta: game.campaignCodex.getActorDisplayMeta(actor),
          locations: allLocations.map(loc => loc.name),
          shops: linkedShops.map(shop => shop.name)
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing associate ${uuid}:`, error);
        brokenAssociateUuids.push(uuid);
      }
    }
    
    // v13: Enhanced broken reference cleanup
    if (brokenAssociateUuids.length > 0 && !game.campaignCodexImporting) {
      document._skipRelationshipUpdates = true;
      await this.clearBrokenReferences(document, brokenAssociateUuids, 'associates');
      delete document._skipRelationshipUpdates;
    }
    
    return associates;
  }

  /**
   * Get linked NPCs
   */
  static async getLinkedNPCs(document, npcUuids) {
    if (!npcUuids || !Array.isArray(npcUuids)) return [];
    
    const npcs = [];
    const brokenNPCUuids = [];
    
    for (const uuid of npcUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | NPC journal not found: ${uuid}`);
          brokenNPCUuids.push(uuid);
          continue;
        }
        
        const npcData = journal.getFlag("campaign-codex", "data") || {};
        const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor) : null;
        const imageData = journal.getFlag("campaign-codex", "image") || actor?.img || TemplateComponents.getAsset('image', 'npc');
        
        npcs.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          actor: actor,
          meta: game.campaignCodex.getActorDisplayMeta(actor)
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing NPC ${uuid}:`, error);
        brokenNPCUuids.push(uuid);
      }
    }
    
    // v13: Enhanced broken reference cleanup with import protection
    if (brokenNPCUuids.length > 0 && !game.campaignCodexImporting) {
      document._skipRelationshipUpdates = true;
      await this.clearBrokenReferences(document, brokenNPCUuids, 'linkedNPCs');
      delete document._skipRelationshipUpdates;
    }
    
    return npcs;
  }

  /**
   * Get all NPCs from locations (region view)
   */
  static async getAllNPCs(locationUuids) {
    if (!locationUuids || !Array.isArray(locationUuids)) return [];
    
    const npcMap = new Map();
    
    for (const locationUuid of locationUuids) {
      try {
        const location = await fromUuid(locationUuid);
        if (!location) {
          console.warn(`Campaign Codex | Location not found for NPC aggregation: ${locationUuid}`);
          continue;
        }
        
        const locationData = location.getFlag("campaign-codex", "data") || {};
        
        // Get direct location NPCs
        const directNPCs = await this.getLinkedNPCs(location, locationData.linkedNPCs || []);
        for (const npc of directNPCs) {
          if (!npcMap.has(npc.id)) {
            npcMap.set(npc.id, {
              ...npc,
              locations: [location.name],
              shops: [],
              source: 'location'
            });
          } else {
            const existingNpc = npcMap.get(npc.id);
            if (!existingNpc.locations.includes(location.name)) {
              existingNpc.locations.push(location.name);
            }
          }
        }
        
        // Get shop NPCs from this location
        const shopUuids = locationData.linkedShops || [];
        for (const shopUuid of shopUuids) {
          try {
            const shop = await fromUuid(shopUuid);
            if (!shop) continue;
            
            const shopData = shop.getFlag("campaign-codex", "data") || {};
            const shopNPCs = await this.getLinkedNPCs(shop, shopData.linkedNPCs || []);
            for (const npc of shopNPCs) {
              if (!npcMap.has(npc.id)) {
                npcMap.set(npc.id, {
                  ...npc,
                  locations: [location.name],
                  shops: [shop.name],
                  source: 'shop'
                });
              } else {
                const existingNpc = npcMap.get(npc.id);
                if (!existingNpc.locations.includes(location.name)) {
                  existingNpc.locations.push(location.name);
                }
                if (!existingNpc.shops.includes(shop.name)) {
                  existingNpc.shops.push(shop.name);
                }
                // Update source if this NPC is now found in a shop
                if (existingNpc.source === 'location') {
                  existingNpc.source = 'shop';
                }
              }
            }
          } catch (error) {
            console.error(`Campaign Codex | Error processing shop ${shopUuid} for NPC aggregation:`, error);
          }
        }
      } catch (error) {
        console.error(`Campaign Codex | Error processing location ${locationUuid} for NPC aggregation:`, error);
      }
    }
    
    return Array.from(npcMap.values());
  }

  /**
   * Get directly linked NPCs (WITH document parameter for cleanup)
   */
  static async getDirectNPCs(document, npcUuids) {
    if (!npcUuids || !Array.isArray(npcUuids)) return [];
    
    const npcs = [];
    const brokenNPCUuids = [];
    
    for (const uuid of npcUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Direct NPC journal not found: ${uuid}`);
          brokenNPCUuids.push(uuid);
          continue;
        }
        
        const npcData = journal.getFlag("campaign-codex", "data") || {};
        const actor = npcData.linkedActor ? await fromUuid(npcData.linkedActor) : null;
        const imageData = journal.getFlag("campaign-codex", "image") || actor?.img || TemplateComponents.getAsset('image', 'npc');
        
        npcs.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          actor: actor,
          meta: game.campaignCodex.getActorDisplayMeta(actor),
          source: 'direct'
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing direct NPC ${uuid}:`, error);
        brokenNPCUuids.push(uuid);
      }
    }
    
    // v13: Enhanced cleanup with import protection
    if (brokenNPCUuids.length > 0 && !game.campaignCodexImporting) {
      document._skipRelationshipUpdates = true;
      await this.clearBrokenReferences(document, brokenNPCUuids, 'linkedNPCs');
      delete document._skipRelationshipUpdates;
    }
    
    return npcs;
  }

  /**
   * Get NPCs from linked shops
   */
  static async getShopNPCs(document, shopUuids) {
    if (!shopUuids || !Array.isArray(shopUuids)) return [];
    
    const npcMap = new Map();
    const brokenShopUuids = [];
    
    for (const shopUuid of shopUuids) {
      try {
        const shop = await fromUuid(shopUuid);
        if (!shop) {
          console.warn(`Campaign Codex | Shop not found: ${shopUuid}`);
          brokenShopUuids.push(shopUuid);
          continue;
        }
        
        const shopData = shop.getFlag("campaign-codex", "data") || {};
        const linkedNPCUuids = shopData.linkedNPCs || [];
        
        // This inner call will handle cleaning broken NPC links from the SHOP's perspective
        const linkedNpcs = await this.getLinkedNPCs(shop, linkedNPCUuids);
        for (const npc of linkedNpcs) {
          const npcJournal = await fromUuid(npc.uuid);
          if (!npcJournal) continue;
          
          if (!npcMap.has(npcJournal.id)) {
            npcMap.set(npcJournal.id, {
              ...npc,
              shops: [shop.name],
              source: 'shop'
            });
          } else {
            const existingNpc = npcMap.get(npcJournal.id);
            if (!existingNpc.shops.includes(shop.name)) {
              existingNpc.shops.push(shop.name);
            }
          }
        }
      } catch (error) {
        console.error(`Campaign Codex | Error processing shop ${shopUuid}:`, error);
        brokenShopUuids.push(shopUuid);
      }
    }
    
    // Clean up broken shop links from the original document (e.g., the Location)
    if (brokenShopUuids.length > 0 && !game.campaignCodexImporting) {
      document._skipRelationshipUpdates = true;
      await this.clearBrokenReferences(document, brokenShopUuids, 'linkedShops');
      delete document._skipRelationshipUpdates;
    }
    
    return Array.from(npcMap.values());
  }

  // ===========================================
  // SHOP METHODS
  // ===========================================
  /**
   * Get linked shops with location info (e.g., for an NPC sheet)
   */
  static async getLinkedShopsWithLocation(document, shopUuids) {
    if (!shopUuids || !Array.isArray(shopUuids)) return [];
    
    const shops = [];
    const brokenShopUuids = [];
    
    for (const uuid of shopUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Shop journal not found: ${uuid}`);
          brokenShopUuids.push(uuid);
          continue;
        }
        
        const shopData = journal.getFlag("campaign-codex", "data") || {};
        const linkedLocationUuid = shopData.linkedLocation;
        const imageData = journal.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image', 'shop');
        let locationName = 'Unknown';
        
        if (linkedLocationUuid) {
          const location = await fromUuid(linkedLocationUuid);
          if (location) {
            locationName = location.name;
          }
        }
        
        shops.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          meta: `<span class="entity-type">${locationName}</span>`
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing shop ${uuid}:`, error);
        brokenShopUuids.push(uuid);
      }
    }
    
    // v13: Enhanced cleanup with import protection
    if (brokenShopUuids.length > 0 && !game.campaignCodexImporting) {
      document._skipRelationshipUpdates = true;
      await this.clearBrokenReferences(document, brokenShopUuids, 'linkedShops');
      delete document._skipRelationshipUpdates;
    }
    
    return shops;
  }

  /**
   * Get linked shops with NPC count (e.g., for a Location sheet)
   */
  static async getLinkedShops(document, shopUuids) {
    if (!shopUuids || !Array.isArray(shopUuids)) return [];
    
    const shops = [];
    const brokenShopUuids = [];
    
    for (const uuid of shopUuids) {
      try {
        const journal = await fromUuid(uuid);
        if (!journal) {
          console.warn(`Campaign Codex | Shop journal not found: ${uuid}`);
          brokenShopUuids.push(uuid);
          continue;
        }
        
        const shopData = journal.getFlag("campaign-codex", "data") || {};
        const npcCount = (shopData.linkedNPCs || []).length;
        const imageData = journal.getFlag("campaign-codex", "image") || TemplateComponents.getAsset('image', 'shop');
        
        shops.push({
          id: journal.id,
          uuid: journal.uuid,
          name: journal.name,
          img: imageData,
          meta: `<span class="entity-stat">${npcCount} NPCs</span>`
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing shop ${uuid}:`, error);
        brokenShopUuids.push(uuid);
      }
    }
    
    // v13: Enhanced cleanup with import protection
    if (brokenShopUuids.length > 0 && !game.campaignCodexImporting) {
      document._skipRelationshipUpdates = true;
      await this.clearBrokenReferences(document, brokenShopUuids, 'linkedShops');
      delete document._skipRelationshipUpdates;
    }
    
    return shops;
  }

  /**
   * Get all shops from locations (region view)
   */
  static async getAllShops(locationUuids) {
    if (!locationUuids || !Array.isArray(locationUuids)) return [];
    
    const shopMap = new Map();
    
    for (const locationUuid of locationUuids) {
      try {
        const location = await fromUuid(locationUuid);
        if (!location) {
          console.warn(`Campaign Codex | Location not found for shop aggregation: ${locationUuid}`);
          continue;
        }
        
        const locationData = location.getFlag("campaign-codex", "data") || {};
        const shops = await this.getLinkedShops(location, locationData.linkedShops || []);
        
        for (const shop of shops) {
          const shopJournal = await fromUuid(shop.uuid);
          if (!shopJournal) continue;
          
          const shopData = shopJournal.getFlag("campaign-codex", "data") || {};
          const inventoryCount = (shopData.inventory || []).length;
          
          if (!shopMap.has(shop.id)) {
            shopMap.set(shop.id, {
              ...shop,
              locations: [location.name],
              meta: `${shop.meta} <span class="entity-stat">${inventoryCount} Items</span>`
            });
          } else {
            const existingShop = shopMap.get(shop.id);
            if (!existingShop.locations.includes(location.name)) {
              existingShop.locations.push(location.name);
            }
          }
        }
      } catch (error) {
        console.error(`Campaign Codex | Error processing location ${locationUuid} for shop aggregation:`, error);
      }
    }
    
    return Array.from(shopMap.values());
  }

  // ===========================================
  // INVENTORY METHODS
  // ===========================================
  /**
   * Get shop inventory with pricing
   */
  static async getInventory(document, inventoryData) {
    if (!inventoryData || !Array.isArray(inventoryData)) return [];
    
    const inventory = [];
    const brokenItemUuids = [];
    
    for (const itemData of inventoryData) {
      try {
        const item = await fromUuid(itemData.itemUuid);
        if (!item) {
          console.warn(`Campaign Codex | Inventory item not found: ${itemData.itemUuid}`);
          brokenItemUuids.push(itemData.itemUuid);
          continue;
        }
        
        // Use settings for price paths - v13: Enhanced system compatibility
        const pricePath = game.settings.get("campaign-codex", "itemPricePath");
        const denominationPath = game.settings.get("campaign-codex", "itemDenominationPath");
      
        const rawPrice = this.getValue(item, pricePath) || 0;
        const basePrice = parseFloat(String(rawPrice).replace(/[^\d.]/g, '')) || 0;
      
        const currency = this.getValue(item, denominationPath) || "gp";
        const weight = null;
        const markup = document.getFlag("campaign-codex", "data.markup") || 1.0;
        const finalPrice = itemData.customPrice ?? Math.round(basePrice * markup);
        
        inventory.push({
          itemId: item.id,
          itemUuid: item.uuid,
          name: item.name,
          img: item.img,
          basePrice: basePrice,
          finalPrice: finalPrice,
          currency: currency,
          quantity: itemData.quantity || 1,
          weight: weight
        });
      } catch (error) {
        console.error(`Campaign Codex | Error processing inventory item:`, error);
        brokenItemUuids.push(itemData.itemUuid);
      }
    }
    
    // Clean up broken item references if any found.
    // This uses custom logic because the inventory is an array of objects, not UUID strings.
    // v13: Enhanced cleanup with import protection
    if (brokenItemUuids.length > 0 && !game.campaignCodexImporting) {
      try {
        const currentData = document.getFlag("campaign-codex", "data") || {};
        const currentInventory = currentData.inventory || [];
        const cleanedInventory = currentInventory.filter(item => !brokenItemUuids.includes(item.itemUuid));
        
        if (cleanedInventory.length !== currentInventory.length) {
          currentData.inventory = cleanedInventory;
          await document.setFlag("campaign-codex", "data", currentData);
          
          const removedCount = currentInventory.length - cleanedInventory.length;
          ui.notifications.warn(`Removed ${removedCount} broken inventory items from ${document.name}`);
        }
      } catch (error) {
        console.error(`Campaign Codex | Error cleaning broken inventory items:`, error);
      }
    }
    
    return inventory;
  }

  /**
   * Utility method to safely get nested object values
   * v13: Enhanced with better error handling
   */
  static getValue(obj, path) {
    if (!obj || !path) return undefined;
    
    try {
      return path.split('.').reduce((current, key) => {
        return current?.[key];
      }, obj);
    } catch (error) {
      console.warn(`Campaign Codex | Error accessing path "${path}" on object:`, error);
      return undefined;
    }
  }
}
