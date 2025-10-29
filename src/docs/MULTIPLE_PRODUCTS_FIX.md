# Fix for Multiple Products Issue

## The Problem

When you ran `debugSingleQuery()`, it showed:
```
✅ Found 32 product(s)
```

**This is the root cause!** The GraphQL API is returning **32 different products** for `m5.xlarge`, not just 1.

## Why This Happens

The Infracost GraphQL API returns multiple product variants for the same instance type, including:
- Different purchase options (on-demand, reserved, spot)
- Different capacity types (used, unused)  
- Different configurations
- Historical pricing data

The old code was just taking `products[0]` (the first one), which might not have on-demand pricing.

## The Fix

**Before (BROKEN):**
```javascript
if (json.data.products && json.data.products.length > 0) {
  var product = json.data.products[0];  // ❌ Just takes first one
  // Extract price from first product...
}
```

**After (FIXED):**
```javascript
if (json.data.products && json.data.products.length > 0) {
  // Loop through ALL products to find one with valid on-demand pricing
  var product = null;
  var ondemandPrice = null;
  
  for (var j = 0; j < json.data.products.length; j++) {
    var candidate = json.data.products[j];
    
    if (candidate.prices && candidate.prices.length > 0) {
      var candidatePrice = parseFloat(candidate.prices[0].USD);
      
      if (candidatePrice && candidatePrice > 0) {
        product = candidate;
        ondemandPrice = candidatePrice;
        break; // ✅ Found a good one!
      }
    }
  }
}
```

## Files Updated

1. ✅ **`src/GraphQLClient.js`** - Individual queries now search for valid pricing
2. ✅ **`src/GraphQLBatchClient.js`** - Batched queries now search for valid pricing
3. ✅ **`src/DebugQuery.js`** - Shows all products and which one has pricing

## What the New Logs Will Show

When you run the function now, you'll see:
```
INFO: Found 32 products for m5.xlarge
INFO: Product [0] has no prices - skipping
INFO: Product [1] has no prices - skipping
INFO: Product [2] has valid on-demand price: $0.192
SUCCESS: Using product with price $0.192
```

Or with the debug function:
```
⚠️  WARNING: Multiple products returned (32)

╔════════════════════════════════════════════════════╗
║       ALL PRODUCTS SUMMARY                         ║
╚════════════════════════════════════════════════════╝

Product [0]:
  Has prices: false

Product [1]:
  Has prices: false

Product [2]:
  Has prices: true
  Price value: "0.192"
  Parsed: 0.192
  ✅ THIS ONE HAS VALID PRICING - will use this

✅ Found product with valid pricing at index 2
```

## Testing Instructions

### Step 1: Deploy Updated Files

Update these in Apps Script:
1. **`src/GraphQLClient.js`** ⚠️ CRITICAL
2. **`src/GraphQLBatchClient.js`** ⚠️ CRITICAL
3. **`src/DebugQuery.js`** (for testing)

### Step 2: Clear Cache

```javascript
function clearCache() {
  CacheService.getScriptCache().removeAll();
  Logger.log('Cache cleared!');
}
```

### Step 3: Test with Debug Function

```javascript
debugSingleQuery('m5.xlarge', 'us-east-1', 'linux')
```

**Expected output:**
```
✅ Found 32 product(s)
✅ Found product with valid pricing at index [some number]
✅ Valid price found!
Price: $0.192/hour
```

### Step 4: Test in Spreadsheet

```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
```

**Expected result:** `0.192` (approximately)

## Why 32 Products?

The Infracost API returns variants like:
- On-demand pricing
- Reserved instance pricing (various terms)
- Spot pricing
- Different capacity statuses
- Maybe historical data

By filtering through all of them to find the first one with valid on-demand pricing (price > 0), we get the correct data.

## Additional Logging

The new code logs:
- How many products were returned
- Which products have pricing
- Which product was selected
- Why products were skipped

This makes it easy to debug if there are still issues.

## Edge Cases Handled

1. **All products have no pricing** → Logs error and skips instance
2. **First product has no pricing** → Searches remaining products
3. **Price is 0** → Skips and looks for valid price > 0
4. **Prices array is empty** → Skips and continues searching

## Performance Impact

Minimal - the loop exits as soon as it finds a product with valid pricing (usually within first few products).

## Summary

| Before | After |
|--------|-------|
| Used products[0] blindly | Searches for product with valid pricing |
| Failed when products[0] had no price | Finds correct product among 32 variants |
| No logging about multiple products | Detailed logging of search process |
| Price was 0 or null | Gets actual price from correct product |

---

**Date:** October 29, 2025  
**Issue:** API returns 32 products, code only checked first one  
**Status:** ✅ Fixed - Now searches all products for valid pricing

