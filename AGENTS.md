# Frontend agent guidance

This is the mobile-first React client for the Devante FastAPI service. The primary users work from phones while travelling or on job sites. Desktop support remains important, but phone usability takes precedence.

## Stack and commands

- React 18 with Vite.
- API wrapper: `src/api.js`.
- Main interface and workflows: `src/App.jsx`.
- Shared responsive styling: `src/index.css`.
- Development server: `npm run dev` on port 5174.
- Required verification: `npm run build`.

## Mobile requirements

- Design and review at approximately 360×800 and 390×844 before considering a feature complete.
- Keep the fixed mobile header and five-item bottom navigation usable with one hand.
- Put frequent actions such as receipt scanning and RFI capture near the bottom-right thumb area.
- Respect `env(safe-area-inset-bottom)` for bottom navigation, sticky actions, and full-screen dialogs.
- Interactive controls must be at least 44×44 CSS pixels; primary form controls should be about 48 pixels high.
- Form input text must remain at least 16px on mobile to prevent automatic browser zoom.
- Do not rely on hover, right-click, or drag-only interactions.
- Avoid horizontal scrolling except for legacy data tables where a card layout is impractical.
- Keep mobile forms full-screen and place their primary action in a sticky footer.
- Preserve keyboard access, visible labels, useful `aria-label` values, and adequate contrast.
- Test long filenames, long vendor names, empty states, loading states, errors, and slow uploads.

## Receipt and RFI capture

- Preserve `accept="image/jpeg,image/png,image/webp,application/pdf"` and `capture="environment"` on the upload input.
- File selection must call `/receipts/preview` and show the original image alongside editable OCR output before final upload.
- Vendor, amount, category, date, transaction type, OCR text, and job/quote/estimate reference must remain correctable.
- Never save automatically after OCR. Require an explicit “Confirm & upload” action.
- Disable confirmation while OCR or upload processing is active and show a clear progress state.
- RFIs are documents, not financial transactions, and must not appear in profit/loss totals.
- Maintain a usable manual-entry path when OCR finds nothing or the user uploads a PDF.

## API conventions

- Use the `api()` helper rather than direct `fetch` calls.
- Keep `credentials: "include"` behavior and CSRF handling intact.
- Display backend `detail` messages in a user-readable notice.
- Gate controls with the corresponding permissions rather than only hiding navigation.
- The default API is `http://localhost:8002`, configurable with `VITE_API_URL`.

## Change discipline

- Reuse existing components and visual tokens before adding a dependency.
- Keep desktop navigation and mobile bottom navigation synchronized when adding a view.
- Add mobile CSS in the existing `max-width: 700px` section unless a component requires a clearly scoped breakpoint.
- Do not remove phone safe-area rules, camera capture, OCR correction, or sticky form actions during refactors.
- Run the production build after every UI change.
