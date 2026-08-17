import React, { useState, useEffect } from 'react';
import { 
  Printer, Download, FileText, CheckCircle2, AlertTriangle, 
  Calendar, Building2, TrendingUp, ShieldCheck, DollarSign
} from 'lucide-react';
import { fetchExecutiveReport, fetchAcos } from '../api';

export default function ExecutiveReport({ selectedAcoId, onSelectAco }) {
  const [acoList, setAcoList] = useState([]);
  const [currentId, setCurrentId] = useState(selectedAcoId || 'A1001');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAcoList();
  }, []);

  useEffect(() => {
    if (selectedAcoId && selectedAcoId !== currentId) {
      setCurrentId(selectedAcoId);
    }
  }, [selectedAcoId]);

  useEffect(() => {
    if (currentId) {
      loadReportData(currentId);
    }
  }, [currentId]);

  async function loadAcoList() {
    try {
      const data = await fetchAcos({ page_size: 500, sort_by: 'ACO_Name', sort_desc: false });
      setAcoList(data.acos || []);
      if (!selectedAcoId && data.acos?.length > 0) {
        setCurrentId(data.acos[0].ACO_ID);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadReportData(id) {
    setLoading(true);
    try {
      const data = await fetchExecutiveReport(id);
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  const exec = report?.executive_summary;
  const matrix = report?.peer_comparison_matrix || [];
  const recs = report?.action_interventions || [];

  return (
    <div>
      {/* View Header & Action Controls (Hidden on Print) */}
      <div className="view-header no-print">
        <div className="view-title-group">
          <h1>📄 Payer-Provider Executive Meeting Briefing</h1>
          <p>Standardized Joint Operating Committee (JOC) contract performance review packet</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="form-group" style={{ minWidth: '300px' }}>
            <select 
              className="select-input"
              value={currentId}
              onChange={(e) => {
                const id = e.target.value;
                setCurrentId(id);
                if (onSelectAco) onSelectAco(id);
              }}
              style={{ fontWeight: 600 }}
            >
              {acoList.map((a) => (
                <option key={a.ACO_ID} value={a.ACO_ID}>
                  {a.ACO_ID} — {a.ACO_Name}
                </option>
              ))}
            </select>
          </div>

          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={15} /> Print / Save as PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Generating executive briefing packet...</p>
        </div>
      ) : report ? (
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* Printable Report Document Card */}
          <div className="card" style={{ padding: '2.25rem', background: 'var(--bg-surface-elevated)' }}>
            {/* Header / Brand */}
            <div style={{ borderBottom: '2px solid var(--border-strong)', paddingBottom: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-sky)', marginBottom: '0.25rem' }}>
                  Medicare Shared Savings Program (MSSP) · PY2024
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {report.report_title}
                </h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  CMS ACO ID: <strong className="mono">{exec.aco_id}</strong> · Track: <strong>{exec.track}</strong> ({exec.revenue_tier})
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Report Generated</div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{report.generated_timestamp}</div>
                <span className="badge badge-success" style={{ marginTop: '0.4rem' }}>CMS Verified</span>
              </div>
            </div>

            {/* 1. Executive Summary KPI Grid */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={16} color="#38bdf8" /> 1. Contract Financial & Quality Snapshot
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Attributed Beneficiaries</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.25rem' }}>{exec.attributed_lives.toLocaleString()}</div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Benchmark Savings Rate</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.25rem', color: parseFloat(exec.savings_rate) >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                    {exec.savings_rate}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Earned Savings / Shared Loss</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.25rem', color: exec.earned_savings_loss.startsWith('-') ? 'var(--status-danger)' : 'var(--status-success)' }}>
                    {exec.earned_savings_loss}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quality Performance Score</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--accent-sky)' }}>
                    {exec.quality_score} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 100</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <span>🎯 <strong>Risk Classification:</strong> {exec.risk_classification}</span>
                <span>📈 <strong>Cost Trend Momentum:</strong> {exec.cost_momentum}</span>
              </div>
            </div>

            {/* 2. Peer Benchmark Variance Matrix */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={16} color="#10b981" /> 2. Peer Cohort Benchmark Variance Matrix
              </h3>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Core Performance Metric</th>
                      <th className="num">ACO Actual Result</th>
                      <th className="num">Peer Cohort Average</th>
                      <th className="num">Variance to Benchmark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((m, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{m.metric}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{m.aco_value}</td>
                        <td className="num" style={{ color: 'var(--text-secondary)' }}>{m.peer_benchmark}</td>
                        <td className="num">
                          <span style={{ 
                            fontWeight: 700,
                            color: m.variance.startsWith('+') && m.metric.includes('Quality') ? 'var(--status-success)' :
                                   m.variance.startsWith('-') && !m.metric.includes('Quality') && !m.metric.includes('Savings') ? 'var(--status-success)' :
                                   m.variance.startsWith('+') && (m.metric.includes('ED') || m.metric.includes('SNF') || m.metric.includes('Expenditure')) ? 'var(--status-danger)' :
                                   'var(--text-primary)'
                          }}>
                            {m.variance}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Joint Action Interventions & Strategic Roadmap */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={16} color="#f59e0b" /> 3. JOC Action Plan & Clinical / Operational Initiatives
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {recs.map((r, idx) => (
                  <div key={idx} className="intervention-card" style={{ background: 'var(--bg-surface)', padding: '1.15rem' }}>
                    <div className="intervention-header">
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {idx + 1}. {r.category}
                      </span>
                      <span className={`badge ${r.severity === 'CRITICAL' || r.severity === 'HIGH' ? 'badge-danger' : r.severity === 'WARNING' ? 'badge-warning' : 'badge-info'}`}>
                        {r.severity}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      <strong>Clinical / Financial Finding:</strong> {r.finding}
                    </p>

                    <div className="intervention-action" style={{ marginBottom: '0.5rem' }}>
                      <strong>Mandated Intervention:</strong> {r.action}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.35rem', borderTop: '1px dashed var(--border-subtle)' }}>
                      <span>💰 <strong>Estimated Financial Opportunity:</strong> {r.potential_impact_estimate || 'Positive quality / risk upside'}</span>
                      <span>⏱️ <strong>Review Target:</strong> Next Quarter JOC</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Signature & Sign-Off Footer */}
            <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3rem' }}>
              <div>
                <div style={{ borderBottom: '1px solid var(--border-strong)', height: '40px' }}></div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Payer Medical Director / VBC Lead Signature & Date</div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid var(--border-strong)', height: '40px' }}></div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>ACO Executive Director / Lead Physician Signature & Date</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
