# FieldDeck v0.5: blueprint and preflight protocol

**Blueprints are proposals, not capabilities.** This rung adds useful editing and verification, but **does not enable arbitrary chains**.

## For humans

In **Chain Lab**, choose a starter template or edit steps manually. Select **Run Preflight** to check the draft against the published action catalog. Every step is labeled `CATALOG_READY` or `CATALOG_MISSING_OR_DISABLED`; this is a **read-only planning check**, not an execution receipt.

Select **Export Blueprint** to save a versioned JSON file, or **Import Blueprint** to load one. Imports are limited to 16 KB and 1–6 reviewed action IDs. Unsafe fields or unsupported versions are rejected before the draft is changed. The original v0.4 draft export remains available.

The one executable preset remains **Field Health Sweep**, in this exact order:
1. Catalog Health
2. Script Smoke Test
3. Macro Sequence

To execute that preset, choose **Request Approved Chain** and submit the prefilled GitHub issue. GitHub must still authenticate the requester and verify repository write permission; the existing runtime does not accept imported steps as input.

## Typed blueprint shape

```json
{
  "schema_version": "0.5.0",
  "kind": "fielddeck.chain.blueprint",
  "name": "Local Chain Draft",
  "steps": [
    {"action_id": "catalog-health", "timeout_seconds": 30, "on_failure": "stop"}
  ],
  "policy": {
    "execution": "denied",
    "requires_authentication": true,
    "requires_review": true
  }
}
```

The fields `timeout_seconds` and `on_failure` are **planning metadata only**, not forwarded to the runner. The importer validates they are within the supported schema, then returns only a sanitized name and action-ID sequence. This prevents a JSON file from granting its own execution rights.

## Agent integration

Agents can generate a blueprint conforming to this format, share it for human review, and obtain a preflight report. An `is_execution_receipt:false` report must never be represented as proof that any action ran. A preflight status of `REQUEST_ELIGIBLE` means only that the local ordered sequence matches the sole approved preset and the catalog currently lists each primitive as ready. The separate IssueOps gate retains all execution authority.

## Security invariants

- No `eval`, shell strings, scripts, network calls from blueprints, or dynamic job definitions.
- The local browser is not a trusted approval authority.
- All imported objects, subfields, IDs, policy flags, and step counts are validated before use.
- No credentials in public JSON or localStorage.
- A preflight preview never creates GitHub issues or launches work.
- Custom chain drafts remain non-executable even when they pass structural validation.
- GitHub workflow/receipt remains the execution source of truth.

## Validation

Run `npm test` and `npm run build`. Test import of a real exported blueprint and rejection of an elevated-policy blueprint. Use an agent to create a valid custom draft, verify the preflight labels it `DRAFT_VALID`, and confirm the request button stays disabled outside the canonical approved preset.
