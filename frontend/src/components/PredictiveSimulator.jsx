import React, { useState, useEffect } from 'react';
import { 
  Sparkles, TrendingUp, TrendingDown, Sliders, DollarSign, 
  Percent, Award, AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';
import { fetchPredictiveSummary, fetchAcos, runSimulation } from '../api';

export default function PredictiveSimulator({ selectedAcoId, onSelectAco }) {
  const [summary, setSummary] = useState(null);
  const [acoList, setAcoList] = useState([]);
  const [currentId, setCurrentId] = useState(selectedAcoId || 'A1001');
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Simulation Sliders
  const [edRed, setEdRed] = useState(10);
  const [snfRed, setSnfRed] = useState(15);
  const [opdRed, setOpdRed] = useState(5);
  const [pcpInc, setPcpInc] = useState(10);
  const [qualBoost, setQualBoost] = useState(3);

  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    loadSummaryData();
    loadAcosList();
  }, []);

  useEffect(() => {
    if (selectedAcoId && selectedAcoId !== currentId) {
      setCurrentId(selectedAcoId);
    }
  }, [selectedAcoId]);

  useEffect(() => {
    if (currentId) {
      triggerSimulation();
    }
  }, [currentId, edRed, snfRed, opdRed, pcpInc, qualBoost]);

  async function loadSummaryData() {
    try {
      const data = await fetchPredictiveSummary();
      setSummary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function loadAcosList() {
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

  async function triggerSimulation() {
    if (!currentId) return;
    setSimulating(true);
    try {
      const res = await runSimulation({
        aco_id: currentId,
        ed_reduction_pct: parseFloat(edRed),
        snf_reduction_pct: parseFloat(snfRed),
        opd_reduction_pct: parseFloat(opdRed),
        pcp_increase_pct: parseFloat(pcpInc),
        qual_improvement_pts: parseFloat(qualBoost)
      });
      setSimResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  }

  const handleResetSliders = () => {
    setEdRed(10);
    setSnfRed(15);
    setOpdRed(5);
    setPcpInc(10);
    setQualBoost(3);
  };

  const sim = simResult?.results;

  return (
    <div>
      {/* View Header */}
      <div className="view-header">
        <div className="view-title-group">
          <h1>🔮 Predictive Modeling & What-If Scenario Simulator</h1>
          <p>Machine learning cost momentum forecasting, key driver analysis, and dynamic financial intervention modeling</p>
        </div>
      </div>

      {/* Trajectory Summary Cards */}
      {summary && (
        <div className="grid-kpis">
          <div className="kpi-card accent-rose">
            <div className="kpi-label">
              <span>Rising Cost Momentum</span>
              <TrendingUp size={16} />
            </div>
            <div className="kpi-value">{summary.trajectory_counts.rising} ACOs</div>
            <div className="kpi-sub">Projected next-year cost growth &gt; 0.5%</div>
          </div>

          <div className="kpi-card accent-emerald">
            <div className="kpi-label">
              <span>Falling Cost Trajectory</span>
              <TrendingDown size={16} />
            </div>
            <div className="kpi-value">{summary.trajectory_counts.falling} ACOs</div>
            <div className="kpi-sub">Sustaining cost reduction trend</div>
          </div>

          <div className="kpi-card accent-sky">
            <div className="kpi-label">
              <span>Stable Trajectory</span>
              <Award size={16} />
            </div>
            <div className="kpi-value">{summary.trajectory_counts.stable} ACOs</div>
            <div className="kpi-sub">In line with baseline benchmark</div>
          </div>

          <div className="kpi-card accent-amber">
            <div className="kpi-label">
              <span>Underperforming Risk Flags</span>
              <AlertCircle size={16} />
            </div>
            <div className="kpi-value">{summary.risk_tiers['Underperforming vs. peer profile'] || 0}</div>
            <div className="kpi-sub">Trailing peer risk profile</div>
          </div>
        </div>
      )}

      {/* What-If Simulator Section */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--bg-surface-elevated)' }}>
        <div className="card-header">
          <div className="card-title">
            <Sliders size={18} color="#38bdf8" />
            <span>Interactive What-If Intervention Simulator</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={handleResetSliders} style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
              <RefreshCw size={12} /> Reset Levers
            </button>
          </div>
        </div>

        {/* ACO Selector for Simulation */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select ACO Contract to Simulate:</label>
          <div style={{ minWidth: '340px' }}>
            <select 
              className="select-input"
              value={currentId}
              onChange={(e) => {
                const id = e.target.value;
                setCurrentId(id);
                if (onSelectAco) onSelectAco(id);
              }}
              style={{ width: '100%', fontWeight: 600 }}
            >
              {acoList.map((a) => (
                <option key={a.ACO_ID} value={a.ACO_ID}>
                  {a.ACO_ID} — {a.ACO_Name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Simulator Grid: Levers on Left, Real-Time Financial Impact on Right */}
        <div className="grid-2col" style={{ marginBottom: 0 }}>
          {/* Sliders Box */}
          <div style={{ background: 'var(--bg-surface-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Operational & Clinical Levers
            </h3>

            {/* Slider 1: ED Reduction */}
            <div style={{ marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Emergency Dept (ED) Redirection</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>-{edRed}% Visits</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="30" 
                step="1" 
                value={edRed} 
                onChange={(e) => setEdRed(e.target.value)}
                className="slider-control" 
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Triage hotlines, urgent care steerage & care management</div>
            </div>

            {/* Slider 2: SNF Admission Reduction */}
            <div style={{ marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>SNF Steerage & Length-of-Stay</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>-{snfRed}% Admissions</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="35" 
                step="1" 
                value={snfRed} 
                onChange={(e) => setSnfRed(e.target.value)}
                className="slider-control" 
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Narrow post-acute network & home health transition</div>
            </div>

            {/* Slider 3: Outpatient Cost Optimization */}
            <div style={{ marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Outpatient Facility Optimization</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>-{opdRed}% Spend</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="20" 
                step="1" 
                value={opdRed} 
                onChange={(e) => setOpdRed(e.target.value)}
                className="slider-control" 
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Site-of-service steerage from HOPD to ASC/office</div>
            </div>

            {/* Slider 4: Primary Care Engagement */}
            <div style={{ marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Primary Care (PCP) Engagement</span>
                <span style={{ fontWeight: 700, color: 'var(--status-success)' }}>+{pcpInc}% Visits</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="30" 
                step="1" 
                value={pcpInc} 
                onChange={(e) => setPcpInc(e.target.value)}
                className="slider-control" 
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Annual Wellness Visits (AWVs) & proactive touchpoints</div>
            </div>

            {/* Slider 5: Quality Boost */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Quality Score Improvement</span>
                <span style={{ fontWeight: 700, color: 'var(--status-warning)' }}>+{qualBoost} Points</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="10" 
                step="0.5" 
                value={qualBoost} 
                onChange={(e) => setQualBoost(e.target.value)}
                className="slider-control" 
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CAHPS outreach & chronic disease clinical gap closure</div>
            </div>
          </div>

          {/* Real-time Simulated Results Box */}
          <div style={{ background: 'var(--bg-surface-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Simulated Financial Impact
                </h3>
                {simulating && <span className="badge badge-info">Calculating...</span>}
              </div>

              {sim && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Big Gain Card */}
                  <div style={{ 
                    background: sim.net_dollar_gain >= 0 ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
                    border: `1px solid ${sim.net_dollar_gain >= 0 ? 'var(--status-success-border)' : 'var(--status-danger-border)'}`,
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: sim.net_dollar_gain >= 0 ? 'var(--status-success)' : 'var(--status-danger)', textTransform: 'uppercase' }}>
                        Net Dollar Gain for ACO
                      </div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: sim.net_dollar_gain >= 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                        {sim.net_dollar_gain >= 0 ? `+$${Math.round(sim.net_dollar_gain).toLocaleString()}` : `-$${Math.abs(Math.round(sim.net_dollar_gain)).toLocaleString()}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gross Program Savings</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ${Math.round(sim.total_gross_savings).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Metrics Comparison Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.82rem' }}>
                    <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Per-Capita Expenditure</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>${Math.round(sim.original_per_capita_exp).toLocaleString()}</span>
                        <span style={{ fontWeight: 700, color: 'var(--status-success)' }}>${Math.round(sim.simulated_per_capita_exp).toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--status-success)', marginTop: '0.15rem' }}>
                        -${Math.round(sim.per_capita_savings)} / beneficiary
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Shared Savings Rate</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{sim.original_savings_rate.toFixed(2)}%</span>
                        <span style={{ fontWeight: 700, color: 'var(--status-success)' }}>{sim.simulated_savings_rate.toFixed(2)}%</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--status-success)', marginTop: '0.15rem' }}>
                        +{(sim.simulated_savings_rate - sim.original_savings_rate).toFixed(2)}% rate delta
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Earned Savings Payout</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>${Math.round(sim.original_earned_savings).toLocaleString()}</span>
                        <span style={{ fontWeight: 700, color: 'var(--status-success)' }}>${Math.round(sim.simulated_earned_savings).toLocaleString()}</span>
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Quality Score Target</div>
                      <div style={{ fontWeight: 700, color: 'var(--accent-sky)', marginTop: '0.2rem' }}>
                        {sim.simulated_quality_score.toFixed(1)} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>/ 100</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1rem', padding: '0.65rem', background: 'rgba(2, 132, 199, 0.06)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              📌 <strong>Audit Note:</strong> Simulation applies Medicare Shared Savings methodology accounting for MSR thresholds and quality sharing factors.
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Driver Feature Importance & Top Trajectory Movers */}
      <div className="grid-2col">
        {/* ML Drivers */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Sparkles size={18} color="#38bdf8" />
              <span>What Drives Savings/Loss — ML Feature Importance</span>
            </div>
            <span className="card-subtitle">Gradient Boosting cross-sectional driver importance</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {summary?.drivers?.map((d) => (
              <div key={d.feature}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.feature_label || d.feature}</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-sky)' }}>{(d.importance * 100).toFixed(1)}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-main)', borderRadius: '3px' }}>
                  <div 
                    style={{ 
                      width: `${d.importance * 100 * 2.2}%`, 
                      maxWidth: '100%',
                      height: '100%', 
                      background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                      borderRadius: '3px'
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Movers (Rising Trajectory) */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <TrendingUp size={18} color="#f43f5e" />
              <span>Highest Projected Cost Escalation (Top Movers)</span>
            </div>
            <span className="card-subtitle">ACOs with largest projected % cost momentum</span>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ACO ID</th>
                  <th>ACO Name</th>
                  <th className="num">Current PY</th>
                  <th className="num">Projected</th>
                  <th className="num">Growth</th>
                </tr>
              </thead>
              <tbody>
                {summary?.top_rising_trend?.slice(0, 7).map((t) => (
                  <tr key={t.ACO_ID} onClick={() => onSelectAco(t.ACO_ID)}>
                    <td className="mono" style={{ color: 'var(--accent-sky)' }}>{t.ACO_ID}</td>
                    <td style={{ fontWeight: 500, maxWidth: '180px' }}>{t.ACO_Name}</td>
                    <td className="num">${Math.round(t.current_py_expenditure).toLocaleString()}</td>
                    <td className="num">${Math.round(t.projected_next_year_expenditure).toLocaleString()}</td>
                    <td className="num" style={{ fontWeight: 700, color: 'var(--status-danger)' }}>
                      +{t.projected_pct_change.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
