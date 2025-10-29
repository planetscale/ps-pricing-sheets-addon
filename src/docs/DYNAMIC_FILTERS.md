# Dynamic Purchase Type Filters

## What Changed

The `operation` and `usagetype` filters are now **dynamically set** based on the `purchaseType` parameter instead of being hardcoded.

## New Function: getAWSPurchaseTypeFilters()

```javascript
function getAWSPurchaseTypeFilters(purchaseType, instanceType) {
  purchaseType = (purchaseType || 'ondemand').toLowerCase();
  
  var filters = {
    operation: 'RunInstances',
    usagetype: null
  };
  
  switch (purchaseType) {
    case 'ondemand':
      filters.operation = 'RunInstances';
      filters.usagetype = 'BoxUsage:' + instanceType;
      break;
      
    case 'reserved':
      filters.operation = 'RunInstances';
      filters.usagetype = null;  // Varies, let price filter handle it
      break;
      
    case 'savings':
      filters.operation = null;  // Varies (RunInstances:SV001, etc.)
      filters.usagetype = null;  // Let price filter handle it
      break;
  }
  
  return filters;
}
```

## Filter Mapping

| Purchase Type | operation Filter | usagetype Filter | Notes |
|--------------|------------------|------------------|-------|
| **ondemand** | `RunInstances` | `BoxUsage:${instanceType}` | Precise filtering |
| **reserved** | `RunInstances` | _(omitted)_ | Price filter handles reserved vs on-demand |
| **savings** | _(omitted)_ | _(omitted)_ | Price filter handles savings plans |

## Why This Design?

### On-Demand (Precise Filtering)
- `operation: "RunInstances"` - Excludes spot, savings plans
- `usagetype: "BoxUsage:m5.xlarge"` - Excludes reserved, spot variants
- Result: Exactly 1 product ✅

### Reserved (Flexible Filtering)
- `operation: "RunInstances"` - Excludes spot, savings plans
- `usagetype:` **omitted** - Reserved instances use different patterns (HeavyUsage, etc.)
- Price filter with `purchaseOption: "reserved"` does the final filtering
- Result: Small set of products, price filter selects the right one

### Savings Plans (Most Flexible)
- `operation:` **omitted** - Savings plans use codes like `RunInstances:SV001`
- `usagetype:` **omitted** - Varies by savings plan type
- Price filter handles all the selection
- Result: Broader set, but price filter narrows it down

## Files Updated

1. ✅ **`src/GraphQLClient.js`**
   - Added `getAWSPurchaseTypeFilters()` function
   - Updated `fetchAWSEC2GraphQL()` to accept `purchaseType` parameter
   - Dynamically builds attribute filters based on purchase type

2. ✅ **`src/GraphQLBatchClient.js`**
   - Updated `fetchAWSEC2GraphQLBatched()` to accept `purchaseType` parameter
   - Uses `getAWSPurchaseTypeFilters()` for each instance in batch

3. ✅ **`src/Fetch.js`**
   - Updated calls to pass `purchaseType` to GraphQL functions

## Example Queries

### On-Demand Query
```graphql
attributeFilters: [
  { key: "instanceType", value: "m5.xlarge" }
  { key: "operatingSystem", value: "Linux" }
  { key: "tenancy", value: "Shared" }
  { key: "preInstalledSw", value: "NA" }
  { key: "operation", value: "RunInstances" }           ✅
  { key: "usagetype", value: "BoxUsage:m5.xlarge" }     ✅
]
prices(filter: { purchaseOption: "on_demand" })
```

### Reserved Query
```graphql
attributeFilters: [
  { key: "instanceType", value: "m5.xlarge" }
  { key: "operatingSystem", value: "Linux" }
  { key: "tenancy", value: "Shared" }
  { key: "preInstalledSw", value: "NA" }
  { key: "operation", value: "RunInstances" }           ✅
  // usagetype omitted - varies for reserved
]
prices(filter: { 
  purchaseOption: "reserved"
  termLength: "1yr"
  termOfferingClass: "standard"
  termPurchaseOption: "no_upfront"
})
```

### Savings Plans Query
```graphql
attributeFilters: [
  { key: "instanceType", value: "m5.xlarge" }
  { key: "operatingSystem", value: "Linux" }
  { key: "tenancy", value: "Shared" }
  { key: "preInstalledSw", value: "NA" }
  // operation omitted - varies for savings plans
  // usagetype omitted - varies for savings plans
]
prices(filter: { 
  purchaseOption: "savings_plan"
  // ... savings plan specific filters
})
```

## Benefits

1. ✅ **Single source of truth** - Filter logic centralized in `getAWSPurchaseTypeFilters()`
2. ✅ **Flexible** - Easy to add new purchase types or adjust filters
3. ✅ **Optimal filtering** - Each purchase type gets the right level of filtering
4. ✅ **Maintainable** - Changes to filter logic only need to be made in one place

## Testing

### Test On-Demand
```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
```
Should return exactly 1 product with on-demand pricing.

### Test Reserved
```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "reserved", "1yr", "standard", "no_upfront")
```
Should return a small set of products, with price filter selecting the right reserved pricing.

### Test Savings (if implemented)
```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "savings")
```
Should return broader set, with price filter handling savings plan selection.

## Future Enhancements

If we need more specific filtering for reserved or savings plans, we can update `getAWSPurchaseTypeFilters()`:

```javascript
case 'reserved':
  if (term === '1yr' && offeringClass === 'standard') {
    filters.usagetype = 'HeavyUsage:' + instanceType + ':1yrNoUpfront';
  }
  // etc.
  break;
```

---

**Date:** October 29, 2025  
**Change:** Made operation and usagetype filters dynamic based on purchaseType  
**Status:** Ready to test

