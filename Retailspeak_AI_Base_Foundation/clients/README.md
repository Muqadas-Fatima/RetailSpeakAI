# RetailSpeak AI — Phase 4 Clients (visual refresh)

Six `index.html` files, still no build step — open any one directly or
serve the `clients/` folder statically.

| Client | Persona | Status |
|---|---|---|
| `owner-dashboard/` | Owner | **Real** — wired to orchestrator + supplier-stage, same as before |
| `warehouse-staff-app/` | Warehouse Staff | **Real** — wired to warehouse-stage + orchestrator |
| `rider-client/` | Rider | **Real** — wired to delivery-stage + orchestrator |
| `dispatch-dashboard/` | Dispatch | **Partly real** — "Ready for pickup" queue is live; the rider roster/map use the same fixture riders as `delivery-stage/_rider_fixtures.py`, since there's no all-riders endpoint yet |
| `voice-ordering/` | Customer | **Partly real** — in-browser speech-to-text is live; item matching is a local demo catalog standing in for the extract-mentions → rag-retrieval → llm-grounding pipeline, which isn't exposed as a public endpoint yet |
| `inventory-forecast/` | Owner (advanced) | **Partly real** — supplier reorder queue is live; demand-forecast chart/table are demo data shaped like `shared/contracts/forecast.py`'s `ForecastRecord`, since there's no forecast-service endpoint yet |

The first three are drop-in replacements for the original files — same
`CONFIG` ports, same backend contract, visual design only. Run the
backend services exactly as documented below; nothing about *how* you
run them changed.

## Running the backend services

```bash
uvicorn fulfillment-half.orchestrator.api:app --port 8001
uvicorn fulfillment-half.warehouse-stage.api:app --port 8003
uvicorn fulfillment-half.supplier-stage.api:app --port 8004
uvicorn fulfillment-half.delivery-stage.api:app --port 8005
uvicorn fulfillment-half.realtime-gateway.api:app --port 8006
```

Then open each `index.html` and sign in with a demo actor id (e.g.
`owner-1`, `staff-1`, `rider-1`) against store id
`00000000-0000-0000-0000-000000000001`.

`dispatch-dashboard`, `voice-ordering`, and `inventory-forecast` open
straight away — no login screen — since they read/act on store-scoped
data only (or, for voice-ordering, run entirely client-side until you
tap Confirm).

## What's genuinely wired vs. what's demo

Every file's own header comment says exactly which panels call a real
endpoint and which use placeholder data, and why (usually: the backend
service for that panel doesn't exist yet in this repo). Nothing here
pretends a mocked number is a live one — nothing was silently swapped
in to make the redesign _look_ more complete than the backend actually
is.
