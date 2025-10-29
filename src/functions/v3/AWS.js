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
    options = getObjectWithValuesToLowerCase({ region, purchaseType, purchaseTerm, offeringClass, paymentOption, platform });
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
    
    options = getObjectWithValuesToLowerCase({ region, purchaseType, purchaseTerm, offeringClass, paymentOption, platform });
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
    
    options = getObjectWithValuesToLowerCase({ region, purchaseType, purchaseTerm, offeringClass, paymentOption, platform });
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
    options = getObjectWithValuesToLowerCase({ region, volumeType, storageType, volumeSize });
    return fetchSingleVolumePrice(cloudProvider, cloudProduct, options);
}

// TODO

/**
 * Returns the instance price for a RDS DB instance
 * 
 * @param {"aurora/mysql"} dbEngine Database engine: aurora/mysql, aurora/postgresql, mysql, mariadb, postgresql
 * @param {"db.r6g.xlarge"} instanceType Type of RDS instance
 * @param {"us-east-1"} region Override the region setting (optional)
 * @param {"reserved"} purchaseType Either "ondemand" or "reserved"
 * @param {"3yr"} purchaseTerm Purchase term (for reserved instances)
 * @param {"partial_upfront"} paymentOption Payment option: no_upfront, partial_upfront, all_upfront (for reserved instances)
 *
 * @returns price
 * @customfunction
 */
/*
function AWS_RDS(dbEngine, instanceType, region, purchaseType, purchaseTerm, paymentOption) {
    // rewrite arguments to lowercase
    const options = getObjectWithValuesToLowerCase({ dbEngine, instanceType, region, purchaseType, purchaseTerm, paymentOption });
    
    if(options.purchaseType === "on-demand") options.purchaseType = "ondemand";
    // validation
    if(!["ondemand","reserved"].includes(options.purchaseType))
      throw `Purchase type "${options.purchaseType}" is not supported. Please use "ondemand" or "reserved".`;

    if(options.purchaseType === "ondemand") {
      if(purchaseTerm || paymentOption)
        throw `Purchase term "${purchaseTerm}" ${paymentOption ? `and payment option "${paymentOption}" are`: "is"} only supported for reserved instances. Remove these arguments for on-demand instances.`
    }

    // rewrite purchaseType
    if(options.purchaseType === "reserved") options.purchaseType = "reserved-instance";
    
    return fetchApiRDS(options, arguments.callee.name);
}
*/

/**
 * Returns the price of RDS storage.
 *
 * @param {"gp2"} storageType Storage type: aurora, gp2, piops, magnetic
 * @param {4000} storageSize Volume size in GB
 * @param {"us-east-2"} region Region
 * @returns price
 * @customfunction
 */
/*
function AWS_RDS_STORAGE(storageType, storageSize, region) {
  return analyticsWrapper(arguments, () => {
    const options = getObjectWithValuesToLowerCase({ storageType, storageSize, region });
    return fetchApiRDSStorage(options, arguments.callee.name);
  });
}
*/
