# GCP Pricing Implementation

## Infracost API Limitations for GCP

The Infracost Cloud Pricing API has limited support for GCP pricing compared to AWS.

### ✅ **Supported GCP Purchase Options**

| Purchase Type | API Value | Status | Implementation |
|--------------|-----------|---------|----------------|
| On-Demand | `on_demand` | ✅ Fully Supported | Fetched directly from API |
| Preemptible | `preemptible` | ✅ Fully Supported | Fetched directly from API |
| Committed-Use Discounts (CUD) | N/A | ✅ Supported via Hardcoded Discounts | On-demand price with applied discount |

### ❌ **Unsupported GCP Purchase Options**

| Purchase Type | Status | Notes |
|--------------|--------|-------|
| Sustained Use Discounts (SUD) | ❌ Not Available | SUDs are automatically applied by GCP billing, not available as separate pricing |

## Committed-Use Discount (CUD) Implementation

Since the Infracost API doesn't provide CUD pricing, we **fetch on-demand pricing and apply hardcoded discount percentages**.

### Discount Rates

| CUD Type | 1-Year | 3-Year |
|----------|--------|--------|
| **Flexible CUD** | 18% off | 46% off |
| **Resource-based CUD** | 37% off | 55% off |

### How It Works

1. User requests committed-use pricing
2. Addon fetches on-demand price from API
3. Applies the appropriate discount based on:
   - Term length (1yr or 3yr)
   - CUD type (flexi or resource)
4. Returns discounted price

**Example:**
- On-demand price: $1.00/hour
- 1-year Flexible CUD: $1.00 × (1 - 0.18) = **$0.82/hour**
- 3-year Resource CUD: $1.00 × (1 - 0.55) = **$0.45/hour**

## Function Usage

### GCP_COMPUTE_HOURLY

**Syntax:**
```javascript
=GCP_COMPUTE_HOURLY(instanceType, region, purchaseType, purchaseTerm, cudType)
```

**Examples:**

**On-Demand:**
```javascript
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "ondemand")
```

**Preemptible:**
```javascript
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "preemptible")
```

**Committed-Use (Flexible):**
```javascript
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "committed-use", "1yr", "flexi")
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "committed-use", "3yr", "flexi")
```

**Committed-Use (Resource-based):**
```javascript
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "committed-use", "1yr", "resource")
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "committed-use", "3yr", "resource")
```

### GCP_COMPUTE_ALL_BY_REGION

**Syntax:**
```javascript
=GCP_COMPUTE_ALL_BY_REGION(region, purchaseType, purchaseTerm, cudType)
```

**Examples:**

**On-Demand Matrix:**
```javascript
=GCP_COMPUTE_ALL_BY_REGION("us-central1", "ondemand")
```

**Flexible CUD Matrix (1-year, 18% off):**
```javascript
=GCP_COMPUTE_ALL_BY_REGION("us-central1", "committed-use", "1yr", "flexi")
```

**Resource CUD Matrix (3-year, 55% off):**
```javascript
=GCP_COMPUTE_ALL_BY_REGION("us-central1", "committed-use", "3yr", "resource")
```

## CUD Type Reference

### Flexible CUD (`cudType: "flexi"`)
- Can be shared across machine families
- More flexibility in resource allocation
- Lower discount rates (18% for 1yr, 46% for 3yr)
- **Default if not specified**

### Resource-based CUD (`cudType: "resource"`)
- Committed to specific machine type/region
- Less flexibility, more savings
- Higher discount rates (37% for 1yr, 55% for 3yr)

## Implementation Details

The CUD discount logic is implemented in:
- `src/GraphQLClient.js` - `getGCPCUDDiscount()` function
- `src/GraphQLClient.js` - `fetchGCPComputeGraphQL()` applies discount
- `src/GraphQLBatchClient.js` - `fetchGCPComputeGraphQLBatched()` applies discount
- `src/functions/fetchPrice/instances.js` - `getHourlyCostCompute()` retrieves stored CUD price

The discount percentages are **hardcoded** based on standard GCP CUD pricing as of 2025.

## Why This Approach

The Infracost API doesn't provide CUD pricing data, but **hardcoded discounts are acceptable** because:

1. **GCP CUD rates are standardized** - they don't vary by instance type
2. **Rates are stable** - Google rarely changes these discount percentages  
3. **Better UX** - Users get CUD pricing without manual calculation
4. **Accurate enough** - Standard rates match most use cases

If you have **custom negotiated discounts**, you can modify the discount rates in `getGCPCUDDiscount()` in `src/GraphQLClient.js`.

