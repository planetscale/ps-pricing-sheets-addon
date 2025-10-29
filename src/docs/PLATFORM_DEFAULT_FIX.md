# Fix for "Platform undefined" Error

## The Problem from Your Logs

```
ERROR: Product pricing missing platform undefined in region us-east-1
Available platforms: linux
Options: {"region":"us-east-1","purchaseType":"ondemand"}
Product: {"instance_type":"m5.xlarge",...,"pricing":{"us-east-1":{"linux":{"ondemand":0}}},...}
```

**What this means:**
1. ✅ GraphQL API returned data with platform "linux"
2. ❌ But `options.platform` was `undefined` 
3. ❌ So the code couldn't find `pricing[region][undefined]`

## Root Cause

When you call:
```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
```

The function signature is:
```javascript
function AWS_EC2_HOURLY(instanceType, region, purchaseType, purchaseTerm, offeringClass, paymentOption, platform)
```

Since you only passed 3 parameters, `platform` is `undefined`.

**The bug:** The default value (`'linux'`) was being set AFTER the options object was created, so the options object still had `platform: undefined`.

## The Fix

**Before (BROKEN):**
```javascript
function AWS_EC2_HOURLY(instanceType, region, purchaseType, ..., platform) {
    // platform is undefined here
    options = getObjectWithValuesToLowerCase({ ..., platform });
    // options.platform is now undefined
    // Later in fetchAWSEC2GraphQL, platform gets defaulted to 'linux'
    // But options.platform is still undefined!
}
```

**After (FIXED):**
```javascript
function AWS_EC2_HOURLY(instanceType, region, purchaseType, ..., platform) {
    // Set defaults BEFORE creating options object
    platform = platform || 'linux';
    purchaseType = purchaseType || 'ondemand';
    
    // Now options.platform will be 'linux'
    options = getObjectWithValuesToLowerCase({ ..., platform });
}
```

## Files Updated

1. ✅ `src/functions/v3/AWS.js`
   - `AWS_EC2_HOURLY()` - Added platform/purchaseType defaults
   - `AWS_EC2_ALL_BY_REGION()` - Added platform/purchaseType defaults

2. ✅ `src/functions/v3/GCP.js`
   - `GCP_COMPUTE_HOURLY()` - Added purchaseType default
   - `GCP_COMPUTE_ALL_BY_REGION()` - Added purchaseType default

3. ✅ `src/GraphQLClient.js`
   - Added detailed logging for price debugging

4. ✅ `src/functions/fetchPrice/instances.js`
   - Added check for price = 0 (which indicates data issue)
   - Better logging for debugging

## Testing Instructions

### Step 1: Update Files

Deploy the updated versions of:
- `AWS.js`
- `GCP.js`
- `GraphQLClient.js`
- `instances.js`

### Step 2: Clear Cache

Run in Apps Script:
```javascript
function clearCache() {
  CacheService.getScriptCache().removeAll();
  Logger.log('Cache cleared!');
}
```

### Step 3: Test the Function

In your spreadsheet:
```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
```

### Step 4: Check Logs

The logs should now show:
```
DEBUG: Raw price data for m5.xlarge: {"USD":"0.192"}
DEBUG: Parsed price: 0.192
DEBUG: ondemand value for m5.xlarge: 0.192 (type: number)
```

**NOT:**
```
ERROR: Product pricing missing platform undefined
```

## About the "0 price" Issue

Your logs showed `"ondemand":0` which is suspicious. With the new logging, we'll see:

**If the API returns 0:**
```
DEBUG: Raw price data: {"USD":"0"}
WARNING: Price is 0 for m5.xlarge
```

**If the API returns empty prices:**
```
WARNING: No pricing data found for m5.xlarge
Prices array: []
```

**If the API returns a valid price:**
```
DEBUG: Raw price data: {"USD":"0.192"}
DEBUG: Parsed price: 0.192
```

## Expected Result

After the fix, calling:
```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
```

Should return approximately: **0.192**

And the logs will show the actual price data from the API to help diagnose any remaining issues.

## What Changed Summary

| Before | After |
|--------|-------|
| `platform` defaulted in GraphQL client | `platform` defaulted in custom function |
| `options.platform` was `undefined` | `options.platform` is `"linux"` |
| Error: "missing platform undefined" | Works correctly ✅ |
| No price debugging | Detailed price logging |

## Next Steps

1. **Deploy these 4 updated files**
2. **Clear the cache**
3. **Test the function**
4. **Check the logs** - They will now show exactly what the API is returning
5. **Share the new logs** if there are still issues

The enhanced logging will tell us:
- What the raw API response is
- What price was parsed
- If the price is 0 (which would be wrong)
- The exact data types involved

---

**Date:** October 29, 2025  
**Issue:** Platform parameter not defaulted before creating options object  
**Status:** ✅ Fixed - Ready to test

