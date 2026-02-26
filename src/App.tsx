import { ControlPanel } from './components/ControlPanel';
import { SpacetimeGraph } from './components/SpacetimeGraph';
import { Spacetime3DGraph } from './components/Spacetime3DGraph';
import { TimeSlider } from './components/TimeSlider';
import { DimensionTabs } from './components/DimensionTabs';
import { useSimulatorStore } from './store/useSimulatorStore';

function App() {
  const viewMode = useSimulatorStore(s => s.viewMode);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <ControlPanel />
        <div className="flex-1 relative bg-slate-950 overflow-hidden">
          <DimensionTabs />
          {viewMode === '2d' ? <SpacetimeGraph /> : <Spacetime3DGraph />}
        </div>
      </div>
      <TimeSlider />
    </div>
  )
}

export default App
