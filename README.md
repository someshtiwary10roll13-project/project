# RetainIQ — SaaS churn-risk intelligence

This project aggregates product-usage, CRM, and support signals into a customer health score. The dashboard gives CSMs a ranked risk queue and an actionable next step.

## Start locally

1. From this folder, run `docker compose up --build`.
2. Open n8n at `http://localhost:5678` and import `n8n/workflows/churn-risk-workflow.json`.
3. Start the frontend separately: `cd frontent`, then `npm run dev`.

The dashboard works in demo mode if the API is not running. When the API is available, it uses seeded PostgreSQL data.

## Send a test signal through n8n

Post a JSON body to `http://localhost:5678/webhook/churn-signal`:

```json
{"customerId":1,"source":"product_analytics","usageDrop":35,"openTickets":2,"sentiment":"negative","note":"Usage decline after failed rollout"}
```

## Production connectors

In n8n, add Airtable nodes for CRM context, an email trigger for support conversations, and an OpenAI node to summarize account context. Store OpenAI/Airtable/Pinecone credentials in n8n Credentials—never in this repository. Pinecone can retain semantic support-note embeddings for retrieval during the AI insight step.
