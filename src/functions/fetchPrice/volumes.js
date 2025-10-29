function fetchSingleVolumePrice(cloudProvider, cloudProduct, options) {
  if(!options.region) throw 'Missing region';
  if(!parseFloat(options.volumeSize)) throw 'Unable to parse volume units';
  validateVolumeOptions(cloudProvider, cloudProduct, options);

  Logger.log(`DEBUG: fetchSingleVolumePrice for ${cloudProduct}`);
  Logger.log(`DEBUG: Region: ${options.region}, VolumeType: ${options.volumeType}, StorageType: ${options.storageType}`);

  let prod;
  switch (cloudProduct){
  case 'ebs':
    try{
      // Call GraphQL directly for this specific volume type and region
      Logger.log(`Fetching EBS pricing from GraphQL: ${options.volumeType} in ${options.region}`);
      prod = [fetchAWSEBSGraphQL(options.region, options.volumeType)];
      
      if(!prod[0] || !prod[0].ebs_prices) {
        throw 'No EBS pricing data returned from API.';
      }
      
      Logger.log(`✅ EBS pricing fetched successfully`);
    }catch(err){
      throw `Failed to fetch EBS pricing. ${err}`;
    }
  break;
  case 'gcs':
    try{
      prod = [fetchGCPLocalSSDGraphQL(options.region)];
    }catch(err){
      Logger.log(`Failed to fetch GCS pricing via API, using fallback: ${err}`);
      // Fallback to hardcoded price
      prod = [{ 
        localssd: {
          fixedPricePerTBMonth: 81.920,
        }
      }];
    }
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