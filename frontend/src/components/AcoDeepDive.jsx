import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, DollarSign, Award, AlertCircle, CheckCircle2, 
  TrendingUp, TrendingDown, ShieldAlert, Sparkles, Activity, PieChart, Layers
} from 'lucide-react';
import { fetchAcoDetail, fetchAcos } from '../api';

export default function AcoDeepDive({ selectedAcoId, onSelectAco, onNavigateToSimulator, onNavigateToReport }) {
  const [acoList, setAcoList] = useState([]);
  const [currentId, setCurrentId] = useState(selectedAcoId || 'A1001');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllAcos();
  }, []);

  useEffect(() => {
    if (selectedAcoId && selectedAcoId !== currentId) {
      setCurrentId(selectedAcoId);
    }
  }, [selectedAcoId]);

  useEffect(() => {
    if (currentId) {
      loadDetail(currentId);
    }
  }, [currentId]);

  async function loadAllAcos() {
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

  async function loadDetail(id) {
    setLoading(true);
    try {
      const data = await fetchAcoDetail(id);
      setDetail(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleAcoChange = (e) => {
    const newId = e.target.value;
    setCurrentId(newId);
    if (onSelectAco) onSelectAco(newId);
  };

  const aco = detail?.aco;
  const preds = detail?.predictions;
  const peers = detail?.peer_benchmarks;
  const careSettings = detail?.care_settings || [];
  const utilization = detail?.utilization || [];
  const providerMix = detail?.provider_mix || [];
  const cahps = detail?.cahps_scores || [];
  const recommendations = detail?.recommendations || [];

  const totalCareSpend = careSettings.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div>
      {/* View Header & ACO Selector */}
      <div className="view-header">
        <div className="view-title-group">
          <h1>🔍 ACO 360° Contract Deep-Dive</h1>
          <p>Comprehensive clinical utilization, financial expenditure breakdown, and peer benchmarking</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="form-group" style={{ minWidth: '320px' }}>
            <select 
              className="select-input" 
              value={currentId} 
              onChange={handleAcoChange}
              style={{ fontWeight: 600, padding: '0.65rem 1rem' }}
            >
              {acoList.map((a) => (
                <option key={a.ACO_ID} value={a.ACO_ID}>
                  {a.ACO_ID} — {a.ACO_Name}
                </option>
              ))}
            </select>
          </div>

          <button 
            className="btn btn-secondary"
            onClick={() => onNavigateToSimulator && onNavigateToSimulator(currentId)}
          >
            <Sparkles size={15} color="#38bdf8" /> Simulate What-If
          </button>

          <button 
            className="btn btn-primary"
            onClick={() => onNavigateToReport && onNavigateToReport(currentId)}
          >
            Executive Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading ACO 360° profile...</p>
        </div>
      ) : aco ? (
        <>
          {/* Top Contract Snapshot Card */}
          <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-surface-elevated)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                  <span className="mono" style={{ background: 'var(--bg-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--accent-sky)', fontWeight: 700 }}>
                    {aco.ACO_ID}
                  </span>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{aco.ACO_Name}</h2>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-info">{aco.Current_Track}</span>
                  <span className="badge badge-neutral">{aco.Rev_Exp_Cat}</span>
                  <span className="badge badge-neutral">{aco.Risk_Model || 'Two-Sided Risk'}</span>
                  {aco.Met_Quality_Gate === 'Yes' || aco.Met_QPS === 'Yes' ? (
                    <span className="badge badge-success"><CheckCircle2 size={12} /> Quality Gate Met</span>
                  ) : (
                    <span className="badge badge-warning"><AlertCircle size={12} /> Quality Gate Watch</span>
                  )}
                  {preds?.risk_flag?.includes('Outperforming') || preds?.risk_flag?.includes('Top') ? (
                    <span className="badge badge-success">{preds.risk_flag}</span>
                  ) : preds?.risk_flag?.includes('Underperforming') || preds?.risk_flag?.includes('High') ? (
                    <span className="badge badge-danger">{preds.risk_flag}</span>
                  ) : (
                    <span className="badge badge-neutral">{preds?.risk_flag || 'In Line'}</span>
                  )}
                </div>
              </div>

              {/* Top Financial Highlights */}
              <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'right' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Attributed Lives</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{Math.round(aco.N_AB).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Savings Rate</div>
                  <div style={{ 
                    fontSize: '1.3rem', 
                    fontWeight: 700, 
                    color: aco.Sav_rate >= 0 ? 'var(--status-success)' : 'var(--status-danger)' 
                  }}>
                    {aco.Sav_rate.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Earned Savings / Loss</div>
                  <div style={{ 
                    fontSize: '1.3rem', 
                    fontWeight: 700, 
                    color: aco.EarnSaveLoss >= 0 ? 'var(--status-success)' : 'var(--status-danger)' 
                  }}>
                    {aco.EarnSaveLoss < 0 ? `-$${Math.abs(Math.round(aco.EarnSaveLoss)).toLocaleString()}` : `$${Math.round(aco.EarnSaveLoss).toLocaleString()}`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quality Score</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-sky)' }}>{aco.QualScore.toFixed(1)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid: Care Setting Spend & Utilization vs Peers */}
          <div className="grid-2col">
            {/* Cost by Care Setting */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <PieChart size={18} color="#0284c7" />
                  <span>Per-Capita Cost by Care Setting</span>
                </div>
                <span className="card-subtitle">Total PY: ${Math.round(aco.Per_Capita_Exp_TOTAL_PY).toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {careSettings.map((c) => {
                  const pct = totalCareSpend > 0 ? (c.amount / totalCareSpend) * 100 : 0;
                  return (
                    <div key={c.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.82rem' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.setting}</span>
                        <span style={{ fontWeight: 600 }}>${Math.round(c.amount).toLocaleString()} <span style={{ color: 'var(--text-muted)' }}>({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div style={{ width: '100%', height: '7px', background: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${pct}%`, 
                            height: '100%', 
                            background: c.setting.includes('Inpatient') ? '#0284c7' : c.setting.includes('SNF') ? '#f59e0b' : c.setting.includes('Outpatient') ? '#10b981' : '#64748b' 
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Utilization Rates vs Peer Cohort */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Activity size={18} color="#f59e0b" />
                  <span>Utilization vs Peer Benchmark Cohort</span>
                </div>
                <span className="card-subtitle">Rates per 1,000 Beneficiary Person-Years</span>
              </div>

              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Care Setting Metric</th>
                      <th className="num">ACO Rate</th>
                      <th className="num">Peer Avg</th>
                      <th className="num">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utilization.map((u) => {
                      const diff = u.rate - u.peer_rate;
                      const diffPct = u.peer_rate > 0 ? (diff / u.peer_rate) * 100 : 0;
                      const isUnfavorable = diffPct > 5 && !u.metric.includes('Primary Care');
                      const isFavorable = diffPct < -5 && !u.metric.includes('Primary Care');

                      return (
                        <tr key={u.key}>
                          <td style={{ fontWeight: 500 }}>{u.metric}</td>
                          <td className="num" style={{ fontWeight: 700 }}>{u.rate.toFixed(1)}</td>
                          <td className="num" style={{ color: 'var(--text-secondary)' }}>{u.peer_rate.toFixed(1)}</td>
                          <td className="num">
                            <span 
                              style={{ 
                                fontWeight: 700,
                                color: isUnfavorable ? 'var(--status-danger)' : (isFavorable ? 'var(--status-success)' : 'var(--text-secondary)')
                              }}
                            >
                              {diffPct > 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Grid: Provider Composition & CAHPS Experience */}
          <div className="grid-2col">
            {/* Provider Network Composition */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Users size={18} color="#38bdf8" />
                  <span>Provider Network Composition</span>
                </div>
                <span className="card-subtitle">Staffing and Participating Entities</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {providerMix.map((p) => (
                  <div 
                    key={p.key}
                    style={{
                      background: 'var(--bg-surface-subtle)',
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.role}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {p.count.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(56, 189, 248, 0.05)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                💡 <strong>PCP to Specialist Ratio:</strong> {(aco.N_PCP / Math.max(1, aco.N_Spec)).toFixed(2)} : 1
              </div>
            </div>

            {/* CAHPS Patient Experience Dimensions */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Award size={18} color="#10b981" />
                  <span>CAHPS Patient Experience Dimensions</span>
                </div>
                <span className="card-subtitle">Survey Performance Scores (0-100)</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {cahps.length > 0 ? cahps.map((c) => (
                  <div key={c.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{c.measure}</span>
                      <span style={{ fontWeight: 700, color: c.score >= 85 ? 'var(--status-success)' : (c.score < 75 ? 'var(--status-warning)' : 'var(--text-primary)') }}>
                        {c.score.toFixed(1)}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: 'var(--bg-main)', borderRadius: '3px' }}>
                      <div 
                        style={{ 
                          width: `${Math.min(100, c.score)}%`, 
                          height: '100%', 
                          background: c.score >= 85 ? 'var(--status-success)' : (c.score < 75 ? 'var(--status-warning)' : 'var(--accent-primary)'),
                          borderRadius: '3px'
                        }} 
                      />
                    </div>
                  </div>
                )) : (
                  <p style={{ color: 'var(--text-muted)' }}>No CAHPS scores recorded for this ACO.</p>
                )}
              </div>
            </div>
          </div>

          {/* AI-Generated Strategic Focus Areas & Intervention Playbook */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Sparkles size={18} color="#38bdf8" />
                <span>AI-Generated Strategic Intervention Playbook</span>
              </div>
              <span className="card-subtitle">
                Ranked clinical & operational focus areas generated from multi-dimensional peer gap analysis
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
              {recommendations.map((rec, idx) => (
                <div key={idx} className="intervention-card">
                  <div className="intervention-header">
                    <span className="intervention-title">{rec.category}</span>
                    {rec.severity === 'CRITICAL' && <span className="badge badge-danger">CRITICAL</span>}
                    {rec.severity === 'HIGH' && <span className="badge badge-danger">HIGH PRIORITY</span>}
                    {rec.severity === 'MEDIUM' && <span className="badge badge-warning">MEDIUM</span>}
                    {rec.severity === 'WARNING' && <span className="badge badge-warning">MOMENTUM ALERT</span>}
                    {rec.severity === 'INFO' && <span className="badge badge-success">BENCHMARK LEADER</span>}
                  </div>

                  <div className="intervention-finding">{rec.finding}</div>

                  <div className="intervention-action">
                    🎯 <strong>Recommended Action:</strong> {rec.action}
                  </div>

                  {rec.potential_impact_estimate && (
                    <div className="intervention-impact">
                      <span>💰 Estimated Financial Impact: {rec.potential_impact_estimate}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="loading-container">
          <p>No ACO selected or data not available.</p>
        </div>
      )}
    </div>
  );
}
