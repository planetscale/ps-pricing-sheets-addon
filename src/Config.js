// Helper function to safely get and split script properties
function getScriptPropertyArray(propertyName, defaultValue) {
  var value = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!value) {
    throw `Missing required script property: ${propertyName}. Please add it to Script Properties.`;
  }
  return value.split(',').map(function(item) { return item.trim(); });
}

const cfg = {
  psWebApi: 'https://api.planetscale.com/www/',
  hoursPerMonth: 730,
  awsEc2InstanceFamilyFilter: getScriptPropertyArray('awsEc2InstanceFamilyFilter'), // These limit the number of instance families we check for EC2
  awsEc2InstanceSizeFilter: getScriptPropertyArray('awsEc2InstanceSizeFilter'), // These limit the number of instance sizes we check for EC2
  gcpComputeInstanceFamilyFilter: getScriptPropertyArray('gcpComputeInstanceFamilyFilter'), // These limit the number of instance families we check for GCP
  gcpComputeInstanceSizeFilter: getScriptPropertyArray('gcpComputeInstanceSizeFilter'), // These limit the number of instance sizes we check for GCP
  environment: "production", // should be either "development" or "production",
  supportedProviders: {
    'planetscale': {
      'psdb': true,
    },
    'aws': {
      'ec2': { 
        'purchaseTypes': {
          'ondemand': true,
          'reserved': {
            'purchaseTerms': {
              '1yr': true,
              '3yr': true,
            },
            'offeringClasses': {
              'standard': true,
              'convertible': true,
            },
            'paymentOptions': {
              'all_upfront': true,
              'partial_upfront': true,
              'no_upfront': true,
            },
          },
        },
      },
      'ebs': {
        'volumeTypes': {
          'gp3': {
            'storageTypes': {
              'storage': true,
              'iops': true,
            },
          },
          'io2': {
            'storageTypes': {
              'storage': true,
              'iops': true,
            }
          },
        },
      },
    },
    'gcp': {
      'compute': {
        'purchaseTypes': {
          'ondemand': true,
          'committed-use': {
            'purchaseTerms': {
              '1yr': true,
              '3yr': true,
            },
          },
        },
      },
      'gcs': {
        'volumeTypes': {
          'localssd': true,
        }
      }
    },
  },
  managedPrices: {
    'memory': 30.66,
    'compute': 20.44,
    'general': 22.63,
    'metal': 30.66,
    'TB': 100,
  },
}