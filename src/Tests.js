/**
 * Test suite for verifying GraphQL API migration
 * Run these tests to ensure all functions work correctly after migration
 */

/**
 * Pre-flight check before running tests
 */
function preflightCheck() {
  Logger.log('=================================');
  Logger.log('Running Pre-flight Checks');
  Logger.log('=================================\n');
  
  var apiKey = PropertiesService.getScriptProperties().getProperty('infracost_api_key');
  if (!apiKey) {
    Logger.log('❌ CRITICAL: Missing infracost_api_key');
    Logger.log('Please add it to Script Properties before running tests.');
    return false;
  }
  
  var awsFamily = PropertiesService.getScriptProperties().getProperty('awsEc2InstanceFamilyFilter');
  var awsSize = PropertiesService.getScriptProperties().getProperty('awsEc2InstanceSizeFilter');
  var gcpFamily = PropertiesService.getScriptProperties().getProperty('gcpComputeInstanceFamilyFilter');
  var gcpSize = PropertiesService.getScriptProperties().getProperty('gcpComputeInstanceSizeFilter');
  
  if (!awsFamily || !awsSize || !gcpFamily || !gcpSize) {
    Logger.log('❌ CRITICAL: Missing instance filter properties');
    Logger.log('Please add the following to Script Properties:');
    if (!awsFamily) Logger.log('  - awsEc2InstanceFamilyFilter');
    if (!awsSize) Logger.log('  - awsEc2InstanceSizeFilter');
    if (!gcpFamily) Logger.log('  - gcpComputeInstanceFamilyFilter');
    if (!gcpSize) Logger.log('  - gcpComputeInstanceSizeFilter');
    return false;
  }
  
  Logger.log('✅ All required script properties are set\n');
  return true;
}

/**
 * Test AWS EC2 on-demand pricing
 */
function testAWSEC2OnDemand() {
  try {
    Logger.log('Testing AWS EC2 on-demand pricing...');
    var result = AWS_EC2_HOURLY('m5.xlarge', 'us-east-1', 'ondemand', '', '', '', 'linux');
    Logger.log(`Result: $${result}/hour`);
    
    if (result && result > 0) {
      Logger.log('✅ AWS_EC2_HOURLY test PASSED');
      return true;
    } else {
      Logger.log('❌ AWS_EC2_HOURLY test FAILED - no price returned');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ AWS_EC2_HOURLY test FAILED: ${err}`);
    return false;
  }
}

/**
 * Test AWS EC2 reserved pricing
 */
function testAWSEC2Reserved() {
  try {
    Logger.log('Testing AWS EC2 reserved pricing...');
    var result = AWS_EC2_HOURLY('m5.xlarge', 'us-east-1', 'reserved', '1yr', 'standard', 'no_upfront', 'linux');
    Logger.log(`Result: $${result}/hour`);
    
    if (result && result > 0) {
      Logger.log('✅ AWS_EC2_HOURLY (reserved) test PASSED');
      return true;
    } else {
      Logger.log('❌ AWS_EC2_HOURLY (reserved) test FAILED - no price returned');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ AWS_EC2_HOURLY (reserved) test FAILED: ${err}`);
    return false;
  }
}

/**
 * Test AWS EBS pricing
 */
function testAWSEBS() {
  try {
    Logger.log('Testing AWS EBS pricing...');
    var result = AWS_EBS_HOURLY('us-east-1', 'gp3', 'storage', 1000);
    Logger.log(`Result: $${result}/hour for 1000GB`);
    
    if (result && result > 0) {
      Logger.log('✅ AWS_EBS_HOURLY test PASSED');
      return true;
    } else {
      Logger.log('❌ AWS_EBS_HOURLY test FAILED - no price returned');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ AWS_EBS_HOURLY test FAILED: ${err}`);
    return false;
  }
}

/**
 * Test GCP Compute on-demand pricing
 */
function testGCPComputeOnDemand() {
  try {
    Logger.log('Testing GCP Compute on-demand pricing...');
    var result = GCP_COMPUTE_HOURLY('n2-standard-4', 'us-central1', 'ondemand');
    Logger.log(`Result: $${result}/hour`);
    
    if (result && result > 0) {
      Logger.log('✅ GCP_COMPUTE_HOURLY test PASSED');
      return true;
    } else {
      Logger.log('❌ GCP_COMPUTE_HOURLY test FAILED - no price returned');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ GCP_COMPUTE_HOURLY test FAILED: ${err}`);
    return false;
  }
}

/**
 * Test GCP Compute committed use discount
 */
function testGCPComputeCommitted() {
  try {
    Logger.log('Testing GCP Compute committed-use pricing...');
    var result = GCP_COMPUTE_HOURLY('n2-standard-4', 'us-central1', 'committed-use', '1yr');
    Logger.log(`Result: $${result}/hour`);
    
    if (result && result > 0) {
      Logger.log('✅ GCP_COMPUTE_HOURLY (committed) test PASSED');
      return true;
    } else {
      Logger.log('❌ GCP_COMPUTE_HOURLY (committed) test FAILED - no price returned');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ GCP_COMPUTE_HOURLY (committed) test FAILED: ${err}`);
    return false;
  }
}

/**
 * Test GCP Local SSD pricing
 */
function testGCPLocalSSD() {
  try {
    Logger.log('Testing GCP Local SSD pricing...');
    var result = GCP_GCS_HOURLY('us-central1', 'localssd', 375);
    Logger.log(`Result: $${result}/hour for 375GB`);
    
    if (result && result >= 0) { // Can be 0 for some regions
      Logger.log('✅ GCP_GCS_HOURLY test PASSED');
      return true;
    } else {
      Logger.log('❌ GCP_GCS_HOURLY test FAILED - invalid price returned');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ GCP_GCS_HOURLY test FAILED: ${err}`);
    return false;
  }
}

/**
 * Test PSDB instance pricing (should still work via PlanetScale API)
 */
function testPSDBInstance() {
  try {
    Logger.log('Testing PSDB instance pricing...');
    var result = PSDB_INSTANCE_HOURLY('PS_40', 'us-east', 250, 1, 0);
    Logger.log(`Result: $${result}/hour`);
    
    if (result && result > 0) {
      Logger.log('✅ PSDB_INSTANCE_HOURLY test PASSED');
      return true;
    } else {
      Logger.log('❌ PSDB_INSTANCE_HOURLY test FAILED - no price returned');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ PSDB_INSTANCE_HOURLY test FAILED: ${err}`);
    return false;
  }
}

/**
 * Test PSDB regions (should still work via PlanetScale API)
 */
function testPSDBRegions() {
  try {
    Logger.log('Testing PSDB regions...');
    var result = PSDB_REGIONS('aws');
    Logger.log(`Result: ${result.length} regions found`);
    
    if (result && result.length > 0) {
      Logger.log('✅ PSDB_REGIONS test PASSED');
      return true;
    } else {
      Logger.log('❌ PSDB_REGIONS test FAILED - no regions returned');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ PSDB_REGIONS test FAILED: ${err}`);
    return false;
  }
}

/**
 * Test AWS EC2 regional matrix
 */
function testAWSEC2Matrix() {
  try {
    Logger.log('Testing AWS EC2 regional matrix...');
    var result = AWS_EC2_ALL_BY_REGION('us-east-1', 'ondemand', '', '', '', 'linux');
    Logger.log(`Result: ${result.length} rows returned`);
    
    if (result && result.length > 1) { // At least header + 1 row
      Logger.log('✅ AWS_EC2_ALL_BY_REGION test PASSED');
      return true;
    } else {
      Logger.log('❌ AWS_EC2_ALL_BY_REGION test FAILED - insufficient data returned');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ AWS_EC2_ALL_BY_REGION test FAILED: ${err}`);
    return false;
  }
}

/**
 * Test GCP Compute regional matrix
 */
function testGCPComputeMatrix() {
  try {
    Logger.log('Testing GCP Compute regional matrix...');
    var result = GCP_COMPUTE_ALL_BY_REGION('us-central1', 'ondemand');
    Logger.log(`Result: ${result.length} rows returned`);
    
    if (result && result.length > 1) { // At least header + 1 row
      Logger.log('✅ GCP_COMPUTE_ALL_BY_REGION test PASSED');
      return true;
    } else {
      Logger.log('❌ GCP_COMPUTE_ALL_BY_REGION test FAILED - insufficient data returned');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ GCP_COMPUTE_ALL_BY_REGION test FAILED: ${err}`);
    return false;
  }
}

/**
 * Test batched GraphQL queries
 */
function testBatchedQueries() {
  try {
    Logger.log('Testing batched GraphQL queries...');
    
    // Generate a small batch of instance types
    var instanceTypes = ['m5.large', 'm5.xlarge', 'm5.2xlarge', 'r6i.large', 'r6i.xlarge'];
    
    var result = fetchAWSEC2GraphQLBatched(instanceTypes, 'us-east-1', 'linux');
    Logger.log(`Result: ${result.length} instances fetched in batched query`);
    
    if (result && result.length >= 3) { // At least some should succeed
      Logger.log('✅ Batched GraphQL test PASSED');
      return true;
    } else {
      Logger.log('❌ Batched GraphQL test FAILED - insufficient results');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ Batched GraphQL test FAILED: ${err}`);
    return false;
  }
}

/**
 * Test performance comparison: individual vs batched
 */
function testBatchPerformance() {
  try {
    Logger.log('Testing batch vs individual query performance...');
    
    var instanceTypes = ['m5.large', 'm5.xlarge', 'm5.2xlarge', 'r6i.large'];
    var region = 'us-east-1';
    var platform = 'linux';
    
    // Test batched approach
    var startBatch = new Date().getTime();
    var batchResults = fetchAWSEC2GraphQLBatched(instanceTypes, region, platform);
    var batchTime = new Date().getTime() - startBatch;
    
    Logger.log(`Batched query: ${batchResults.length} instances in ${batchTime}ms`);
    
    // Test individual approach (only for comparison, commented out in production)
    // var startIndividual = new Date().getTime();
    // var individualResults = fetchAWSEC2GraphQL(instanceTypes, region, platform);
    // var individualTime = new Date().getTime() - startIndividual;
    
    // Logger.log(`Individual queries: ${individualResults.length} instances in ${individualTime}ms`);
    // Logger.log(`Performance gain: ${Math.round((individualTime - batchTime) / individualTime * 100)}%`);
    
    if (batchResults && batchResults.length > 0) {
      Logger.log('✅ Batch performance test PASSED');
      return true;
    } else {
      Logger.log('❌ Batch performance test FAILED');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ Batch performance test FAILED: ${err}`);
    return false;
  }
}

/**
 * Run all tests
 */
function runAllTests() {
  Logger.log('=================================');
  Logger.log('Starting GraphQL Migration Tests');
  Logger.log('=================================\n');
  
  // Run preflight check first
  if (!preflightCheck()) {
    Logger.log('\n⚠️  Pre-flight checks failed. Please fix the issues above before running tests.');
    return;
  }
  
  var tests = [
    { name: 'AWS EC2 On-Demand', func: testAWSEC2OnDemand },
    { name: 'AWS EC2 Reserved', func: testAWSEC2Reserved },
    { name: 'AWS EBS', func: testAWSEBS },
    { name: 'GCP Compute On-Demand', func: testGCPComputeOnDemand },
    { name: 'GCP Compute Committed', func: testGCPComputeCommitted },
    { name: 'GCP Local SSD', func: testGCPLocalSSD },
    { name: 'PSDB Instance', func: testPSDBInstance },
    { name: 'PSDB Regions', func: testPSDBRegions },
    { name: 'AWS EC2 Matrix', func: testAWSEC2Matrix },
    { name: 'GCP Compute Matrix', func: testGCPComputeMatrix },
    { name: 'Batched Queries', func: testBatchedQueries },
    { name: 'Batch Performance', func: testBatchPerformance }
  ];
  
  var passed = 0;
  var failed = 0;
  
  tests.forEach(function(test) {
    Logger.log(`\n--- Running: ${test.name} ---`);
    if (test.func()) {
      passed++;
    } else {
      failed++;
    }
  });
  
  Logger.log('\n=================================');
  Logger.log('Test Results');
  Logger.log('=================================');
  Logger.log(`✅ Passed: ${passed}`);
  Logger.log(`❌ Failed: ${failed}`);
  Logger.log(`Total: ${tests.length}`);
  Logger.log('=================================\n');
  
  if (failed === 0) {
    Logger.log('🎉 All tests passed! Migration successful!');
  } else {
    Logger.log('⚠️ Some tests failed. Please review the errors above.');
  }
}

/**
 * Quick test to verify GraphQL connection
 */
function testGraphQLConnection() {
  try {
    Logger.log('Testing GraphQL API connection...');
    
    var query = `{
      products(
        filter: {
          vendorName: "aws"
          service: "AmazonEC2"
          productFamily: "Compute Instance"
          region: "us-east-1"
          attributeFilters: [
            { key: "instanceType", value: "t3.micro" }
            { key: "operatingSystem", value: "Linux" }
            { key: "tenancy", value: "Shared" }
          ]
        }
      ) {
        prices(filter: { purchaseOption: "on_demand" }) {
          USD
        }
      }
    }`;
    
    var result = cachedGraphQL(query);
    
    if (result && result.data && result.data.products) {
      Logger.log('✅ GraphQL API connection successful!');
      Logger.log(`Sample result: ${JSON.stringify(result.data.products[0])}`);
      return true;
    } else {
      Logger.log('❌ GraphQL API connection failed - unexpected response format');
      return false;
    }
  } catch (err) {
    Logger.log(`❌ GraphQL API connection failed: ${err}`);
    return false;
  }
}

