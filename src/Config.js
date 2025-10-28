const cfg = {
  psWebApi: 'https://api.planetscale.com/www/',
  hoursPerMonth: 730,
  awsEc2InstanceFamilyFilter: PropertiesService.getScriptProperties().getProperty('awsEc2InstanceFamilyFilter').split(','), // These limit the number of instance families we check for EC2, to limit the sizes of our FireStore calls.
  awsEc2InstanceSizeFilter: PropertiesService.getScriptProperties().getProperty('awsEc2InstanceSizeFilter').split(','), // These limit the number of instance sizes we check for EC2 and RDS, to limit the sizes of our FireStore calls.
  gcpComputeInstanceFamilyFilter: PropertiesService.getScriptProperties().getProperty('gcpComputeInstanceFamilyFilter').split(','), // These limit the number of instance families we check for GCP, to limit the sizes of our FireStore calls.
  gcpComputeInstanceSizeFilter: PropertiesService.getScriptProperties().getProperty('gcpComputeInstanceSizeFilter').split(','), // These limit the number of instance sizes we check for GCP, to limit the sizes of our FireStore calls.
  fsEmail: PropertiesService.getScriptProperties().getProperty('fs_email'),
  fsKey: PropertiesService.getScriptProperties().getProperty('fs_key').replace(/\\n/g, '\n'),
  fsLimit: 30,
  fsProjectId: PropertiesService.getScriptProperties().getProperty('fs_projectid'),
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