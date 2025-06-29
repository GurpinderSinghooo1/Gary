# Code Quality Audit Report

## Summary

| Severity | Count |
|---------|------|
| Critical | 0 |
| Warning | 4 |
| Info | 3 |

## Issues

### 1. Auto-refresh timer never stored
- **File:** `js/app.js`
- **Lines:** [56-57](js/app.js#L56-L57), [343-346](js/app.js#L343-L346)
- **Description:** `setupAutoRefresh()` creates an interval but does not return the ID or store it. Consequently `cleanup()` cannot clear it, causing potential leaks. The method was also never invoked.
- **Recommendation:** Return the interval ID and assign it during `init()` so it can be cleared later.
- **Effort:** Low (≈5 lines)

### 2. Inefficient archive cleanup
- **File:** `apps-script.gs`
- **Lines:** [581-593](apps-script.gs#L581-L593)
- **Description:** `cleanOldArchiveData()` iterates over rows and calls `deleteRow()` for each match. This becomes O(N²) on large sheets because every deletion shifts rows.
- **Recommendation:** Collect contiguous ranges and delete with `deleteRows(start, count)` or rebuild the sheet with only recent rows.
- **Effort:** Medium

### 3. Hard‑coded API endpoint in multiple places
- **Files:** `js/data-handler.js`, `sw.js`
- **Lines:** [95-99](js/data-handler.js#L95-L99), [26-29](sw.js#L26-L29)
- **Description:** The Apps Script URL (with proxy) is duplicated. Updating the backend URL requires editing multiple files.
- **Recommendation:** Move the base URL/proxy prefix to a single config (e.g. in `utils.js`) and import in both modules.
- **Effort:** Low

### 4. Service worker data cache growth
- **File:** `sw.js`
- **Lines:** various
- **Description:** Cached API responses in `DATA_CACHE` never expire. Repeated syncs could fill storage over time.
- **Recommendation:** Implement a max‑entries policy or regularly clear old responses during `activate` or `performBackgroundSync`.
- **Effort:** Medium

### 5. Possible localStorage quota issues
- **Files:** `js/data-handler.js`, `js/utils.js`
- **Lines:** [174-183](js/data-handler.js#L174-L183), [169-188](js/utils.js#L169-L188)
- **Description:** Entire datasets are serialized into localStorage without checking size. Browsers typically limit localStorage to ~5MB.
- **Recommendation:** Compress data or limit stored rows; detect and handle quota errors.
- **Effort:** Medium

### 6. Missing automated lint/test workflow
- **Files:** whole repo
- **Description:** No ESLint or test suite is configured. GitHub Actions workflows are absent.
- **Recommendation:** Add ESLint with `eslint-plugin-google-apps-script` for `.gs` files, set up Jest for frontend utilities, and create CI workflows to lint and test on pull requests.
- **Effort:** Medium

### 7. Lack of documentation for some helper functions
- **Files:** `js/utils.js` et al.
- **Description:** Many exported helpers lack JSDoc comments, making maintenance harder.
- **Recommendation:** Add concise JSDoc for public functions.
- **Effort:** Low

## Architecture Observations
- Frontend and backend separation is clear. Service worker uses network‑first for API and cache‑first for static assets—sensible for fresh data.
- The application relies on a CORS proxy; consolidating its URL will simplify changes.
- No unit tests or CI pipeline present. Adding them would raise reliability.
- Cleaning old rows individually in Apps Script may hit script execution limits as the archive grows. Batch operations are preferable.

