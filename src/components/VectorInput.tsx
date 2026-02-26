import React, { useState, useRef, useEffect } from 'react';
import type { Vector4 } from '../engine/cas';
import { validateExpression } from '../engine/cas';

interface Props {
    label: string;
    value: Vector4;
    onChange: (newVal: Vector4) => void;
    disabled?: boolean;
}

// Groups of insertable symbols/functions with display labels and insertion text
const SYMBOL_GROUPS = [
    {
        label: 'Variables',
        items: [
            { display: 'τ', insert: 'tau', description: 'Proper time' },
            { display: 'π', insert: 'pi', description: '3.14159…' },
            { display: 'e', insert: 'e', description: "Euler's number 2.71828…" },
        ]
    },
    {
        label: 'Constants',
        items: [
            { display: 'c', insert: 'c', description: 'Speed of light = 1 (natural units)' },
            { display: 'g', insert: 'g', description: 'Gravitational accel = 9.80665 m/s²' },
            { display: 'ℏ', insert: 'hbar', description: 'Reduced Planck const = 1 (natural units)' },
            { display: 'k_B', insert: 'kb', description: 'Boltzmann const = 1 (natural units)' },
            { display: 'φ', insert: 'phi', description: 'Golden ratio = 1.618…' },
        ]
    },
    {
        label: 'Trig',
        items: [
            { display: 'sin', insert: 'sin(', description: 'Sine' },
            { display: 'cos', insert: 'cos(', description: 'Cosine' },
            { display: 'tan', insert: 'tan(', description: 'Tangent' },
        ]
    },
    {
        label: 'Hyperbolic',
        items: [
            { display: 'sinh', insert: 'sinh(', description: 'Hyperbolic sine' },
            { display: 'cosh', insert: 'cosh(', description: 'Hyperbolic cosine' },
            { display: 'tanh', insert: 'tanh(', description: 'Hyperbolic tangent' },
        ]
    },
    {
        label: 'Operators & Functions',
        items: [
            { display: '÷', insert: '/', description: 'Division' },
            { display: '×', insert: '*', description: 'Multiply' },
            { display: 'exp', insert: 'exp(', description: 'Exponential eˣ' },
            { display: 'ln', insert: 'log(', description: 'Natural log' },
            { display: '√', insert: 'sqrt(', description: 'Square root' },
            { display: 'x²', insert: '^2', description: 'Square' },
            { display: 'xⁿ', insert: '^', description: 'Power' },
            { display: '|x|', insert: 'abs(', description: 'Absolute value' },
        ]
    },
];

const SymbolPalette: React.FC<{
    onInsert: (text: string) => void;
    anchorRef: React.RefObject<HTMLElement | null>;
}> = ({ onInsert }) => {
    return (
        <div
            className="absolute left-0 top-full mt-1 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl shadow-black/40 p-2 w-[280px]"
            onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
        >
            {SYMBOL_GROUPS.map((group) => (
                <div key={group.label} className="mb-1.5 last:mb-0">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-1">
                        {group.label}
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {group.items.map((item) => (
                            <button
                                key={item.insert}
                                onClick={() => onInsert(item.insert)}
                                title={item.description}
                                className="px-2 py-1 text-xs font-mono bg-slate-700/60 hover:bg-blue-600/30 border border-slate-600/50 hover:border-blue-500/50 rounded text-slate-200 hover:text-blue-300 transition-colors cursor-pointer"
                            >
                                {item.display}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
            <div className="mt-1.5 pt-1.5 border-t border-slate-700">
                <p className="text-[10px] text-slate-500 px-1">
                    Click to insert at cursor · Use <span className="font-mono text-slate-400">tau</span> for proper time τ
                </p>
            </div>
        </div>
    );
};

export const VectorInput: React.FC<Props> = ({ label, value, onChange, disabled }) => {
    const [localValues, setLocalValues] = useState<Vector4>(value);
    const [errors, setErrors] = useState<boolean[]>([false, false, false, false]);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
    const containerRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);

    const components = ['μ=0 (t)', 'μ=1 (x)', 'μ=2 (y)', 'μ=3 (z)'];

    const handleBlur = (index: number) => {
        const expr = localValues[index];
        const isValid = validateExpression(expr);

        setErrors(prev => {
            const newErrors = [...prev];
            newErrors[index] = !isValid;
            return newErrors;
        });

        if (isValid && value[index] !== expr) {
            onChange(localValues);
        }

        // Small delay to allow palette clicks to register before closing
        setTimeout(() => {
            setActiveIndex(prev => prev === index ? null : prev);
        }, 150);
    };

    const handleFocus = (index: number) => {
        setActiveIndex(index);
    };

    const handleChange = (index: number, val: string) => {
        const newValues: Vector4 = [...localValues];
        newValues[index] = val;
        setLocalValues(newValues);
    };

    const handleInsert = (index: number, text: string) => {
        const input = inputRefs.current[index];
        if (!input) return;

        const start = input.selectionStart ?? localValues[index].length;
        const end = input.selectionEnd ?? start;
        const current = localValues[index];

        const newVal = current.slice(0, start) + text + current.slice(end);
        const newValues: Vector4 = [...localValues];
        newValues[index] = newVal;
        setLocalValues(newValues);

        // Move cursor after insertion
        requestAnimationFrame(() => {
            const newPos = start + text.length;
            input.focus();
            input.setSelectionRange(newPos, newPos);
        });
    };

    // Sync local values with props if props change from outside
    useEffect(() => {
        setLocalValues(value);
    }, [value]);

    return (
        <div className="flex flex-col mb-4">
            <label className="text-sm font-semibold text-slate-300 mb-1">{label}</label>
            <div className="flex gap-1 w-full items-center">
                <div className="text-lg text-slate-400 shrink-0">(</div>
                {localValues.map((val, i) => (
                    <React.Fragment key={i}>
                        <div className="relative flex-1 min-w-0" ref={el => { containerRefs.current[i] = el; }}>
                            <input
                                ref={el => { inputRefs.current[i] = el; }}
                                type="text"
                                className={`w-full bg-slate-800 border ${errors[i] ? 'border-red-500' : activeIndex === i ? 'border-blue-500' : 'border-slate-600'} rounded px-2 py-1.5 text-slate-100 font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors`}
                                value={val}
                                disabled={disabled}
                                onChange={(e) => handleChange(i, e.target.value)}
                                onFocus={() => handleFocus(i)}
                                onBlur={() => handleBlur(i)}
                                title={components[i]}
                                placeholder={`${i === 0 ? 't' : (i === 1 ? 'x' : (i === 2 ? 'y' : 'z'))}`}
                            />
                            {activeIndex === i && !disabled && (
                                <SymbolPalette
                                    onInsert={(text) => handleInsert(i, text)}
                                    anchorRef={{ current: containerRefs.current[i] }}
                                />
                            )}
                        </div>
                        {i < 3 && <div className="text-lg text-slate-400 self-center shrink-0">,</div>}
                    </React.Fragment>
                ))}
                <div className="text-lg text-slate-400 self-center shrink-0">)</div>
            </div>
            {errors.some(e => e) && (
                <span className="text-xs text-red-400 mt-1">Invalid expression. Use tau, trig functions (sin, cos, sinh, cosh), etc.</span>
            )}
        </div>
    );
};
