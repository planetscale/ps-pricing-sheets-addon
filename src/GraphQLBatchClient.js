/**
 * Batched GraphQL queries for bulk instance retrieval
 * Optimized for fetchRegionalInstanceMatrix use case
 */

/**
 * Fetch multiple AWS EC2 instances in a single batched GraphQL query
 * 
 * @param {Array<string>} instanceTypes - Array of instance types to fetch
 * @param {string} region - AWS region
 * @param {string} platform - Operating system (linux, windows, etc.)
 * @return {Array<object>} Array of instance pricing objects
 */
/**
 * Fetch multiple AWS EC2 instances in a single batched GraphQL query
 * Returns exactly the pricing type requested (on-demand or reserved)
 * 
 * @param {Array<string>} instanceTypes - Array of instance types to fetch
 * @param {string} region - AWS region
 * @param {string} platform - Operating system (linux, windows, etc.)
 * @param {string} purchaseType - ondemand or reserved
 * @param {string} purchaseTerm - 1yr or 3yr (for reserved)
 * @param {string} offeringClass - standard or convertible (for reserved)
 * @param {string} paymentOption - no_upfront, partial_upfront, all_upfront (for reserved)
 * @return {Array<object>} Array of instance pricing objects
 */
function fetchAWSEC2GraphQLBatched(instanceTypes, region, platform, purchaseType, purchaseTerm, offeringClass, paymentOption) {
  platform = platform || 'linux';
  purchaseType = purchaseType || 'ondemand';
  
  // Map platform to GraphQL operatingSystem values
  var osMap = {
    'linux': 'Linux',
    'windows': 'Windows',
    'rhel': 'RHEL',
    'suse': 'SUSE'
  };
  var operatingSystem = osMap[platform.toLowerCase()] || 'Linux';

  // Build aliases for each instance type to batch them in one query
  var aliases = instanceTypes.map(function(type, i) {
    var safeAlias = 'inst_' + type.replace(/\./g, '_').replace(/-/g, '_');
    
    // Get purchase-type specific filters
    var purchaseFilters = getAWSPurchaseTypeFilters(purchaseType, type, {
      purchaseTerm: purchaseTerm,
      offeringClass: offeringClass,
      paymentOption: paymentOption
    });
    
    // Build attribute filters
    var attributeFilters = [
      '{ key: "instanceType", value: "' + type + '" }',
      '{ key: "operatingSystem", value: "' + operatingSystem + '" }',
      '{ key: "tenancy", value: "Shared" }',
      '{ key: "preInstalledSw", value: "NA" }'
    ];
    
    if (purchaseFilters.operation) {
      attributeFilters.push('{ key: "operation", value: "' + purchaseFilters.operation + '" }');
    }
    
    // NOTE: usagetype filter disabled for now due to region variations
    // if (purchaseFilters.usagetype) {
    //   attributeFilters.push('{ key: "usagetype", value: "' + purchaseFilters.usagetype + '" }');
    // }
    
    // Build price filter based on what was requested
    var priceFilterParts = [];
    
    switch (purchaseType) {
      case 'ondemand':
        priceFilterParts.push('purchaseOption: "on_demand"');
        break;
        
      case 'reserved':
        priceFilterParts.push('purchaseOption: "reserved"');
        if (purchaseTerm) {
          var term = (purchaseTerm === '3yr') ? '3yr' : '1yr';
          priceFilterParts.push(`termLength: "${term}"`);
        }
        if (offeringClass) {
          var riClass = (offeringClass === 'convertible') ? 'convertible' : 'standard';
          priceFilterParts.push(`termOfferingClass: "${riClass}"`);
        }
        if (paymentOption) {
          // Translate to API format: "no_upfront" → "No Upfront"
          var apiPaymentOption = translatePaymentOptionToAPI(paymentOption);
          priceFilterParts.push(`termPurchaseOption: "${apiPaymentOption}"`);
        }
        break;
        
      default:
        priceFilterParts.push('purchaseOption: "on_demand"');
    }
    
    var priceFilter = priceFilterParts.length > 0 ? 
      'filter: { ' + priceFilterParts.join(', ') + ' }' : '';
    
    return `
      ${safeAlias}: products(
        filter: {
          vendorName: "aws"
          service: "AmazonEC2"
          productFamily: "Compute Instance"
          region: "${region}"
          attributeFilters: [
            ${attributeFilters.join(',\n            ')}
          ]
        }
      ) {
        attributes { key value }
        prices(${priceFilter}) {
          USD
        }
      }
    `;
  });
  
  var query = `{ ${aliases.join('\n')} }`;
  
  Logger.log(`Batched AWS EC2 query for ${instanceTypes.length} instances in ${region} (${purchaseType})`);
  Logger.log(`Batch query parameters: term=${purchaseTerm}, class=${offeringClass}, payment=${paymentOption}`);
  Logger.log('First 500 chars of query:');
  Logger.log(query.substring(0, 500));
  
  try {
    var json = cachedGraphQL(query);
    
    Logger.log(`DEBUG: Batch query returned successfully`);
    Logger.log(`DEBUG: Response has data: ${!!json.data}`);
    
    if (!json.data) {
      Logger.log(`ERROR: Batch response has no data field!`);
      Logger.log(`Response: ${JSON.stringify(json)}`);
      throw new Error('Batch response missing data field');
    }
    
    var results = [];
    
    // Parse results from batched response
    instanceTypes.forEach(function(type, i) {
      var safeAlias = 'inst_' + type.replace(/\./g, '_').replace(/-/g, '_');
      var productData = json.data[safeAlias];
      
      if (!productData) {
        Logger.log(`WARNING: No data for alias "${safeAlias}" (${type})`);
        return;
      }
      
      if (productData && productData.length > 0) {
        Logger.log(`Batched: Found ${productData.length} products for ${type}`);
        
        // Find the product with valid pricing for the requested purchase type
        var product = null;
        var priceValue = null;
        
        for (var j = 0; j < productData.length; j++) {
          var candidate = productData[j];
          
          if (candidate.prices && candidate.prices.length > 0) {
            var candidatePrice = parseFloat(candidate.prices[0].USD);
            
            if (candidatePrice && candidatePrice > 0) {
              Logger.log(`Batched: Product [${j}] for ${type} has valid ${purchaseType} price: $${candidatePrice}`);
              product = candidate;
              priceValue = candidatePrice;
              break;
            }
          }
        }
        
        if (!product) {
          Logger.log(`Batched: No valid ${purchaseType} pricing found for ${type} among ${productData.length} products`);
          return; // Skip this instance
        }
        
        var attributes = {};
        
        // Convert attributes array to object
        product.attributes.forEach(function(attr) {
          attributes[attr.key] = attr.value;
        });

        // Build pricing structure based on purchase type requested
        var pricingObj = {};
        
        if (purchaseType === 'ondemand') {
          pricingObj.ondemand = priceValue;
        } else if (purchaseType === 'reserved') {
          pricingObj.reserved = {};
          if (priceValue && purchaseTerm && offeringClass && paymentOption) {
            var reservedKey = buildReservedPricingKey(purchaseTerm, offeringClass, paymentOption);
            pricingObj.reserved[reservedKey] = priceValue;
          }
        } else {
          // Default fallback
          pricingObj.ondemand = priceValue;
        }
        
        var instanceObj = {
          instance_type: type,
          vCPU: parseFloat(attributes.vcpu) || 0,
          memory: parseFloat(attributes.memory) || 0,
          storage: parseInstanceStorage(attributes),
          pricing: {
            [region]: {
              [platform]: pricingObj
            }
          }
        };

        results.push(instanceObj);
      } else {
        Logger.log(`No data found for ${type} in batched response`);
      }
    });
    
    return results;
    
  } catch (err) {
    Logger.log(`❌ Batched query failed: ${err}`);
    Logger.log(`Stack: ${err.stack}`);
    Logger.log(`Falling back to individual queries with same parameters...`);
    // Fallback to individual queries if batch fails - MUST pass all parameters
    return fetchAWSEC2GraphQL(instanceTypes, region, platform, purchaseType, purchaseTerm, offeringClass, paymentOption);
  }
}

/**
 * Fetch multiple GCP Compute instances in a single batched GraphQL query
 * NOW USES SAME STRUCTURE AS AWS for consistency
 * 
 * For committed-use: fetches on-demand pricing and applies hardcoded discount
 * 
 * @param {Array<string>} instanceTypes - Array of machine types to fetch
 * @param {string} region - GCP region
 * @param {string} purchaseType - ondemand, committed-use, or preemptible
 * @param {string} purchaseTerm - 1yr or 3yr (for committed-use)
 * @param {string} cudType - flexi or resource (for committed-use)
 * @return {Array<object>} Array of instance pricing objects
 */
function fetchGCPComputeGraphQLBatched(instanceTypes, region, purchaseType, purchaseTerm, cudType) {
  purchaseType = purchaseType || 'ondemand';
  cudType = cudType || 'flexi';
  
  // Build aliases for each machine type to batch them in one query
  var aliases = instanceTypes.map(function(type, i) {
    var safeAlias = 'inst_' + type.replace(/-/g, '_');
    var machineTypeFilter = '{ key: "machineType", value: "' + type + '" }';

    // Build price filter based on purchase type
    // For committed-use: fetch on-demand and apply discount in code
    var priceFilterParts = [];
    
    if (purchaseType === 'committed-use' || purchaseType === 'committed') {
      priceFilterParts.push('purchaseOption: "on_demand"');
    } else if (purchaseType === 'preemptible') {
      priceFilterParts.push('purchaseOption: "preemptible"');
    } else {
      // ondemand
      priceFilterParts.push('purchaseOption: "on_demand"');
    }
    
    var priceFilter = priceFilterParts.length > 0 ? 
      'filter: { ' + priceFilterParts.join(', ') + ' }' : '';
    
    return `
      ${safeAlias}: products(
        filter: {
          vendorName: "gcp"
          service: "Compute Engine"
          productFamily: "Compute Instance"
          region: "${region}"
          attributeFilters: [
            ${machineTypeFilter}
          ]
        }
      ) {
        attributes { key value }
        prices(${priceFilter}) {
          USD
        }
      }
    `;
  });
  
  var query = `{ ${aliases.join('\n')} }`;
  
  Logger.log(`Batched GCP Compute query for ${instanceTypes.length} instances in ${region} (${purchaseType})`);
  
  try {
    var json = cachedGraphQL(query);
    var results = [];
    var missingTypes = [];
    
    // Parse results from batched response (same logic as AWS)
    instanceTypes.forEach(function(type, i) {
      var safeAlias = 'inst_' + type.replace(/-/g, '_');
      var productData = json.data[safeAlias];
      
      if (productData && productData.length > 0) {
        Logger.log(`Batched GCP: Found ${productData.length} products for ${type}`);
        
        // Find product with valid pricing (same logic as AWS)
        var product = null;
        var priceValue = null;
        
        for (var j = 0; j < productData.length; j++) {
          var candidate = productData[j];
          
          if (candidate.prices && candidate.prices.length > 0) {
            var candidatePrice = parseFloat(candidate.prices[0].USD);
            
            if (candidatePrice && candidatePrice > 0) {
              Logger.log(`Batched GCP: Product [${j}] for ${type} has valid ${purchaseType} price: $${candidatePrice}`);
              product = candidate;
              priceValue = candidatePrice;
              break;
            }
          }
        }
        
        if (!product) {
          Logger.log(`Batched GCP: No valid ${purchaseType} pricing found for ${type}`);
          missingTypes.push(type);
          return;
        }
        
        var attributes = {};
        
        // Convert attributes array to object
        product.attributes.forEach(function(attr) {
          attributes[attr.key] = attr.value;
        });

        // Parse vCPU and memory from machine type name
        var resolvedType = attributes.machineType || attributes.machine_type || type;
        var specs = parseGCPMachineType(resolvedType, attributes);

        // Build pricing structure - NOW SAME AS AWS
        var pricingObj = {};
        
        if (purchaseType === 'committed-use' || purchaseType === 'committed') {
          // Apply CUD discount to on-demand price
          var discount = getGCPCUDDiscount(purchaseTerm, cudType);
          var cudPrice = priceValue * (1 - discount);
          
          Logger.log(`Batched: Applying ${cudType} CUD discount to ${type}: ${(discount * 100).toFixed(0)}% off $${priceValue} = $${cudPrice.toFixed(6)}`);
          
          pricingObj.ondemand = priceValue;
          pricingObj.reserved = {};
          
          // Store CUD price like AWS reserved
          var key = purchaseTerm === '3yr' ? 'cud-3y' : 'cud-1y';
          if (cudType === 'resource') {
            key = purchaseTerm === '3yr' ? 'cud-resource-3y' : 'cud-resource-1y';
          } else {
            key = purchaseTerm === '3yr' ? 'cud-flexi-3y' : 'cud-flexi-1y';
          }
          pricingObj.reserved[key] = cudPrice;
          
        } else if (purchaseType === 'preemptible') {
          pricingObj.preemptible = priceValue;
        } else {
          // ondemand
          pricingObj.ondemand = priceValue;
        }

        // Use AWS-style pricing structure
        var instanceObj = {
          instance_type: type,
          resolved_machine_type: resolvedType,
          vCPU: specs.cores,
          memory: specs.memory,
          pricing: {
            [region]: {
              "linux": pricingObj
            }
          }
        };

        results.push(instanceObj);
      } else {
        Logger.log(`No data found for ${type} in batched response`);
        missingTypes.push(type);
      }
    });
    
    if (missingTypes.length > 0) {
      Logger.log(`Batched GCP: Falling back to individual lookups for ${missingTypes.length} machine type(s)`);
      var fallbackResults = fetchGCPComputeGraphQL(missingTypes, region, purchaseType, purchaseTerm, cudType);
      results = results.concat(fallbackResults);
    }
    
    return results;
    
  } catch (err) {
    Logger.log(`❌ Batched GCP query failed: ${err}`);
    Logger.log(`Stack: ${err.stack}`);
    Logger.log(`Falling back to individual queries with same parameters...`);
    // Fallback to individual queries if batch fails - MUST pass all parameters
    return fetchGCPComputeGraphQL(instanceTypes, region, purchaseType, purchaseTerm, cudType);
  }
}

/**
 * Fetch reserved pricing for multiple AWS EC2 instances in a single batch
 * 
 * @param {Array<string>} instanceTypes - Array of instance types
 * @param {string} region - AWS region
 * @param {string} platform - Operating system
 * @param {string} purchaseTerm - 1yr or 3yr
 * @param {string} offeringClass - standard or convertible
 * @param {string} paymentOption - no_upfront, partial_upfront, all_upfront
 * @return {Object} Map of instanceType -> price
 */
function fetchAWSEC2ReservedPriceGraphQLBatched(instanceTypes, region, platform, purchaseTerm, offeringClass, paymentOption) {
  platform = platform || 'linux';
  
  var osMap = {
    'linux': 'Linux',
    'windows': 'Windows',
    'rhel': 'RHEL',
    'suse': 'SUSE'
  };
  var operatingSystem = osMap[platform.toLowerCase()] || 'Linux';

  // Map to GraphQL values
  var termMap = {
    '1yr': '1yr',
    '3yr': '3yr'
  };
  var term = termMap[purchaseTerm] || '1yr';
  
  var classMap = {
    'standard': 'standard',
    'convertible': 'convertible'
  };
  var riClass = classMap[offeringClass] || 'standard';
  
  // Translate payment option to API format
  var payment = translatePaymentOptionToAPI(paymentOption);

  // Build aliases for each instance type
  // Use specific filters for reserved pricing
  var aliases = instanceTypes.map(function(type, i) {
    var safeAlias = 'inst_' + type.replace(/\./g, '_').replace(/-/g, '_');
    return `
      ${safeAlias}: products(
        filter: {
          vendorName: "aws"
          service: "AmazonEC2"
          productFamily: "Compute Instance"
          region: "${region}"
          attributeFilters: [
            { key: "instanceType", value: "${type}" }
            { key: "operatingSystem", value: "${operatingSystem}" }
            { key: "tenancy", value: "Shared" }
            { key: "preInstalledSw", value: "NA" }
            { key: "operation", value: "RunInstances" }
          ]
        }
      ) {
        prices(
          filter: {
            purchaseOption: "reserved"
            termLength: "${term}"
            termOfferingClass: "${riClass}"
            termPurchaseOption: "${payment}"
          }
        ) {
          USD
        }
      }
    `;
  });
  
  var query = `{ ${aliases.join('\n')} }`;
  
  Logger.log(`Batched AWS EC2 reserved pricing query for ${instanceTypes.length} instances`);
  
  try {
    var json = cachedGraphQL(query);
    var priceMap = {};
    
    // Parse results from batched response
    instanceTypes.forEach(function(type, i) {
      var safeAlias = 'inst_' + type.replace(/\./g, '_').replace(/-/g, '_');
      var productData = json.data[safeAlias];
      
      if (productData && productData.length > 0) {
        var product = productData[0];
        if (product.prices && product.prices.length > 0) {
          priceMap[type] = parseFloat(product.prices[0].USD);
        }
      }
    });
    
    return priceMap;
    
  } catch (err) {
    Logger.log(`Batched reserved pricing query failed: ${err}`);
    return {};
  }
}

/**
 * Fetch committed use discounts for multiple GCP instances in a single batch
 * 
 * @param {Array<string>} instanceTypes - Array of machine types
 * @param {string} region - GCP region
 * @param {string} purchaseTerm - 1yr or 3yr
 * @return {Object} Map of machineType -> price
 */
function fetchGCPComputeReservedPriceGraphQLBatched(instanceTypes, region, purchaseTerm) {
  var termMap = {
    '1yr': '1yr',
    '3yr': '3yr'
  };
  var term = termMap[purchaseTerm] || '1yr';

  // Build aliases for each machine type
  var aliases = instanceTypes.map(function(type, i) {
    var safeAlias = 'inst_' + type.replace(/-/g, '_');
    return `
      ${safeAlias}: products(
        filter: {
          vendorName: "gcp"
          service: "Compute Engine"
          productFamily: "Compute Instance"
          region: "${region}"
          attributeFilters: [
            { key: "machineType", value: "${type}" }
          ]
        }
      ) {
        prices(
          filter: {
            purchaseOption: "reserved"
            termLength: "${term}"
          }
        ) {
          USD
        }
      }
    `;
  });
  
  var query = `{ ${aliases.join('\n')} }`;
  
  Logger.log(`Batched GCP committed use discount query for ${instanceTypes.length} instances`);
  
  try {
    var json = cachedGraphQL(query);
    var priceMap = {};
    
    // Parse results from batched response
    instanceTypes.forEach(function(type, i) {
      var safeAlias = 'inst_' + type.replace(/-/g, '_');
      var productData = json.data[safeAlias];
      
      if (productData && productData.length > 0) {
        var product = productData[0];
        if (product.prices && product.prices.length > 0) {
          priceMap[type] = parseFloat(product.prices[0].USD);
        }
      }
    });
    
    return priceMap;
    
  } catch (err) {
    Logger.log(`Batched GCP reserved pricing query failed: ${err}`);
    return {};
  }
}

