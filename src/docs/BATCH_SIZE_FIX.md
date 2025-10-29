# Batch Size Limit Fix

## The Problem

```
Batched query failed: Exception: Argument too large: value
```

When querying for 20+ instances with all the filters, the GraphQL query string becomes too large for Google Apps Script's `UrlFetchApp.fetch()` payload limit.

## The Fix

### Limited Batch Size

Changed batch threshold from:
```javascript
// OLD: Batch everything > 3 instances
let useBatch = filterTypes.length > 3;
```

To:
```javascript
// NEW: Batch only 4-10 instances (avoid payload too large)
let useBatch = filterTypes.length > 3 && filterTypes.length <= 10;
```

### Updated Fallback

Fixed the fallback to pass all parameters:
```javascript
// OLD: Missing purchaseType parameters!
return fetchAWSEC2GraphQL(instanceTypes, region, platform);

// NEW: Pass all parameters
return fetchAWSEC2GraphQL(instanceTypes, region, platform, purchaseType, purchaseTerm, offeringClass, paymentOption);
```

## Batch Strategy

| Instance Count | Strategy | API Calls |
|----------------|----------|-----------|
| 1-3 | Individual queries | 1-3 |
| 4-10 | **Batched query** | 1 ✅ |
| 11+ | Individual queries | 11+ |

### Why This Works

- **4-10 instances**: Batch query is small enough to fit in payload ✅
- **11+ instances**: Query too large, use individual queries (but pass correct parameters) ✅

## Performance Impact

### Regional Matrix (20 instances)

**Before (broken batch):**
- Tries to batch 20 instances
- Fails with "Argument too large"
- Falls back to individual queries WITHOUT purchase type parameters ❌
- Returns only on-demand pricing ❌

**After (smart batching):**
- Uses individual queries with correct parameters ✅
- Each query requests the correct purchase type ✅
- Returns requested pricing (on-demand or reserved) ✅

**API Calls:** 20 (acceptable for regional matrices)

### Smaller Queries (4-10 instances)

**After (batched):**
- Uses batched query ✅
- Returns in 1 API call ✅
- Works for both on-demand and reserved ✅

## Alternative: Chunked Batching

If you want to optimize for larger sets, we could implement chunked batching:

```javascript
// Split into chunks of 10
var chunks = [];
for (var i = 0; i < filterTypes.length; i += 10) {
  chunks.push(filterTypes.slice(i, i + 10));
}

// Query each chunk
var allResponses = [];
chunks.forEach(function(chunk) {
  var chunkResults = fetchAWSEC2GraphQLBatched(chunk, ...);
  allResponses = allResponses.concat(chunkResults);
});
```

This would give you:
- 20 instances = 2 batched queries (instead of 20 individual)
- 30 instances = 3 batched queries (instead of 30 individual)

Let me know if you want me to implement chunked batching!

## Files Updated

1. ✅ **`Fetch.js`** - Limited batch size to 10 for AWS and GCP
2. ✅ **`GraphQLBatchClient.js`** - Fixed fallback to pass all parameters
3. ✅ **`CacheUtils.js`** - Fixed cache clearing

## Testing

After deploying:

```
=AWS_EC2_ALL_BY_REGION("us-east-1", "reserved", "1yr", "standard", "no_upfront", "linux")
```

**Expected logs:**
```
Using individual GraphQL queries for 20 AWS EC2 instances (reserved)
INFO: Product [1] has valid reserved price: $X.XX
DEBUG: Building pricing structure for purchaseType="reserved"
DEBUG: Parameters - term: 1yr, class: standard, payment: no_upfront
DEBUG: Storing as reserved
```

---

**Date:** October 29, 2025  
**Issue:** Batch query payload too large for 20+ instances  
**Fix:** Limited batch size to 10 instances, fixed fallback to pass parameters  
**Status:** Ready to test

