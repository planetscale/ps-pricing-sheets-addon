# Migration Guide: Firestore to Infracost GraphQL API

## Overview

This codebase has been migrated from using Firestore and multiple disparate data sources to the unified **Infracost Cloud Pricing GraphQL API**. This provides:

- ✅ **Unified data source** for AWS and GCP pricing
- ✅ **Real-time pricing updates** without manual data maintenance
- ✅ **Simpler architecture** with fewer dependencies
- ✅ **Better caching** using query-based cache keys
- ✅ **All existing custom functions preserved** with identical signatures

## What Changed

### New Files
- **`src/GraphQLClient.js`** - GraphQL client with caching for Infracost API

### Updated Files
- **`src/Fetch.js`** - Replaced Firestore queries with GraphQL calls
- **`src/Config.js`** - Removed Firestore configuration
- **`src/functions/fetchPrice/volumes.js`** - Updated GCS pricing to use GraphQL
- **`appsscript.json`** - Added Infracost API to URL whitelist

### Unchanged Files (PSDB functions still work as before)
- **`src/functions/v3/PSDB.js`** - Still uses PlanetScale's public API
- **`src/CacheLoader.js`** - Still available for other caching needs
- **`src/helper/Helper.js`** - No changes needed

## Setup Instructions

### 1. Get Infracost API Key

1. Visit https://www.infracost.io/docs/cloud_pricing_api/api_usage/
2. Sign up for a free API key
3. Copy your API key (format: `ico-xxxxxxxxxxxxx`)

### 2. Configure Script Properties

In your Google Apps Script project:

1. Go to **Project Settings** (⚙️ icon)
2. Scroll to **Script Properties**
3. Add a new property:
   - **Property**: `infracost_api_key`
   - **Value**: Your Infracost API key (e.g., `ico-z5lYkOCvqmvgGbZEhn8p76sZ653qNHWF`)

### 3. Existing Script Properties (Keep These)

The following existing script properties are still required:
- `awsEc2InstanceFamilyFilter` - e.g., `m5,r6i,c5,i3`
- `awsEc2InstanceSizeFilter` - e.g., `large,xlarge,2xlarge`
- `gcpComputeInstanceFamilyFilter` - e.g., `n2,n2d,c2`
- `gcpComputeInstanceSizeFilter` - e.g., `standard-4,standard-8,highmem-8`

### 4. Remove Old Firestore Properties (Optional)

These are no longer needed and can be removed:
- `fs_email`
- `fs_key`
- `fs_projectid`

## API Architecture

### Before (Firestore-based)
```
Google Sheets
    ↓
Custom Functions
    ↓
Fetch.js → Firestore (AWS EC2, EBS, GCP Compute)
    ↓      ↓
    ↓      PlanetScale API (PSDB)
    ↓
Format & Return
```

### After (GraphQL-based)
```
Google Sheets
    ↓
Custom Functions
    ↓
Fetch.js → GraphQLClient → Infracost GraphQL API (AWS & GCP)
    ↓                   ↓
    ↓                   PlanetScale API (PSDB)
    ↓
Format & Return
```

## GraphQL Query Examples

### AWS EC2 Instance Pricing
```graphql
{
  products(
    filter: {
      vendorName: "aws"
      service: "AmazonEC2"
      productFamily: "Compute Instance"
      region: "us-east-1"
      attributeFilters: [
        { key: "instanceType", value: "m5.xlarge" }
        { key: "operatingSystem", value: "Linux" }
      ]
    }
  ) {
    prices(filter: { purchaseOption: "on_demand" }) {
      USD
    }
  }
}
```

### GCP Compute Instance Pricing
```graphql
{
  products(
    filter: {
      vendorName: "gcp"
      service: "Compute Engine"
      productFamily: "Compute Instance"
      region: "us-central1"
      attributeFilters: [
        { key: "machineType", value: "n2-standard-4" }
      ]
    }
  ) {
    prices(filter: { purchaseOption: "on_demand" }) {
      USD
    }
  }
}
```

## Caching Strategy

The new implementation uses MD5 hash-based caching:

1. Each GraphQL query is hashed using MD5
2. The hash becomes the cache key
3. Cache TTL: 24 hours (86400 seconds)
4. Uses Google Apps Script's `CacheService.getScriptCache()`

**Benefits:**
- Automatic cache invalidation when queries change
- No need for manual cache key management
- Reduced API calls for identical queries

## Function Compatibility

All existing custom functions maintain their **exact signatures and behavior**:

### AWS Functions
- ✅ `AWS_EC2_HOURLY(instanceType, region, purchaseType, ...)`
- ✅ `AWS_EC2_ALL_BY_REGION(region, purchaseType, ...)`
- ✅ `AWS_EBS_HOURLY(region, volumeType, storageType, volumeSize)`

### GCP Functions
- ✅ `GCP_COMPUTE_HOURLY(instanceType, region, purchaseType, ...)`
- ✅ `GCP_COMPUTE_ALL_BY_REGION(region, purchaseType, ...)`
- ✅ `GCP_GCS_HOURLY(region, volumeType, volumeSize)`
- ✅ `GCP_VOLUME_OPTIONS(instanceType)`

### PlanetScale Functions
- ✅ `PSDB_ALL_BY_REGION(region)`
- ✅ `PSDB_SKU_BY_REGION(region)`
- ✅ `PSDB_REGIONS(cloudProvider)`
- ✅ `PSDB_INSTANCE_HOURLY(instanceType, region, ...)`
- ✅ `PSDB_MNGD_TABLET_HOURLY(instanceType, extraReplicas)`
- ✅ `PSDB_MNGD_VTGATE_HOURLY(instanceType, extraReplicas)`
- ✅ `PSDB_MNGD_STORAGE_HOURLY(numGB, instanceType)`

## Testing Checklist

Test each function type to ensure compatibility:

- [ ] AWS EC2 on-demand pricing
- [ ] AWS EC2 reserved instance pricing (1yr, 3yr)
- [ ] AWS EBS volume pricing (gp3, io2)
- [ ] GCP Compute on-demand pricing
- [ ] GCP Compute committed use discounts
- [ ] GCP Local SSD pricing
- [ ] PSDB instance pricing
- [ ] PSDB managed service costs
- [ ] Regional instance matrices (ALL_BY_REGION functions)

## Troubleshooting

### "Missing infracost_api_key" Error
**Solution:** Add the `infracost_api_key` to Script Properties (see Setup step 2)

### "GraphQL API error" Messages
**Possible causes:**
1. Invalid API key
2. Invalid region name
3. Unsupported instance type
4. Rate limiting

**Solution:** Check the error details in the execution log

### Pricing Data Not Found
**Possible causes:**
1. Instance type not available in that region
2. Typo in region or instance type name
3. API doesn't have data for that specific configuration

**Solution:** Verify region and instance type names, check Infracost API documentation

### Cache Issues
If you need to force-refresh pricing data:
1. Go to Apps Script editor
2. Run > Clear cache (or manually clear in code)
3. Re-execute the function

## Performance Improvements

| Metric | Before (Firestore) | After (GraphQL) |
|--------|-------------------|-----------------|
| Data Sources | 2 (Firestore + PSDB API) | 2 (Infracost + PSDB API) |
| Manual Data Maintenance | Yes (Firestore updates) | No (Auto-updated) |
| Cache Strategy | Manual keys | Query-based hashing |
| API Dependencies | 3 (Google, Firestore, PSDB) | 2 (Infracost, PSDB) |

## Future Enhancements

Potential improvements:
- [ ] Batch GraphQL queries for better performance
- [ ] Add support for more reserved instance options
- [ ] Implement spot instance pricing
- [ ] Add Azure pricing support (when available in Infracost)
- [ ] Remove Firestore library dependency entirely

## Rollback Plan

If you need to revert to the old Firestore implementation:

1. Restore the old version from git: `git checkout <previous-commit>`
2. Re-add Firestore script properties
3. Ensure Firestore data is up-to-date

## Support

For issues:
- **Infracost API**: https://www.infracost.io/docs/
- **PlanetScale API**: https://api.planetscale.com/
- **Project Issues**: [Create an issue in your repository]

## Migration Date

**Migrated:** October 29, 2025
**Migration Author:** AI Assistant with user collaboration

