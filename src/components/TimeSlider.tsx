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
        <div className="h-16 border-t border-slate-700 bg-slate-900 flex items-center px-6 gap-4 shadow-2xl z-20">
            {/* Playback controls */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                >
                    {isPlaying ? <Square size={18} /> : <Play size={18} />}
                </button>
                <button
                    onClick={() => { setIsPlaying(false); setAnimationTime(timeMin); }}
                    className="p-2 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                >
                    <SkipBack size={18} />
                </button>
            </div>

            {/* Min label */}
            {editingMin ? (
                <input
                    type="number"
                    className="w-20 bg-slate-800 border border-blue-500 rounded px-2 py-0.5 text-xs font-mono text-blue-400 focus:outline-none"
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
                    className="text-xs font-mono text-slate-500 hover:text-blue-400 transition-colors cursor-pointer w-20 text-right"
                    title="Click to edit start time"
                >
                    {timeMin}
                </button>
            )}

            {/* Slider */}
            <div className="flex-1">
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
                    className="w-full accent-blue-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            {/* Max label */}
            {editingMax ? (
                <input
                    type="number"
                    className="w-20 bg-slate-800 border border-blue-500 rounded px-2 py-0.5 text-xs font-mono text-blue-400 focus:outline-none"
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
                    className="text-xs font-mono text-slate-500 hover:text-blue-400 transition-colors cursor-pointer w-20"
                    title="Click to edit end time"
                >
                    {timeMax}
                </button>
            )}

            {/* Current time */}
            <div className="w-28 text-right">
                <span className="text-base font-mono text-blue-400 font-bold">t = {animationTime.toFixed(2)}</span>
            </div>
        </div>
    );
};
