import React, { useEffect, useState } from 'react';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { Play, Square, SkipBack } from 'lucide-react';

export const TimeSlider: React.FC = () => {
    const { animationTime, setAnimationTime, timeMin, timeMax, setTimeMin, setTimeMax } = useSimulatorStore();
    const [isPlaying, setIsPlaying] = useState(false);

    // Editable min/max
    const [editingMin, setEditingMin] = useState(false);
    const [editingMax, setEditingMax] = useState(false);
    const [minInput, setMinInput] = useState(timeMin.toString());
    const [maxInput, setMaxInput] = useState(timeMax.toString());

    useEffect(() => {
        if (!isPlaying) return;

        let lastTime = performance.now();
        let animationFrameId: number;

        const animate = (time: number) => {
            const delta = (time - lastTime) / 1000;
            lastTime = time;

            const { animationTime: cur, timeMin: mn, timeMax: mx } = useSimulatorStore.getState();
            const nextTime = cur + delta;

            if (nextTime > mx) {
                setAnimationTime(mn);
            } else {
                setAnimationTime(nextTime);
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, setAnimationTime]);

    useEffect(() => { setMinInput(timeMin.toString()); }, [timeMin]);
    useEffect(() => { setMaxInput(timeMax.toString()); }, [timeMax]);

    const submitMin = () => {
        const val = parseFloat(minInput);
        if (!isNaN(val)) {
            setTimeMin(val);
            if (animationTime < val) setAnimationTime(val);
        } else {
            setMinInput(timeMin.toString());
        }
        setEditingMin(false);
    };

    const submitMax = () => {
        const val = parseFloat(maxInput);
        if (!isNaN(val)) {
            setTimeMax(val);
            if (animationTime > val) setAnimationTime(val);
        } else {
            setMaxInput(timeMax.toString());
        }
        setEditingMax(false);
    };

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl h-14 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-full px-6 flex items-center gap-4 shadow-[0_20px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(6,182,212,0.1)] z-50 transition-all hover:bg-black/50 hover:border-white/20">
            {/* Playback controls */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-cyan-neon transition-colors shadow-sm"
                >
                    {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <button
                    onClick={() => { setIsPlaying(false); setAnimationTime(timeMin); }}
                    className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-cyan-neon transition-colors"
                >
                    <SkipBack size={18} />
                </button>
            </div>

            {/* Min label */}
            {editingMin ? (
                <input
                    type="number"
                    className="w-16 bg-black/40 border border-cyan-neon/50 rounded-lg px-2 py-1 text-xs font-mono text-cyan-neon focus:outline-none focus:ring-1 focus:ring-cyan-neon text-right shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                    value={minInput}
                    onChange={(e) => setMinInput(e.target.value)}
                    onBlur={submitMin}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitMin(); }}
                    autoFocus
                    step="any"
                />
            ) : (
                <button
                    onClick={() => setEditingMin(true)}
                    className="text-xs font-mono text-slate-400 hover:text-cyan-neon transition-colors cursor-pointer w-16 text-right font-medium"
                    title="Click to edit start time"
                >
                    {timeMin}
                </button>
            )}

            {/* Slider */}
            <div className="flex-1 px-4">
                <input
                    type="range"
                    min={timeMin}
                    max={timeMax}
                    step={Math.max(0.01, (timeMax - timeMin) / 1000)}
                    value={animationTime}
                    onChange={(e) => {
                        setIsPlaying(false);
                        setAnimationTime(parseFloat(e.target.value));
                    }}
                    className="w-full h-1.5 glass-slider"
                />
            </div>

            {/* Max label */}
            {editingMax ? (
                <input
                    type="number"
                    className="w-16 bg-black/40 border border-cyan-neon/50 rounded-lg px-2 py-1 text-xs font-mono text-cyan-neon focus:outline-none focus:ring-1 focus:ring-cyan-neon shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                    value={maxInput}
                    onChange={(e) => setMaxInput(e.target.value)}
                    onBlur={submitMax}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitMax(); }}
                    autoFocus
                    step="any"
                />
            ) : (
                <button
                    onClick={() => setEditingMax(true)}
                    className="text-xs font-mono text-slate-400 hover:text-cyan-neon transition-colors cursor-pointer w-16 text-left font-medium"
                    title="Click to edit end time"
                >
                    {timeMax}
                </button>
            )}

            {/* Current time */}
            <div className="w-28 text-right border-l border-white/10 pl-4 py-1">
                <span className="text-sm font-mono text-cyan-neon font-bold tracking-wider" style={{ textShadow: '0 0 10px rgba(6,182,212,0.5)' }}>t={animationTime.toFixed(2)}</span>
            </div>
        </div>
    );
};
