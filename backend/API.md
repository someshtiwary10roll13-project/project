# RetainIQ API

Base URL: `http://localhost:3000/api`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | API status |
| GET | `/dashboard` | Dashboard summary and ranked customers |
| GET | `/customers?risk=high` | Filtered customer health list |
| POST | `/customers` | Add customer: `companyName`, `plan`, `csmEmail` |
| PATCH | `/customers/:id` | Edit customer fields |
| GET | `/customers/:id/signals` | Recent signal history |
| POST | `/signals` | Ingest one normalized signal |
| POST | `/signals/bulk` | Ingest up to 100 signals |
| GET | `/alerts` | Medium/high risk CSM alert queue |

## Example n8n request

Send an HTTP Request node to `POST http://api:3000/api/signals` with JSON:

```json
{
  "customerId": 1,
  "source": "product_analytics",
  "usageDrop": 35,
  "openTickets": 2,
  "sentiment": "negative",
  "daysInactive": 14,
  "renewalDays": 30,
  "note": "Usage declined after rollout"
}
```
