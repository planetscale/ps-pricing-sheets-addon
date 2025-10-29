# Setup Verification Checklist

## Before Using the Functions

Follow this checklist to ensure everything is configured correctly.

## Step 1: Script Properties ⚙️

Open **Project Settings** (gear icon) → **Script Properties** and verify these are set:

### Required Properties

- [ ] `infracost_api_key` = `ico-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - Get from: https://dashboard.infracost.io/
  
- [ ] `awsEc2InstanceFamilyFilter` = `m5,m6i,r6i,c5,c6i`
  - Customize based on your needs
  
- [ ] `awsEc2InstanceSizeFilter` = `large,xlarge,2xlarge,4xlarge`
  - Customize based on your needs
  
- [ ] `gcpComputeInstanceFamilyFilter` = `n2,n2d,c2,c2d`
  - Customize based on your needs
  
- [ ] `gcpComputeInstanceSizeFilter` = `standard-4,standard-8,standard-16`
  - Customize based on your needs

### Example Configuration

```
Property                          Value
--------------------------------  ------------------------------------
infracost_api_key                ico-z5lYkOCvqmvgGbZEhn8p76sZ653qNHWF
awsEc2InstanceFamilyFilter       m5,m6i,r6i,c5,c6i,i3
awsEc2InstanceSizeFilter         large,xlarge,2xlarge,4xlarge,8xlarge
gcpComputeInstanceFamilyFilter   n2,n2d,c2,c2d
gcpComputeInstanceSizeFilter     standard-4,standard-8,standard-16,highmem-8
```

## Step 2: Verify Files Are Deployed 📁

In the Apps Script editor, verify these files exist in the left sidebar:

### Core Files (Must Exist)
- [ ] `Config.js` - Configuration
- [ ] `Fetch.js` - Data fetching logic
- [ ] `GraphQLClient.js` - GraphQL API client
- [ ] `GraphQLBatchClient.js` - Batched queries
- [ ] `Helper.js` (in helper folder)

### Function Files (Must Exist)
- [ ] `AWS.js` (in functions/v3 folder)
- [ ] `GCP.js` (in functions/v3 folder)
- [ ] `PSDB.js` (in functions/v3 folder)
- [ ] `instances.js` (in functions/fetchPrice folder)
- [ ] `volumes.js` (in functions/fetchPrice folder)

### Optional Files
- [ ] `Tests.js` - Test suite
- [ ] `Diagnostics.js` - Diagnostic tools
- [ ] `CacheLoader.js` - Cache utilities

## Step 3: Run Diagnostics 🔍

### Quick Check
In Apps Script editor:
1. Select function: `quickDiag`
2. Click **Run**
3. View logs (Ctrl/Cmd + Enter or View → Logs)

Expected output:
```
API Key: ✅
AWS Filters: ✅
GCP Filters: ✅
✅ All required properties are set!
✅ API connection successful!
```

### Full Diagnostics
1. Select function: `runDiagnostics`
2. Click **Run**
3. Review detailed output

Expected final line:
```
🎉 All diagnostics passed!
```

## Step 4: Test Individual Functions 🧪

### Test AWS EC2
Run in Apps Script editor:
```javascript
function testAWS() {
  var price = AWS_EC2_HOURLY('m5.xlarge', 'us-east-1', 'ondemand', '', '', '', 'linux');
  Logger.log('AWS EC2 m5.xlarge price: $' + price);
}
```

Expected: `AWS EC2 m5.xlarge price: $0.192` (approximately)

### Test GCP Compute
Run in Apps Script editor:
```javascript
function testGCP() {
  var price = GCP_COMPUTE_HOURLY('n2-standard-4', 'us-central1', 'ondemand');
  Logger.log('GCP n2-standard-4 price: $' + price);
}
```

Expected: `GCP n2-standard-4 price: $0.1949` (approximately)

## Step 5: Test in Google Sheet 📊

### Simple Test
In any cell of your spreadsheet:

```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
```

Expected: `0.192` (or similar number)

### If You See an Error
1. Check the error message
2. Click on the cell to see the full error
3. Refer to [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

Common errors:
- `#ERROR!` - Usually missing script properties
- `#REF!` - Function not recognized (file not deployed)
- `#VALUE!` - Wrong parameter type

## Step 6: Test Matrix Functions 📈

### AWS Regional Matrix
In your spreadsheet:

```
=AWS_EC2_ALL_BY_REGION("us-east-1", "ondemand")
```

Expected: A table with headers and multiple rows of instance data

### GCP Regional Matrix
In your spreadsheet:

```
=GCP_COMPUTE_ALL_BY_REGION("us-central1", "ondemand")
```

Expected: A table with headers and multiple rows of instance data

## Verification Checklist Summary

Use this quick checklist:

- [ ] All 5 script properties are set
- [ ] Infracost API key is valid (starts with `ico-`)
- [ ] All core files are visible in Apps Script editor
- [ ] `quickDiag()` passes all checks
- [ ] `runDiagnostics()` shows all green checkmarks
- [ ] Test functions work in Apps Script editor
- [ ] Functions return values (not errors) in spreadsheet
- [ ] Matrix functions return data tables

## If Everything Passes ✅

Congratulations! Your setup is complete. You can now:

1. Use all custom functions in your spreadsheets
2. Create pricing comparison tables
3. Build cost analysis dashboards

## If Something Fails ❌

1. Review the error message carefully
2. Check the specific step that failed
3. Refer to [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
4. Run `runDiagnostics()` to identify the issue

## Common Setup Mistakes

### Mistake 1: Wrong API Key Format
❌ `your-key-here`
✅ `ico-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Mistake 2: Missing Commas in Filters
❌ `m5 m6i r6i`
✅ `m5,m6i,r6i`

### Mistake 3: Spaces in Filters
❌ `m5, m6i, r6i`
✅ `m5,m6i,r6i`

### Mistake 4: Forgot to Save Script
- Always save (Ctrl/Cmd + S) after making changes
- Wait for "Saved" indicator before testing

### Mistake 5: Old Cache
If functions worked before but stopped:
```javascript
function clearOldCache() {
  CacheService.getScriptCache().removeAll();
  Logger.log('Cache cleared!');
}
```

## Need Help?

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions to common problems.

---

**Last Updated:** October 29, 2025

