# Troubleshooting Guide

## Quick Diagnostics

If your functions are returning errors or no results, run this function first in the Apps Script editor:

```javascript
runDiagnostics()
```

This will check:
- ✅ All required script properties are configured
- ✅ Infracost API connection is working
- ✅ Sample queries return data

## Common Issues and Solutions

### Issue 1: "Missing required script property" Error

**Symptoms:**
- Functions return errors about missing properties
- Error mentions `awsEc2InstanceFamilyFilter`, `gcpComputeInstanceFamilyFilter`, etc.

**Solution:**
1. Go to **Project Settings** (⚙️ icon in Apps Script)
2. Scroll to **Script Properties**
3. Add these properties:

```
awsEc2InstanceFamilyFilter = m5,m6i,r6i,c5,c6i
awsEc2InstanceSizeFilter = large,xlarge,2xlarge,4xlarge
gcpComputeInstanceFamilyFilter = n2,n2d,c2,c2d
gcpComputeInstanceSizeFilter = standard-4,standard-8,standard-16
```

### Issue 2: "Missing infracost_api_key" Error

**Symptoms:**
- Error message: `Missing infracost_api_key in script properties`

**Solution:**
1. Get your API key from: https://dashboard.infracost.io/
2. Add it to Script Properties:
   - Property: `infracost_api_key`
   - Value: `ico-your-actual-key-here`

### Issue 3: Functions Return #ERROR or #N/A

**Symptoms:**
- Spreadsheet cells show `#ERROR!` or `#N/A`
- No helpful error message visible

**Solution:**
1. Check the execution log:
   - Apps Script Editor → **Executions** tab
   - Look for the most recent execution
   - Click to see the error details

2. Common causes:
   - Missing script properties (see Issue 1 & 2)
   - Invalid region name (check spelling)
   - Invalid instance type (check spelling)
   - API rate limiting (wait a few minutes)

### Issue 4: GraphQL API Errors

**Symptoms:**
- Error mentions "GraphQL API error"
- Error shows JSON with "errors" field

**Solution:**
1. Verify your API key is correct:
   ```javascript
   quickDiag()
   ```

2. Check if the region/instance type exists:
   - AWS: https://aws.amazon.com/ec2/instance-types/
   - GCP: https://cloud.google.com/compute/docs/machine-types

3. Check API rate limits:
   - Free tier: 10,000 requests/month
   - If exceeded, wait for next billing cycle or upgrade

### Issue 5: "Unable to parse..." Errors

**Symptoms:**
- Error about parsing volume size or other parameters

**Solution:**
- Ensure numeric parameters are numbers, not text
- Example: `=AWS_EBS_HOURLY("us-east-1", "gp3", "storage", 1000)`
- NOT: `=AWS_EBS_HOURLY("us-east-1", "gp3", "storage", "1000")`

### Issue 6: Functions Work in Script Editor but Not in Sheets

**Symptoms:**
- Test functions work when run in Apps Script
- Same functions fail when used in Google Sheets cells

**Possible Causes:**
1. **Script not deployed:** Make sure you've saved all changes
2. **Caching issues:** Try:
   - Close and reopen the spreadsheet
   - Clear cache: Run `CacheService.getScriptCache().removeAll()`
3. **Permission issues:** 
   - First time using a function, you may need to authorize
   - Click "Review Permissions" when prompted

### Issue 7: Empty Results for Regional Matrices

**Symptoms:**
- `AWS_EC2_ALL_BY_REGION` or `GCP_COMPUTE_ALL_BY_REGION` returns only headers
- No instance data shown

**Solution:**
1. Check your instance filters are correct:
   ```javascript
   Logger.log(cfg.awsEc2InstanceFamilyFilter);
   Logger.log(cfg.awsEc2InstanceSizeFilter);
   ```

2. Verify the region exists and has those instances available

3. Check execution logs for individual instance errors

### Issue 8: Slow Performance

**Symptoms:**
- Functions take 20+ seconds to return results
- "Loading..." appears for a long time

**Explanation:**
- First run (cold cache): May take 15-20 seconds for regional matrices
- Subsequent runs (warm cache): Should be < 2 seconds

**Solutions:**
1. **Be patient on first run** - Results are cached for 24 hours
2. **Use batching** - Automatically enabled for > 3 instances
3. **Avoid frequent formula changes** - Each change invalidates cache

## Manual Tests

### Test 1: Simple AWS EC2 Query
```javascript
function testManual() {
  var result = AWS_EC2_HOURLY('m5.xlarge', 'us-east-1', 'ondemand', '', '', '', 'linux');
  Logger.log('Price: $' + result);
}
```

Expected output: `Price: $0.192` (or similar)

### Test 2: Simple GCP Compute Query
```javascript
function testManual() {
  var result = GCP_COMPUTE_HOURLY('n2-standard-4', 'us-central1', 'ondemand');
  Logger.log('Price: $' + result);
}
```

Expected output: `Price: $0.1949` (or similar)

### Test 3: GraphQL API Direct Test
```javascript
testAPIConnection()
```

Expected output: `✅ API connection successful!`

## Debugging Tips

### Enable Detailed Logging

Add this at the top of your test function:
```javascript
Logger.log('Starting test...');
```

Then check **View > Logs** or **View > Executions**

### Check Cache Status

To see if caching is working:
```javascript
function checkCache() {
  var cache = CacheService.getScriptCache();
  var keys = cache.getAll({});
  Logger.log('Cache entries: ' + Object.keys(keys).length);
}
```

### Clear Cache

If you suspect cache issues:
```javascript
function clearCache() {
  CacheService.getScriptCache().removeAll();
  Logger.log('Cache cleared!');
}
```

## Getting Help

### Information to Provide

When asking for help, include:

1. **Exact function call:**
   ```
   =AWS_EC2_HOURLY("m5.xlarge", "us-east-1", "ondemand")
   ```

2. **Error message:**
   - From spreadsheet cell
   - From execution logs

3. **Script properties configured:**
   - List property names (not values)

4. **Diagnostic results:**
   ```javascript
   runDiagnostics()
   ```

### Where to Get Help

- Check this troubleshooting guide first
- Review [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
- Check execution logs in Apps Script
- Review Infracost API docs: https://www.infracost.io/docs/

## Advanced Troubleshooting

### Inspect GraphQL Query

To see the actual GraphQL query being sent:
```javascript
function inspectQuery() {
  var instanceTypes = ['m5.xlarge'];
  var region = 'us-east-1';
  var platform = 'linux';
  
  // This will log the query before sending
  var result = fetchAWSEC2GraphQL(instanceTypes, region, platform);
  Logger.log('Result: ' + JSON.stringify(result));
}
```

### Check Function Availability

Ensure all files are deployed:
```javascript
function checkFunctions() {
  try {
    Logger.log('cachedGraphQL: ' + typeof cachedGraphQL);
    Logger.log('fetchAWSEC2GraphQL: ' + typeof fetchAWSEC2GraphQL);
    Logger.log('fetchGCPComputeGraphQL: ' + typeof fetchGCPComputeGraphQL);
    Logger.log('fetchAWSEC2GraphQLBatched: ' + typeof fetchAWSEC2GraphQLBatched);
  } catch (err) {
    Logger.log('Error: ' + err);
  }
}
```

All should show `function`. If any show `undefined`, that file isn't deployed.

## Still Having Issues?

If none of the above solutions work:

1. **Try the old version first** to verify spreadsheet structure is correct
2. **Check for typos** in region names, instance types
3. **Verify API quota** hasn't been exceeded
4. **Try a different region/instance** to isolate the issue
5. **Check Infracost API status** at their status page

---

**Last Updated:** October 29, 2025

