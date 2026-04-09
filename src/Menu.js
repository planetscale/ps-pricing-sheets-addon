/**
 * Runs when the spreadsheet is opened. Adds the addon menu.
 * Runs in AuthMode.LIMITED for add-ons -- only menu creation is safe here.
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createAddonMenu()
    .addItem('Settings', 'showSettingsSidebar')
    .addToUi();
}

/**
 * Runs when the add-on is first installed. Has AuthMode.FULL.
 */
function onInstall(e) {
  onOpen(e);
  ensureConfigSheet();
}

/**
 * Opens the settings sidebar. Called from the addon menu.
 */
function showSettingsSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('src/Sidebar')
    .setTitle('PS Pricing Settings');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Homepage trigger declared in appsscript.json.
 */
function buildSideBar() {
  showSettingsSidebar();
}
