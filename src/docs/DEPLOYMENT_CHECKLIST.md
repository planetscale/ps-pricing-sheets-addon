# Deployment Checklist

Use this checklist to deploy the fixed version to Google Apps Script.

## Pre-Deployment

- [ ] Review [FIXES_APPLIED.md](FIXES_APPLIED.md) to understand what was fixed
- [ ] Read [SETUP_VERIFICATION.md](SETUP_VERIFICATION.md) for testing procedures

## Files to Deploy

### New Files (Must Add to Apps Script)
- [ ] `src/Diagnostics.js` - Diagnostic tools
- [ ] `TROUBLESHOOTING.md` - Reference documentation
- [ ] `SETUP_VERIFICATION.md` - Reference documentation
- [ ] `FIXES_APPLIED.md` - Reference documentation

### Modified Files (Must Update in Apps Script)
- [ ] `src/Config.js` - Fixed script property handling
- [ ] `src/Tests.js` - Added pre-flight checks
- [ ] `src/functions/fetchPrice/instances.js` - Fixed empty string handling

### Existing Files (Should Already Be Deployed)
- [ ] `src/GraphQLClient.js`
- [ ] `src/GraphQLBatchClient.js`
- [ ] `src/Fetch.js`
- [ ] `src/functions/v3/AWS.js`
- [ ] `src/functions/v3/GCP.js`
- [ ] `src/functions/v3/PSDB.js`
- [ ] `src/functions/fetchPrice/volumes.js`
- [ ] `src/helper/Helper.js`

## Deployment Steps

### Step 1: Copy Files to Apps Script

For each file in the "New Files" and "Modified Files" sections above:

1. Open the file in your local editor
2. Copy the entire contents
3. In Apps Script:
   - For **new files**: Click ➕ → "Script" → Paste → Rename to match original name
   - For **modified files**: Open the existing file → Select All → Paste new contents

### Step 2: Verify All Files Are Present

In Apps Script sidebar, you should see:

```
📁 Project
  📄 appsscript.json
  📄 Config.js ⭐ UPDATED
  📄 Diagnostics.js ⭐ NEW
  📄 Fetch.js
  📄 GraphQLClient.js
  📄 GraphQLBatchClient.js
  📄 Tests.js ⭐ UPDATED
  📁 functions
    📁 fetchPrice
      📄 instances.js ⭐ UPDATED
      📄 volumes.js
    📁 v3
      📄 AWS.js
      📄 GCP.js
      📄 PSDB.js
  📁 helper
    📄 Helper.js
```

### Step 3: Configure Script Properties

1. Click ⚙️ **Project Settings**
2. Scroll to **Script Properties**
3. Add or verify these properties:

```
Property Name                     Example Value
---------------------------------  ------------------------------------
infracost_api_key                 ico-z5lYkOCvqmvgGbZEhn8p76sZ653qNHWF
awsEc2InstanceFamilyFilter        m5,m6i,r6i,c5,c6i
awsEc2InstanceSizeFilter          large,xlarge,2xlarge,4xlarge
gcpComputeInstanceFamilyFilter    n2,n2d,c2,c2d
gcpComputeInstanceSizeFilter      standard-4,standard-8,standard-16
```

**Important:** 
- Get your API key from https://dashboard.infracost.io/
- Customize instance filters based on your needs
- No spaces after commas

### Step 4: Save Everything

- [ ] Click 💾 **Save project** (or Ctrl/Cmd + S)
- [ ] Wait for "Saved" indicator
- [ ] Verify no syntax errors shown

## Testing

### Test 1: Quick Diagnostic ⚡

In Apps Script editor:

1. Select function dropdown → `quickDiag`
2. Click **Run** ▶️
3. View logs (Ctrl/Cmd + Enter)

**Expected:**
```
API Key: ✅
AWS Filters: ✅
GCP Filters: ✅
✅ All required properties are set!
✅ API connection successful!
```

**If you see ❌:** 
- Check that you've set all script properties correctly
- Verify your API key is valid

### Test 2: Full Diagnostics 🔍

1. Select function dropdown → `runDiagnostics`
2. Click **Run** ▶️
3. Review detailed output

**Expected Final Line:**
```
🎉 All diagnostics passed!
```

**If diagnostics fail:**
- Read the error messages - they'll tell you exactly what's wrong
- Fix the identified issues
- Run diagnostics again

### Test 3: Individual Function Tests 🧪

Run each of these in sequence:

```javascript
// Test AWS EC2
testAWSEC2OnDemand()
// Expected: ✅ AWS_EC2_HOURLY test PASSED

// Test GCP Compute  
testGCPComputeOnDemand()
// Expected: ✅ GCP_COMPUTE_HOURLY test PASSED

// Test PSDB (should still work)
testPSDBInstance()
// Expected: ✅ PSDB_INSTANCE_HOURLY test PASSED
```

### Test 4: Full Test Suite 🎯

1. Select function → `runAllTests`
2. Click **Run** ▶️
3. Wait for completion (may take 2-3 minutes)

**Expected:**
```
✅ Passed: 12
❌ Failed: 0
Total: 12

🎉 All tests passed! Migration successful!
```

**If any tests fail:**
- Check execution logs for details
- Most common issue: missing or incorrect script properties
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

### Test 5: Google Sheet Integration 📊

Open your Google Sheet (or create a new one):

#### Test Simple Function
In cell A1:
```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
```

**Expected:** Number like `0.192`

#### Test Regional Matrix
In cell A3:
```
=AWS_EC2_ALL_BY_REGION("us-east-1", "ondemand")
```

**Expected:** Table with headers and instance data

#### Test GCP Function  
In cell A1:
```
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "ondemand")
```

**Expected:** Number like `0.1949`

## Troubleshooting Deployment

### Issue: "Function not found" in Sheet

**Cause:** Function file not deployed or Apps Script not saved

**Solution:**
1. Verify file exists in Apps Script sidebar
2. Click Save (💾)
3. Close and reopen the spreadsheet

### Issue: "Missing required script property"

**Cause:** Script properties not configured

**Solution:**
1. Go to Project Settings ⚙️
2. Add all required properties (see Step 3 above)
3. Save
4. Re-run the function

### Issue: Functions work in editor but not in sheets

**Cause:** Authorization required

**Solution:**
1. In the sheet, try the function again
2. Click "Review Permissions" when prompted
3. Authorize the script
4. Function should work after authorization

## Post-Deployment Verification

After deployment and testing, verify:

- [ ] `quickDiag()` passes all checks
- [ ] `runDiagnostics()` shows all green
- [ ] At least 3 individual tests pass
- [ ] `runAllTests()` shows 0 failures
- [ ] Functions work when called from Google Sheet
- [ ] Regional matrix functions return data
- [ ] No authorization errors in sheet

## Rollback Plan

If the deployment has issues and you need to revert:

```bash
# In your terminal
cd /Users/lizz/Code/ps-pricing-sheets-addon
git log --oneline -5  # Find the commit before changes
git checkout <commit-hash>  # Revert to that commit
```

Then redeploy the old version to Apps Script.

## Success Criteria ✅

You'll know the deployment is successful when:

1. ✅ All diagnostics pass
2. ✅ Test suite shows 0 failures  
3. ✅ Functions return data in spreadsheet
4. ✅ No error messages in cells
5. ✅ Regional matrices populate correctly

## Next Steps After Successful Deployment

1. Update your production spreadsheets
2. Test with real-world use cases
3. Monitor execution logs for any issues
4. Consider clearing old cache: `CacheService.getScriptCache().removeAll()`

## Getting Help

If you encounter issues during deployment:

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review [SETUP_VERIFICATION.md](SETUP_VERIFICATION.md)
3. Check execution logs in Apps Script
4. Verify all files are deployed correctly

---

**Deployment Date:** _____________

**Deployed By:** _____________

**Status:** [ ] Success  [ ] Issues (see notes below)

**Notes:**
_____________________________________________________________

_____________________________________________________________

_____________________________________________________________

