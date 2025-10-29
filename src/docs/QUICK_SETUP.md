# Quick Setup Guide

## For First-Time Setup

### Step 1: Get Your Infracost API Key (2 minutes)

1. Go to: https://dashboard.infracost.io/
2. Sign up (free)
3. Copy your API key (starts with `ico-`)

### Step 2: Add API Key to Script Properties (1 minute)

In Google Apps Script:

1. Open your Apps Script project
2. Click ⚙️ **Project Settings** (left sidebar)
3. Scroll to **Script Properties**
4. Click **Add script property**
5. Add:
   - **Property:** `infracost_api_key`
   - **Value:** `ico-your-key-here`
6. Click **Save**

### Step 3: Configure Instance Filters (2 minutes)

Add these script properties (or keep existing ones):

```
awsEc2InstanceFamilyFilter = m5,m6i,r6i,c5,c6i,i3
awsEc2InstanceSizeFilter = large,xlarge,2xlarge,4xlarge,8xlarge
gcpComputeInstanceFamilyFilter = n2,n2d,c2,c2d
gcpComputeInstanceSizeFilter = standard-4,standard-8,standard-16,highmem-8,highmem-16
```

### Step 4: Test (2 minutes)

1. In Apps Script editor, open `src/Tests.js`
2. Select function: `testGraphQLConnection`
3. Click **Run**
4. Check logs - should see ✅ success

### Step 5: Full Test Suite (5 minutes)

1. Select function: `runAllTests`
2. Click **Run**
3. Review results in logs
4. All should pass ✅

## Troubleshooting

### Error: "Missing infracost_api_key"
→ Go back to Step 2, add the API key

### Error: "GraphQL API error"
→ Check your API key is correct
→ Verify it starts with `ico-`

### Error: "Unable to parse..."
→ Check instance type name spelling
→ Verify region name is correct

## Ready to Use!

Try these in your Google Sheet:

```
=AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
=GCP_COMPUTE_HOURLY("n2-standard-4", "us-central1", "ondemand")
=PSDB_INSTANCE_HOURLY("PS_40", "us-east")
```

## Need Help?

See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for detailed documentation.

