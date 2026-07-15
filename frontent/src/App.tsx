import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Customer = { id: number; company_name: string; plan: string; score: number; risk_level: string; insight: string; next_step: string; usage_drop: number; open_tickets: number }
type Dashboard = { summary: { total: number; high_risk: number; medium_risk: number; average_health: number }; customers: Customer[] }

const fallback: Dashboard = {
  summary: { total: 4, high_risk: 2, medium_risk: 1, average_health: 58 },
  customers: [
    { id: 1, company_name: 'Acme Labs', plan: 'Enterprise', score: 38, risk_level: 'high', insight: 'Weekly active users fell 42% and two priority tickets remain unresolved.', next_step: 'Book an executive recovery call today.', usage_drop: 42, open_tickets: 2 },
    { id: 2, company_name: 'Northstar Inc.', plan: 'Growth', score: 62, risk_level: 'medium', insight: 'Product adoption is down 18% after the latest release.', next_step: 'Share the onboarding refresher with the admin.', usage_drop: 18, open_tickets: 1 },
    { id: 3, company_name: 'Bloom & Co.', plan: 'Pro', score: 84, risk_level: 'low', insight: 'Usage and support activity are stable.', next_step: 'Continue the regular success cadence.', usage_drop: 3, open_tickets: 0 },
    { id: 4, company_name: 'Vertex Systems', plan: 'Enterprise', score: 48, risk_level: 'high', insight: 'Negative support sentiment and declining seat utilization.', next_step: 'Assign technical support and review renewal blockers.', usage_drop: 28, open_tickets: 3 }
  ]
}

function App() {
  const [data, setData] = useState<Dashboard>(fallback)
  const [filter, setFilter] = useState('all')
  const [live, setLive] = useState(false)
  useEffect(() => { fetch('http://localhost:3000/api/dashboard').then(r => r.ok ? r.json() : Promise.reject()).then(d => { setData(d); setLive(true) }).catch(() => setLive(false)) }, [])
  const customers = useMemo(() => filter === 'all' ? data.customers : data.customers.filter(c => c.risk_level === filter), [data, filter])
  return <main>
    <nav><div className="brand"><span>◈</span> RetainIQ</div><div className="status"><i className={live ? 'live' : ''}></i>{live ? 'Live data' : 'Demo data'}</div><button className="avatar">MS</button></nav>
    <section className="hero"><div><p className="eyebrow">CUSTOMER HEALTH COMMAND CENTER</p><h1>Spot churn before it happens.</h1><p className="subtitle">Signals from product activity, CRM context, and support conversations—prioritized into clear CSM actions.</p></div><button className="primary">Run signal scan <span>→</span></button></section>
    <section className="metrics">
      <article><span>Portfolio health</span><strong>{data.summary.average_health}<small>/100</small></strong><em>+4 pts since last week</em></article>
      <article><span>Customers monitored</span><strong>{data.summary.total}</strong><em>Across product, CRM & support</em></article>
      <article className="warning"><span>High-risk accounts</span><strong>{data.summary.high_risk}</strong><em>Needs attention today</em></article>
      <article><span>At-risk ARR</span><strong>$184k</strong><em>{data.summary.medium_risk} accounts in watchlist</em></article>
    </section>
    <section className="panel"><div className="panel-top"><div><h2>Risk radar</h2><p>Accounts ranked by current health score and urgency.</p></div><div className="filters">{['all','high','medium','low'].map(x => <button key={x} onClick={() => setFilter(x)} className={filter === x ? 'active' : ''}>{x === 'all' ? 'All accounts' : `${x[0].toUpperCase()+x.slice(1)} risk`}</button>)}</div></div>
      <div className="table-head"><span>Account</span><span>Health</span><span>Signals</span><span>AI insight & recommended action</span></div>
      <div className="rows">{customers.map(c => <article className="account" key={c.id}><div className="account-name"><b>{c.company_name.slice(0, 1)}</b><div><strong>{c.company_name}</strong><small>{c.plan} plan</small></div></div><div className="score"><span className={c.risk_level}>{c.score}</span><small>{c.risk_level} risk</small></div><div className="signals"><span>↓ {c.usage_drop}% usage</span><span>{c.open_tickets} open tickets</span></div><div className="action"><p>{c.insight}</p><a href="#action">{c.next_step} <span>→</span></a></div></article>)}</div>
    </section>
    <footer><span>Last refreshed just now</span><span>Powered by n8n + OpenAI + PostgreSQL</span></footer>
  </main>
}
export default App
