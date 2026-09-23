# Devante administration frontend

React + Vite frontend for `D:\Dev\devante\back\devante_app_back`.

## Run locally

Start the backend on port 8002, then run:

```powershell
cd D:\Dev\devante\front\devante_app_front
Copy-Item .env.example .env
npm install
npm run dev
```

Open http://localhost:5174. The API base URL is controlled with `VITE_API_URL` and defaults to `http://localhost:8002`.

The backend `.env` must include:

```text
FRONTEND_URL=http://localhost:5174
CORS_ALLOWED_ORIGINS=http://localhost:5174
```

Microsoft OAuth credentials and MongoDB must also be configured in the backend before authentication can complete.

The frontend also includes receipt/RFI screenshot capture, automatic OCR review, Google Drive links, work-item references, and weekly/monthly/yearly profit-and-loss reports. See the backend README for Drive service-account setup. Non-super-admin roles need the appropriate `RECEIPTS_*` permissions.

## Jobs

Jobs is the primary navigation screen. Use the Jobs subnavigation to switch between Quotes, Receipts, RFIs, and Drawings for the selected job. On phones, the subnavigation appears inside the job view. The Jobs view creates jobs and groups each job's receipts, quotes, drawings, and RFIs. Quotes and drawings accept PDF, JPEG, PNG, or WebP files. Receipt and RFI uploads started from a job are linked to its code. Roles need `JOBS_READ` to view jobs, `JOBS_CREATE` to create them, and `JOBS_UPDATE` to upload or remove quote and drawing files. Receipt and RFI uploads still require `RECEIPTS_CREATE`.

RFI uploads can record an RFI number, subject, recipient, question, and response due date. Open an RFI in a job to review the request and add dated responses with optional PDF or image attachments. Adding a response requires `RECEIPTS_UPDATE`; viewing responses requires `RECEIPTS_READ`.
The Jobs RFI section also has a Create RFI form for requests without an uploaded file. Upload existing RFI remains available for scans or PDFs.
Jobs are selected from a dropdown. The search field filters the dropdown by job code or name; the job creation form is collapsed below it.
