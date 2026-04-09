// In-memory cache for sheet config (shared across all getters)
var _sheetConfig = null;
var _sheetConfigLoadedAt = 0;
var _SHEET_CONFIG_TTL_MS = 30000; // 30 seconds

function _getSheetConfig() {
  var now = new Date().getTime();
  if (_sheetConfig && (now - _sheetConfigLoadedAt) < _SHEET_CONFIG_TTL_MS) {
    return _sheetConfig;
  }
  try {
    _sheetConfig = readConfigSheet();
    _sheetConfigLoadedAt = now;
  } catch (e) {
    // Can't read sheet (AuthMode.LIMITED, or no active spreadsheet)
    _sheetConfig = null;
  }
  return _sheetConfig;
}

function _clearSheetConfigCache() {
  _sheetConfig = null;
  _sheetConfigLoadedAt = 0;
}

// Helper: read a comma-separated ScriptProperty into an array. Returns [] if missing.
function getScriptPropertyArray(propertyName) {
  var value = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!value) return [];
  return value.split(',').map(function(item) { return item.trim(); });
}

// Helper: parse a float from sheet config with fallback
function _parseConfigFloat(sheetConfig, key, defaultValue) {
  if (!sheetConfig || !(key in sheetConfig)) return defaultValue;
  var val = parseFloat(sheetConfig[key]);
  return isNaN(val) ? defaultValue : val;
}

// Helper: parse a comma-separated string from sheet config into an array
function _parseConfigArray(sheetConfig, key, fallbackPropertyName) {
  if (sheetConfig && sheetConfig[key]) {
    var str = String(sheetConfig[key]).trim();
    if (str) {
      return str.split(',').map(function(s) { return s.trim(); });
    }
  }
  return getScriptPropertyArray(fallbackPropertyName);
}

var _MANAGED_PRICE_DEFAULTS = {
  memory: 30.66,
  compute: 20.44,
  general: 22.63,
  metal: 30.66,
  TB: 100,
};

var cfg = {
  psApiBase: 'https://api.planetscale.com/v1/organizations/',
  psApiOrg: PropertiesService.getScriptProperties().getProperty('psApiOrg') || 'planetscale-demo',
  psApiToken: PropertiesService.getScriptProperties().getProperty('psApiToken'),
  psWebApi: 'https://api.planetscale.com/www/',
  hoursPerMonth: 730,
  environment: "production",
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

  get managedPrices() {
    var sc = _getSheetConfig();
    return {
      memory: _parseConfigFloat(sc, 'managedPrices.memory', _MANAGED_PRICE_DEFAULTS.memory),
      compute: _parseConfigFloat(sc, 'managedPrices.compute', _MANAGED_PRICE_DEFAULTS.compute),
      general: _parseConfigFloat(sc, 'managedPrices.general', _MANAGED_PRICE_DEFAULTS.general),
      metal: _parseConfigFloat(sc, 'managedPrices.metal', _MANAGED_PRICE_DEFAULTS.metal),
      TB: _parseConfigFloat(sc, 'managedPrices.TB', _MANAGED_PRICE_DEFAULTS.TB),
    };
  },

  get awsEc2InstanceFamilyFilter() {
    return _parseConfigArray(_getSheetConfig(), 'awsEc2InstanceFamilyFilter', 'awsEc2InstanceFamilyFilter');
  },

  get awsEc2InstanceSizeFilter() {
    return _parseConfigArray(_getSheetConfig(), 'awsEc2InstanceSizeFilter', 'awsEc2InstanceSizeFilter');
  },

  get gcpComputeInstanceFamilyFilter() {
    return _parseConfigArray(_getSheetConfig(), 'gcpComputeInstanceFamilyFilter', 'gcpComputeInstanceFamilyFilter');
  },

  get gcpComputeInstanceSizeFilter() {
    return _parseConfigArray(_getSheetConfig(), 'gcpComputeInstanceSizeFilter', 'gcpComputeInstanceSizeFilter');
  },
};
