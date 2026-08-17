import React, { useState, useEffect } from 'react';
import { 
  Search, MapPin, Stethoscope, DollarSign, Database, FileText, 
  ChevronRight, ChevronLeft, Filter, AlertCircle
} from 'lucide-react';
import { fetchBenchmarksMeta, fetchGeoBenchmarks, fetchProviderBenchmarks } from '../api';

export default function BenchmarksExplorer() {
  const [activeSubTab, setActiveSubTab] = useState('geo'); // 'geo' or 'providers'
  const [meta, setMeta] = useState({ states: [], specialties: [] });

  // Geo benchmarks filters
  const [geoLvl, setGeoLvl] = useState('National');
  const [selectedState, setSelectedState] = useState('');
  const [hcpcsSearch, setHcpcsSearch] = useState('');
  const [geoData, setGeoData] = useState(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoPage, setGeoPage] = useState(1);
  const geoPageSize = 25;

  // Provider benchmarks filters
  const [selectedSpec, setSelectedSpec] = useState('All');
  const [selectedProvState, setSelectedProvState] = useState('All');
  const [provNameSearch, setProvNameSearch] = useState('');
  const [provData, setProvData] = useState(null);
  const [provLoading, setProvLoading] = useState(true);
  const [provPage, setProvPage] = useState(1);
  const provPageSize = 25;

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'geo') {
      loadGeoData();
    }
  }, [activeSubTab, geoLvl, selectedState, hcpcsSearch, geoPage]);

  useEffect(() => {
    if (activeSubTab === 'providers') {
      loadProvData();
    }
  }, [activeSubTab, selectedSpec, selectedProvState, provNameSearch, provPage]);

  async function loadMeta() {
    try {
      const data = await fetchBenchmarksMeta();
      setMeta(data);
      if (data.states?.length > 0 && !selectedState) {
        setSelectedState(data.states[0]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadGeoData() {
    setGeoLoading(true);
    try {
      const data = await fetchGeoBenchmarks({
        geo_lvl: geoLvl,
        state: geoLvl === 'State' ? selectedState : undefined,
        query: hcpcsSearch,
        limit: geoPageSize,
        offset: (geoPage - 1) * geoPageSize
      });
      setGeoData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setGeoLoading(false);
    }
  }

  async function loadProvData() {
    setProvLoading(true);
    try {
      const data = await fetchProviderBenchmarks({
        specialty: selectedSpec,
        state: selectedProvState,
        search_name: provNameSearch,
        limit: provPageSize,
        offset: (provPage - 1) * provPageSize
      });
      setProvData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setProvLoading(false);
    }
  }

  return (
    <div>
      {/* View Header */}
      <div className="view-header">
        <div className="view-title-group">
          <h1>🔎 National Provider & Service Cost Benchmarks</h1>
          <p>CMS Medicare Physician & Other Practitioners service-level pricing and NPI provider directory</p>
        </div>

        {/* Sub-tab switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-surface)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <button 
            className={`btn ${activeSubTab === 'geo' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
            onClick={() => setActiveSubTab('geo')}
          >
            <MapPin size={14} /> Geography & Service Benchmarks
          </button>
          <button 
            className={`btn ${activeSubTab === 'providers' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
            onClick={() => setActiveSubTab('providers')}
          >
            <Stethoscope size={14} /> Provider (NPI) Explorer
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: Geography & Service Benchmarks */}
      {activeSubTab === 'geo' && (
        <>
          {/* Filters Bar */}
          <div className="filter-bar">
            <div className="form-group">
              <label className="form-label">Geography Level</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className={`btn ${geoLvl === 'National' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => { setGeoLvl('National'); setGeoPage(1); }}
                >
                  National
                </button>
                <button 
                  className={`btn ${geoLvl === 'State' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  onClick={() => { setGeoLvl('State'); setGeoPage(1); }}
                >
                  State-Level
                </button>
              </div>
            </div>

            {geoLvl === 'State' && (
              <div className="form-group" style={{ minWidth: '200px' }}>
                <label className="form-label">Select State</label>
                <select 
                  className="select-input"
                  value={selectedState}
                  onChange={(e) => { setSelectedState(e.target.value); setGeoPage(1); }}
                >
                  {meta.states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group input-with-icon" style={{ flex: 1, minWidth: '260px' }}>
              <label className="form-label">Search HCPCS Code / Description</label>
              <div className="input-with-icon">
                <Search size={16} className="input-icon" />
                <input 
                  type="text"
                  className="input-text"
                  placeholder="e.g. 99213, Office Visit, Colonoscopy, MRI..."
                  value={hcpcsSearch}
                  onChange={(e) => { setHcpcsSearch(e.target.value); setGeoPage(1); }}
                />
              </div>
            </div>
          </div>

          {/* Benchmarks Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Database size={18} color="#0284c7" />
                <span>Medicare Allowed & Payment Rates ({geoLvl})</span>
              </div>
              <span className="card-subtitle">
                {geoData ? `${geoData.total.toLocaleString()} services match query` : 'Loading...'}
              </span>
            </div>

            {geoLoading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading benchmark rates...</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>HCPCS Code</th>
                      <th>Service Description</th>
                      <th>Place of Service</th>
                      <th className="num">Providers</th>
                      <th className="num">Beneficiaries</th>
                      <th className="num">Total Services</th>
                      <th className="num">Avg Submitted Charge</th>
                      <th className="num">Avg Allowed Amt</th>
                      <th className="num">Avg Medicare Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {geoData?.benchmarks?.map((b, idx) => (
                      <tr key={idx}>
                        <td className="mono" style={{ color: 'var(--accent-sky)', fontWeight: 600 }}>{b.HCPCS_Cd}</td>
                        <td style={{ fontWeight: 500, maxWidth: '280px' }}>{b.HCPCS_Desc}</td>
                        <td>
                          <span className={`badge ${b.Place_Of_Srvc === 'F' ? 'badge-info' : 'badge-neutral'}`}>
                            {b.Place_Of_Srvc === 'F' ? 'Facility (Hospital/ASC)' : 'Non-Facility (Office)'}
                          </span>
                        </td>
                        <td className="num">{b.Tot_Rndrng_Prvdrs?.toLocaleString()}</td>
                        <td className="num">{b.Tot_Benes?.toLocaleString()}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{b.Tot_Srvcs?.toLocaleString()}</td>
                        <td className="num">${Math.round(b.Avg_Sbmtd_Chrg || 0).toLocaleString()}</td>
                        <td className="num" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          ${Math.round(b.Avg_Mdcr_Alowd_Amt || 0).toLocaleString()}
                        </td>
                        <td className="num" style={{ fontWeight: 700, color: 'var(--status-success)' }}>
                          ${Math.round(b.Avg_Mdcr_Pymt_Amt || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {geoData && geoData.total > geoPageSize && (
              <div className="pagination-bar">
                <span>
                  Showing {((geoPage - 1) * geoPageSize) + 1} - {Math.min(geoPage * geoPageSize, geoData.total)} of {geoData.total.toLocaleString()} services
                </span>
                <div className="pagination-controls">
                  <button 
                    className="btn btn-secondary"
                    disabled={geoPage <= 1}
                    onClick={() => setGeoPage(geoPage - 1)}
                  >
                    Previous
                  </button>
                  <button 
                    className="btn btn-secondary"
                    disabled={geoPage * geoPageSize >= geoData.total}
                    onClick={() => setGeoPage(geoPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* SUB-TAB 2: Provider (NPI) Explorer */}
      {activeSubTab === 'providers' && (
        <>
          {/* Filters Bar */}
          <div className="filter-bar">
            <div className="form-group" style={{ minWidth: '220px' }}>
              <label className="form-label">Specialty / Provider Type</label>
              <select 
                className="select-input"
                value={selectedSpec}
                onChange={(e) => { setSelectedSpec(e.target.value); setProvPage(1); }}
              >
                <option value="All">All Specialties</option>
                {meta.specialties.map((sp) => (
                  <option key={sp} value={sp}>{sp}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ minWidth: '120px' }}>
              <label className="form-label">State</label>
              <select 
                className="select-input"
                value={selectedProvState}
                onChange={(e) => { setSelectedProvState(e.target.value); setProvPage(1); }}
              >
                <option value="All">All States</option>
                {meta.states.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div className="form-group input-with-icon" style={{ flex: 1, minWidth: '240px' }}>
              <label className="form-label">Search Provider / Organization Name</label>
              <div className="input-with-icon">
                <Search size={16} className="input-icon" />
                <input 
                  type="text"
                  className="input-text"
                  placeholder="Search by physician last name or group practice..."
                  value={provNameSearch}
                  onChange={(e) => { setProvNameSearch(e.target.value); setProvPage(1); }}
                />
              </div>
            </div>
          </div>

          {/* Provider Directory Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Stethoscope size={18} color="#10b981" />
                <span>Provider Directory (~10% National Representative Sample)</span>
              </div>
              <span className="card-subtitle">
                {provData ? `${provData.total.toLocaleString()} providers match filter` : 'Loading...'}
              </span>
            </div>

            {provLoading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Querying high-performance provider database...</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>NPI</th>
                      <th>Provider / Practice Name</th>
                      <th>Specialty</th>
                      <th>Location</th>
                      <th className="num">Beneficiaries</th>
                      <th className="num">Total Services</th>
                      <th className="num">Total Medicare Allowed</th>
                      <th className="num">Total Medicare Paid</th>
                      <th className="num">Avg Patient Risk Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provData?.providers?.map((p) => (
                      <tr key={p.Rndrng_NPI}>
                        <td className="mono" style={{ color: 'var(--accent-sky)', fontWeight: 600 }}>{p.Rndrng_NPI}</td>
                        <td style={{ fontWeight: 600 }}>
                          {p.Rndrng_Prvdr_Last_Org_Name}
                          {p.Rndrng_Prvdr_First_Name ? `, ${p.Rndrng_Prvdr_First_Name}` : ''}
                        </td>
                        <td><span className="badge badge-neutral">{p.Rndrng_Prvdr_Type}</span></td>
                        <td>{p.Rndrng_Prvdr_City}, {p.Rndrng_Prvdr_State_Abrvtn}</td>
                        <td className="num">{p.Tot_Benes?.toLocaleString()}</td>
                        <td className="num">{p.Tot_Srvcs?.toLocaleString()}</td>
                        <td className="num">${Math.round(p.Tot_Mdcr_Alowd_Amt || 0).toLocaleString()}</td>
                        <td className="num" style={{ fontWeight: 700, color: 'var(--status-success)' }}>
                          ${Math.round(p.Tot_Mdcr_Pymt_Amt || 0).toLocaleString()}
                        </td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {p.Bene_Avg_Risk_Scre ? p.Bene_Avg_Risk_Scre.toFixed(2) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {provData && provData.total > provPageSize && (
              <div className="pagination-bar">
                <span>
                  Showing {((provPage - 1) * provPageSize) + 1} - {Math.min(provPage * provPageSize, provData.total)} of {provData.total.toLocaleString()} providers
                </span>
                <div className="pagination-controls">
                  <button 
                    className="btn btn-secondary"
                    disabled={provPage <= 1}
                    onClick={() => setProvPage(provPage - 1)}
                  >
                    Previous
                  </button>
                  <button 
                    className="btn btn-secondary"
                    disabled={provPage * provPageSize >= provData.total}
                    onClick={() => setProvPage(provPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
