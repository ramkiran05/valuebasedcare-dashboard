/**
 * API Client for VBC Command Center
 */

const API_BASE = '/api';

export async function fetchOverview() {
  const res = await fetch(`${API_BASE}/overview`);
  if (!res.ok) throw new Error('Failed to load overview data');
  return res.json();
}

export async function fetchAcos(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  const res = await fetch(`${API_BASE}/acos?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to load ACOs list');
  return res.json();
}

export async function fetchAcoDetail(acoId) {
  const res = await fetch(`${API_BASE}/acos/${encodeURIComponent(acoId)}`);
  if (!res.ok) throw new Error(`Failed to load details for ACO ${acoId}`);
  return res.json();
}

export async function fetchPredictiveSummary() {
  const res = await fetch(`${API_BASE}/predictive/summary`);
  if (!res.ok) throw new Error('Failed to load predictive summary');
  return res.json();
}

export async function runSimulation(payload) {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Simulation calculation failed');
  return res.json();
}

export async function fetchBenchmarksMeta() {
  const res = await fetch(`${API_BASE}/benchmarks/meta`);
  if (!res.ok) throw new Error('Failed to load benchmarks metadata');
  return res.json();
}

export async function fetchGeoBenchmarks(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  const res = await fetch(`${API_BASE}/benchmarks/geo?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to load geo service benchmarks');
  return res.json();
}

export async function fetchProviderBenchmarks(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  });
  const res = await fetch(`${API_BASE}/benchmarks/providers?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to load provider benchmarks');
  return res.json();
}

export async function fetchExecutiveReport(acoId) {
  const res = await fetch(`${API_BASE}/report/${encodeURIComponent(acoId)}`);
  if (!res.ok) throw new Error(`Failed to load report for ACO ${acoId}`);
  return res.json();
}
