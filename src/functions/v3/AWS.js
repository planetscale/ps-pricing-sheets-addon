// These formulas have been rewritten to support integration with the Vantage API

/**
 * Returns an array containing all instance types and prices for a given region. 
 * For reserved purchaseTypes, purchaseTerm and paymentOption are required.
 *
 * @param {"aws"} cloudProvider - [OPTIONAL] Public Cloud vendor (aws,gcp)
 * @param {"ec2"} cloudProduct - [OPTIONAL] Public Cloud vendor product family (ec2,cloud), defaults to "ec2"
 * @param {"us-east-2"} region - Region of EC2 instance
 * @param {"reserved"} purchaseType - Either "ondemand" or "reserved"
 * @param {"1yr"} purchaseTerm - Reserved instance: Purchase term, defaults to "1yr"
 * @param {"standard"} offeringClass - Reserved instance: Offering class (standard, convertible), defaults to "standard"
 * @param {"no_upfront"} paymentOption - Reserved instance: Payment option (no_upfront, partial_upfront, all_upfront), defaults to "no_upfront"
 * @param {"linux"} platform - Platform of EC2 instance, defaults to "linux"
 * @returns instance_matrix
 * @customfunction
 */

function CLOUD_ALL_BY_REGION(cloudProvider="aws", cloudProduct="ec2", region, purchaseType, purchaseTerm, offeringClass="standard", paymentOption, platform="linux") {
    var options = getObjectWithValuesToLowerCase({ region, purchaseType, purchaseTerm, offeringClass, paymentOption, platform });
    return fetchRegionalInstanceMatrix(cloudProvider, cloudProduct, options);
}

/**
 * Returns an array containing all instance types and prices for a given region. 
 * For reserved purchaseTypes, purchaseTerm and paymentOption are required.
 *
 * @param {"us-east-2"} region Region of EC2 instance
 * @param {"reserved"} purchaseType Either "ondemand" or "reserved"
 * @param {"1yr"} purchaseTerm Reserved instance: Purchase term, defaults to "1yr"
 * @param {"standard"} offeringClass Reserved instance: Offering class (standard, convertible), defaults to "standard"
 * @param {"no_upfront"} paymentOption Reserved instance: Payment option (no_upfront, partial_upfront, all_upfront), defaults to "no_upfront"
 * @param {"linux"} platform Platform of EC2 instance, defaults to "linux"
 * @returns instance_matrix
 * @customfunction
 */

function AWS_EC2_ALL_BY_REGION(region, purchaseType, purchaseTerm, offeringClass, paymentOption, platform) {
    var cloudProvider = 'aws';
    var cloudProduct = 'ec2';
    
    // Set defaults BEFORE creating options object
    platform = platform || 'linux';
    purchaseType = purchaseType || 'ondemand';
    
    var options = getObjectWithValuesToLowerCase({ region, purchaseType, purchaseTerm, offeringClass, paymentOption, platform });
    return fetchRegionalInstanceMatrix(cloudProvider, cloudProduct, options);
}

/**
 * Returns the hourly cost for an instance type in a given region. 
 * For reserved purchaseTypes, purchaseTerm and paymentOption are required.
 *
 * @param {"m5.xlarge"} instanceType Type of EC2 instance
 * @param {"us-east-2"} region Region of EC2 instance
 * @param {"reserved"} purchaseType Either "ondemand" or "reserved"
 * @param {"1yr"} purchaseTerm Reserved instance: Purchase term, defaults to "1yr"
 * @param {"standard"} offeringClass Reserved instance: Offering class (standard, convertible), defaults to "standard"
 * @param {"no_upfront"} paymentOption Reserved instance: Payment option (no_upfront, partial_upfront, all_upfront), defaults to "no_upfront"
 * @param {"linux"} platform Platform of EC2 instance, defaults to "linux"
 * @returns hourly_cost
 * @customfunction
 */

function AWS_EC2_HOURLY(instanceType, region, purchaseType, purchaseTerm, offeringClass, paymentOption, platform) {
    var cloudProvider = 'aws';
    var cloudProduct = 'ec2';
    
    // Set defaults BEFORE creating options object
    platform = platform || 'linux';
    purchaseType = purchaseType || 'ondemand';
    
    var options = getObjectWithValuesToLowerCase({ region, purchaseType, purchaseTerm, offeringClass, paymentOption, platform });
    return fetchSingleInstancePrice(cloudProvider, cloudProduct, instanceType, options);
}

/**
 * Returns the hourly cost for the amount of provisioned EBS storage Gigabytes. 
 * When a formula has "snapshot" as storageType, the first field will be ignored. 
 * In this example the first argument is empty: AWS_EBS("","snapshot",3000,"us-east-1")
 *
 * @param {"us-east-2"} region Region of EBS volume
 * @param {"gp3"} volumeType Volume type of EBS volume.
 * @param {"iops"} storageType Storage type of EBS volume
 * @param {4000} volumeSize Volume size in GB
 * @returns hourly_cost
 * @customfunction
 */

function AWS_EBS_HOURLY(region, volumeType, storageType, volumeSize) {
    var cloudProvider = 'aws';
    var cloudProduct = 'ebs';
    var options = getObjectWithValuesToLowerCase({ region, volumeType, storageType, volumeSize });
    return fetchSingleVolumePrice(cloudProvider, cloudProduct, options);
}

/**
 * Returns the hourly cost for an RDS instance.
 * For Aurora: defaults to Standard storage config (not I/O-Optimized).
 * 
 * @param {"aurora/mysql"} dbEngine Database engine: aurora/mysql, aurora/postgresql, mysql, mariadb, postgresql
 * @param {"db.r6g.xlarge"} instanceType Type of RDS instance
 * @param {"us-east-1"} region AWS region
 * @param {"ondemand"} purchaseType Either "ondemand" or "reserved"
 * @param {"1yr"} purchaseTerm Purchase term: "1yr" or "3yr" (for reserved instances)
 * @param {"no_upfront"} paymentOption Payment option: no_upfront, partial_upfront, all_upfront (for reserved instances)
 * @param {false} ioOptimized For Aurora only: set to TRUE for I/O-Optimized pricing (higher compute cost, no I/O charges)
 * @returns hourly_cost
 * @customfunction
 */
function AWS_RDS_HOURLY(dbEngine, instanceType, region, purchaseType, purchaseTerm, paymentOption, ioOptimized) {
    // Convert arguments to lowercase
    var options = getObjectWithValuesToLowerCase({ 
        dbEngine: dbEngine,
        instanceType: instanceType,
        region: region,
        purchaseType: purchaseType,
        purchaseTerm: purchaseTerm,
        paymentOption: paymentOption
    });
    
    // Handle ioOptimized parameter (boolean, not lowercased)
    // Accept TRUE, true, "true", "TRUE", 1, etc.
    if (ioOptimized === true || ioOptimized === 'true' || ioOptimized === 'TRUE' || ioOptimized === 1) {
        options.ioOptimized = true;
    } else {
        options.ioOptimized = false;
    }
    
    // Set defaults
    options.purchaseType = options.purchaseType || 'ondemand';
    
    // Normalize purchase type variations
    if (options.purchaseType === 'on-demand') {
        options.purchaseType = 'ondemand';
    }
    
    // Validation
    if (!['ondemand', 'reserved'].includes(options.purchaseType)) {
        throw 'Purchase type "' + options.purchaseType + '" is not supported. Please use "ondemand" or "reserved".';
    }
    
    // Validate reserved instance parameters
    if (options.purchaseType === 'reserved') {
        if (!options.purchaseTerm) {
            throw 'Purchase term is required for reserved instances. Please specify "1yr" or "3yr".';
        }
        if (!options.paymentOption) {
            throw 'Payment option is required for reserved instances. Please specify "no_upfront", "partial_upfront", or "all_upfront".';
        }
    }
    
    // Ignore ioOptimized for non-Aurora engines
    if (options.ioOptimized && options.dbEngine.indexOf('aurora') === -1) {
        options.ioOptimized = false;
    }
    
    return fetchAWSRDSGraphQL(options);
}

/**
 * Returns the hourly cost for RDS storage.
 * For Aurora: specify dbEngine (aurora/mysql or aurora/postgresql)
 * For EBS-backed RDS: dbEngine is optional (defaults to MySQL)
 * 
 * @param {"aurora"} storageType Storage type: aurora, gp2, gp3, io1, io2, magnetic
 * @param {1000} storageSize Storage size in GB
 * @param {"us-east-1"} region AWS region
 * @param {"aurora/mysql"} dbEngine Database engine (required for Aurora, optional for others)
 * @returns hourly_cost
 * @customfunction
 */
function AWS_RDS_STORAGE_HOURLY(storageType, storageSize, region, dbEngine) {
    // Convert arguments to lowercase
    var options = getObjectWithValuesToLowerCase({ 
        storageType: storageType,
        storageSize: storageSize,
        region: region,
        dbEngine: dbEngine
    });
    
    // Validate storage type
    var validTypes = ['aurora', 'gp2', 'gp3', 'io1', 'io2', 'magnetic'];
    if (validTypes.indexOf(options.storageType) === -1) {
        throw 'Invalid storage type "' + options.storageType + '". Valid types: ' + validTypes.join(', ');
    }
    
    // Validate storage size
    if (!options.storageSize || options.storageSize <= 0) {
        throw 'Storage size must be greater than 0';
    }
    
    // Fetch price per GB-month from API
    var pricePerGBMonth = fetchAWSRDSStorageGraphQL(options);
    
    // Convert to hourly cost
    // Formula: (price per GB-month) * (storage size in GB) / (hours per month)
    var hourlyStorageCost = (pricePerGBMonth * options.storageSize) / cfg.hoursPerMonth;
    
    return hourlyStorageCost;
}

/**
 * Returns the hourly cost for Aurora I/O requests.
 * Only applicable to Aurora Standard (not Aurora I/O-Optimized).
 * Note: Aurora I/O-Optimized instances have no I/O charges.
 * 
 * @param {1000000} ioRequests Number of I/O requests per hour
 * @param {"us-east-1"} region AWS region
 * @param {"aurora/mysql"} dbEngine Database engine: aurora/mysql or aurora/postgresql
 * @returns hourly_cost
 * @customfunction
 */
function AWS_RDS_IO_HOURLY(ioRequests, region, dbEngine) {
    // Convert arguments to lowercase
    var options = getObjectWithValuesToLowerCase({ 
        region: region,
        dbEngine: dbEngine
    });
    
    // Validate dbEngine is Aurora
    if (!options.dbEngine || options.dbEngine.indexOf('aurora') === -1) {
        throw 'I/O pricing is only for Aurora databases. Specify "aurora/mysql" or "aurora/postgresql"';
    }
    
    // Validate ioRequests
    if (!ioRequests || ioRequests < 0) {
        throw 'I/O requests must be greater than or equal to 0';
    }
    
    // Fetch price per I/O request from API
    // API returns per-request price (e.g., 2e-7 = $0.0000002, i.e. $0.20 per 1M IOs)
    var pricePerIO = fetchAWSRDSIOGraphQL(options);
    
    // Convert to hourly cost
    // Formula: (price per I/O request) * (I/O requests per hour)
    var hourlyIOCost = pricePerIO * ioRequests;
    
    return hourlyIOCost;
}
