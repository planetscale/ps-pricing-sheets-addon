# GraphQL Filter Update - Added operation Filter

## What Changed

Added `operation: "RunInstances"` filter to all GraphQL queries.

## Why This Helps

AWS EC2 has different "operations" in their pricing API:
- **`RunInstances`** - Standard on-demand instances (what we want)
- `RunInstances:0002` - Spot instances
- `RunInstances:0010` - Reserved instances (different variant)
- `RunInstances:SV###` - Savings Plans
- And others...

By filtering to `operation: "RunInstances"`, we should significantly reduce the number of products returned (from 32 down to ideally 1-3).

## Updated Query Structure

**Before:**
```graphql
attributeFilters: [
  { key: "instanceType", value: "m5.xlarge" }
  { key: "operatingSystem", value: "Linux" }
  { key: "tenancy", value: "Shared" }
  { key: "preInstalledSw", value: "NA" }
]
```

**After:**
```graphql
attributeFilters: [
  { key: "instanceType", value: "m5.xlarge" }
  { key: "operatingSystem", value: "Linux" }
  { key: "tenancy", value: "Shared" }
  { key: "preInstalledSw", value: "NA" }
  { key: "operation", value: "RunInstances" }  // ← NEW
]
```

## Files Updated

1. ✅ `src/GraphQLClient.js` - On-demand and reserved queries
2. ✅ `src/GraphQLBatchClient.js` - Batched on-demand and reserved queries
3. ✅ `src/DebugQuery.js` - Debug queries
4. ✅ `src/Diagnostics.js` - Diagnostic query

## Testing

### Step 1: Deploy Updated Files

Update these in Apps Script:
1. `GraphQLClient.js`
2. `GraphQLBatchClient.js`
3. `DebugQuery.js`
4. `Diagnostics.js`

### Step 2: Clear Cache

```javascript
function clearCache() {
  CacheService.getScriptCache().removeAll();
  Logger.log('Cache cleared!');
}
```

### Step 3: Test

```javascript
debugSingleQuery('m5.xlarge', 'us-east-1', 'linux')
```

**Before:** 
```
✅ Found 32 product(s)
```

**Expected After:**
```
✅ Found 1-3 product(s)  // Much fewer!
```

### Step 4: Try the Function

```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
```

The logs should now show:
```
INFO: Found 1 products for m5.xlarge  // Ideally just 1!
INFO: Product [0] has valid on-demand price: $0.192
SUCCESS: Using product with price $0.192
```

## Current Filter Set

Our complete filter set is now:

| Filter | Value | Purpose |
|--------|-------|---------|
| `vendorName` | "aws" | Cloud provider |
| `service` | "AmazonEC2" | AWS service |
| `productFamily` | "Compute Instance" | Product type |
| `region` | (variable) | Geographic region |
| `instanceType` | (variable) | Instance size/type |
| `operatingSystem` | (variable) | OS platform |
| `tenancy` | "Shared" | Shared hardware |
| `preInstalledSw` | "NA" | No pre-installed software |
| `operation` | "RunInstances" | Standard instances ⭐ NEW |

## If Still Returning Multiple Products

If you still get multiple products after adding this filter, run:

```javascript
investigateAllAttributes('m5.xlarge', 'us-east-1', 'linux')
```

This will show which other attributes differ and could be used for additional filtering.

Possible additional filters to consider:
- `marketoption` - "OnDemand" vs others
- `licenseModel` - License type
- `normalizationSizeFactor` - Instance size factor

## Benefits

1. ✅ Fewer products to search through (32 → hopefully 1-3)
2. ✅ Faster queries (less data to process)
3. ✅ More reliable (don't need to search for the right product)
4. ✅ Correct data (filtering out spot, reserved variants upfront)

---

**Date:** October 29, 2025  
**Change:** Added `operation: "RunInstances"` filter to all GraphQL queries  
**Status:** Ready to test

