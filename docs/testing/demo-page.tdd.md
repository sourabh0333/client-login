# Demo page TDD evidence

## Source and journey

Derived from the request to make the public client portal a credential-free demo while keeping the interactive park.

As a client reviewer, I want an explicitly labelled product preview with no sign-in controls, so that I can safely review the concept without being asked for credentials.

## RED and GREEN evidence

- **RED:** `node --test tests/demo-page.test.mjs` — 2 failures: the page lacked the `Interactive demo` and `Client Portal Demo` labels and still imported `LoginForm`.
- **GREEN:** `node --test tests/demo-page.test.mjs` — 2 passing tests after the page and metadata were updated.

## Guarantees

| # | What is guaranteed | Test | Result |
| --- | --- | --- | --- |
| 1 | The public page identifies itself as an interactive demo, states that credentials are not collected, and does not render or import `LoginForm`. | `tests/demo-page.test.mjs` | PASS |
| 2 | Both route and root metadata identify the site as `Client Portal Demo` and remove the sign-in description. | `tests/demo-page.test.mjs` | PASS |

## Additional verification

- `npm run lint` — PASS.
- `npm run build` — PASS; all four static routes generated successfully.
- Browser smoke check at `http://localhost:3000` — PASS; the rendered page shows the demo notice and reports no browser errors.

## Coverage and known gaps

The repository has no configured coverage runner. The focused Node test covers the public safety-copy contract; visual layout was checked in a local browser and the full production build completed successfully.
