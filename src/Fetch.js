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

function fetchPsApi(path) {
    if (!cfg.psApiToken) throw 'Missing psApiToken in Script Properties. Create a PlanetScale service token and store it as psApiToken.';
    const url = `${cfg.psApiBase}${cfg.psApiOrg}/${path}`;
    const resp = UrlFetchApp.fetch(url, {
        headers: {
            'Authorization': `${cfg.psApiToken}`,
            'Accept': 'application/json',
        },
        muteHttpExceptions: true,
    });
    if (resp.getResponseCode() != 200) throw `PlanetScale API error (${resp.getResponseCode()}): ${resp.getContentText()}`;
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
    var match = fetchPSDBRegions().filter(r => r.slug == region)[0];
    if (!match) {
        throw `No PlanetScale region found for slug "${region}". Please check the region name.`;
    }
    return match.display_name.toLowerCase();
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
    let queryParams = 'rates=true';
    if(options.region){
        queryParams += `&region=${options.region}`;
    }
    let skuApi = `cluster-size-skus?${queryParams}`;

    let responses = fetchPsApi(skuApi).filter(p => (p.enabled !== false && p.rate && (filterTypes.includes(p.name) || filterTypes.length == 0)));

    responses.forEach(r => {
        r.options = options;
    })

    return formatPSDB(responses);
}

function parseTshirtSize(tshirtSize) {
    if (!tshirtSize) return { productType: 'vitess', provider: null, cloudInstanceType: null };
    var parts = tshirtSize.split('.');
    var productType = 'vitess';
    if (parts[0] === 'pg') productType = 'postgres';

    var provider = null;
    var cloudInstanceType = null;

    if (parts[1] === 'aws') {
        provider = 'aws';
        // e.g., vt.aws.i4i.large -> i4i.large
        cloudInstanceType = parts.slice(2).join('.');
    } else if (parts[1] === 'gcp') {
        provider = 'gcp';
        // e.g., vt.gcp.n2d-highmem-2-localssd-1 -> n2d-highmem-2 (strip localssd suffix)
        var gcpFull = parts.slice(2).join('.');
        cloudInstanceType = gcpFull.replace(/-localssd-\d+$/, '');
    }

    return { productType: productType, provider: provider, cloudInstanceType: cloudInstanceType };
}

function isGravitonFamily(instanceFamily) {
    // AWS Graviton families have 'g' immediately after the generation digit(s).
    // Examples: r6g, m7g, c6g, r6gd, m6gd (Graviton)
    // Non-Graviton: r6i, r6id, m5, m5d, c5, i3, i4i (x86)
    var match = instanceFamily.match(/^[a-z](\d+)(.*)/);
    if (!match) return false;
    var variant = match[2];
    return variant.length > 0 && variant.charAt(0) === 'g';
}

function formatPSDB(allProducts) {
    if (!allProducts || allProducts.length === 0) {
        return allProducts;
    }

    // Check if we have any non-metal SKUs that need cloud instance matching
    var hasNonMetal = false;
    for (var j = 0; j < allProducts.length; j++) {
        if (!allProducts[j].metal) { hasNonMetal = true; break; }
    }

    // Only fetch cloud products if we have non-metal SKUs that need matching
    var cloudProds = [];
    if (hasNonMetal) {
        var parentProviderRegion = fetchCloudProviderFromPSDBRegion(allProducts[0].options.region).split(" ");

        switch(parentProviderRegion[0].toLowerCase()){
        case 'aws':
            cloudProds = fetchProducts('ec2', [], { region:parentProviderRegion[1], platform:'linux', });
            // Filter out Graviton (ARM) families for Vitess instance matching
            cloudProds = cloudProds.filter(function(p) {
                return !isGravitonFamily(p.instance_family);
            });
            break;
        case 'gcp':
            cloudProds = fetchProducts('compute', [], { region:parentProviderRegion[1], });
            break;
        }
    }

    for (var i = 0; i < allProducts.length; i++) {
        var parsed = allProducts[i].tshirt_size
            ? parseTshirtSize(allProducts[i].tshirt_size)
            : { productType: 'vitess', provider: null, cloudInstanceType: null };

        allProducts[i].product_type = parsed.productType;
        allProducts[i].instance_type = allProducts[i].name;
        allProducts[i].region = allProducts[i].options ? allProducts[i].options.region : null;

        allProducts[i].vCPU = parseFloat(allProducts[i].cpu);
        allProducts[i].memory = parseInt(allProducts[i].ram)/1024/1024/1024;
        allProducts[i].onboard_storage = parseInt(allProducts[i].storage)/1024/1024/1024;

        // Determine ps_instance_class
        if (allProducts[i].metal) {
            allProducts[i].ps_instance_class = 'metal';
        } else if (allProducts[i].tshirt_size) {
            var tss = allProducts[i].tshirt_size.split('.');
            switch (tss[1]) {
            case 'm1': allProducts[i].ps_instance_class = 'memory'; break;
            case 'g1': allProducts[i].ps_instance_class = 'general'; break;
            case 'c1': allProducts[i].ps_instance_class = 'compute'; break;
            default: allProducts[i].ps_instance_class = 'memory';
            }
        } else {
            // No tshirt_size (v1 API): derive from CPU/RAM ratio
            var gbPerCpu = allProducts[i].vCPU > 0 ? allProducts[i].memory / allProducts[i].vCPU : 0;
            if (gbPerCpu >= 6) allProducts[i].ps_instance_class = 'memory';
            else if (gbPerCpu >= 3) allProducts[i].ps_instance_class = 'general';
            else allProducts[i].ps_instance_class = 'compute';
        }

        // VTGate fields
        allProducts[i].default_vtgate = allProducts[i].default_vtgate || null;
        allProducts[i].default_vtgate_rate = allProducts[i].default_vtgate_rate || null;

        // Provider instance type resolution
        if (allProducts[i].metal && parsed.cloudInstanceType) {
            // Metal with tshirt_size: full type from tshirt (e.g., vt.aws.i3en.12xlarge -> i3en.12xlarge)
            allProducts[i].provider_instance_type = parsed.cloudInstanceType;
        } else if (allProducts[i].metal && allProducts[i].provider_instance_type) {
            // Metal from v1 API: already has provider_instance_type (family only, e.g., "i3en")
            // Keep as-is
        } else if (!allProducts[i].metal) {
            // Non-metal: match against cloud catalog (Graviton-filtered for AWS)
            var prodMatch = findCloudInstanceMatch(allProducts[i].vCPU, allProducts[i].memory, allProducts[i].ps_instance_class, cloudProds);
            if (prodMatch) allProducts[i].provider_instance_type = prodMatch.instance_type;
        }
    }

    return allProducts;
}

function fetchGCPCompute(filterTypes, options) {
    var { region, purchaseType, purchaseTerm, cudType } = options;
    cudType = cudType || 'flexi'; // Default to flexi CUD
    
    var responses = [];
    
    // Strategy: Same as AWS - chunk large sets into manageable batches (max 5)
    if (filterTypes.length <= 3) {
        // Small set - use individual queries
        responses = fetchGCPComputeGraphQL(filterTypes, region, purchaseType, purchaseTerm, cudType);
    } else {
        // Large set - split into chunks of 10 and batch each chunk
        var chunkSize = 5;
        
        for (var i = 0; i < filterTypes.length; i += chunkSize) {
            var chunk = filterTypes.slice(i, i + chunkSize);
            
            try {
                var chunkResults = fetchGCPComputeGraphQLBatched(chunk, region, purchaseType, purchaseTerm, cudType);
                responses = responses.concat(chunkResults);
            } catch (err) {
                // Fallback to individual queries for this batch
                var individualResults = fetchGCPComputeGraphQL(chunk, region, purchaseType, purchaseTerm, cudType);
                responses = responses.concat(individualResults);
            }
        }
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
        responses = fetchAWSEC2GraphQL(filterTypes, region, platform, purchaseType, purchaseTerm, offeringClass, paymentOption);
    } else {
        // Large set - split into chunks of 10 and batch each chunk
        var chunkSize = 10;
        
        for (var i = 0; i < filterTypes.length; i += chunkSize) {
            var chunk = filterTypes.slice(i, i + chunkSize);
            
            try {
                var chunkResults = fetchAWSEC2GraphQLBatched(chunk, region, platform, purchaseType, purchaseTerm, offeringClass, paymentOption);
                responses = responses.concat(chunkResults);
            } catch (err) {
                // If a batch fails, try individual queries for that chunk only
                var individualResults = fetchAWSEC2GraphQL(chunk, region, platform, purchaseType, purchaseTerm, offeringClass, paymentOption);
                responses = responses.concat(individualResults);
            }
        }
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
                // Skip volume types that fail to fetch
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