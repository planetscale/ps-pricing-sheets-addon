function fetchSingleInstancePrice(cloudProvider, cloudProduct, instanceType, options) {
  if(!instanceType) throw 'Missing instanceType';
  validateInstanceOptions(cloudProvider, cloudProduct, options);

  const prod = fetchProducts(cloudProduct, [instanceType], options);
  if(prod.length > 1) throw 'Search returned more than one product. Please check the instance type and try again.';
  let price = getHourlyCost(cloudProduct, prod[0],options);
  if (!price) throw `Price for ${instanceType} returned null. Please check your options and try again.`;
  
  return price;

}

function fetchRegionalInstanceMatrix(cloudProvider, cloudProduct, options) {
  validateInstanceOptions(cloudProvider, cloudProduct, options);

  let instanceTypes = [];
  let allProducts = fetchProducts(cloudProduct, instanceTypes, options);

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
    var prod_monthly_price = prod_price * cfg.hoursPerMonth;
    if (!prod_price) continue;

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

  let result = parseFloat(0);

  if (!product.pricing) return null;
  switch (purchaseType) {
  case 'ondemand':
    if (!product.pricing[region][platform].ondemand) return null;
      result = parseFloat(product.pricing[region][platform].ondemand);
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
  var { region, purchaseType, purchaseTerm  } = options;

  let result = parseFloat(0);
  //Logger.log(`getHourlyCostCompute: ${JSON.stringify(product)}`);

  switch (purchaseType) {
  case 'ondemand':
    //Logger.log(JSON.stringify(product));
    if (!product.regions[region].ondemand) return null;
    result = parseFloat(product.regions[region].ondemand);
    break;
  case 'committed-use':
    let k = ''
    switch (purchaseTerm) {
    case '3yr':
      k = 'cud-3y';
      break;
    default:
      k = 'cud-1y';
    }
    if (!product.regions[region][k]) return null;
    result = parseFloat(product.regions[region][k]);
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