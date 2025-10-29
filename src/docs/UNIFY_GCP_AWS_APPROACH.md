# Unifying GCP and AWS GraphQL Approach

## Current Situation

### AWS Structure (in our code):
```javascript
{
  instance_type: "m5.xlarge",
  vCPU: 4,
  memory: 16,
  pricing: {
    "us-east-1": {
      "linux": {
        ondemand: 0.192,
        reserved: {
          "yrTerm1Standard.noUpfront": 0.121
        }
      }
    }
  }
}
```

### GCP Structure (in our code):
```javascript
{
  instance_type: "n2-standard-4",
  specs: { cores: 4, memory: 16 },
  regions: {
    "us-central1": {
      ondemand: 0.1949,
      "cud-1y": 0.1169
    }
  }
}
```

## Key Differences

| Aspect | AWS | GCP |
|--------|-----|-----|
| Top-level pricing field | `pricing` | `regions` |
| Platform/OS layer | Yes (`[platform]`) | No (Linux only?) |
| CPU/Memory field | `vCPU`, `memory` | `specs.cores`, `specs.memory` |
| Reserved key format | `yrTerm1Standard.noUpfront` | `cud-1y` |

## Investigation Needed

Run this to see what the GraphQL API actually returns for GCP:

```javascript
investigateGCPGraphQLStructure('n2-standard-4', 'us-central1')
```

This will show:
1. **Raw API response** for GCP
2. **Price structure** from GraphQL
3. **Attributes available** (vCPUs, memory, etc.)
4. **Whether it has purchaseOption** like AWS
5. **If we can unify the structures**

## Possible Outcomes

### Outcome 1: GraphQL Returns Same Structure
If GCP GraphQL API returns similar data with `purchaseOption`, we can:

✅ **Unify to AWS-style structure:**
```javascript
// Both AWS and GCP use same structure
{
  instance_type: "n2-standard-4",
  vCPU: 4,
  memory: 16,
  pricing: {
    "us-central1": {
      "linux": {  // Or just use "default" for GCP
        ondemand: 0.1949,
        reserved: {
          "1yrCommitted": 0.1169
        }
      }
    }
  }
}
```

**Benefits:**
- Single code path for both AWS and GCP
- Reuse all the AWS logic (search for valid pricing, handle reserved, etc.)
- Simpler to maintain

### Outcome 2: GraphQL Returns Different Structure
If GCP is fundamentally different, we keep separate logic but optimize each.

## Migration Plan (if we can unify)

### Step 1: Update fetchGCPComputeGraphQL()
Change from `regions` structure to `pricing` structure:

```javascript
// NEW: Match AWS structure
var instanceObj = {
  instance_type: machineType,
  vCPU: parseFloat(attributes.vCPUs) || 0,
  memory: parseFloat(attributes.memory) || 0,
  pricing: {
    [region]: {
      "linux": {  // GCP instances are typically Linux
        ondemand: ondemandPrice
      }
    }
  }
};
```

### Step 2: Update getHourlyCostCompute()
Change to use `pricing` instead of `regions`:

```javascript
// OLD
if (!product.regions[region].ondemand) return null;
result = parseFloat(product.regions[region].ondemand);

// NEW (same as AWS)
if (!product.pricing[region]["linux"].ondemand) return null;
result = parseFloat(product.pricing[region]["linux"].ondemand);
```

### Step 3: Remove GCP-specific validation
Update `fetchSingleInstancePrice` to use same validation for both.

### Step 4: Reuse AWS reserved pricing logic
GCP committed-use discounts would follow same pattern as AWS reserved.

## Benefits of Unification

1. ✅ **Single code path** - One set of logic for both clouds
2. ✅ **Reuse AWS fixes** - All the reserved pricing logic works for GCP
3. ✅ **Easier maintenance** - Changes apply to both
4. ✅ **Consistent behavior** - Same error handling, caching, etc.
5. ✅ **Less code** - Remove duplicate logic

## Next Steps

1. **Run investigation:**
   ```javascript
   investigateGCPGraphQLStructure('n2-standard-4', 'us-central1')
   ```

2. **Review output** - Does GraphQL return similar structure to AWS?

3. **If yes → Unify** - Refactor GCP to use pricing structure

4. **If no → Optimize separately** - Keep separate but improve each

---

**Run `investigateGCPGraphQLStructure()` and share the output - it will tell us if we can unify the approaches!**

