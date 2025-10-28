function fetchSingleVolumePrice(cloudProvider, cloudProduct, options) {
  if(!options.region) throw 'Missing region';
  if(!parseFloat(options.volumeSize)) throw 'Unable to parse volume units';
  validateVolumeOptions(cloudProvider, cloudProduct, options);

  let allRegions = [];

  let prod;
  switch (cloudProduct){
  case 'ebs':
    try{
      prod = fetchProducts(cloudProduct, [options.region]);
      if(prod.length > 1) throw 'Search returned more than one region. Please check the region and try again.';
    }catch(err){
      throw `Failed to query FireStore. ${err}`;
    }
  break;
  case 'gcs':
    // Need to API this eventually
    prod = [{ 
      localssd: {
        fixedPricePerTBMonth: 81.920,
      }
    }];
  break;
  }

  return getVolumePrice(cloudProduct, prod[0], options);
}

function getVolumePrice(cloudProduct, product, options) {
  var { volumeType, storageType, volumeSize, region } = options;

  let result = parseFloat(0);

  switch (cloudProduct){
  case 'ebs':
    let storageTypeFilter = '';
    switch(storageType){
    case 'iops':
      switch(volumeType){
      case 'io2':
        if (volumeSize < 32) 
          storageTypeFilter = 'pricePerTier1IOPSMonth';
        if (volumeSize > 32 && volumeSize < 64)
          storageTypeFilter = 'pricePerTier2IOPSMonth';
        if (volumeSize > 64)
          storageTypeFilter = 'pricePerTier3IOPSMonth';
        break;
      default:
        storageTypeFilter = 'pricePerIOPSMonth';
      }
      break;
    case 'storage':
      storageTypeFilter = 'pricePerGBMonth';
      break;
    }
    result = parseFloat(product.ebs_prices[volumeType][storageTypeFilter].USD) * options.volumeSize / cfg.hoursPerMonth;
    break;
  case 'gcs':
    result = parseFloat(product[volumeType].fixedPricePerTBMonth/1024 * options.volumeSize / cfg.hoursPerMonth);
    break;
  }
  
  return result;
}

function validateVolumeOptions(cloudProvider, cloudProduct, options) {
  const supp = cfg.supportedProviders;

  if (!supp[cloudProvider]) throw `Currently unsupported Cloud Provider: ${cloudProvider}`;
  if (!supp[cloudProvider][cloudProduct]) throw `Currently unsupported Cloud Product "${cloudProduct}" for ${cloudProvider}`;
  
  if (!supp[cloudProvider][cloudProduct].volumeTypes[options.volumeType]) throw `Volume Type "${options.volumeType}" is not supported for "${cloudProduct}". Supported types: ${JSON.stringify(Object.getOwnPropertyNames(supp[cloudProvider][cloudProduct].volumeTypes))}`;
  
  if (options.storageType && !supp[cloudProvider][cloudProduct].volumeTypes[options.volumeType].storageTypes) throw `Storage Type "${options.storageType}" is not supported for "${options.volumeType}". Please keep it empty.`;
  if (options.storageType && !supp[cloudProvider][cloudProduct].volumeTypes[options.volumeType].storageTypes[options.storageType]) throw `Storage Type "${options.storageType}" is not supported for "${options.volumeType}". Supported types: ${JSON.stringify(Object.getOwnPropertyNames(supp[cloudProvider][cloudProduct].volumeTypes[options.volumeType].storageTypes))}`;
}