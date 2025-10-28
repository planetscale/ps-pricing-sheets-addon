/**
 * Returns an array containing all PSDB instance types and prices for a given region. 
 *
 * @param {"us-east"} region - [OPTIONAL] PlanetScale Cloud region slug, defaults to "us-east"
 * @returns pricing_matrix
 * @customfunction
 */

function PSDB_ALL_BY_REGION(region="us-east") {
    var cloudProvider = 'planetscale';
    var cloudProduct = 'psdb';
    options = getObjectWithValuesToLowerCase({ region });
    return fetchRegionalInstanceMatrix(cloudProvider, cloudProduct, options);
}

/**
 * Returns an array containing all PSDB instance types and prices for a given region. Use this to populate
 * drop down lists.
 *
 * @param {"us-east"} region - [OPTIONAL] PlanetScale Cloud region slug, defaults to "us-east"
 * @returns list
 * @customfunction
 */

function PSDB_SKU_BY_REGION(region="us-east") {
    var cloudProvider = 'planetscale';
    var cloudProduct = 'psdb';
    options = getObjectWithValuesToLowerCase({ region });

    let instanceTypes = [];
    let prods = fetchProducts(cloudProduct, instanceTypes, options);

    let instanceNames = [];
    prods.forEach(p => {
        instanceNames.push(p.instance_type);
    })

    return instanceNames;
}

/**
 * Returns an array containing all available PSDB Cloud regions for a given cloud provider. 
 *
 * @param {"aws"} cloudProvider - [OPTIONAL] Base Cloud Provider choice for PlanetScale, defaults to "aws"
 * @returns region_list
 * @customfunction
 */

function PSDB_REGIONS(cloudProvider="aws") {
    return fetchPSDBRegionsByProvider(cloudProvider);
}

/**
 * Returns the hourly cost for an instance type in a given Cloud/ST region. Note that this returns the cost for three
 * replicas as a baseline, and already includes default vtgate choices for the selected instance type.
 * 
 * @param {"PS_40"} instanceType - PSDB instance type
 * @param {"us-east"} region - [OPTIONAL] PlanetScale Cloud region slug, defaults to "us-east"
 * @param {250} dataSizeGB - [OPTIONAL] Total data size to include in GB, defaults to 10
 * @param {1} shards - [OPTIONAL] Total number of shards, defaults to 1
 * @param {3} extraReplicas - [OPTIONAL] Number of replicas in addition to the standard baseline of 3, defaults to 0
 * @param {"VTG_40"} vtGateOverride - [OPTIONAL] VTGate sku to use as override to the default included one
 * @param {3} extraVtGateReplicas - [OPTIONAL] Number of vtgates in addition to the standard baseline of 3, defaults to 0
 * @returns hourly_cost
 * @customfunction
 */

function PSDB_INSTANCE_HOURLY(instanceType, region="us-east", dataSizeGB=10, shards=1, extraReplicas=0, vtGateOverride, extraVtGateReplicas=0) {
    var cloudProvider = 'planetscale';
    var cloudProduct = 'psdb';

    let vtGateOverridePrice = 0;

    if(vtGateOverride) {
        try{
            let vtg = fetchPSDBVTGates([vtGateOverride])[0];
            vtGateOverridePrice = vtg.rate
        }catch(err){
            throw `Not a valid vtgate SKU name: ${vtGateOverride} - ${err}`;
        }
    }

    options = getObjectWithValuesToLowerCase({ region, dataSizeGB, shards, extraReplicas, vtGateOverridePrice, extraVtGateReplicas });



    return fetchSingleInstancePrice(cloudProvider, cloudProduct, instanceType, options);
}

/**
 * Returns the hourly service fee for running PlanetScale Managed for a given instance type's tablets. Note that this returns
 * the cost for three replicas as a baseline (i.e. if 0 extra replicas are provided), and does not include vtgates for the selected
 * instance type.
 * 
 * @param {"PS_40"} instanceType - PSDB instance type
 * @param {3} extraReplicas - [OPTIONAL] Number of replicas in addition to the standard baseline of 3, defaults to 0
 * @returns hourly_cost
 * @customfunction
 */

function PSDB_MNGD_TABLET_HOURLY(instanceType, extraReplicas=0) {
    var cloudProvider = 'planetscale';
    var cloudProduct = 'psdb';
    options = {region:'us-east',};

    let prod = fetchProducts(cloudProduct,[instanceType],options)[0];
    let ic = prod.ps_instance_class;
    let numCPU = parseFloat(prod.vCPU);
    let totalReplicas = 3 + extraReplicas;
    
    return (cfg.managedPrices[ic]/cfg.hoursPerMonth) * numCPU * totalReplicas;
}

/**
 * Returns the hourly service fee for running PlanetScale Managed for a given instance type's vtgates. Note that this function
 * will either accept a PlanetScale instance type as input, in which case it will calculate vtgate cost based on that instance
 * type's default vtgate type, OR it accepts an explicit vtgate type, in case you'd like to override the default.
 * 
 * @param {"PS_40"} instanceType - PSDB instance type OR explicit VTGATE sku type
 * @param {3} extraReplicas - [OPTIONAL] Number of replicas in addition to the standard baseline of 3, defaults to 0
 * @returns hourly_cost
 * @customfunction
 */

function PSDB_MNGD_VTGATE_HOURLY(instanceType, extraReplicas=0) {
    let vtgName = instanceType;

    if (!vtgName.startsWith('VTG')){
        var cloudProvider = 'planetscale';
        var cloudProduct = 'psdb';
        options = {region:'us-east',};

        let prod = fetchProducts(cloudProduct,[instanceType],options)[0];
        vtgName = prod.default_vtgate;
    }

    let vtg = fetchPSDBVTGates([vtgName])[0];
    let numCPU = parseFloat(vtg.cpu);
    let totalReplicas = 3 + extraReplicas;

    return (cfg.managedPrices['compute'] / cfg.hoursPerMonth) * numCPU * totalReplicas;

}

/**
 * Returns the hourly service fee for running PlanetScale Managed for a given instance type.
 * 
 * @param {250} numGB - Total GB for a single replica's worth of storage requirements
 * @param {"PS_40"} instanceType - [OPTIONAL] PSDB instance type, defaults to "PS_40", a network storage-based instance
 * @returns hourly_cost
 * @customfunction
 */

function PSDB_MNGD_STORAGE_HOURLY(numGB, instanceType="PS_40") {
    var cloudProvider = 'planetscale';
    var cloudProduct = 'psdb';
    options = {region:'us-east',};

    let prod = fetchProducts(cloudProduct,[instanceType],options)[0];

    let hourlyPrice = prod.ps_instance_class == 'metal' ? 0 : cfg.managedPrices['TB']/cfg.hoursPerMonth*(numGB/1024);
    return hourlyPrice;
}

function PSDB_MNGD_COST_BY_CLASS_HOURLY(instanceClass) {
    if(['general','memory','compute','metal'].includes(instanceClass)){
        return cfg.managedPrices[instanceClass] / cfg.hoursPerMonth;
    }else{
        throw 'Instance Class must be one of [general, memory, compute, metal]'
    }
}