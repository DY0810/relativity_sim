import React from 'react';
import type { InputType } from '../store/useSimulatorStore';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { VectorInput } from './VectorInput';
import type { Vector4, NumericVector4 } from '../engine/cas';
import { checkCausalityViolation } from '../engine/cas';
import { evaluate as mathEval } from 'mathjs';

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
            <label className="text-xs font-semibold text-slate-400 mb-1">{label}</label>
            <div className="flex gap-1 w-full items-center">
                <div className="text-sm text-slate-500 shrink-0">(</div>
                {local.map((val, i) => (
                    <React.Fragment key={`num-${i}`}>
                        <input
                            type="text"
                            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded px-1 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                            value={val}
                            onChange={(e) => handleChange(i, e.target.value)}
                            onBlur={() => handleBlur(i)}
                        />
                        {i < 3 && <div className="text-sm text-slate-500 shrink-0">,</div>}
                    </React.Fragment>
                ))}
                <div className="text-sm text-slate-500 shrink-0">)</div>
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
        setTauRange
    } = useSimulatorStore();

    return (
        <div className="w-[500px] h-full bg-slate-900 border-r border-slate-700 flex flex-col pt-4 overflow-y-auto custom-scrollbar">
            <div className="px-6 mb-6">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Relativity Simulator
                </h1>
                <p className="text-slate-400 text-sm mt-1">Define objects using 4-vectors. Metric: (-,+,+,+)</p>
            </div>

            <div className="px-6 mb-4">
                <label className="text-sm font-semibold text-slate-300 block mb-2">Active Reference Frame</label>
                <select
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                    value={activeReferenceFrameId}
                    onChange={(e) => setActiveReferenceFrame(e.target.value)}
                >
                    <option value="Lab">Lab Rest Frame</option>
                    {particles.map(p => (
                        <option key={`frame-${p.id}`} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            <div className="px-6 mb-4">
                <label className="text-sm font-semibold text-slate-300 block mb-2">Worldline Range (τ)</label>
                <div className="flex items-center gap-3">
                    <input
                        type="range"
                        min="10"
                        max="500"
                        step="10"
                        value={tauRange}
                        onChange={(e) => setTauRange(Number(e.target.value))}
                        className="flex-1 accent-blue-500 cursor-pointer"
                    />
                    <span className="text-slate-400 text-xs font-mono w-16 text-right">±{tauRange}</span>
                </div>
            </div>

            <div className="flex-1 px-4 pb-20">
                {particles.map((p) => {
                    const inputType: InputType = p.inputPosition ? 'position' : (p.inputVelocity ? 'velocity' : 'acceleration');
                    const inputValue: Vector4 = p.inputPosition || p.inputVelocity || p.inputAcceleration || ['0', '0', '0', '0'];

                    const isFTL = checkCausalityViolation(p.velocityExpr);

                    return (
                        <div key={p.id} className={`mb-4 bg-slate-800/50 border rounded-lg p-4 relative transition-colors ${isFTL ? 'border-red-500/70 hover:border-red-400' : 'border-slate-700 hover:border-slate-600'}`}>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2 flex-1 mr-4">
                                    <input
                                        type="color"
                                        value={p.color}
                                        onChange={(e) => updateParticleColor(p.id, e.target.value)}
                                        className="w-6 h-6 p-0 border-0 rounded cursor-pointer bg-transparent"
                                        title="Change particle color"
                                    />
                                    <input
                                        type="text"
                                        value={p.name}
                                        onChange={(e) => updateParticleName(p.id, e.target.value)}
                                        className="font-semibold text-slate-200 bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 focus:outline-none transition-colors px-1 w-full"
                                        title="Rename particle"
                                    />
                                </div>
                                {particles.length > 1 && (
                                    <button onClick={() => removeParticle(p.id)} className="text-slate-500 hover:text-red-400 transition-colors text-sm px-2 py-1">
                                        Remove
                                    </button>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="text-xs font-semibold text-slate-400 block mb-2 mt-2">Define Object By:</label>
                                <div className="flex gap-2">
                                    {(['position', 'velocity', 'acceleration'] as InputType[]).map(type => (
                                        <button
                                            key={type}
                                            className={`flex-1 py-1 px-2 text-xs rounded border transition-colors ${inputType === type
                                                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
                                                }`}
                                            onClick={() => updateParticleInput(p.id, type, inputValue)}
                                        >
                                            4-{type.charAt(0).toUpperCase() + type.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <VectorInput
                                label={`Symbolic 4-${inputType.charAt(0).toUpperCase() + inputType.slice(1)} (f(τ))`}
                                value={inputValue}
                                onChange={(val) => updateParticleInput(p.id, inputType, val)}
                            />

                            {isFTL && (
                                <div className="mt-3 p-3 rounded-md bg-red-500/10 border border-red-500/30">
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-400 text-lg leading-none mt-0.5">⚠</span>
                                        <div>
                                            <p className="text-red-300 text-xs font-semibold">Causality Violation — FTL Detected</p>
                                            <p className="text-red-400/80 text-xs mt-1 leading-relaxed">
                                                This worldline exceeds the speed of light (|v| &gt; c) for some values of τ.
                                                The particle will not be rendered on the graph until the trajectory is corrected.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {inputType !== 'position' && (
                                <div className="mt-4 pt-4 border-t border-slate-700">
                                    <h4 className="text-xs font-semibold text-slate-400 mb-3 opacity-80 uppercase tracking-wider">Initial Conditions (at τ=0)</h4>
                                    {inputType === 'acceleration' && (
                                        <NumericTupleInput
                                            label="Initial 4-Velocity U₀^μ"
                                            value={p.initialVelocity}
                                            onChange={(val) => updateParticleInitialConditions(p.id, undefined, val)}
                                        />
                                    )}
                                    <NumericTupleInput
                                        label="Initial 4-Position X₀^μ"
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
                    className="w-full py-3 mt-2 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400 hover:bg-slate-800 transition-all font-medium"
                >
                    + Add Object
                </button>
            </div>
        </div>
    );
};
