/**
 * Returns the hourly cost for an instance type in a given region. 
 * For reserved purchaseTypes, purchaseTerm and paymentOption are required.
 *
 * @param {"n2-highmem-8"} instanceType Type of GCP Compute instance
 * @param {"us-central1"} region Region of GCP Compute instance
 * @param {"ondemand"} purchaseType Either "ondemand" or "committed-use"
 * @param {"1yr"} purchaseTerm Reserved instance: Purchase term, defaults to "1yr"
 * @returns hourly_cost
 * @customfunction
 */

function GCP_COMPUTE_HOURLY(instanceType, region, purchaseType, purchaseTerm) {
    var cloudProvider = 'gcp';
    var cloudProduct = 'compute';
    options = getObjectWithValuesToLowerCase({ region, purchaseType, purchaseTerm });
    return fetchSingleInstancePrice(cloudProvider, cloudProduct, instanceType, options);
}

/**
 * Returns an array containing all instance types and prices for a given region. 
 * For reserved purchaseTypes, purchaseTerm and paymentOption are required.
 *
 * @param {"us-central1"} region Region of GCP Compute instance
 * @param {"ondemand"} purchaseType Either "ondemand" or "committed-use"
 * @param {"1yr"} purchaseTerm Reserved instance: Purchase term, defaults to "1yr"
 * @returns instance_matrix
 * @customfunction
 */

function GCP_COMPUTE_ALL_BY_REGION(region, purchaseType, purchaseTerm) {
    var cloudProvider = 'gcp';
    var cloudProduct = 'compute';
    options = getObjectWithValuesToLowerCase({ region, purchaseType, purchaseTerm });
    return fetchRegionalInstanceMatrix(cloudProvider, cloudProduct, options);
}

/**
 * Returns the hourly cost for the amount of provisioned GCS storage Gigabytes.
 * We currently return the price for the us-central1 region.
 *
 * @param {"us-central1"} region Region of EBS volume
 * @param {"localssd"} volumeType Volume type of GCS volume.
 * @param {4000} volumeSize Volume size in GB
 * @returns hourly_cost
 * @customfunction
 */

function GCP_GCS_HOURLY(region, volumeType, volumeSize) {
    var cloudProvider = 'gcp';
    var cloudProduct = 'gcs';
    options = getObjectWithValuesToLowerCase({ region, volumeType, volumeSize });
    return fetchSingleVolumePrice(cloudProvider, cloudProduct, options);
}

/**
 * Returns the available number of volume options for the selected GCP Compute
 * Instance type.
 * 
 * @param {"n2-standard-16"} instanceType Type of GCP Compute Instance
 * @returns list
 * @customfunction
 */

function GCP_VOLUME_OPTIONS(instanceType) {
    let responses = [1, 2, 4, 8, 16, 24];

    let inst = instanceType.split('-');
    let instanceFamily = inst[0];

    let instance_size = parseInt(inst[2]);

    let minValue = 1;

    if (instance_size > 4){
        minValue = instance_size / 8;
    }

    for (var i = responses.length - 1; i >= 0; i--) {
        if (responses[i] < minValue) {
            responses.splice(i,1);
        }
    }

    if (instanceFamily == 'c2d'){
        return [1, 2, 4, 8];
    }

    return responses;

}