function fetchProducts(cloudProduct, filterTypes, options) {
    switch(cloudProduct){
    case 'psdb':
        return fetchPSDBInstances(filterTypes, options);
    case 'ec2':
        if (filterTypes.length == 0){
            filterTypes = generateEc2InstanceChoices();
        }
        return fetchAWSEC2(filterTypes, options);
    case 'ebs':
        return fetchAWSEBS(filterTypes, options);
    case 'compute':
        if (filterTypes.length == 0){
            filterTypes = generateComputeInstanceChoices();
        }
        return fetchGCPCompute(filterTypes, options);
    }
}

function fetchUrl(apiPath) {
    let fetches = [apiPath];
    const resp = UrlFetchApp.fetchAll(fetches)[0]; 
    if (resp.getResponseCode() != 200) throw `Unable to load the URL: ${apiPath}`;
    return JSON.parse(resp.getContentText());
}

function fetchPSDBRegions() {
  let allRegions = [];
  try {
    let regionsApi = `${cfg.psWebApi}regions`;
    allRegions = fetchUrl(regionsApi).data;
  } catch(err) {
    throw `Failed to retrieve regions. ${err}`;
  }

  if (allRegions.length == 0) throw 'No results returned by PlanetScale API.';

  return allRegions;
}

function fetchCloudProviderFromPSDBRegion(region) {
    return fetchPSDBRegions().filter(r => r.slug == region)[0].display_name.toLowerCase();
}

function fetchPSDBVTGates(filterTypes) {
    let responses = [];
    try {
        let vtGatesApi = `${cfg.psWebApi}vtgate-size-skus`;
        responses = fetchUrl(vtGatesApi).filter(v => (filterTypes.includes(v.name) || filterTypes.length == 0));
    } catch(err) {
        throw `Failed to retrieve vtgates sku info. ${err}`;
    }

    return responses;
}

function fetchPSDBInstances(filterTypes, options) {
    let skuApi = `${cfg.psWebApi}cluster-size-skus`;
    if(options.region){
        skuApi = `${skuApi}?region=${options.region}`;
    }

    let responses = fetchUrl(skuApi).filter(p => (p.rate && (filterTypes.includes(p.name) || filterTypes.length == 0)));

    responses.forEach(r => {
        r.options = options;
    })

    return formatPSDB(responses);
}

function formatPSDB(allProducts) {

    let cloudProds = [];
    let parentProviderRegion = fetchCloudProviderFromPSDBRegion(allProducts[0].options.region).split(" ");

    switch(parentProviderRegion[0].toLowerCase()){
    case 'aws':
        cloudProds = fetchProducts('ec2', [], { region:parentProviderRegion[1], platform:'linux', });
        break;
    case 'gcp':
        cloudProds = fetchProducts('compute', [], { region:parentProviderRegion[1], });
        break;
    }

    for (var i = 0; i < allProducts.length; i++) {
        allProducts[i].instance_type = allProducts[i].name;
        allProducts[i].region = options.region;
        allProducts[i].ps_instance_class = allProducts[i].metal ? 'metal' : '';
        if (allProducts[i].ps_instance_class == ''){
            let tss = allProducts[i].tshirt_size.split('.');
            switch (tss[1]) {
            case 'm1':
                allProducts[i].ps_instance_class = 'memory';
                break;
            case 'g1':
                allProducts[i].ps_instance_class = 'general';
                break;
            case 'c1':
                allProducts[i].ps_instance_class = 'compute';
                break;
            }
        }
      
        allProducts[i].vCPU = parseFloat(allProducts[i].cpu);
        allProducts[i].memory = parseInt(allProducts[i].ram)/1024/1024/1024;
        allProducts[i].onboard_storage = parseInt(allProducts[i].storage)/1024/1024/1024;
        let prodMatch = findCloudInstanceMatch(allProducts[i].vCPU, allProducts[i].memory, allProducts[i].ps_instance_class, cloudProds);   
        if (prodMatch) allProducts[i].provider_instance_type = prodMatch.instance_type;
    }

    return allProducts;
}

function fetchGCPCompute(filterTypes, options) {
    var { region, purchaseType, purchaseTerm, cudType } = options;
    cudType = cudType || 'flexi'; // Default to flexi CUD
    
    var responses = [];
    
    // Strategy: Same as AWS - chunk large sets into batches of 10
    if (filterTypes.length <= 3) {
        // Small set - use individual queries
        Logger.log(`Using individual GraphQL queries for ${filterTypes.length} GCP instances (${purchaseType})`);
        responses = fetchGCPComputeGraphQL(filterTypes, region, purchaseType, purchaseTerm, cudType);
    } else {
        // Large set - split into chunks of 10 and batch each chunk
        var chunkSize = 10;
        var totalChunks = Math.ceil(filterTypes.length / chunkSize);
        
        Logger.log(`Using chunked batched GraphQL for ${filterTypes.length} GCP instances (${purchaseType})`);
        Logger.log(`Splitting into ${totalChunks} batches of up to ${chunkSize} instances each`);
        
        for (var i = 0; i < filterTypes.length; i += chunkSize) {
            var chunk = filterTypes.slice(i, i + chunkSize);
            var chunkNum = Math.floor(i / chunkSize) + 1;
            
            Logger.log(`Processing GCP batch ${chunkNum}/${totalChunks} (${chunk.length} instances)...`);
            
            try {
                var chunkResults = fetchGCPComputeGraphQLBatched(chunk, region, purchaseType, purchaseTerm, cudType);
                responses = responses.concat(chunkResults);
                Logger.log(`  ✅ Batch ${chunkNum} completed: ${chunkResults.length} instances`);
            } catch (err) {
                Logger.log(`  ❌ Batch ${chunkNum} failed: ${err}`);
                Logger.log(`  Falling back to individual queries for this batch...`);
                var individualResults = fetchGCPComputeGraphQL(chunk, region, purchaseType, purchaseTerm, cudType);
                responses = responses.concat(individualResults);
            }
        }
        
        Logger.log(`Total GCP instances fetched: ${responses.length}/${filterTypes.length}`);
    }

    // GCP committed-use is now handled in the main query above
    // Discounts are applied based on cudType (flexi or resource)

    return formatGCPCompute(responses);
}

function formatGCPCompute(allProducts) {
    // For GCP, we follow the same basic process, but basically just map some of the fields to match the Vantage EC2 json file,
    // so it's easier to deal with downstream.

    for (var i = 0; i < allProducts.length; i++) {
      var famSize = allProducts[i].instance_type.split('-')
      allProducts[i].instance_family = famSize[0];
      allProducts[i].family = famSize[1];
      allProducts[i].instance_size = famSize[2];
      
      // vCPU and memory are now stored directly (unified with AWS structure)
      // Keep them as-is, or fall back to 0 if missing
      allProducts[i].memory = allProducts[i].memory || 0;
      allProducts[i].vCPU = allProducts[i].vCPU || 0;

      // Determine PS family first
      switch (allProducts[i].family){
        case 'standard':
          allProducts[i].ps_instance_class = 'general';
          break;
        case 'highmem':
          allProducts[i].ps_instance_class = 'memory';
          break;
        case 'highcpu':
          allProducts[i].ps_instance_class = 'compute';
          break;
      }
      //if(allProducts[i].instance_type.includes('localssd')) allProducts[i].ps_instance_class = 'metal';
      if (allProducts[i].instance_family == 'n2d' || allProducts[i].instance_family == 'z3'){
        allProducts[i].ps_instance_class = 'metal';
      }
      
      // Calculate minimum onboard storage (local SSD) - ONLY for metal instances
      // GCP local SSDs come in 375GB units
      if (allProducts[i].ps_instance_class === 'metal') {
        var instanceSize = parseInt(famSize[2]) || 0;
        var minSSDUnits = 1;
        
        if (instanceSize > 4) {
          minSSDUnits = instanceSize / 8;
        }
        
        // c2d family has specific limits
        if (allProducts[i].instance_family == 'c2d') {
          minSSDUnits = 1;
        }
        
        // Each local SSD unit is 375GB
        allProducts[i].onboard_storage = minSSDUnits * 375;
      } else {
        allProducts[i].onboard_storage = 0;
      }
    }

    return allProducts;
}

function fetchAWSEC2(filterTypes, options) {
    var { region, platform, purchaseType, purchaseTerm, offeringClass, paymentOption } = options;

    var responses = [];
    
    // Strategy: 
    // - 1-3 instances: Individual queries (batching overhead not worth it)
    // - 4+ instances: Use batched queries in chunks of 10 (max per batch to avoid "Argument too large")
    
    if (filterTypes.length <= 3) {
        // Small set - use individual queries
        Logger.log(`Using individual GraphQL queries for ${filterTypes.length} AWS EC2 instances (${purchaseType})`);
        responses = fetchAWSEC2GraphQL(filterTypes, region, platform, purchaseType, purchaseTerm, offeringClass, paymentOption);
    } else {
        // Large set - split into chunks of 10 and batch each chunk
        var chunkSize = 10;
        var totalChunks = Math.ceil(filterTypes.length / chunkSize);
        
        Logger.log(`Using chunked batched GraphQL for ${filterTypes.length} AWS EC2 instances (${purchaseType})`);
        Logger.log(`Splitting into ${totalChunks} batches of up to ${chunkSize} instances each`);
        
        for (var i = 0; i < filterTypes.length; i += chunkSize) {
            var chunk = filterTypes.slice(i, i + chunkSize);
            var chunkNum = Math.floor(i / chunkSize) + 1;
            
            Logger.log(`Processing batch ${chunkNum}/${totalChunks} (${chunk.length} instances)...`);
            
            try {
                var chunkResults = fetchAWSEC2GraphQLBatched(chunk, region, platform, purchaseType, purchaseTerm, offeringClass, paymentOption);
                responses = responses.concat(chunkResults);
                Logger.log(`  ✅ Batch ${chunkNum} completed: ${chunkResults.length} instances`);
            } catch (err) {
                Logger.log(`  ❌ Batch ${chunkNum} failed: ${err}`);
                // If a batch fails, try individual queries for that chunk only
                Logger.log(`  Falling back to individual queries for this batch...`);
                var individualResults = fetchAWSEC2GraphQL(chunk, region, platform, purchaseType, purchaseTerm, offeringClass, paymentOption);
                responses = responses.concat(individualResults);
            }
        }
        
        Logger.log(`Total instances fetched: ${responses.length}/${filterTypes.length}`);
    }

    return formatAWSEC2(responses);
}

function formatAWSEC2(allProducts) {
    // Add an intance_family and instance_size property based on the product name,
    // add ps_instance_class based on instance_family,
    // then filter underlying pricing down to include only the region & platform we requested.
    for (var i = 0; i < allProducts.length; i++) {
      // add a few extra fields
      var famSize = allProducts[i].instance_type.split('.')
      allProducts[i].instance_family = famSize[0];
      allProducts[i].instance_size = famSize[1];
      if (allProducts[i].storage){
          allProducts[i].onboard_storage = parseInt(allProducts[i].storage.size)*parseInt(allProducts[i].storage.devices);
      }

      // Determine PS family
      switch (allProducts[i].instance_family.substring(0,1)){
        case 'c':
          allProducts[i].ps_instance_class = 'compute';
          break;
        case 'r':
          allProducts[i].ps_instance_class = 'memory';
          break;
        case 'm':
          allProducts[i].ps_instance_class = 'general';
          break;
      }
      if(allProducts[i].onboard_storage > 0){
        allProducts[i].ps_instance_class = 'metal';
      }

    }

    return allProducts;
}

function fetchAWSEBS(filterTypes, options) {
    // filterTypes contains region codes for EBS
    let responses = [];
    
    // For EBS, filterTypes is actually an array of regions
    filterTypes.forEach(function(region) {
        // Fetch pricing for common volume types
        ['gp3', 'gp2', 'io2', 'io1'].forEach(function(volumeType) {
            try {
                let volumeData = fetchAWSEBSGraphQL(region, volumeType);
                if (volumeData) {
                    responses.push(volumeData);
                }
            } catch (err) {
                Logger.log(`Error fetching EBS ${volumeType} for ${region}: ${err}`);
            }
        });
    });

    return responses;
}

function findCloudInstanceMatch(numCPU, numGB, psInstanceClass, cloudProds) {
    //Logger.log(JSON.stringify(cloudProds[0].vCPU));
    numCPU = numCPU < 2 ? 2 : numCPU;
    numGB = numGB < 16 ? 16 : numGB;
    let results = cloudProds.filter(p => (numCPU == parseFloat(p.vCPU) && numGB == parseFloat(p.memory) && psInstanceClass == p.ps_instance_class));
    return results[results.length-1];
}

function generateEc2InstanceChoices() {
  let instanceTypes = [];
  cfg.awsEc2InstanceFamilyFilter.forEach(family => {
      cfg.awsEc2InstanceSizeFilter.forEach(size => {
        instanceTypes.push(`${family}.${size}`);
      });
    }); 
  return instanceTypes;
}

function generateComputeInstanceChoices() {
  let instanceTypes = [];
  cfg.gcpComputeInstanceFamilyFilter.forEach(family => {
      cfg.gcpComputeInstanceSizeFilter.forEach(size => {
        instanceTypes.push(`${family}-${size}`);
      });
    }); 
  return instanceTypes;
}