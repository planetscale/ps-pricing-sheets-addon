# Debugging Region Issues

## The Problem

Functions work for `us-east-1` but not other regions like `us-west-2`, `eu-west-1`, etc.

## Possible Causes

### 1. Region Name Format
The Infracost API might expect a specific format:
- ✅ `us-east-1` (kebab-case)
- ❌ `us_east_1` (snake_case)
- ❌ `US-EAST-1` (uppercase)
- ❌ `useast1` (no separators)

### 2. UsageType is Region-Specific
The `usagetype` filter might be region-specific:
- `BoxUsage:m5.xlarge` (us-east-1)
- `USE1-BoxUsage:m5.xlarge` (us-east-1 with prefix?)
- `USW2-BoxUsage:m5.xlarge` (us-west-2 with prefix?)

### 3. Instance Not Available in Region
Some instance types aren't available in all regions.

### 4. Infracost API Data Coverage
The Infracost API might not have complete data for all regions.

## Diagnostic Tools

I've created several functions to help diagnose this:

### Test a Specific Region
```javascript
testRegion('us-west-2', 'm5.xlarge')
```

This will:
- ✅ Test if the region format is correct
- ✅ Show if products are found
- ✅ Show if pricing data exists
- ✅ Display actual price if found

### Test Multiple Regions
```javascript
testMultipleRegions()
```

This will test 7 common regions and show which ones work:
```
Testing us-east-1...
  ✅ us-east-1: $0.192/hr

Testing us-west-2...
  ❌ us-west-2: No data returned
```

### Debug Region Value
```javascript
debugRegionValue('us-west-2')
```

Shows the exact region string and checks for hidden characters.

## Most Likely Issue: UsageType Region Prefix

AWS pricing data often includes region codes in the usagetype:

**Pattern in us-east-1:**
```
usagetype: "BoxUsage:m5.xlarge"
```

**Pattern in us-west-2 (possibly):**
```
usagetype: "USW2-BoxUsage:m5.xlarge"
```

**Pattern in eu-west-1 (possibly):**
```
usagetype: "EUW1-BoxUsage:m5.xlarge"
```

## Solution Approach

### Option 1: Remove UsageType Filter for Now
Quick fix - comment out the usagetype filter temporarily:

```javascript
case 'ondemand':
  filters.operation = 'RunInstances';
  // filters.usagetype = 'BoxUsage:' + instanceType;  // Temporarily disabled
  filters.usagetype = null;
  break;
```

This will return multiple products again, but the search logic will find the right one.

### Option 2: Map Regions to Prefixes
If regions have prefixes, we can map them:

```javascript
function getRegionPrefix(region) {
  var regionMap = {
    'us-east-1': '',           // No prefix
    'us-east-2': 'USE2-',
    'us-west-1': 'USW1-',
    'us-west-2': 'USW2-',
    'eu-west-1': 'EUW1-',
    'eu-central-1': 'EUC1-',
    // etc.
  };
  return regionMap[region] || '';
}

// Then use:
filters.usagetype = getRegionPrefix(region) + 'BoxUsage:' + instanceType;
```

### Option 3: Test Without UsageType First
To verify this is the issue, try querying with just `operation` filter:

```javascript
attributeFilters: [
  { key: "instanceType", value: "m5.xlarge" }
  { key: "operatingSystem", value: "Linux" }
  { key: "tenancy", value: "Shared" }
  { key: "preInstalledSw", value: "NA" }
  { key: "operation", value: "RunInstances" }
  // NO usagetype filter
]
```

If this works for other regions, we know usagetype is the issue.

## Immediate Action

### Step 1: Deploy DebugRegion.js

Add this file to Apps Script.

### Step 2: Test a Non-Working Region

```javascript
testRegion('us-west-2', 'm5.xlarge')
```

### Step 3: Review the Output

Look for:
- ✅ Products found → usagetype might be the issue
- ❌ No products found → region format or data coverage issue

### Step 4: Test Without UsageType

If products are found but no pricing, the usagetype filter might be too restrictive.

Temporarily modify `getAWSPurchaseTypeFilters()`:

```javascript
case 'ondemand':
  filters.operation = 'RunInstances';
  filters.usagetype = null;  // Temporarily disable to test
  break;
```

Re-test the region. If it works now, we know usagetype needs region-specific handling.

## Investigation Steps

1. **Deploy `DebugRegion.js`**
2. **Run `testRegion('us-west-2')`** - see what it shows
3. **Run `testMultipleRegions()`** - see which regions work
4. **Share the output** - I'll tell you the exact fix needed

## Quick Test

Try this query in the investigation function:

```javascript
investigateAllAttributes('m5.xlarge', 'us-west-2', 'linux')
```

This will show you ALL attributes returned by the API for us-west-2, including the actual usagetype values.

---

**Deploy DebugRegion.js and run `testRegion('us-west-2')` - the output will tell us exactly what's wrong!**

