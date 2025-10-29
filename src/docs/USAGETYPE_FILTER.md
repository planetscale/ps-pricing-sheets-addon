# UsageType Filter Addition

## What Changed

Added `usagetype: "BoxUsage:${instanceType}"` filter to all **on-demand** GraphQL queries.

## Why This Matters

AWS pricing API uses `usagetype` to distinguish between different billing types:

- **`BoxUsage:m5.xlarge`** - Standard on-demand ✅ What we want
- **`SpotUsage:m5.xlarge`** - Spot instances ❌
- **`HeavyUsage:m5.xlarge`** - Reserved instances (old pattern) ❌
- **Other variants** ❌

By filtering to `usagetype: "BoxUsage:${instanceType}"`, we ensure we only get standard on-demand instances.

## Pattern Breakdown

```
BoxUsage:m5.xlarge
├─ BoxUsage:     ← Fixed prefix for on-demand instances
└─ m5.xlarge     ← The instance type (dynamic)
```

The filter is constructed dynamically:
```javascript
{ key: "usagetype", value: "BoxUsage:${instanceType}" }
```

So for `m5.xlarge` it becomes:
```javascript
{ key: "usagetype", value: "BoxUsage:m5.xlarge" }
```

## Where Applied

### ✅ On-Demand Queries (with usagetype filter):
1. `GraphQLClient.js` - `fetchAWSEC2GraphQL()` 
2. `GraphQLBatchClient.js` - `fetchAWSEC2GraphQLBatched()`
3. `DebugQuery.js` - `debugSingleQuery()`
4. `Diagnostics.js` - `debugInstanceQuery()`

### ⚠️ Reserved Pricing Queries (WITHOUT usagetype filter):
1. `GraphQLClient.js` - `fetchAWSEC2ReservedPriceGraphQL()`
2. `GraphQLBatchClient.js` - `fetchAWSEC2ReservedPriceGraphQLBatched()`

**Why no filter for reserved?** Reserved instances may use different usagetype patterns (like `HeavyUsage:` or others). The price filter already specifies `purchaseOption: "reserved"` which is sufficient.

## Complete Filter Set for On-Demand

Your on-demand queries now filter on:

| Filter | Value | Purpose |
|--------|-------|---------|
| `instanceType` | m5.xlarge | Instance type |
| `operatingSystem` | Linux | OS platform |
| `tenancy` | Shared | Not dedicated hardware |
| `preInstalledSw` | NA | No pre-installed software |
| `operation` | RunInstances | Standard instances |
| `usagetype` | BoxUsage:m5.xlarge | **On-demand billing** ⭐ NEW |

## Expected Impact

**Before (with just operation filter):**
- Maybe 3-5 products (different billing types)

**After (with operation + usagetype filters):**
- **Ideally 1 product** (the exact on-demand instance we want)

## Testing

### Step 1: Deploy Files

Update in Apps Script:
1. `GraphQLClient.js`
2. `GraphQLBatchClient.js`
3. `DebugQuery.js`
4. `Diagnostics.js`

### Step 2: Clear Cache

```javascript
function clearCache() {
  CacheService.getScriptCache().removeAll();
}
```

### Step 3: Test

```javascript
debugSingleQuery('m5.xlarge', 'us-east-1', 'linux')
```

**Expected:**
```
✅ Found 1 product(s)  // ← Should be exactly 1!
✅ Valid price found!
Price: $0.192/hour
```

### Step 4: Test Your Function

```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
```

**Expected logs:**
```
INFO: Found 1 products for m5.xlarge
SUCCESS: Using product with price $0.192
```

No more searching through 32 products!

## Benefits

1. ✅ **Exactly 1 product returned** (no more searching)
2. ✅ **Faster queries** (less data to process)
3. ✅ **More reliable** (always get the right variant)
4. ✅ **No more price = 0 issues** (correct product from the start)

## Other UsageType Patterns

For reference, other `usagetype` patterns you might encounter:

- `BoxUsage:${instanceType}` - On-demand ✅
- `SpotUsage:${instanceType}` - Spot instances
- `HeavyUsage:${instanceType}:${az}` - Reserved (old)
- `DedicatedUsage:${instanceType}` - Dedicated hosts
- `HostBoxUsage:${instanceType}` - Dedicated hosts with instance billing

By using `BoxUsage:`, we explicitly target only on-demand instances.

---

**Date:** October 29, 2025  
**Change:** Added `usagetype: "BoxUsage:${instanceType}"` to on-demand queries  
**Impact:** Should return exactly 1 product instead of 32  
**Status:** Ready to test

