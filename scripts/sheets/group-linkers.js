// scripts/group-linkers.js
import { TemplateComponents } from './template-components.js';
import { CampaignCodexLinkers } from './linkers.js'; 

// v13: This utility class is already v13 compatible as it doesn't use jQuery or ApplicationV2
export class GroupLinkers {
  /**
   * Get group members from UUIDs
   * v13: Enhanced error handling and null safety
   */
  static async getGroupMembers(memberUuids) {
    if (!memberUuids || !Array.isArray(memberUuids)) return [];
    
    const members = [];
    
    for (const uuid of memberUuids) {
      try {
        const doc = await fromUuid(uuid);
        if (!doc) {
          console.warn(`GroupLinkers | Member document not found: ${uuid}`);
          continue;
        }
        
        const type = doc.getFlag?.("campaign-codex", "type") || 'unknown';
        const customImage = doc.getFlag?.("campaign-codex", "image");
        const defaultImage = TemplateComponents.getAsset('image', type);
        
        members.push({ 
          uuid: doc.uuid, 
          name: doc.name, 
          img: customImage || doc.img || defaultImage, 
          type 
        });
      } catch (error) {
        console.error(`GroupLinkers | Error processing member ${uuid}:`, error);
      }
    }
    
    return members;
  }

  /**
   * Get nested data structure for group members
   * v13: Enhanced error handling and performance improvements
   */
  static async getNestedData(groupMembers) {
    const nestedData = {
      allGroups: [], 
      allRegions: [], 
      allLocations: [], 
      allShops: [], 
      allNPCs: [], 
      allItems: [],
      membersByGroup: {}, 
      locationsByRegion: {}, 
      shopsByLocation: {}, 
      npcsByLocation: {}, 
      npcsByShop: {}, 
      itemsByShop: {},
      totalValue: 0
    };
    
    const processedUuids = new Set();
    
    // Process all group members
    for (const member of groupMembers || []) {
      try {
        await this._processEntity(member, nestedData, processedUuids);
      } catch (error) {
        console.error(`GroupLinkers | Error processing entity ${member?.uuid}:`, error);
      }
    }
    
    // Remove duplicates from NPCs (most likely to have duplicates)
    nestedData.allNPCs = this._removeDuplicates(nestedData.allNPCs);
    
    return nestedData;
  }

  /**
   * Process individual entity in the group hierarchy
   * v13: Enhanced error handling and context management
   */
  static async _processEntity(entity, nestedData, processedUuids, parent = null, locationContext = null) {
    if (!entity || !entity.type || processedUuids.has(entity.uuid)) return;
    
    processedUuids.add(entity.uuid);
    
    // Update location context when processing a location
    let newLocationContext = locationContext;
    if (entity.type === 'location') {
      newLocationContext = entity;
    }
    
    try {
      switch (entity.type) {
        case 'group':
          await this._processGroup(entity, nestedData, processedUuids);
          break;
        case 'region':
          await this._processRegion(entity, nestedData, processedUuids);
          break;
        case 'location':
          await this._processLocation(entity, nestedData, processedUuids, parent, newLocationContext);
          break;
        case 'shop':
          await this._processShop(entity, nestedData, processedUuids, parent, newLocationContext);
          break;
        case 'npc':
          await this._processNPC(entity, nestedData, parent, newLocationContext);
          break;
        default:
          console.warn(`GroupLinkers | Unknown entity type: ${entity.type}`);
      }
    } catch (error) {
      console.error(`GroupLinkers | Error processing ${entity.type} entity ${entity.uuid}:`, error);
    }
  }

  /**
   * Process group entity and its members
   * v13: Enhanced error handling for nested groups
   */
  static async _processGroup(group, nestedData, processedUuids) {
    // Add to all groups if not already present
    if (!nestedData.allGroups.find(g => g.uuid === group.uuid)) {
      nestedData.allGroups.push(group);
    }
    
    try {
      const groupDoc = await fromUuid(group.uuid);
      if (!groupDoc) {
        console.warn(`GroupLinkers | Group document not found: ${group.uuid}`);
        return;
      }
      
      const groupData = groupDoc.getFlag("campaign-codex", "data") || {};
      const members = await this.getGroupMembers(groupData.members);
      nestedData.membersByGroup[group.uuid] = members;
      
      // Process each member recursively
      for (const member of members) {
        await this._processEntity(member, nestedData, processedUuids, group);
      }
    } catch (error) {
      console.error(`GroupLinkers | Error processing group ${group.uuid}:`, error);
    }
  }

  /**
   * Process region entity and its locations
   * v13: Enhanced error handling for region processing
   */
  static async _processRegion(region, nestedData, processedUuids) {
    // Add to all regions if not already present
    if (!nestedData.allRegions.find(r => r.uuid === region.uuid)) {
      nestedData.allRegions.push(region);
    }
    
    try {
      const regionDoc = await fromUuid(region.uuid);
      if (!regionDoc) {
        console.warn(`GroupLinkers | Region document not found: ${region.uuid}`);
        return;
      }
      
      const regionData = regionDoc.getFlag("campaign-codex", "data") || {};
      nestedData.locationsByRegion[region.uuid] = [];
      
      // Process linked locations
      for (const locationUuid of regionData.linkedLocations || []) {
        try {
          const locationDoc = await fromUuid(locationUuid);
          if (!locationDoc) {
            console.warn(`GroupLinkers | Location not found: ${locationUuid}`);
            continue;
          }
          
          const locationInfo = { 
            uuid: locationDoc.uuid, 
            name: locationDoc.name, 
            img: locationDoc.getFlag("campaign-codex", "image") || locationDoc.img || TemplateComponents.getAsset('image', 'location'), 
            type: 'location' 
          };
          
          nestedData.locationsByRegion[region.uuid].push(locationInfo);
          await this._processEntity(locationInfo, nestedData, processedUuids, region, locationInfo);
        } catch (error) {
          console.error(`GroupLinkers | Error processing location ${locationUuid} in region:`, error);
        }
      }
    } catch (error) {
      console.error(`GroupLinkers | Error processing region ${region.uuid}:`, error);
    }
  }

  /**
   * Process location entity and its shops/NPCs
   * v13: Enhanced error handling and region linking
   */
  static async _processLocation(location, nestedData, processedUuids, parent, locationContext) {
    // Add to all locations if not already present
    if (!nestedData.allLocations.find(l => l.uuid === location.uuid)) {
      try {
        const locationDoc = await fromUuid(location.uuid);
        if (locationDoc) {
          // Get linked region information
          const region = await CampaignCodexLinkers.getLinkedRegion(locationDoc);
          location.region = region?.name;
          location.npcCount = 0; // Will be calculated later
          location.shopCount = 0; // Will be calculated later
        }
        nestedData.allLocations.push(location);
      } catch (error) {
        console.error(`GroupLinkers | Error getting region for location ${location.uuid}:`, error);
        nestedData.allLocations.push(location);
      }
    }
    
    try {
      const locationDoc = await fromUuid(location.uuid);
      if (!locationDoc) {
        console.warn(`GroupLinkers | Location document not found: ${location.uuid}`);
        return;
      }
      
      const locationData = locationDoc.getFlag("campaign-codex", "data") || {};
      
      // Process linked shops
      nestedData.shopsByLocation[location.uuid] = [];
      for (const shopUuid of locationData.linkedShops || []) {
        try {
          const shopDoc = await fromUuid(shopUuid);
          if (!shopDoc) {
            console.warn(`GroupLinkers | Shop not found: ${shopUuid}`);
            continue;
          }
          
          const shopInfo = { 
            uuid: shopDoc.uuid, 
            name: shopDoc.name, 
            img: shopDoc.getFlag("campaign-codex", "image") || shopDoc.img || TemplateComponents.getAsset('image', 'shop'), 
            type: 'shop' 
          };
          
          nestedData.shopsByLocation[location.uuid].push(shopInfo);
          await this._processEntity(shopInfo, nestedData, processedUuids, location, locationContext);
        } catch (error) {
          console.error(`GroupLinkers | Error processing shop ${shopUuid} in location:`, error);
        }
      }
      
      // Process directly linked NPCs
      nestedData.npcsByLocation[location.uuid] = [];
      for (const npcUuid of locationData.linkedNPCs || []) {
        const npcInfo = { uuid: npcUuid, type: 'npc' };
        await this._processEntity(npcInfo, nestedData, processedUuids, location, locationContext);
      }
      
      // Update location stats
      const locationInAll = nestedData.allLocations.find(l => l.uuid === location.uuid);
      if (locationInAll) {
        locationInAll.shopCount = nestedData.shopsByLocation[location.uuid]?.length || 0;
      }
    } catch (error) {
      console.error(`GroupLinkers | Error processing location ${location.uuid}:`, error);
    }
  }

  /**
   * Process shop entity and its NPCs/inventory
   * v13: Enhanced inventory processing and error handling
   */
  static async _processShop(shop, nestedData, processedUuids, parent, locationContext) {
    // Add to all shops if not already present
    if (!nestedData.allShops.find(s => s.uuid === shop.uuid)) {
      nestedData.allShops.push(shop);
    }
    
    try {
      const shopDoc = await fromUuid(shop.uuid);
      if (!shopDoc) {
        console.warn(`GroupLinkers | Shop document not found: ${shop.uuid}`);
        return;
      }
      
      const shopData = shopDoc.getFlag("campaign-codex", "data") || {};
      
      // Process linked NPCs
      nestedData.npcsByShop[shop.uuid] = [];
      for (const npcUuid of shopData.linkedNPCs || []) {
        const npcInfo = { uuid: npcUuid, type: 'npc' };
        await this._processEntity(npcInfo, nestedData, processedUuids, shop, locationContext);
      }
      
      // Process inventory using CampaignCodexLinkers
      try {
        const processedInventory = await CampaignCodexLinkers.getInventory(shopDoc, shopData.inventory || []);
        
        nestedData.itemsByShop[shop.uuid] = [];
        for (const item of processedInventory) {
          const itemInfo = {
            uuid: item.itemUuid, 
            name: item.name, 
            img: item.img, 
            type: 'item',
            quantity: item.quantity, 
            finalPrice: item.finalPrice, 
            currency: item.currency
          };
          
          nestedData.itemsByShop[shop.uuid].push(itemInfo);
          nestedData.allItems.push(itemInfo);
          
          // Calculate total value (handle potential NaN values)
          const itemValue = (item.finalPrice || 0) * (item.quantity || 0);
          if (!isNaN(itemValue)) {
            nestedData.totalValue += itemValue;
          }
        }
      } catch (error) {
        console.error(`GroupLinkers | Error processing inventory for shop ${shop.uuid}:`, error);
        nestedData.itemsByShop[shop.uuid] = [];
      }
    } catch (error) {
      console.error(`GroupLinkers | Error processing shop ${shop.uuid}:`, error);
    }
  }
  
  /**
   * Process NPC entity
   * v13: Enhanced actor data handling and error recovery
   */
  static async _processNPC(npc, nestedData, parent, locationContext) {
    try {
      const npcDoc = await fromUuid(npc.uuid);
      if (!npcDoc) {
        console.warn(`GroupLinkers | NPC document not found: ${npc.uuid}`);
        return;
      }
      
      const npcInfo = await this._createNPCInfo(npcDoc, parent, locationContext);
      
      // Check for duplicates before adding to allNPCs
      if (!nestedData.allNPCs.find(n => n.uuid === npcInfo.uuid)) {
        nestedData.allNPCs.push(npcInfo);
      }
      
      // Add to appropriate parent collections
      if (parent?.type === 'location') {
        if (!nestedData.npcsByLocation[parent.uuid]) {
          nestedData.npcsByLocation[parent.uuid] = [];
        }
        if (!nestedData.npcsByLocation[parent.uuid].find(n => n.uuid === npcInfo.uuid)) {
          nestedData.npcsByLocation[parent.uuid].push(npcInfo);
        }
      } else if (parent?.type === 'shop') {
        if (!nestedData.npcsByShop[parent.uuid]) {
          nestedData.npcsByShop[parent.uuid] = [];
        }
        if (!nestedData.npcsByShop[parent.uuid].find(n => n.uuid === npcInfo.uuid)) {
          nestedData.npcsByShop[parent.uuid].push(npcInfo);
        }
      }
    } catch (error) {
      console.error(`GroupLinkers | Error processing NPC ${npc.uuid}:`, error);
    }
  }

  /**
   * Create NPC info object with context
   * v13: Enhanced actor data extraction with multi-system support
   */
  static async _createNPCInfo(npcDoc, parent, locationContext) {
    const npcData = npcDoc.getFlag("campaign-codex", "data") || {};
    let actor = null;
    
    // Safely get linked actor
    if (npcData.linkedActor) {
      try {
        actor = await fromUuid(npcData.linkedActor);
      } catch (error) {
        console.warn(`GroupLinkers | Linked actor not found for NPC ${npcDoc.name}: ${npcData.linkedActor}`);
      }
    }
    
    // Determine source context
    const sourceType = parent?.type || 'direct';
    let sourceLocationName = null;
    let sourceShopName = null;
    
    if (sourceType === 'shop') {
      sourceShopName = parent.name;
      if (locationContext) {
        sourceLocationName = locationContext.name;
      }
    } else if (sourceType === 'location') {
      sourceLocationName = parent.name;
    }
    
    // Create actor info with enhanced system compatibility
    let actorInfo = null;
    if (actor) {
      try {
        // Use CampaignCodexLinkers.getValue for better system compatibility
        const ac = CampaignCodexLinkers.getValue(actor, 'system.attributes.ac.value') ||
                  CampaignCodexLinkers.getValue(actor, 'system.ac.value') ||
                  CampaignCodexLinkers.getValue(actor, 'system.armor') ||
                  10; // Default AC
        
        const hp = CampaignCodexLinkers.getValue(actor, 'system.attributes.hp') ||
                  CampaignCodexLinkers.getValue(actor, 'system.hp') ||
                  { value: 0, max: 0 }; // Default HP object
        
        actorInfo = { 
          uuid: actor.uuid, 
          name: actor.name, 
          ac: ac,
          hp: hp,
          type: actor.type 
        };
      } catch (error) {
        console.warn(`GroupLinkers | Error extracting actor data for ${actor.name}:`, error);
        actorInfo = {
          uuid: actor.uuid,
          name: actor.name,
          ac: 10,
          hp: { value: 0, max: 0 },
          type: actor.type
        };
      }
    }
    
    return {
      uuid: npcDoc.uuid,
      name: npcDoc.name,
      img: npcDoc.getFlag("campaign-codex", "image") || actor?.img || TemplateComponents.getAsset('image', 'npc'),
      type: 'npc',
      source: sourceType,
      sourceLocation: sourceLocationName,
      sourceShop: sourceShopName,
      actor: actorInfo
    };
  }
    
  /**
   * Remove duplicate entries from array based on UUID
   * v13: Enhanced duplicate removal with better performance
   */
  static _removeDuplicates(array) {
    if (!Array.isArray(array)) return [];
    
    const seen = new Set();
    return array.filter(item => {
      if (!item || !item.uuid) return false;
      if (seen.has(item.uuid)) return false;
      seen.add(item.uuid);
      return true;
    });
  }
}
