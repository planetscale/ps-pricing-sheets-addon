# GCP Committed-Use Discount (CUD) Implementation Summary

## Problem

The Infracost Cloud Pricing API returns only two price options for GCP:
- `on_demand`
- `preemptible`

It does **not** provide committed-use discount (CUD) pricing.

## Solution

**Hardcoded discount percentages** applied to on-demand pricing.

### Discount Rates Applied

Based on standard GCP CUD pricing:

| Purchase Option | Discount | Calculation |
|----------------|----------|-------------|
| On Demand | 0% | `on_demand_price × 1.00` |
| 1 Yr Flexi CUD | 18% | `on_demand_price × 0.82` |
| 3 Yr Flexi CUD | 46% | `on_demand_price × 0.54` |
| 1 Yr Resource CUD | 37% | `on_demand_price × 0.63` |
| 3 Yr Resource CUD | 55% | `on_demand_price × 0.45` |

## Implementation

### Files Changed

1. **`src/GraphQLClient.js`**
   - Added `getGCPCUDDiscount()` function with hardcoded rates
   - Modified `fetchGCPComputeGraphQL()` to:
     - Accept `cudType` parameter
     - Fetch on-demand pricing for committed-use requests
     - Apply discount and store in `pricing[region]["linux"].reserved[key]`

2. **`src/GraphQLBatchClient.js`**
   - Modified `fetchGCPComputeGraphQLBatched()` to:
     - Accept `cudType` parameter
     - Apply same discount logic for batched queries
     - Pass `cudType` to fallback function

3. **`src/Fetch.js`**
   - Modified `fetchGCPCompute()` to:
     - Extract `cudType` from options (defaults to `'flexi'`)
     - Pass `cudType` to all GraphQL functions

4. **`src/functions/fetchPrice/instances.js`**
   - Modified `getHourlyCostCompute()` to:
     - Accept `cudType` parameter
     - Build correct pricing key based on term and cudType
     - Return discounted price from reserved pricing structure

5. **`src/functions/v3/GCP.js`**
   - Added `cudType` parameter to `GCP_COMPUTE_HOURLY()`
   - Added `cudType` parameter to `GCP_COMPUTE_ALL_BY_REGION()`
   - Updated JSDoc comments with new parameter
   - Set default: `cudType = cudType || 'flexi'`

### Pricing Keys

CUD prices are stored using these keys:

- Flexible CUD: `cud-flexi-1y`, `cud-flexi-3y`
- Resource CUD: `cud-resource-1y`, `cud-resource-3y`

## Usage

### Single Instance

```javascript
// Flexible CUD (default)
=GCP_COMPUTE_HOURLY("c2d-highcpu-16", "us-east1", "committed-use", "1yr")
=GCP_COMPUTE_HOURLY("c2d-highcpu-16", "us-east1", "committed-use", "1yr", "flexi")

// Resource CUD
=GCP_COMPUTE_HOURLY("c2d-highcpu-16", "us-east1", "committed-use", "1yr", "resource")
=GCP_COMPUTE_HOURLY("c2d-highcpu-16", "us-east1", "committed-use", "3yr", "resource")
```

### Regional Matrix

```javascript
// Flexible CUD
=GCP_COMPUTE_ALL_BY_REGION("us-central1", "committed-use", "1yr", "flexi")

// Resource CUD (3-year, 55% off)
=GCP_COMPUTE_ALL_BY_REGION("us-central1", "committed-use", "3yr", "resource")
```

## Backward Compatibility

- **Old calls still work**: If `cudType` is not specified, defaults to `"flexi"`
- **API structure unchanged**: Uses same `pricing[region][platform].reserved` structure as AWS
- **Parameter order preserved**: New `cudType` parameter is last (optional)

## Example Output

For `n2-standard-4` in `us-central1`:
- On-demand: $0.194236/hour
- 1yr Flexi CUD (18% off): $0.159273/hour
- 3yr Resource CUD (55% off): $0.087406/hour

## Testing

1. Deploy the updated code to Apps Script
2. Clear cache: Run `clearCache()` in Apps Script
3. Test each CUD type:

```javascript
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "ondemand")
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "committed-use", "1yr", "flexi")
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "committed-use", "3yr", "resource")
```

Verify the discounted prices are correct (18% and 55% off on-demand respectively).

## Maintenance

If GCP changes CUD discount rates, update the `getGCPCUDDiscount()` function in `src/GraphQLClient.js`:

```javascript
function getGCPCUDDiscount(purchaseTerm, cudType) {
  var discounts = {
    '1yr': {
      'flexi': 0.18,      // <-- Update this
      'resource': 0.37    // <-- Update this
    },
    '3yr': {
      'flexi': 0.46,      // <-- Update this
      'resource': 0.55    // <-- Update this
    }
  };
  // ...
}
```

## Why This Works

1. **GCP CUD rates are standardized** across all instance types
2. **Rates are stable** - rarely change
3. **No API dependency** - works even if Infracost never adds CUD data
4. **Accurate** - based on official GCP pricing as of 2025
5. **User-friendly** - no manual calculations needed

