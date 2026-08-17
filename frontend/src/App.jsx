import React, { useState } from 'react';
import { 
  Building2, Activity, Sparkles, MapPin, FileText, Stethoscope, 
  Layers, ShieldCheck
} from 'lucide-react';
import ExecutiveCommandCenter from './components/ExecutiveCommandCenter';
import AcoDeepDive from './components/AcoDeepDive';
import PredictiveSimulator from './components/PredictiveSimulator';
import BenchmarksExplorer from './components/BenchmarksExplorer';
import ExecutiveReport from './components/ExecutiveReport';

export default function App() {
  const [activeTab, setActiveTab] = useState('command_center');
  const [selectedAcoId, setSelectedAcoId] = useState('A1001');

  const handleSelectAco = (acoId) => {
    setSelectedAcoId(acoId);
    setActiveTab('deep_dive');
  };

  const handleNavigateToSimulator = (acoId) => {
    if (acoId) setSelectedAcoId(acoId);
    setActiveTab('predictive');
  };

  const handleNavigateToReport = (acoId) => {
    if (acoId) setSelectedAcoId(acoId);
    setActiveTab('report');
  };

  return (
    <>
      {/* App Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">
            <Building2 size={22} />
          </div>
          <div>
            <div className="brand-title">Value-Based Care Contract Performance Command Center</div>
            <div className="brand-subtitle">CMS Medicare Shared Savings Program (MSSP) · Performance Year 2024</div>
          </div>
        </div>

        <div className="header-badges">
          <span className="badge badge-success">
            <ShieldCheck size={13} /> CMS Official PUF
          </span>
          <span className="badge badge-info">
            <Activity size={13} /> 476 ACOs Active
          </span>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <nav className="nav-tabs-bar no-print">
        <button 
          className={`nav-tab ${activeTab === 'command_center' ? 'active' : ''}`}
          onClick={() => setActiveTab('command_center')}
        >
          <Building2 size={16} /> 📊 Executive Command Center
        </button>

        <button 
          className={`nav-tab ${activeTab === 'deep_dive' ? 'active' : ''}`}
          onClick={() => setActiveTab('deep_dive')}
        >
          <Layers size={16} /> 🔍 ACO 360° Deep-Dive
        </button>

        <button 
          className={`nav-tab ${activeTab === 'predictive' ? 'active' : ''}`}
          onClick={() => setActiveTab('predictive')}
        >
          <Sparkles size={16} /> 🔮 Predictive Insights & What-If Simulator
        </button>

        <button 
          className={`nav-tab ${activeTab === 'benchmarks' ? 'active' : ''}`}
          onClick={() => setActiveTab('benchmarks')}
        >
          <MapPin size={16} /> 🔎 National Provider Benchmarks
        </button>

        <button 
          className={`nav-tab ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <FileText size={16} /> 📄 Payer-Provider Executive Briefing
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'command_center' && (
          <ExecutiveCommandCenter onSelectAco={handleSelectAco} />
        )}

        {activeTab === 'deep_dive' && (
          <AcoDeepDive 
            selectedAcoId={selectedAcoId} 
            onSelectAco={setSelectedAcoId}
            onNavigateToSimulator={handleNavigateToSimulator}
            onNavigateToReport={handleNavigateToReport}
          />
        )}

        {activeTab === 'predictive' && (
          <PredictiveSimulator 
            selectedAcoId={selectedAcoId} 
            onSelectAco={setSelectedAcoId} 
          />
        )}

        {activeTab === 'benchmarks' && (
          <BenchmarksExplorer />
        )}

        {activeTab === 'report' && (
          <ExecutiveReport 
            selectedAcoId={selectedAcoId} 
            onSelectAco={setSelectedAcoId} 
          />
        )}
      </main>
    </>
  );
}
