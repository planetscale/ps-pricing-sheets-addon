var CONFIG_SHEET_NAME = 'PS Config';

var CONFIG_DEFAULTS = {
  'managedPrices.memory': 30.66,
  'managedPrices.compute': 20.44,
  'managedPrices.general': 22.63,
  'managedPrices.metal': 30.66,
  'managedPrices.TB': 100,
  'awsEc2InstanceFamilyFilter': '',
  'awsEc2InstanceSizeFilter': '',
  'gcpComputeInstanceFamilyFilter': '',
  'gcpComputeInstanceSizeFilter': '',
};

var CONFIG_SECTIONS = [
  { header: '# PlanetScale Managed Pricing (monthly rates per vCPU, except TB which is per TB)', keys: [
    'managedPrices.memory',
    'managedPrices.compute',
    'managedPrices.general',
    'managedPrices.metal',
    'managedPrices.TB',
  ]},
  { header: '# AWS Instance Filters (comma-separated)', keys: [
    'awsEc2InstanceFamilyFilter',
    'awsEc2InstanceSizeFilter',
  ]},
  { header: '# GCP Instance Filters (comma-separated)', keys: [
    'gcpComputeInstanceFamilyFilter',
    'gcpComputeInstanceSizeFilter',
  ]},
];

/**
 * Ensure the hidden "PS Config" sheet exists. Creates it with defaults if missing.
 * Idempotent -- safe to call from any context with AuthMode.FULL.
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureConfigSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (sheet) return sheet;

  sheet = ss.insertSheet(CONFIG_SHEET_NAME);

  // Seed filter defaults from ScriptProperties (migration path)
  var props = PropertiesService.getScriptProperties();
  var seedDefaults = {};
  Object.keys(CONFIG_DEFAULTS).forEach(function(key) {
    seedDefaults[key] = CONFIG_DEFAULTS[key];
  });

  var filterKeys = [
    'awsEc2InstanceFamilyFilter',
    'awsEc2InstanceSizeFilter',
    'gcpComputeInstanceFamilyFilter',
    'gcpComputeInstanceSizeFilter',
  ];
  filterKeys.forEach(function(key) {
    var propVal = props.getProperty(key);
    if (propVal) {
      seedDefaults[key] = propVal;
    }
  });

  // Build rows: section headers + key-value pairs
  var rows = [];
  CONFIG_SECTIONS.forEach(function(section) {
    rows.push([section.header, '']);
    section.keys.forEach(function(key) {
      rows.push([key, seedDefaults[key]]);
    });
  });

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);

  // Auto-size columns for readability
  sheet.autoResizeColumn(1);
  sheet.autoResizeColumn(2);

  // Bold the section headers
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).charAt(0) === '#') {
      sheet.getRange(i + 1, 1, 1, 2).setFontWeight('bold');
    }
  }

  sheet.hideSheet();
  return sheet;
}

/**
 * Read the config sheet into a {key: value} object.
 * Skips rows where column A starts with '#' or is empty.
 * @return {Object}
 */
function readConfigSheet() {
  var sheet = ensureConfigSheet();
  var data = sheet.getDataRange().getValues();
  var config = {};

  for (var i = 0; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    if (!key || key.charAt(0) === '#') continue;
    config[key] = data[i][1];
  }

  return config;
}

/**
 * Write a {key: value} object to the config sheet, matching keys to existing rows.
 * @param {Object} updates
 */
function writeConfigValues(updates) {
  var sheet = ensureConfigSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 0; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    if (key in updates) {
      sheet.getRange(i + 1, 2).setValue(updates[key]);
    }
  }
}

/**
 * Entry point for google.script.run from the sidebar.
 * @return {Object} current config values
 */
function getConfigForSidebar() {
  return readConfigSheet();
}

/**
 * Entry point for google.script.run from the sidebar.
 * Saves values and clears the in-memory cache.
 * @param {Object} formData - {key: value} pairs to save
 */
function saveConfigFromSidebar(formData) {
  writeConfigValues(formData);
  _clearSheetConfigCache();
}

/**
 * Delete the config sheet and recreate it from defaults.
 * Clears the in-memory cache.
 */
function resetConfigToDefaults() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (sheet) {
    ss.deleteSheet(sheet);
  }
  ensureConfigSheet();
  _clearSheetConfigCache();
}
