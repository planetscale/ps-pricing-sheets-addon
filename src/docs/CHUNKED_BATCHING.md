# Chunked Batching Implementation

## The Problem

When querying 20+ instances in a regional matrix, the batched GraphQL query became too large:
```
Exception: Argument too large: value
```

## The Solution: Chunked Batching

Instead of choosing between "all batched" or "all individual", we now use **chunked batching**:

### Split large sets into chunks of 10 instances
- Chunk 1: instances 1-10 → 1 batched query
- Chunk 2: instances 11-20 → 1 batched query
- Chunk 3: instances 21-30 → 1 batched query

## Strategy by Size

| Instance Count | Strategy | API Calls |
|----------------|----------|-----------|
| 1-3 | Individual queries | 1-3 |
| 4-10 | **1 batched query** | 1 |
| 11-20 | **2 batched queries** (chunks of 10) | 2 |
| 21-30 | **3 batched queries** (chunks of 10) | 3 |
| 31-40 | **4 batched queries** (chunks of 10) | 4 |

## Performance Comparison

### Regional Matrix: 20 Instances

**Before (broken):**
```
Tries to batch all 20 → "Argument too large" error
Falls back to 20 individual queries WITHOUT purchaseType
Returns wrong data (ondemand instead of reserved)
API Calls: 20
```

**After (chunked batching):**
```
Splits into 2 chunks of 10
Batch 1: instances 1-10 (1 query) ✅
Batch 2: instances 11-20 (1 query) ✅
Returns correct data (reserved pricing)
API Calls: 2 ✨ 90% reduction!
```

## Implementation Details

### Chunking Logic

```javascript
var chunkSize = 10;
var totalChunks = Math.ceil(filterTypes.length / chunkSize);

for (var i = 0; i < filterTypes.length; i += chunkSize) {
    var chunk = filterTypes.slice(i, i + chunkSize);
    
    // Query this chunk
    var chunkResults = fetchAWSEC2GraphQLBatched(
        chunk, region, platform, purchaseType, 
        purchaseTerm, offeringClass, paymentOption
    );
    
    // Accumulate results
    responses = responses.concat(chunkResults);
}
```

### Error Handling

If a chunk fails, only that chunk falls back to individual queries:

```javascript
try {
    var chunkResults = fetchAWSEC2GraphQLBatched(chunk, ...);
    responses = responses.concat(chunkResults);
} catch (err) {
    // Fallback to individual queries for this chunk only
    var individualResults = fetchAWSEC2GraphQL(chunk, ...);
    responses = responses.concat(individualResults);
}
```

## Example Logs

### 20 Instances (Reserved Pricing):

```
Using chunked batched GraphQL for 20 AWS EC2 instances (reserved)
Splitting into 2 batches of up to 10 instances each

Processing batch 1/2 (10 instances)...
Batched AWS EC2 query for 10 instances in us-east-1 (reserved)
  ✅ Batch 1 completed: 10 instances

Processing batch 2/2 (10 instances)...
Batched AWS EC2 query for 10 instances in us-east-1 (reserved)
  ✅ Batch 2 completed: 10 instances

Total instances fetched: 20/20
```

### 5 Instances (On-Demand):

```
Using chunked batched GraphQL for 5 AWS EC2 instances (ondemand)
Splitting into 1 batches of up to 10 instances each

Processing batch 1/1 (5 instances)...
Batched AWS EC2 query for 5 instances in us-east-1 (ondemand)
  ✅ Batch 1 completed: 5 instances

Total instances fetched: 5/5
```

## Benefits

1. ✅ **No more "Argument too large" errors** - Each batch stays under limit
2. ✅ **Efficient** - 20 instances = 2 API calls (not 20!)
3. ✅ **Scalable** - Works with any number of instances
4. ✅ **Resilient** - If one batch fails, others continue
5. ✅ **Correct data** - Passes purchaseType to all queries

## Chunk Size Tuning

Currently set to **10 instances per chunk**. You can adjust if needed:

```javascript
var chunkSize = 10;  // Current setting

// Options:
var chunkSize = 5;   // More conservative (smaller queries)
var chunkSize = 15;  // More aggressive (risk "Argument too large")
```

**Recommended:** Keep at 10 - good balance between efficiency and safety.

## Files Updated

1. ✅ **`Fetch.js`** - Implemented chunked batching for AWS
2. ✅ **`Fetch.js`** - Implemented chunked batching for GCP
3. ✅ **`GraphQLBatchClient.js`** - Fixed fallback to pass all parameters

## Testing

### Test 20 Instances (Regional Matrix):
```
=AWS_EC2_ALL_BY_REGION("us-east-1", "reserved", "1yr", "standard", "no_upfront", "linux")
```

**Expected:**
- 2 batched queries
- All instances return reserved pricing
- ~4-8 seconds (instead of 20+ seconds)

### Test 5 Instances:
```
=AWS_EC2_ALL_BY_REGION("us-east-1", "ondemand")
```

**Expected:**
- 1 batched query
- ~2-3 seconds

---

**Date:** October 29, 2025  
**Issue:** Batch queries too large for 20+ instances  
**Fix:** Chunked batching (10 instances per chunk)  
**Impact:** 20 instances = 2 API calls instead of 1 failed + 20 fallback  
**Status:** Ready to test

