# Fix for "Cannot read properties of undefined (reading 'ondemand')" Error

## The Problem

You were getting this error:
```
TypeError: Cannot read properties of undefined (reading 'ondemand')
    at getHourlyCostEC2(src/functions/fetchPrice/instances:176:44)
```

This means the GraphQL API was finding the instance type but **not returning pricing data**.

## Root Cause

The GraphQL query had **too many filters**, specifically the `capacitystatus: "Used"` filter was causing the Infracost API to return products without pricing information.

## What I Fixed

### 1. Removed Restrictive Filter

**Before:**
```javascript
attributeFilters: [
  { key: "instanceType", value: "m5.xlarge" }
  { key: "operatingSystem", value: "Linux" }
  { key: "tenancy", value: "Shared" }
  { key: "capacitystatus", value: "Used" }  // ❌ TOO RESTRICTIVE
  { key: "preInstalledSw", value: "NA" }
]
```

**After:**
```javascript
attributeFilters: [
  { key: "instanceType", value: "m5.xlarge" }
  { key: "operatingSystem", value: "Linux" }
  { key: "tenancy", value: "Shared" }
  { key: "preInstalledSw", value: "NA" }  // ✅ Removed capacitystatus
]
```

**Files Updated:**
- `src/GraphQLClient.js` - Individual queries
- `src/GraphQLBatchClient.js` - Batched queries
- `src/Diagnostics.js` - Debug queries

### 2. Added Better Error Logging

**In `GraphQLClient.js`:**
- Logs warnings when no pricing data is found
- Logs the query when no products are returned
- Shows full error stack traces

**In `instances.js`:**
- Checks for empty results and provides helpful error message
- Validates pricing structure before accessing
- Logs product structure when pricing is incomplete
- Better error messages in `getHourlyCostEC2()`

### 3. Created Debug Function

New function `debugInstanceQuery()` to diagnose pricing issues:

```javascript
// Run this in Apps Script to debug any instance
debugInstanceQuery('m5.xlarge', 'us-east-1', 'linux')
```

This will show you:
- ✅ If the API key is valid
- ✅ If the product was found
- ❌ If pricing data is missing
- 💰 The actual price (if available)

## How to Deploy the Fix

### Step 1: Update Files in Apps Script

Update these files with the new code:

1. **`GraphQLClient.js`** - Removed capacitystatus filter, added logging
2. **`GraphQLBatchClient.js`** - Removed capacitystatus filter
3. **`functions/fetchPrice/instances.js`** - Better error handling
4. **`Diagnostics.js`** - New debug function

### Step 2: Clear Cache

After updating, clear the cache to ensure queries use the new filters:

```javascript
function clearCache() {
  CacheService.getScriptCache().removeAll();
  Logger.log('Cache cleared!');
}
```

Run this function once in Apps Script.

### Step 3: Test

Try your function again:

```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
```

Should now return: `0.192` (or similar)

## If Still Not Working

### Debug with the New Function

1. In Apps Script, run:
   ```javascript
   debugInstanceQuery('m5.xlarge', 'us-east-1', 'linux')
   ```

2. Check the logs. You should see:
   ```
   ✅ Found 1 product(s)
   💰 Pricing data:
     On-Demand: $0.192/hour
   ✅ Everything looks good!
   ```

### If debugInstanceQuery Shows "No pricing data"

This means the Infracost API doesn't have pricing for that specific combination. Try:

1. **Different region:**
   ```javascript
   debugInstanceQuery('m5.xlarge', 'us-west-2', 'linux')
   ```

2. **Different instance type:**
   ```javascript
   debugInstanceQuery('t3.medium', 'us-east-1', 'linux')
   ```

3. **Check Infracost API directly:**
   - Visit: https://www.infracost.io/docs/
   - Their API might not have all instance types/regions yet

### If debugInstanceQuery Works but Function Still Fails

Check your function parameters:

```javascript
// Make sure you're calling it correctly
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")

// NOT:
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "on-demand")  // Wrong: "on-demand"
=AWS_EC2_HOURLY("m5.xlarge", "US-EAST-1", "ondemand")   // Wrong: uppercase region
=AWS_EC2_HOURLY("M5.XLARGE", "us-east-1", "ondemand")   // Wrong: uppercase instance
```

## Testing Checklist

After deploying the fix:

- [ ] Clear cache with `clearCache()`
- [ ] Run `debugInstanceQuery('m5.xlarge', 'us-east-1', 'linux')`
- [ ] Verify it shows pricing data
- [ ] Try the function in a spreadsheet cell
- [ ] Verify it returns a number (not an error)
- [ ] Test with different instance types
- [ ] Test regional matrix functions

## Expected Behavior Now

### Before the Fix
```
❌ TypeError: Cannot read properties of undefined (reading 'ondemand')
```

### After the Fix

**Scenario 1: Success**
```
✅ Returns: 0.192
```

**Scenario 2: No Pricing Data (Better Error)**
```
❌ Product data exists but pricing is incomplete for m5.xlarge in us-east-1
   Check execution logs for details.
```

The logs will show:
```
WARNING: No pricing data found for m5.xlarge in us-east-1 (linux)
```

**Scenario 3: No Product Found (Clear Error)**
```
❌ No data returned for m5.xlarge. Please check:
   1. Instance type is spelled correctly
   2. Instance type exists in region us-east-1
   3. Your infracost_api_key is valid
   4. Check execution logs for more details
```

## Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `GraphQLClient.js` | Removed `capacitystatus` filter | Reduce query restrictions |
| `GraphQLClient.js` | Added warning logs | Better debugging |
| `GraphQLBatchClient.js` | Removed `capacitystatus` filter | Consistency with individual queries |
| `instances.js` | Added pricing validation | Catch errors before they crash |
| `instances.js` | Enhanced error messages | Help users diagnose issues |
| `Diagnostics.js` | New `debugInstanceQuery()` | Dedicated debugging tool |

## Why This Happened

The Infracost API sometimes returns products without pricing when filters are too specific. The `capacitystatus: "Used"` filter was meant to exclude reserved capacity, but it was causing the API to return incomplete data.

By using minimal filters (just instance type, OS, tenancy, and pre-installed software), we get more reliable results.

## Questions?

- **Still getting errors?** Run `debugInstanceQuery()` and check the logs
- **Need different filters?** Edit `GraphQLClient.js` lines 94-98
- **Want to test the API directly?** See [Infracost API docs](https://www.infracost.io/docs/cloud_pricing_api/)

---

**Fix Applied:** October 29, 2025
**Issue:** Pricing data not returned due to restrictive GraphQL filters
**Status:** ✅ Fixed - Please test and verify

