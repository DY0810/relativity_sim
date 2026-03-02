import React from 'react';
import type { InputType } from '../store/useSimulatorStore';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { VectorInput } from './VectorInput';
import type { Vector4, NumericVector4 } from '../engine/cas';
import { checkCausalityViolation } from '../engine/cas';
import { evaluate as mathEval } from 'mathjs';
import { PARADOX_PRESETS } from '../constants/ParadoxPresets';

const parseNumericInput = (val: string): number => {
    try {
        return mathEval(val);
    } catch (e) {
        return 0;
    }
};

const NumericTupleInput: React.FC<{
    label: string,
    value: NumericVector4,
    onChange: (val: NumericVector4) => void
}> = ({ label, value, onChange }) => {
    const [local, setLocal] = React.useState<string[]>(value.map(v => v.toString()));

    const handleBlur = (index: number) => {
        const num = parseNumericInput(local[index]);
        const newVal = [...value] as NumericVector4;
        newVal[index] = num;
        onChange(newVal);
    };

    const handleChange = (index: number, val: string) => {
        const nextLocal = [...local];
        nextLocal[index] = val;
        setLocal(nextLocal);
    };

    React.useEffect(() => {
        setLocal(value.map(v => Number.isInteger(v) ? v.toString() : v.toFixed(3)));
    }, [value]);

    return (
        <div className="flex flex-col mb-4">
            <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1.5">{label}</label>
            <div className="flex gap-1 w-full items-center bg-black/20 border border-white/5 rounded-lg p-1">
                <div className="text-sm text-slate-500 shrink-0 select-none pl-2">(</div>
                {local.map((val, i) => (
                    <React.Fragment key={`num-${i}`}>
                        <input
                            type="text"
                            className="flex-1 min-w-0 bg-transparent px-1 py-1 text-slate-200 font-mono text-sm text-center focus:outline-none focus:bg-white/5 rounded transition-colors placeholder:text-slate-700"
                            value={val}
                            onChange={(e) => handleChange(i, e.target.value)}
                            onBlur={() => handleBlur(i)}
                        />
                        {i < 3 && <div className="text-sm text-slate-600 shrink-0 select-none">,</div>}
                    </React.Fragment>
                ))}
                <div className="text-sm text-slate-500 shrink-0 select-none pr-2">)</div>
            </div>
        </div>
    );
};

export const ControlPanel: React.FC = () => {
    const {
        particles,
        addParticle,
        removeParticle,
        updateParticleName,
        updateParticleColor,
        updateParticleInput,
        updateParticleInitialConditions,
        activeReferenceFrameId,
        setActiveReferenceFrame,
        tauRange,
        setTauRange,
        loadPreset
    } = useSimulatorStore();

    return (
        <div className="w-full h-full bg-transparent flex flex-col pt-2 overflow-y-auto custom-scrollbar">
            <div className="px-6 mb-6">
                <h2 className="text-[10px] font-bold tracking-widest uppercase text-cyan-neon/80 mb-1">Global Parameters</h2>
                <div className="h-[1px] w-full bg-gradient-to-r from-cyan-neon/30 to-transparent mb-4"></div>

                <label className="text-xs font-semibold text-slate-300 block mb-2">Load Classic Paradox</label>
                <div className="relative mb-4">
                    <select
                        className="w-full appearance-none bg-emerald-900/30 backdrop-blur-md border border-emerald-500/30 rounded-xl px-4 py-2.5 text-emerald-100 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/50 cursor-pointer transition-all"
                        onChange={(e) => {
                            if (e.target.value !== "") loadPreset(e.target.value);
                            e.target.value = "";
                        }}
                        defaultValue=""
                    >
                        <option value="" disabled className="bg-slate-900">-- Select Scenario --</option>
                        {PARADOX_PRESETS.map(p => (
                            <option key={p.id} value={p.id} className="bg-slate-900">{p.title}</option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500/70">▼</div>
                </div>

                <label className="text-xs font-semibold text-slate-300 block mb-2">Active Reference Frame</label>
                <div className="relative">
                    <select
                        className="w-full appearance-none bg-black/30 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-cyan-neon focus:ring-1 focus:ring-cyan-neon/50 cursor-pointer transition-all"
                        value={activeReferenceFrameId}
                        onChange={(e) => setActiveReferenceFrame(e.target.value)}
                    >
                        <option value="Lab">Lab Rest Frame (Absolute)</option>
                        {particles.map(p => (
                            <option key={`frame-${p.id}`} value={p.id}>MCRF: {p.name}</option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">▼</div>
                </div>
            </div>

            <div className="px-6 mb-8">
                <label className="text-xs font-semibold text-slate-300 block mb-3">Simulation Horizon (±τ)</label>
                <div className="flex items-center gap-4">
                    <input
                        type="range"
                        min="10"
                        max="500"
                        step="10"
                        value={tauRange}
                        onChange={(e) => setTauRange(Number(e.target.value))}
                        className="flex-1 glass-slider"
                    />
                    <div className="bg-black/30 border border-white/10 rounded-lg px-3 py-1 font-mono text-xs text-cyan-neon shadow-neon-cyan/20">
                        {tauRange.toString().padStart(3, '0')}
                    </div>
                </div>
            </div>

            <div className="px-6 mb-4 flex items-center justify-between">
                <h2 className="text-[10px] font-bold tracking-widest uppercase text-violet-neon/80">Entity Array</h2>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-violet-neon/30 to-transparent ml-4"></div>
            </div>

            <div className="flex-1 px-4 pb-20">
                {particles.map((p) => {
                    const inputType: InputType = p.inputPosition ? 'position' : (p.inputVelocity ? 'velocity' : 'acceleration');
                    const inputValue: Vector4 = p.inputPosition || p.inputVelocity || p.inputAcceleration || ['0', '0', '0', '0'];

                    const isFTL = checkCausalityViolation(p.velocityExpr);

                    return (
                        <div
                            key={p.id}
                            className={`mb-5 backdrop-blur-xl border rounded-2xl p-5 relative transition-all duration-500 group
                                ${isFTL
                                    ? 'bg-red-950/20 border-red-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                }`}
                            style={{ boxShadow: !isFTL ? `inset 0 0 40px ${p.color}08` : undefined }}
                        >
                            {/* Accent Glow Line */}
                            <div className="absolute top-0 left-4 right-4 h-[1px] opacity-50" style={{ background: `linear-gradient(90deg, transparent, ${p.color}, transparent)` }}></div>

                            <div className="flex justify-between items-center mb-5">
                                <div className="flex items-center gap-3 flex-1 mr-4">
                                    <div className="relative w-6 h-6 rounded-full overflow-hidden border border-white/20 shadow-lg cursor-pointer flex-shrink-0" style={{ boxShadow: `0 0 10px ${p.color}40` }}>
                                        <input
                                            type="color"
                                            value={p.color}
                                            onChange={(e) => updateParticleColor(p.id, e.target.value)}
                                            className="absolute -inset-2 w-10 h-10 p-0 cursor-pointer"
                                            title="Change marker color"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={p.name}
                                        onChange={(e) => updateParticleName(p.id, e.target.value)}
                                        className="font-bold text-lg text-slate-100 bg-transparent border-b border-white/0 hover:border-white/10 focus:border-cyan-neon focus:outline-none transition-colors px-1 w-full"
                                        title="Rename entity"
                                    />
                                </div>
                                {particles.length > 1 && (
                                    <button
                                        onClick={() => removeParticle(p.id)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all text-xs tracking-wider uppercase font-bold px-2 py-1"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>

                            <div className="mb-5 bg-black/20 rounded-xl p-1 border border-white/5 flex gap-1">
                                {(['position', 'velocity', 'acceleration'] as InputType[]).map(type => (
                                    <button
                                        key={type}
                                        className={`flex-1 py-1.5 px-2 text-[10px] font-bold tracking-widest uppercase rounded-lg transition-all duration-300 ${inputType === type
                                            ? 'bg-white/10 text-white shadow-lg'
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                            }`}
                                        onClick={() => updateParticleInput(p.id, type, inputValue)}
                                    >
                                        4-{type.charAt(0)}
                                    </button>
                                ))}
                            </div>

                            <VectorInput
                                label={`f(τ) : Symbolic 4-${inputType.charAt(0).toUpperCase() + inputType.slice(1)}`}
                                value={inputValue}
                                onChange={(val) => updateParticleInput(p.id, inputType, val)}
                            />

                            {isFTL && (
                                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 backdrop-blur-md shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 animate-pulse-slow shadow-[0_0_10px_rgba(244,63,94,0.8)]"></div>
                                        <div>
                                            <p className="text-red-400 text-xs font-bold tracking-widest uppercase mb-1">Causality Violation</p>
                                            <p className="text-red-300/70 text-xs leading-relaxed">
                                                Tachyonic trajectory detected (|v| &gt; c). Metric constraints failed. Render suspended.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {inputType !== 'position' && (
                                <div className="mt-5 pt-5 border-t border-white/5 relative">
                                    <h4 className="text-[10px] font-bold text-slate-500 mb-4 opacity-80 uppercase tracking-widest">Boundary Conditions (τ=0)</h4>
                                    {inputType === 'acceleration' && (
                                        <NumericTupleInput
                                            label="U₀^μ [Initial Velocity]"
                                            value={p.initialVelocity}
                                            onChange={(val) => updateParticleInitialConditions(p.id, undefined, val)}
                                        />
                                    )}
                                    <NumericTupleInput
                                        label="X₀^μ [Initial Position]"
                                        value={p.initialPosition}
                                        onChange={(val) => updateParticleInitialConditions(p.id, val, undefined)}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}

                <button
                    onClick={addParticle}
                    className="w-full py-4 mt-2 mb-8 rounded-2xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all font-bold text-sm tracking-wide shadow-lg group flex items-center justify-center gap-2"
                >
                    <span className="text-xl leading-none text-emerald-neon group-hover:scale-110 transition-transform">+</span> INITIALIZE ENTITY
                </button>
            </div>
        </div>
    );
};
