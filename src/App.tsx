import { ControlPanel } from './components/ControlPanel';
import { SpacetimeGraph } from './components/SpacetimeGraph';
import { Spacetime3DGraph } from './components/Spacetime3DGraph';
import { TimeSlider } from './components/TimeSlider';
import { DimensionTabs } from './components/DimensionTabs';
import { useSimulatorStore } from './store/useSimulatorStore';
import Hyperspeed from './components/Backgrounds/Hyperspeed';
import ShinyText from './components/ReactBits/ShinyText';

function App() {
  const viewMode = useSimulatorStore(s => s.viewMode);

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-slate-100 font-sans overflow-hidden relative">

      {/* Dynamic React Bits Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-60">
        <Hyperspeed effectOptions={{
          onSpeedUp: () => { },
          onSlowDown: () => { },
          distortion: 'turbulentDistortion',
          length: 400,
          roadWidth: 10,
          islandWidth: 2,
          lanesPerRoad: 3,
          fov: 90,
          fovSpeedUp: 150,
          speedUp: 2,
          carLightsFade: 0.4,
          totalSideLightSticks: 50,
          lightPairsPerRoadWay: 50,
          shoulderLinesWidthPercentage: 0.05,
          brokenLinesWidthPercentage: 0.1,
          brokenLinesLengthPercentage: 0.5,
          lightStickWidth: [0.12, 0.5],
          lightStickHeight: [1.3, 1.7],
          movingAwaySpeed: [20, 50],
          movingCloserSpeed: [-150, -230],
          carLightsLength: [400 * 0.05, 400 * 0.2],
          carLightsRadius: [0.05, 0.14],
          carWidthPercentage: [0.3, 0.5],
          carShiftX: [-0.2, 0.2],
          carFloorSeparation: [0.05, 1],
          colors: {
            roadColor: 0x080808,
            islandColor: 0x0a0a0a,
            background: 0x000000,
            shoulderLines: 0x131318,
            brokenLines: 0x131318,
            leftCars: [0x0ea5e9, 0x0284c7, 0x0369a1], // Cyan/Sky tones
            rightCars: [0x14b8a6, 0x0d9488, 0x0f766e], // Teal tones
            sticks: 0x0ea5e9,
          }
        }} />
      </div>

      {/* Sleek Top Branding Bar */}
      <header className="h-14 flex items-center px-6 border-b border-white/5 bg-slate-900/60 backdrop-blur-md z-40 shrink-0 relative">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan-neon animate-pulse-slow shadow-neon-cyan"></div>
          <h1 className="text-sm font-semibold tracking-widest uppercase text-slate-200">
            Relativity <span className="text-slate-500 font-light">| <ShinyText text="Kinematic Simulator" disabled={false} speed={3} className="inline-block" /></span>
          </h1>
        </div>
      </header>

      {/* Main Glassmorphic Workspace */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6 relative z-10">

        {/* Left Control Panel Wrapper */}
        <div className="w-[420px] shrink-0 bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col z-20">
          <ControlPanel />
        </div>

        {/* Right Visualization Wrapper */}
        <div className="flex-1 bg-slate-900/50 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden relative flex flex-col z-20">
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
