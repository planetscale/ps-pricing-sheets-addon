/**
 * GraphQL client for Infracost Cloud Pricing API
 * https://www.infracost.io/docs/supported_resources/cloud_pricing_api/
 */

/**
 * Execute a GraphQL query with automatic caching based on query hash
 *
 * @param {string} query - GraphQL query string
 * @param {number} ttl - Cache time-to-live in seconds (default: 86400 = 24 hours)
 * @return {object} Parsed JSON response from API
 */
function cachedGraphQL(query, ttl) {
  ttl = ttl || 86400; // 24 hours default

  // Generate cache key from query hash + cache version
  var cacheVersion = PropertiesService.getScriptProperties().getProperty('cacheVersion') || '0';
  var queryWithVersion = cacheVersion + '::' + query;
  
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, queryWithVersion);
  var cacheKey = digest.map(function (byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('').substring(0, 32); // MD5 hash as hex string

  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);

  if (cached) {
    Logger.log("GraphQL: Returning cached response");
    return JSON.parse(cached);
  }

  Logger.log("GraphQL: Cache miss, fetching from API");
  
  // Get API key from script properties
  var apiKey = PropertiesService.getScriptProperties().getProperty('infracost_api_key');
  if (!apiKey) {
    throw 'Missing infracost_api_key in script properties. Please set it in the Script Properties.';
  }

  var options = {
    method: "post",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify({ query: query })
  };

  var response = UrlFetchApp.fetch("https://pricing.api.infracost.io/graphql", options);
  var responseText = response.getContentText();
  
  Logger.log('═══════════════════════════════════════════════════');
  Logger.log('GRAPHQL API RESPONSE - FULL RESPONSE');
  Logger.log('═══════════════════════════════════════════════════');
  Logger.log('Response code: ' + response.getResponseCode());
  Logger.log('Response text length: ' + responseText.length + ' characters');
  Logger.log('');
  Logger.log('FULL RESPONSE JSON:');
  Logger.log(responseText);
  Logger.log('═══════════════════════════════════════════════════');
  
  var json = JSON.parse(responseText);

  // Check for GraphQL errors
  if (json.errors) {
    Logger.log('❌ GraphQL returned errors:');
    Logger.log(JSON.stringify(json.errors, null, 2));
    throw `GraphQL API error: ${JSON.stringify(json.errors)}`;
  }
  
  // Log parsed structure
  Logger.log('');
  Logger.log('PARSED RESPONSE STRUCTURE:');
  if (json.data && json.data.products) {
    Logger.log('Number of products: ' + json.data.products.length);
    if (json.data.products.length > 0) {
      Logger.log('');
      Logger.log('FIRST PRODUCT DETAILS:');
      Logger.log(JSON.stringify(json.data.products[0], null, 2));
    }
  } else {
    Logger.log('No products in response!');
    Logger.log('Response structure: ' + JSON.stringify(json, null, 2));
  }
  Logger.log('═══════════════════════════════════════════════════');

  cache.put(cacheKey, JSON.stringify(json), ttl);
  return json;
}

/**
 * Fetch AWS EC2 instance pricing data from GraphQL API
 * 
 * @param {Array<string>} instanceTypes - Array of instance types to fetch
 * @param {string} region - AWS region
 * @param {string} platform - Operating system (linux, windows, etc.)
 * @return {Array<object>} Array of instance pricing objects
 */
/**
 * Translate payment option from our format to Infracost API format
 * @param {string} paymentOption - no_upfront, partial_upfront, all_upfront
 * @return {string} API format - "No Upfront", "Partial Upfront", "All Upfront"
 */
function translatePaymentOptionToAPI(paymentOption) {
  var map = {
    'no_upfront': 'No Upfront',
    'partial_upfront': 'Partial Upfront',
    'all_upfront': 'All Upfront'
  };
  return map[paymentOption] || 'No Upfront';
}

/**
 * Build list of potential GCP machine type names for lookup, including variants
 * that append storage suffixes (e.g., -highlssd).
 * @param {string} machineType
 * @return {Array<string>}
 */
function getGCPMachineTypeCandidates(machineType) {
  var candidates = [machineType];

  if (machineType.indexOf('lssd') === -1 && machineType.indexOf('z3-') === 0) {
    candidates.push(machineType + '-highlssd');
    candidates.push(machineType + '-standardlssd');
    candidates.push(machineType + '-lssd');
  }

  // Deduplicate while preserving order
  var unique = [];
  var seen = {};
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    if (!seen[candidate]) {
      unique.push(candidate);
      seen[candidate] = true;
    }
  }

  return unique;
}

/**
 * Escape a string for safe use inside a regular expression
 * @param {string} value
 * @return {string}
 */
/**
 * Get the correct operation and usagetype filters based on purchase type
 * @param {string} purchaseType - ondemand or reserved
 * @param {string} instanceType - e.g., m5.xlarge
 * @param {object} options - Optional: purchaseTerm, offeringClass, paymentOption
 * @return {object} Object with operation and usagetype values
 */
function getAWSPurchaseTypeFilters(purchaseType, instanceType, options) {
  purchaseType = (purchaseType || 'ondemand').toLowerCase();
  options = options || {};
  
  var filters = {
    operation: 'RunInstances',
    usagetype: null
  };
  
  switch (purchaseType) {
    case 'ondemand':
      filters.operation = 'RunInstances';
      // TODO: UsageType may vary by region - needs investigation
      // Temporarily disabled until we confirm the pattern for all regions
      // filters.usagetype = 'BoxUsage:' + instanceType;
      filters.usagetype = null;  // Search logic will find correct product
      break;
      
    case 'reserved':
      filters.operation = 'RunInstances';
      // Construct reserved instance usagetype based on term/class/payment
      // Pattern: HeavyUsage:instanceType or specific variant based on options
      // Adapting from instances.js getHourlyCostEC2 logic
      if (options.purchaseTerm && options.offeringClass && options.paymentOption) {
        var k = '';
        switch (options.purchaseTerm) {
          case '3yr':
            k = '3yr';
            break;
          default:
            k = '1yr';
        }
        
        switch (options.offeringClass) {
          case 'convertible':
            k += 'Convertible';
            break;
          default:
            k += 'Standard';
        }
        
        switch (options.paymentOption) {
          case 'all_upfront':
            k += 'AllUpfront';
            break;
          case 'partial_upfront':
            k += 'PartialUpfront';
            break;
          default:
            k += 'NoUpfront';
        }
        
        // Pattern examples: HeavyUsage:m5.xlarge:1yrStandardNoUpfront
        // TODO: May need region prefix like reserved instances
        // filters.usagetype = 'HeavyUsage:' + instanceType + ':' + k;
        filters.usagetype = null;  // Temporarily disabled - search logic will find correct product
      } else {
        // If options not provided, don't filter on usagetype
        filters.usagetype = null;
      }
      break;
      
    default:
      // Default to on-demand
      filters.operation = 'RunInstances';
      filters.usagetype = null;
  }
  
  return filters;
}

/**
 * Fetch AWS EC2 instance pricing data from GraphQL API
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
function fetchAWSEC2GraphQL(instanceTypes, region, platform, purchaseType, purchaseTerm, offeringClass, paymentOption) {
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

  var results = [];
  
  // Query each instance type
  for (var i = 0; i < instanceTypes.length; i++) {
    var instanceType = instanceTypes[i];
    
    // Get purchase-type specific filters
    var purchaseFilters = getAWSPurchaseTypeFilters(purchaseType, instanceType, {
      purchaseTerm: purchaseTerm,
      offeringClass: offeringClass,
      paymentOption: paymentOption
    });
    
    // Build attribute filters array
    var attributeFilters = [
      '{ key: "instanceType", value: "' + instanceType + '" }',
      '{ key: "operatingSystem", value: "' + operatingSystem + '" }',
      '{ key: "tenancy", value: "Shared" }',
      '{ key: "preInstalledSw", value: "NA" }'
    ];
    
    // Add operation filter if specified
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
        // Add specific reserved options if provided
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
    
    var query = `{
      products(
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
    }`;

    Logger.log('');
    Logger.log('───────────────────────────────────────────────────');
    Logger.log(`QUERY FOR: ${instanceType} in ${region} (${operatingSystem})`);
    Logger.log('───────────────────────────────────────────────────');
    Logger.log('GraphQL Query:');
    Logger.log(query);
    Logger.log('───────────────────────────────────────────────────');

    try {
      var json = cachedGraphQL(query);
      
      if (json.data.products && json.data.products.length > 0) {
        Logger.log(`INFO: Found ${json.data.products.length} products for ${instanceType}`);
        
        // Find the product with valid pricing for the requested purchase type
        var product = null;
        var priceValue = null;
        
        for (var j = 0; j < json.data.products.length; j++) {
          var candidate = json.data.products[j];
          
          // Check if this product has pricing
          if (candidate.prices && candidate.prices.length > 0) {
            var candidatePrice = parseFloat(candidate.prices[0].USD);
            
            if (candidatePrice && candidatePrice > 0) {
              Logger.log(`INFO: Product [${j}] has valid ${purchaseType} price: $${candidatePrice}`);
              product = candidate;
              priceValue = candidatePrice;
              break; // Found a good one!
            } else {
              Logger.log(`INFO: Product [${j}] has price ${candidatePrice} - skipping`);
            }
          } else {
            Logger.log(`INFO: Product [${j}] has no prices - skipping`);
          }
        }
        
        if (!product) {
          Logger.log(`ERROR: Found ${json.data.products.length} products but none have valid ${purchaseType} pricing`);
          Logger.log(`First product details: ${JSON.stringify(json.data.products[0])}`);
          continue; // Skip this instance type
        }
        
        Logger.log(`SUCCESS: Using product with ${purchaseType} price $${priceValue}`);
        
        var attributes = {};
        
        // Convert attributes array to object
        product.attributes.forEach(function(attr) {
          attributes[attr.key] = attr.value;
        });

        // Build pricing structure based on purchase type
        Logger.log(`DEBUG: Building pricing structure for purchaseType="${purchaseType}"`);
        Logger.log(`DEBUG: Parameters - term: ${purchaseTerm}, class: ${offeringClass}, payment: ${paymentOption}`);
        
        var pricingObj = {};
        
        if (purchaseType === 'ondemand') {
          Logger.log(`DEBUG: Storing as ondemand`);
          pricingObj.ondemand = priceValue;
        } else if (purchaseType === 'reserved') {
          Logger.log(`DEBUG: Storing as reserved`);
          // For reserved, store in reserved structure
          pricingObj.ondemand = null; // No on-demand in this query
          pricingObj.reserved = {};
          
          if (priceValue && purchaseTerm && offeringClass && paymentOption) {
            var reservedKey = buildReservedPricingKey(purchaseTerm, offeringClass, paymentOption);
            pricingObj.reserved[reservedKey] = priceValue;
            Logger.log(`DEBUG: Stored reserved price in key: ${reservedKey} = $${priceValue}`);
          } else {
            Logger.log(`WARNING: Reserved price found but missing parameters to build key`);
            Logger.log(`  purchaseTerm: ${purchaseTerm}, offeringClass: ${offeringClass}, paymentOption: ${paymentOption}`);
          }
        } else {
          Logger.log(`DEBUG: Storing as ondemand (default fallback for purchaseType=${purchaseType})`);
          // Default fallback
          pricingObj.ondemand = priceValue;
        }
        
        Logger.log(`DEBUG: Final pricingObj: ${JSON.stringify(pricingObj)}`);
        
        var instanceObj = {
          instance_type: instanceType,
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
        Logger.log(`WARNING: No product data found for ${instanceType} in ${region} (${platform})`);
        Logger.log(`Query was: ${query.substring(0, 200)}...`);
      }
    } catch (err) {
      Logger.log(`Error fetching ${instanceType}: ${err}`);
      Logger.log(`Stack: ${err.stack}`);
      // Continue with other instances
    }
  }

  return results;
}

/**
 * Build the reserved pricing key (same pattern as instances.js)
 */
function buildReservedPricingKey(purchaseTerm, offeringClass, paymentOption) {
  var k = '';
  
  switch (purchaseTerm) {
    case '3yr':
      k = 'yrTerm3';
      break;
    default:
      k = 'yrTerm1';
  }
  
  switch (offeringClass) {
    case 'convertible':
      k += 'Convertible.';
      break;
    default:
      k += 'Standard.';
  }
  
  switch (paymentOption) {
    case 'all_upfront':
      k += 'allUpfront';
      break;
    case 'partial_upfront':
      k += 'partialUpfront';
      break;
    default:
      k += 'noUpfront';
  }
  
  return k;
}

/**
 * Parse storage information from instance attributes
 */
function parseInstanceStorage(attributes) {
  if (!attributes.storage || attributes.storage === 'EBS only') {
    return null;
  }
  
  // Parse strings like "1 x 150 NVMe SSD" or "2 x 1900 NVMe SSD"
  var match = attributes.storage.match(/(\d+)\s*x\s*(\d+)/);
  if (match) {
    return {
      devices: parseInt(match[1]),
      size: parseInt(match[2])
    };
  }
  
  return null;
}

/**
 * Fetch AWS EC2 reserved instance pricing
 * 
 * @param {string} instanceType - Instance type
 * @param {string} region - AWS region  
 * @param {string} platform - Operating system
 * @param {string} purchaseTerm - 1yr or 3yr
 * @param {string} offeringClass - standard or convertible
 * @param {string} paymentOption - no_upfront, partial_upfront, all_upfront
 * @return {number} Hourly price
 */
function fetchAWSEC2ReservedPriceGraphQL(instanceType, region, platform, purchaseTerm, offeringClass, paymentOption) {
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

  // Use specific filters for reserved pricing
  var query = `{
    products(
      filter: {
        vendorName: "aws"
        service: "AmazonEC2"
        productFamily: "Compute Instance"
        region: "${region}"
        attributeFilters: [
          { key: "instanceType", value: "${instanceType}" }
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
  }`;

  var json = cachedGraphQL(query);
  
  if (json.data.products && json.data.products.length > 0) {
    var product = json.data.products[0];
    if (product.prices && product.prices.length > 0) {
      return parseFloat(product.prices[0].USD);
    }
  }
  
  return null;
}

/**
 * Get GCP CUD discount percentage
 * GCP committed-use discounts are not available through the API,
 * so we apply fixed discount percentages to on-demand pricing
 * 
 * @param {string} purchaseTerm - 1yr or 3yr
 * @param {string} cudType - flexi or resource
 * @return {number} Discount as decimal (e.g., 0.18 for 18%)
 */
function getGCPCUDDiscount(purchaseTerm, cudType) {
  // GCP CUD discount rates (hardcoded as API doesn't provide them)
  var discounts = {
    '1yr': {
      'flexi': 0.18,      // 18%
      'resource': 0.37    // 37%
    },
    '3yr': {
      'flexi': 0.46,      // 46%
      'resource': 0.55    // 55%
    }
  };
  
  var term = (purchaseTerm === '3yr') ? '3yr' : '1yr';
  var type = (cudType === 'resource') ? 'resource' : 'flexi';
  
  return discounts[term][type] || 0;
}

/**
 * Fetch GCP Compute instance pricing data from GraphQL API
 * NOW USES SAME STRUCTURE AS AWS for consistency
 * 
 * For committed-use: fetches on-demand pricing and applies hardcoded discount
 * 
 * @param {Array<string>} instanceTypes - Array of machine types to fetch
 * @param {string} region - GCP region
 * @param {string} purchaseType - ondemand, preemptible, or committed-use
 * @param {string} purchaseTerm - 1yr or 3yr (for committed-use)
 * @param {string} cudType - flexi or resource (for committed-use)
 * @return {Array<object>} Array of instance pricing objects
 */
function fetchGCPComputeGraphQL(instanceTypes, region, purchaseType, purchaseTerm, cudType) {
  purchaseType = purchaseType || 'ondemand';
  cudType = cudType || 'flexi';
  
  var results = [];
  
  for (var i = 0; i < instanceTypes.length; i++) {
    var machineType = instanceTypes[i];
    var candidates = getGCPMachineTypeCandidates(machineType);
    var matchedProduct = null;
    var matchedAttributes = {};
    var matchedTypeName = null;
    var priceValue = null;
    
    for (var c = 0; c < candidates.length; c++) {
      var candidateType = candidates[c];
      
      // Build price filter based on purchase type
      // For committed-use: fetch on-demand and apply discount in code
      var priceFilterParts = [];
      
      if (purchaseType === 'committed-use' || purchaseType === 'committed') {
        Logger.log(`Fetching on-demand pricing for ${candidateType}, will apply ${cudType} CUD discount`);
        priceFilterParts.push('purchaseOption: "on_demand"');
      } else if (purchaseType === 'preemptible') {
        priceFilterParts.push('purchaseOption: "preemptible"');
      } else {
        // ondemand
        priceFilterParts.push('purchaseOption: "on_demand"');
      }
      
      var priceFilter = priceFilterParts.length > 0 ? 
        'filter: { ' + priceFilterParts.join(', ') + ' }' : '';
    
    var query = `{
      products(
        filter: {
          vendorName: "gcp"
          service: "Compute Engine"
          productFamily: "Compute Instance"
          region: "${region}"
          attributeFilters: [
              { key: "machineType", value: "${candidateType}" }
          ]
        }
      ) {
        attributes { key value }
          prices(${priceFilter}) {
          USD
        }
      }
    }`;

    try {
      var json = cachedGraphQL(query);
      
      if (json.data.products && json.data.products.length > 0) {
          Logger.log(`INFO: Found ${json.data.products.length} GCP products for ${candidateType}`);
          
          for (var j = 0; j < json.data.products.length; j++) {
            var candidateProduct = json.data.products[j];
            
            if (candidateProduct.prices && candidateProduct.prices.length > 0) {
              var candidatePrice = parseFloat(candidateProduct.prices[0].USD);
              
              if (candidatePrice && candidatePrice > 0) {
                Logger.log(`INFO: GCP Product [${j}] has valid ${purchaseType} price: $${candidatePrice}`);
                matchedProduct = candidateProduct;
                priceValue = candidatePrice;
                matchedTypeName = candidateType;
                break;
              }
            }
          }
          
          if (matchedProduct) {
            matchedProduct.attributes.forEach(function(attr) {
              matchedAttributes[attr.key] = attr.value;
            });
            break;
          }
        }
        
        Logger.log(`INFO: No valid pricing found for candidate ${candidateType}, trying next option if available...`);
      } catch (err) {
        Logger.log(`Error fetching ${candidateType}: ${err}`);
      }
    }
    
    if (!matchedProduct) {
      Logger.log(`ERROR: Unable to find ${purchaseType} pricing for ${machineType} in ${region}`);
      continue;
    }
    
    // Parse vCPU and memory from machine type name (GCP doesn't return these in attributes)
    var specs = parseGCPMachineType(matchedTypeName || machineType, matchedAttributes);

    // Build pricing structure - NOW USING SAME FORMAT AS AWS
    var pricingObj = {};
    
    if (purchaseType === 'committed-use' || purchaseType === 'committed') {
      // Apply CUD discount to on-demand price
      var discount = getGCPCUDDiscount(purchaseTerm, cudType);
      var cudPrice = priceValue * (1 - discount);
      
      Logger.log(`Applying ${cudType} CUD discount: ${(discount * 100).toFixed(0)}% off $${priceValue} = $${cudPrice.toFixed(6)}`);
      
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
          instance_type: machineType,
      resolved_machine_type: matchedTypeName || machineType,
      vCPU: specs.cores,
      memory: specs.memory,
      pricing: {
            [region]: {
          "linux": pricingObj  // GCP instances are Linux
            }
          }
        };

        results.push(instanceObj);
  }

  return results;
}

/**
 * Parse GCP machine type to extract cores and memory
 */
function parseGCPMachineType(machineType, attributes) {
  // Try to get from attributes first
  var cores = parseFloat(attributes.vCPUs) || parseFloat(attributes.vcpu) || 0;
  var memory = parseFloat(attributes.memory) || 0;
  
  // If not in attributes, try to parse from machine type name
  // Format: family-type-size (e.g., n2-standard-4, n2-highmem-8)
  if (cores === 0) {
    var parts = machineType.split('-');
    if (parts.length >= 3) {
      var size = 0;
      for (var idx = parts.length - 1; idx >= 0; idx--) {
        var parsedSize = parseInt(parts[idx], 10);
        if (!isNaN(parsedSize)) {
          size = parsedSize;
          break;
        }
      }

      if (size > 0) {
        cores = size;
        
        // Estimate memory based on type
        var type = parts[1];
        if (type === 'standard') {
          memory = size * 4; // 4GB per vCPU
        } else if (type === 'highmem') {
          memory = size * 8; // 8GB per vCPU
        } else if (type === 'highcpu') {
          memory = size * 0.9; // 0.9GB per vCPU
        }
      }
    }
  }
  
  return {
    cores: cores,
    memory: memory
  };
}

/**
 * Fetch GCP Compute reserved pricing (committed use discounts)
 */
function fetchGCPComputeReservedPriceGraphQL(machineType, region, purchaseTerm) {
  var termMap = {
    '1yr': '1yr',
    '3yr': '3yr'
  };
  var term = termMap[purchaseTerm] || '1yr';

  var query = `{
    products(
      filter: {
        vendorName: "gcp"
        service: "Compute Engine"
        productFamily: "Compute Instance"
        region: "${region}"
        attributeFilters: [
          { key: "machineType", value: "${machineType}" }
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
  }`;

  var json = cachedGraphQL(query);
  
  if (json.data.products && json.data.products.length > 0) {
    var product = json.data.products[0];
    if (product.prices && product.prices.length > 0) {
      return parseFloat(product.prices[0].USD);
    }
  }
  
  return null;
}

/**
 * Fetch GCP Local SSD pricing from GraphQL API
 * 
 * @param {string} region - GCP region
 * @return {object} Local SSD pricing per GB-month
 */
function fetchGCPLocalSSDGraphQL(region) {
  var query = `{
    products(
      filter: {
        vendorName: "gcp"
        service: "Compute Engine"
        region: "${region}"
        attributeFilters: [
          { key: "resourceGroup", value: "LocalSSD" }
        ]
      }
    ) {
      attributes { key value }
      prices(filter: { purchaseOption: "OnDemand" }) {
        USD
      }
    }
  }`;

  var json = cachedGraphQL(query);
  
  // Find the generic Local SSD pricing (not family-specific)
  var genericLocalSsd = null;
  
  if (json.data.products && json.data.products.length > 0) {
    for (var i = 0; i < json.data.products.length; i++) {
      var product = json.data.products[i];
      var descAttr = product.attributes.find(function(a) { return a.key === 'description'; });
      var desc = descAttr ? descAttr.value : '';
      
      // Find generic "SSD backed Local Storage" price
      if (desc.indexOf('SSD backed Local Storage') === 0 &&
          desc.indexOf('Preemptible') === -1 &&
          desc.indexOf('Reserved') === -1 &&
          product.prices && product.prices.length > 0) {
        genericLocalSsd = parseFloat(product.prices[0].USD);
        break;
      }
    }
  }
  
  return {
    localssd: {
      fixedPricePerTBMonth: genericLocalSsd ? genericLocalSsd * 1024 : 81.920 // Fallback to hardcoded if not found
    }
  };
}

/**
 * Fetch AWS EBS volume pricing data from GraphQL API
 * 
 * @param {string} region - AWS region
 * @param {string} volumeType - Volume type (gp3, io2, etc.)
 * @return {object} Volume pricing object
 */
function fetchAWSEBSGraphQL(region, volumeType) {
  var volumeTypeMap = {
    'gp3': 'gp3',
    'gp2': 'gp2',
    'io2': 'io2',
    'io1': 'io1',
    'st1': 'st1',
    'sc1': 'sc1'
  };
  var apiVolumeType = volumeTypeMap[volumeType.toLowerCase()] || volumeType;

  // Query for storage price
  var storageQuery = `{
    products(
      filter: {
        vendorName: "aws"
        service: "AmazonEC2"
        productFamily: "Storage"
        region: "${region}"
        attributeFilters: [
          { key: "volumeApiName", value: "${apiVolumeType}" }
        ]
      }
    ) {
      prices(filter: { purchaseOption: "on_demand" }) {
        USD
      }
    }
  }`;

  var result = {
    rzCode: region,
    ebs_prices: {
      [volumeType]: {}
    }
  };

  try {
    var storageJson = cachedGraphQL(storageQuery);
    if (storageJson.data.products && storageJson.data.products.length > 0) {
      var storagePrice = parseFloat(storageJson.data.products[0].prices[0].USD);
      result.ebs_prices[volumeType].pricePerGBMonth = { USD: storagePrice.toString() };
    }

    // For gp3 and io2, also fetch IOPS pricing
    if (volumeType === 'gp3' || volumeType === 'io2') {
      var iopsQuery = `{
        products(
          filter: {
            vendorName: "aws"
            service: "AmazonEC2"
            productFamily: "System Operation"
            region: "${region}"
            attributeFilters: [
              { key: "volumeApiName", value: "${apiVolumeType}" }
              { key: "group", value: "EBS IOPS" }
            ]
          }
        ) {
          prices(filter: { purchaseOption: "on_demand" }) {
            USD
          }
        }
      }`;

      var iopsJson = cachedGraphQL(iopsQuery);
      if (iopsJson.data.products && iopsJson.data.products.length > 0) {
        var iopsPrice = parseFloat(iopsJson.data.products[0].prices[0].USD);
        result.ebs_prices[volumeType].pricePerIOPSMonth = { USD: iopsPrice.toString() };
      }
    }

    // For io2, fetch tiered IOPS pricing if available
    if (volumeType === 'io2') {
      // io2 has tiered pricing, but for simplicity using the base price
      // Can be enhanced later to fetch all tiers
      result.ebs_prices[volumeType].pricePerTier1IOPSMonth = result.ebs_prices[volumeType].pricePerIOPSMonth;
      result.ebs_prices[volumeType].pricePerTier2IOPSMonth = result.ebs_prices[volumeType].pricePerIOPSMonth;
      result.ebs_prices[volumeType].pricePerTier3IOPSMonth = result.ebs_prices[volumeType].pricePerIOPSMonth;
    }

  } catch (err) {
    Logger.log(`Error fetching EBS pricing for ${volumeType} in ${region}: ${err}`);
  }

  return result;
}

