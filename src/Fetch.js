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
    let targetColl = 'gcp_instances';

    fs = getFirestore();

    let responses = [];

    try{
        fr = fs.getDocuments(targetColl);
    }catch(err){
        throw `${err}`;
    }

    fr.forEach(doc => {
        Object.getOwnPropertyNames(doc.obj).forEach(prop => {
            filterTypes.forEach(insType => {
                if(prop == insType) {
                    let newObj = doc.obj[prop];
                    if (newObj.regions && newObj.regions[options.region]){
                        newObj.regions = {[options.region]: newObj.regions[options.region]};
                        newObj.instance_type = prop;
                        responses.push(newObj);
                    }
                }
            })
        })
    })

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
      allProducts[i].memory = allProducts[i].specs ? parseFloat(allProducts[i].specs.memory) : 0;
      allProducts[i].vCPU = allProducts[i].specs ? parseFloat(allProducts[i].specs.cores) : 0;

      // Determine PS family
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
      if (allProducts[i].instance_family == 'n2d'){
        allProducts[i].ps_instance_class = 'metal';
      }
    }

    return allProducts;
}

function fetchAWSEC2(filterTypes, options) {
    var { region, platform } = options;

    let targetColl = 'aws_ec2_instances';
    let filterField = 'instance_type';

    fs = getFirestore();

    let lim = parseInt(cfg.fsLimit);
    const chunks = Math.ceil(filterTypes.length / lim);

    let responses = [];

    for (var i = 0; i < chunks; i++) {
        let fr = [];
        let chunk = filterTypes.slice(i * lim, Math.min((i+1) * lim,filterTypes.length));
        try{
            fr = fs.query(targetColl).Where(filterField, "IN", chunk).Execute();
        }catch(err){
            throw `${err}`;
        }
        fr.forEach(r => {

            if(r.obj.pricing[region] && r.obj.pricing[region][platform]) {
                r.obj.pricing = {
                    [region]: {
                        [platform]: r.obj.pricing[region][platform],
                    },
                }
                //r.obj.selected_price = getPrice('ec2',r.obj,options);
                responses.push(r.obj);
            }
        });
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
          allProducts[i].ps_instance_class = (allProducts[i].instance_family == 'r6id') ? 'metal' : 'memory';
          break;
        case 'm':
          allProducts[i].ps_instance_class = (allProducts[i].instance_family == 'm6id') ? 'metal' : 'general';
          break;
        case 'i':
          allProducts[i].ps_instance_class = 'metal';
          break;
      }

    }

    return allProducts;
}

function fetchAWSEBS(filterTypes, options) {
    let targetColl = 'aws_ebs_volumes';
    let filterField = 'rzCode';

    fs = getFirestore();

    let responses = [];

    try{
        fr = fs.query(targetColl).Where(filterField, "IN", filterTypes).Execute();
    }catch(err){
        throw `${err}`;
    }
    fr.forEach(r => {
        responses.push(r.obj);
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

function getFirestore(){
    const fs = FirestoreApp.getFirestore(cfg.fsEmail, cfg.fsKey, cfg.fsProjectId);
    return fs;
}