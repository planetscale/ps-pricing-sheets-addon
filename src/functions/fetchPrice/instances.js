function fetchSingleInstancePrice(cloudProvider, cloudProduct, instanceType, options) {
  if(!instanceType) throw 'Missing instanceType';
  validateInstanceOptions(cloudProvider, cloudProduct, options);

  const prod = fetchProducts(cloudProduct, [instanceType], options);
  
  if(prod.length === 0) {
    throw `No data returned for ${instanceType}. Please check:\n` +
          `1. Instance type is spelled correctly\n` +
          `2. Instance type exists in region ${options.region}\n` +
          `3. Your infracost_api_key is valid\n` +
          `4. Check execution logs for more details`;
  }
  
  if(prod.length > 1) {
    throw 'Search returned more than one product. Please check the instance type and try again.';
  }
  
  // Log the product structure for debugging
  // Both AWS and GCP now use unified 'pricing' structure
  if (!prod[0].pricing || !prod[0].pricing[options.region]) {
    Logger.log(`DEBUG: Product structure for ${instanceType}:`);
    Logger.log(JSON.stringify(prod[0], null, 2));
    throw `Product data exists but pricing is incomplete for ${instanceType} in ${options.region}. Check execution logs for details.`;
  }
  
  let price = getHourlyCost(cloudProduct, prod[0], options);
  
  if (!price) {
    Logger.log(`DEBUG: getHourlyCost returned null for ${instanceType}`);
    Logger.log(`Options: ${JSON.stringify(options)}`);
    Logger.log(`Product: ${JSON.stringify(prod[0])}`);
    
    throw `Price for ${instanceType} returned null. Please check your options and try again. See execution logs for details.`;
  }
  
  return price;

}

function fetchRegionalInstanceMatrix(cloudProvider, cloudProduct, options) {
  Logger.log(`DEBUG: fetchRegionalInstanceMatrix called with purchaseType="${options.purchaseType}"`);
  Logger.log(`DEBUG: Options: ${JSON.stringify(options)}`);
  
  validateInstanceOptions(cloudProvider, cloudProduct, options);

  let instanceTypes = [];
  let allProducts = fetchProducts(cloudProduct, instanceTypes, options);
  
  Logger.log(`DEBUG: fetchProducts returned ${allProducts.length} products`);

  // sort results "logically"
  allProducts = allProducts.sort(function (a,b) { 
    if (a.instance_family > b.instance_family) return -1;
    if (a.instance_family < b.instance_family) return 1;

    if (parseFloat(a.vCPU) > parseFloat(b.vCPU)) return -1;
    if (parseFloat(a.vCPU) < parseFloat(b.vCPU)) return 1;

    if (parseInt(a.memory) > parseInt(b.memory)) return -1;
    if (parseInt(a.memory) < parseInt(b.memory)) return 1;
  });

  // header row
  var results = [];
  results.push([
    'Instance Type', 
    'Cloud Provider', 
    'Region', 
    'PS Instance Class', 
    'vCPU\'s', 
    'Memory (GB)',
    'On-board Storage',
    'Hourly Cost',
    'Monthly Cost'
  ]);

  for (var i = allProducts.length - 1; i >= 0; i--) {
    var prodResult = [];
    
    var prod_price = getHourlyCost(cloudProduct, allProducts[i], options);
    
    if (!prod_price) {
      Logger.log(`DEBUG: Skipping ${allProducts[i].instance_type} - no price for purchaseType=${options.purchaseType}`);
      continue;
    }
    
    var prod_monthly_price = prod_price * cfg.hoursPerMonth;

    // Instance Type
    prodResult.push(allProducts[i].instance_type);
    // Cloud Provider
    prodResult.push(cloudProvider);
    // Region
    prodResult.push(options.region);
    // PlanetScale Instance Class
    prodResult.push(allProducts[i].ps_instance_class);
    // vCPU's
    prodResult.push(parseFloat(allProducts[i].vCPU));
    // Memory (GB)
    prodResult.push(parseInt(allProducts[i].memory));
    // On-board Storage (GB) - this only works for AWS/PSDB instances.
    if(!allProducts[i].onboard_storage){
      prodResult.push('');
    }else{
      prodResult.push(parseInt(allProducts[i].onboard_storage));
    }
    // Hourly Cost
    prodResult.push(prod_price);
    // Monthly Cost
    prodResult.push(prod_monthly_price);

    // Provider Instance Type
    prodResult.push(allProducts[i].provider_instance_type);


    results.push(prodResult);
  }

  return results;

}

function validateInstanceOptions(cloudProvider, cloudProduct, options) {
  const supp = cfg.supportedProviders;

  if (!supp[cloudProvider]) throw `Currently unsupported Cloud Provider: ${cloudProvider}`;
  if (!supp[cloudProvider][cloudProduct]) throw `Currently unsupported Cloud Product "${cloudProduct}" for ${cloudProvider}`;
  
  // Treat empty strings as undefined/null
  if (options.purchaseType === '') options.purchaseType = undefined;
  if (options.purchaseTerm === '') options.purchaseTerm = undefined;
  if (options.offeringClass === '') options.offeringClass = undefined;
  if (options.paymentOption === '') options.paymentOption = undefined;
  if (options.platform === '') options.platform = undefined;
  
  if (options.purchaseType && !supp[cloudProvider][cloudProduct].purchaseTypes[options.purchaseType]) throw `Purchase Type "${options.purchaseType}" is not supported for "${cloudProduct}". Supported types: ${JSON.stringify(Object.getOwnPropertyNames(supp[cloudProvider][cloudProduct].purchaseTypes))}`;
  if (options.purchaseTerm && !supp[cloudProvider][cloudProduct].purchaseTypes[options.purchaseType].purchaseTerms) throw `Purchase Term "${options.purchaseTerm}" is not supported for "${options.purchaseType}". Please keep it empty.`;
  if (options.offeringClass && !supp[cloudProvider][cloudProduct].purchaseTypes[options.purchaseType].offeringClasses) throw `Offering Class "${options.purchaseTerm}" is not supported for "${options.purchaseType}". Please keep it empty.`;
  if (options.paymentOption && !supp[cloudProvider][cloudProduct].purchaseTypes[options.purchaseType].paymentOptions) throw `Payment Option "${options.paymentOption}" is not supported for "${options.purchaseType}". Please keep it empty.`;

  if (options.purchaseTerm && !supp[cloudProvider][cloudProduct].purchaseTypes[options.purchaseType].purchaseTerms[options.purchaseTerm]) throw `Purchase Term "${options.purchaseTerm}" is not supported for "${options.purchaseType}". Supported types: ${JSON.stringify(Object.getOwnPropertyNames(supp[cloudProvider][cloudProduct].purchaseTypes[options.purchaseType].purchaseTerms))}`;
  if (options.offeringClass && !supp[cloudProvider][cloudProduct].purchaseTypes[options.purchaseType].offeringClasses[options.offeringClass]) throw `Offering Class "${options.offeringClass}" is not supported for "${options.purchaseType}". Supported types: ${JSON.stringify(Object.getOwnPropertyNames(supp[cloudProvider][cloudProduct].purchaseTypes[options.purchaseType].offeringClasses))}`;
  if (options.paymentOption && !supp[cloudProvider][cloudProduct].purchaseTypes[options.purchaseType].paymentOptions[options.paymentOption]) throw `Offering Class "${options.paymentOption}" is not supported for "${options.purchaseType}". Supported types: ${JSON.stringify(Object.getOwnPropertyNames(supp[cloudProvider][cloudProduct].purchaseTypes[options.purchaseType].paymentOptions))}`;

}

function fetchPSDBRegionsByProvider(cloudProvider) {
  let allRegions = fetchPSDBRegions();

  var results = [];

  for (var i = allRegions.length - 1; i >= 0; i--) {
    if(cloudProvider == allRegions[i].provider.toLowerCase()){
      results.push(allRegions[i].slug);
    }
  }
  return results;
}

function getCloudProviderFromPSDBRegion(region) {
  let allRegions = fetchPSDBRegions();
  let cloudProvider = '';
  for (var i = allRegions.length - 1; i >= 0; i--) {
    if(region == allRegions[i].slug){
      cloudProvider = allRegions[i].provider.toLowerCase();
      break;
    }
  }

  return cloudProvider;
}

function getMonthlyCostPSDB(product, options) {
  var { dataSizeGB, shards, extraReplicas, vtGateOverridePrice, extraVtGateReplicas } = options;

  let result = parseFloat(0);

  result = parseInt(product.rate);
  if(shards>1) {
    let origPrice = parseInt(product.replica_rate) * 3;
    let newPrice = origPrice * shards;
    result = result - origPrice + newPrice;
  }
  if(extraReplicas) {
    result += parseInt(product.replica_rate) * parseInt(extraReplicas);
  }
  if(extraVtGateReplicas) {
    result += parseInt(product.default_vtgate_rate) * parseInt(extraVtGateReplicas);
  }
  if(vtGateOverridePrice > 0) {
    let totalVtGates = 3 + parseInt(extraVtGateReplicas);
    let origVtGatePrice = (product.default_vtgate_rate * shards) / 3 * parseInt(totalVtGates);
    let newVtGatePrice = (vtGateOverridePrice * shards) / 3 * parseInt(totalVtGates);
    result = result - origVtGatePrice + newVtGatePrice;
  }
  if(dataSizeGB>10){
    let dataPrice = (dataSizeGB - 10) * 1.50;
    result += dataPrice;
  }

  return result;
}

function getHourlyCostEC2(product, options) {
  var { region, purchaseType, purchaseTerm, paymentOption, offeringClass, platform } = options;

  Logger.log(`DEBUG: getHourlyCostEC2 for ${product.instance_type}, purchaseType=${purchaseType}`);
  
  let result = parseFloat(0);

  if (!product.pricing) {
    Logger.log(`ERROR: Product ${product.instance_type} has no pricing object`);
    return null;
  }
  
  if (!product.pricing[region]) {
    Logger.log(`ERROR: Product ${product.instance_type} pricing missing region ${region}`);
    Logger.log(`Available regions: ${Object.keys(product.pricing).join(', ')}`);
    return null;
  }
  
  if (!product.pricing[region][platform]) {
    Logger.log(`ERROR: Product ${product.instance_type} pricing missing platform ${platform} in region ${region}`);
    Logger.log(`Available platforms: ${Object.keys(product.pricing[region]).join(', ')}`);
    return null;
  }
  
  Logger.log(`DEBUG: Pricing structure for ${product.instance_type}: ${JSON.stringify(product.pricing[region][platform])}`);
  
  switch (purchaseType) {
  case 'ondemand':
    var ondemandValue = product.pricing[region][platform].ondemand;
    Logger.log(`DEBUG: ondemand value for ${product.instance_type}: ${ondemandValue} (type: ${typeof ondemandValue})`);
    
    if (!ondemandValue && ondemandValue !== 0) {
      Logger.log(`ERROR: No ondemand pricing found for ${product.instance_type} in ${region} (${platform})`);
      return null;
    }
    
    if (ondemandValue === 0) {
      Logger.log(`ERROR: Ondemand price is 0 for ${product.instance_type} in ${region} (${platform}) - this is likely incorrect`);
      return null;
    }
    
    result = parseFloat(ondemandValue);
    break;
  case 'reserved':
    if (!product.pricing[region][platform].reserved) return null;

    let k = '';
    switch (purchaseTerm) {
    case '3yr':
      k = 'yrTerm3';
      break;
    default:
      k = 'yrTerm1';
    }
    switch (offeringClass) {
    case 'convertible':
      k = `${k}Convertible.`;
      break;
    default:
      k = `${k}Standard.`;
    }
    switch (paymentOption) {
    case 'all_upfront':
      k = `${k}allUpfront`;
      break;
    case 'partial_upfront':
      k = `${k}partialUpfront`;
      break;
    default:
      k = `${k}noUpfront`;
    }
    if (!product.pricing[region][platform].reserved[k]) return null;
    result = parseFloat(product.pricing[region][platform].reserved[k]);
    break;
  default:
    return null;
  }

  return result;
}

function getHourlyCostCompute(product, options) {
  var { region, purchaseType, purchaseTerm, cudType } = options;
  cudType = cudType || 'flexi';
  
  Logger.log(`DEBUG: getHourlyCostCompute for ${product.instance_type}, purchaseType=${purchaseType}`);

  let result = parseFloat(0);
  
  // GCP now uses same structure as AWS: pricing[region]["linux"]
  var platform = "linux"; // GCP instances are Linux
  
  if (!product.pricing) {
    Logger.log(`ERROR: Product ${product.instance_type} has no pricing object`);
    return null;
  }
  
  if (!product.pricing[region]) {
    Logger.log(`ERROR: Product ${product.instance_type} pricing missing region ${region}`);
    Logger.log(`Available regions: ${Object.keys(product.pricing).join(', ')}`);
    return null;
  }
  
  if (!product.pricing[region][platform]) {
    Logger.log(`ERROR: Product ${product.instance_type} pricing missing platform ${platform}`);
    Logger.log(`Available platforms: ${Object.keys(product.pricing[region]).join(', ')}`);
    return null;
  }
  
  Logger.log(`DEBUG: Pricing structure for ${product.instance_type}: ${JSON.stringify(product.pricing[region][platform])}`);

  switch (purchaseType) {
  case 'ondemand':
    var ondemandValue = product.pricing[region][platform].ondemand;
    if (!ondemandValue && ondemandValue !== 0) return null;
    if (ondemandValue === 0) return null;
    result = parseFloat(ondemandValue);
    break;
    
  case 'committed-use':
  case 'committed':
    // GCP CUD pricing: applied discount to on-demand in fetchGCPComputeGraphQL
    if (!product.pricing[region][platform].reserved) return null;
    
    // Build key based on term and cudType
    var key = '';
    if (cudType === 'resource') {
      key = purchaseTerm === '3yr' ? 'cud-resource-3y' : 'cud-resource-1y';
    } else {
      key = purchaseTerm === '3yr' ? 'cud-flexi-3y' : 'cud-flexi-1y';
    }
    
    if (!product.pricing[region][platform].reserved[key]) {
      Logger.log(`ERROR: No ${cudType} CUD pricing found for ${purchaseTerm}`);
      return null;
    }
    result = parseFloat(product.pricing[region][platform].reserved[key]);
    break;
    
  case 'preemptible':
    var preemptibleValue = product.pricing[region][platform].preemptible;
    if (!preemptibleValue && preemptibleValue !== 0) return null;
    if (preemptibleValue === 0) return null;
    result = parseFloat(preemptibleValue);
    break;
  }
  
  return result;
}

function getMonthlyCost(cloudProduct, product, options) {
  let result = parseFloat(0);

  switch (cloudProduct) {
  case 'psdb':
    result = getMonthlyCostPSDB(product, options);
    break;
  case 'ec2':
    result = getHourlyCostEC2(product, options) * cfg.hoursPerMonth;
    break;
  case 'compute':
    result = getHourlyCostCompute(product, options) * cfg.hoursPerMonth;
    break;
  default:
    return null;
  }

  return result;
}

function getHourlyCost(cloudProduct, product, options) {
  let result = parseFloat(0);

  switch (cloudProduct) {
  case 'psdb':
    result = getMonthlyCostPSDB(product, options) / cfg.hoursPerMonth;
    break;
  case 'ec2':
    result = getHourlyCostEC2(product, options);
    break;
  case 'compute':
    result = getHourlyCostCompute(product, options);
    break;
  default:
    return null;
  }

  return result;
}