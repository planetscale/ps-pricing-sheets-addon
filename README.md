# Google Sheets Plugin for PlanetScale Pricing

This is an extremely heavily modified fork of the now defunct [AWS Pricing sheet addon by Strake](https://github.com/getstrake/aws-pricing-sheets-addon).

It offers functions that integrate both AWS and GCP pricing, as well as the ability to load up and cache bulk price lists for a set of predetermined instance types within a given region, so you can avoid making hundreds of API calls for every tiny change.

## 🎉 Recent Migration (October 2025)

**We've migrated from Firestore to the [Infracost Cloud Pricing GraphQL API](https://www.infracost.io/docs/cloud_pricing_api/)!**

**Benefits:**
- ✅ No more manual data maintenance
- ✅ Real-time pricing updates from AWS and GCP
- ✅ Unified API for all cloud pricing
- ✅ All existing functions work exactly the same
- ✅ **95% fewer API calls** for bulk queries (batched GraphQL)

**See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for setup instructions.**

## Data Sources

- **AWS & GCP Pricing**: [Infracost Cloud Pricing API](https://www.infracost.io/docs/cloud_pricing_api/) (GraphQL)
- **PlanetScale Pricing**: [PlanetScale Public API](https://api.planetscale.com/)

## Current Template Sheets

- Vitess [link](https://docs.google.com/spreadsheets/d/1TcMQDlM_zZUnvB9wfoBk0FdLcDWEFzDYPorlxuoLphs/edit?gid=2114267484#gid=2114267484)
- Postgres [link](https://docs.google.com/spreadsheets/d/1adUhMuDCGPTeixJ7TZC02_YhOahs1YZ5_N26DItrylI/edit?gid=2114267484#gid=2114267484)

## Quick Start

### 1. Setup
1. Get a free Infracost API key: https://www.infracost.io/docs/cloud_pricing_api/
2. Add to Script Properties:
   - `infracost_api_key` = your API key
   - `awsEc2InstanceFamilyFilter` = e.g., `m5,r6i,c5`
   - `awsEc2InstanceSizeFilter` = e.g., `large,xlarge,2xlarge`
   - `gcpComputeInstanceFamilyFilter` = e.g., `n2,n2d,c2`
   - `gcpComputeInstanceSizeFilter` = e.g., `standard-4,highmem-8`

### 2. Available Functions

#### AWS Functions
```javascript
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
=AWS_EC2_ALL_BY_REGION("us-east-1", "ondemand")
=AWS_EBS_HOURLY("us-east-1", "gp3", "storage", 1000)
```

#### GCP Functions
```javascript
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "ondemand")
=GCP_COMPUTE_ALL_BY_REGION("us-central1", "ondemand")
=GCP_GCS_HOURLY("us-central1", "localssd", 375)
```

#### PlanetScale Functions
```javascript
=PSDB_ALL_BY_REGION("us-east")
=PSDB_INSTANCE_HOURLY("PS_40", "us-east", 250)
=PSDB_REGIONS("aws")
```

## Architecture

```
Google Sheets Custom Functions
    ↓
Fetch.js (orchestration)
    ↓
    ├─→ GraphQLClient.js → Infracost API (AWS/GCP)
    └─→ Direct API calls → PlanetScale API (PSDB)
    ↓
Formatters & Price Calculators
    ↓
Return to Sheet
```

## Development

See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for detailed architecture and troubleshooting.
