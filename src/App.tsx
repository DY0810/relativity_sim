import { ControlPanel } from './components/ControlPanel';
import { SpacetimeGraph } from './components/SpacetimeGraph';
import { Spacetime3DGraph } from './components/Spacetime3DGraph';
import { TimeSlider } from './components/TimeSlider';
import { DimensionTabs } from './components/DimensionTabs';
import { useSimulatorStore } from './store/useSimulatorStore';

function App() {
  const viewMode = useSimulatorStore(s => s.viewMode);

  return (
    <div className="flex flex-col h-screen w-screen bg-transparent text-slate-100 font-sans overflow-hidden">

      {/* Sleek Top Branding Bar */}
      <header className="h-14 flex items-center px-6 border-b border-white/5 bg-slate-900/40 backdrop-blur-md z-40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan-neon animate-pulse-slow shadow-neon-cyan"></div>
          <h1 className="text-sm font-semibold tracking-widest uppercase text-slate-200">
            Relativity <span className="text-slate-500 font-light">| Kinematic Simulator</span>
          </h1>
        </div>
      </header>

      {/* Main Glassmorphic Workspace */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6 relative z-10">

        {/* Left Control Panel Wrapper */}
        <div className="w-[420px] shrink-0 bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <ControlPanel />
        </div>

        {/* Right Visualization Wrapper */}
        <div className="flex-1 bg-slate-900/30 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative flex flex-col">
          <DimensionTabs />
          <div className="flex-1 relative">
            {viewMode === '2d' ? <SpacetimeGraph /> : <Spacetime3DGraph />}
          </div>
          <TimeSlider />
        </div>

      </div>
    </div>
  )
}

export default App
