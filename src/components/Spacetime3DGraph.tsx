import React, { useMemo, useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { evaluateVectorAtTau, findTauForLabTime, checkCausalityViolation, getCompiledExpression, type NumericVector4 } from '../engine/cas';
import { getLorentzBoostMatrix, transformWorldlineCoordinates } from '../engine/physics';


export const Spacetime3DGraph: React.FC = () => {
    const { particles, activeReferenceFrameId, animationTime, tauRange, loadedPresetId } = useSimulatorStore();

    const [autoRotate, setAutoRotate] = useState(false);
    const angleRef = useRef(0);
    const plotRef = useRef<any>(null);
    const rafRef = useRef<number | null>(null);
    const isDraggingRef = useRef(false);

    // Auto-rotate via direct Plotly DOM calls (doesn't block manual interaction)
    useEffect(() => {
        if (!autoRotate) {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            return;
        }

        const radius = 2.1;
        const elevation = 0.9;
        const speed = 0.004;

        const animate = () => {
            if (isDraggingRef.current) {
                rafRef.current = requestAnimationFrame(animate);
                return;
            }
            angleRef.current += speed;
            const el = plotRef.current?.el;
            if (el && (window as any).Plotly) {
                (window as any).Plotly.relayout(el, {
                    'scene.camera.eye': {
                        x: radius * Math.cos(angleRef.current),
                        y: radius * Math.sin(angleRef.current),
                        z: elevation
                    }
                });
            }
            rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [autoRotate]);

    // Detect mouse interaction to pause auto-rotate during drag
    useEffect(() => {
        const el = plotRef.current?.el;
        if (!el) return;
        const onDown = () => { isDraggingRef.current = true; };
        const onUp = () => { isDraggingRef.current = false; };
        el.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);
        return () => {
            el.removeEventListener('mousedown', onDown);
            window.removeEventListener('mouseup', onUp);
        };
    });

    // Reuse the same MCRF logic from SpacetimeGraph
    const { MCRF, playheadTime } = useMemo(() => {
        if (activeReferenceFrameId === 'Lab') {
            return {
                MCRF: { Lambda: getLorentzBoostMatrix([0, 0, 0]), X_origin: [0, 0, 0, 0] as NumericVector4, tau: 0 },
                playheadTime: animationTime
            };
        }
        const frameParticle = particles.find(p => p.id === activeReferenceFrameId);
        if (!frameParticle) {
            return {
                MCRF: { Lambda: getLorentzBoostMatrix([0, 0, 0]), X_origin: [0, 0, 0, 0] as NumericVector4, tau: 0 },
                playheadTime: animationTime
            };
        }

        const isInertial = !frameParticle.velocityExpr.some(comp => comp.includes('tau'));

        if (isInertial) {
            const U = evaluateVectorAtTau(frameParticle.velocityExpr, 0);
            if (Math.abs(U[0]) < 1e-5) {
                return { MCRF: { Lambda: getLorentzBoostMatrix([0, 0, 0]), X_origin: [0, 0, 0, 0] as NumericVector4, tau: 0 }, playheadTime: animationTime };
            }
            const v3: [number, number, number] = [U[1] / U[0], U[2] / U[0], U[3] / U[0]];
            const v2 = v3[0] * v3[0] + v3[1] * v3[1] + v3[2] * v3[2];
            if (v2 >= 0.99999) {
                return { MCRF: { Lambda: getLorentzBoostMatrix([0, 0, 0]), X_origin: [0, 0, 0, 0] as NumericVector4, tau: 0 }, playheadTime: animationTime };
            }
            const ptau = findTauForLabTime(frameParticle.positionExpr, animationTime);
            return {
                MCRF: { Lambda: getLorentzBoostMatrix(v3), X_origin: [0, 0, 0, 0] as NumericVector4, tau: 0 },
                playheadTime: ptau
            };
        }

        const tau = findTauForLabTime(frameParticle.positionExpr, animationTime);
        const X_origin = evaluateVectorAtTau(frameParticle.positionExpr, tau);
        const U = evaluateVectorAtTau(frameParticle.velocityExpr, tau);
        if (Math.abs(U[0]) < 1e-5) return { MCRF: { Lambda: getLorentzBoostMatrix([0, 0, 0]), X_origin, tau }, playheadTime: tau };
        const v3: [number, number, number] = [U[1] / U[0], U[2] / U[0], U[3] / U[0]];
        const v2 = v3[0] * v3[0] + v3[1] * v3[1] + v3[2] * v3[2];
        if (v2 >= 0.99999) return { MCRF: { Lambda: getLorentzBoostMatrix([0, 0, 0]), X_origin, tau }, playheadTime: tau };
        return { MCRF: { Lambda: getLorentzBoostMatrix(v3), X_origin, tau }, playheadTime: tau };
    }, [activeReferenceFrameId, particles, animationTime]);

    // Generate 3D worldline traces (reduced sampling for 3D performance)
    const plotData = useMemo(() => {
        const traces: Plotly.Data[] = [];

        particles.forEach(p => {
            if (checkCausalityViolation(p.velocityExpr)) return;

            const t: number[] = [], x: number[] = [], y: number[] = [], z: number[] = [];
            const dynamicSteps = Math.max(300, tauRange * 5); // Reduced from 500/10x for 3D
            const step = (tauRange * 2) / dynamicSteps;
            const compT = getCompiledExpression(p.positionExpr[0]);
            const compX = getCompiledExpression(p.positionExpr[1]);
            const compY = getCompiledExpression(p.positionExpr[2]);
            const compZ = getCompiledExpression(p.positionExpr[3]);

            for (let tau = -tauRange; tau <= tauRange; tau += step) {
                const scope = { tau };
                const vt = Number(compT.evaluate(scope));
                const vx = Number(compX.evaluate(scope));
                const vy = Number(compY.evaluate(scope));
                const vz = Number(compZ.evaluate(scope));
                if (isNaN(vt) || isNaN(vx) || isNaN(vy) || isNaN(vz)) {
                    t.push(0); x.push(0); y.push(0); z.push(0);
                } else {
                    t.push(vt); x.push(vx); y.push(vy); z.push(vz);
                }
            }

            const tr = transformWorldlineCoordinates({ t, x, y, z }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);

            const fx: number[] = [], fy: number[] = [], ft: number[] = [];
            for (let i = 0; i < tr.t.length; i++) {
                if (isFinite(tr.x[i]) && isFinite(tr.y[i]) && isFinite(tr.t[i]) &&
                    Math.abs(tr.x[i]) < 20000 && Math.abs(tr.y[i]) < 20000 && Math.abs(tr.t[i]) < 20000) {
                    fx.push(tr.x[i]); fy.push(tr.y[i]); ft.push(tr.t[i]);
                }
            }

            traces.push({
                type: 'scatter3d', mode: 'lines', name: p.name,
                x: fx, y: fy, z: ft,
                line: { color: p.color, width: 4 },
                hovertemplate: `${p.name}<br>x': %{x:.3f}<br>y': %{y:.3f}<br>t': %{z:.3f}<extra></extra>`,
            } as Plotly.Data);
        });

        return traces;
    }, [particles, MCRF, tauRange]);

    // Marker dots at current animation time
    const markerData = useMemo(() => {
        const traces: Plotly.Data[] = [];

        particles.forEach(p => {
            if (checkCausalityViolation(p.velocityExpr)) return;

            const particle_tau = findTauForLabTime(p.positionExpr, animationTime);
            const lab_coords = evaluateVectorAtTau(p.positionExpr, particle_tau);
            if (lab_coords.some(Number.isNaN)) return;

            const tr = transformWorldlineCoordinates(
                { t: [lab_coords[0]], x: [lab_coords[1]], y: [lab_coords[2]], z: [lab_coords[3]] },
                MCRF.Lambda, MCRF.X_origin, MCRF.tau
            );

            if (isFinite(tr.x[0]) && isFinite(tr.y[0]) && isFinite(tr.t[0])) {
                traces.push({
                    type: 'scatter3d',
                    x: [tr.x[0]],
                    y: [tr.y[0]],
                    z: [tr.t[0]],
                    marker: { color: '#ffffff', size: 5, line: { color: p.color, width: 2 }, symbol: 'circle' },
                    mode: p.showClock !== false ? 'markers+text' : 'markers',
                    ...(p.showClock !== false && {
                        text: [`<b>${p.name}</b><br>Lab t: ${animationTime.toFixed(1)}s<br>Proper τ: ${particle_tau.toFixed(1)}s`],
                        textposition: 'top center',
                        textfont: { family: 'JetBrains Mono', color: p.color, size: 12 }
                    }),
                    showlegend: false,
                    hoverinfo: 'skip' as any,
                } as any);
            }
        });

        return traces;
    }, [particles, animationTime, MCRF]);

    // Light cone surface: x² + y² = t² → a cone in (x, y, t) space
    // Reduced from 40×40 to 20×20 mesh — cone is 8% opacity so detail is invisible
    const lightConeData = useMemo(() => {
        const N = 20;
        const range = tauRange;
        const xSurf: number[][] = [];
        const ySurf: number[][] = [];
        const futureZ: number[][] = [];
        const pastZ: number[][] = [];

        const ot = activeReferenceFrameId === 'Lab' ? 0 : playheadTime;

        for (let i = 0; i <= N; i++) {
            const th = (2 * Math.PI * i) / N;
            const cosT = Math.cos(th), sinT = Math.sin(th);
            const xRow: number[] = [], yRow: number[] = [], fzRow: number[] = [], pzRow: number[] = [];
            for (let j = 0; j <= N; j++) {
                const t = (range * j) / N;
                xRow.push(t * cosT);
                yRow.push(t * sinT);
                fzRow.push(t + ot);
                pzRow.push(ot - t);
            }
            xSurf.push(xRow); ySurf.push(yRow); futureZ.push(fzRow); pastZ.push(pzRow);
        }

        const coneProps = {
            opacity: 0.08,
            colorscale: [[0, '#fbbf24'], [1, '#fbbf24']] as [number, string][],
            showscale: false,
            hoverinfo: 'skip' as const,
            hovertemplate: '',
            showlegend: false,
        };

        return [
            { type: 'surface', x: xSurf, y: ySurf, z: futureZ, ...coneProps } as any,
            { type: 'surface', x: xSurf, y: ySurf, z: pastZ, ...coneProps } as any,
        ];
    }, [activeReferenceFrameId, playheadTime, tauRange]);

    // Dimension mapping for 2D is not needed here, we do true 3D
    // OPTIMIZED: All grid lines merged into 3 traces using NaN separators (~150 draw calls → 3)
    const gridData = useMemo(() => {
        const RANGE = tauRange * 2;  // Reduced from 3x to 2x — less geometry off-screen
        const STEP = Math.max(2, Math.floor(tauRange / 5));

        // Shared arrays for merged traces (NaN = line break within a single trace)
        const mainX: number[] = [], mainY: number[] = [], mainZ: number[] = [];  // t=0 plane (thicker)
        const subX: number[] = [], subY: number[] = [], subZ: number[] = [];     // t=±half planes + verticals  
        const hyperX: number[] = [], hyperY: number[] = [], hyperZ: number[] = []; // Hyperbolic curves

        // Helper: append a line segment to shared arrays with NaN separator
        const appendLine = (ax: number[], ay: number[], az: number[], tr: { x: number[], y: number[], t: number[] }) => {
            for (let i = 0; i < tr.x.length; i++) { ax.push(tr.x[i]); ay.push(tr.y[i]); az.push(tr.t[i]); }
            ax.push(NaN); ay.push(NaN); az.push(NaN);
        };

        // 1. Grid of constant T planes
        const tStep = RANGE / 2;
        for (const t_plane of [-tStep, 0, tStep]) {
            const target = t_plane === 0 ? [mainX, mainY, mainZ] : [subX, subY, subZ];
            // Lines parallel to X
            for (let y = -RANGE; y <= RANGE; y += STEP) {
                const tr = transformWorldlineCoordinates(
                    { t: [t_plane, t_plane], x: [-RANGE, RANGE], y: [y, y], z: [0, 0] },
                    MCRF.Lambda, MCRF.X_origin, MCRF.tau
                );
                appendLine(target[0], target[1], target[2], tr);
            }
            // Lines parallel to Y
            for (let x = -RANGE; x <= RANGE; x += STEP) {
                const tr = transformWorldlineCoordinates(
                    { t: [t_plane, t_plane], x: [x, x], y: [-RANGE, RANGE], z: [0, 0] },
                    MCRF.Lambda, MCRF.X_origin, MCRF.tau
                );
                appendLine(target[0], target[1], target[2], tr);
            }
        }

        // 2. Vertical lines (constant X, constant Y, varying T) — sparser
        for (let x = -RANGE; x <= RANGE; x += STEP * 2) {
            for (let y = -RANGE; y <= RANGE; y += STEP * 2) {
                const tr = transformWorldlineCoordinates(
                    { t: [-RANGE, RANGE], x: [x, x], y: [y, y], z: [0, 0] },
                    MCRF.Lambda, MCRF.X_origin, MCRF.tau
                );
                appendLine(subX, subY, subZ, tr);
            }
        }

        // 3. Hyperbolic invariant intervals (merged into single trace)
        const limit_hyper = tauRange * 2;
        for (let c = STEP; c <= limit_hyper; c += STEP) {
            const vals: number[] = [];
            for (let v = -limit_hyper; v <= limit_hyper; v += STEP / 4) vals.push(v);

            const h_x1: number[] = [], h_t1: number[] = [], h_x2: number[] = [], h_t2: number[] = [];
            const h_x3: number[] = [], h_t3: number[] = [], h_x4: number[] = [], h_t4: number[] = [];

            for (const val of vals) {
                const mag = Math.sqrt(c * c + val * val);
                if (mag <= limit_hyper) {
                    h_x1.push(val); h_t1.push(mag);
                    h_x2.push(val); h_t2.push(-mag);
                    h_t3.push(val); h_x3.push(mag);
                    h_t4.push(val); h_x4.push(-mag);
                }
            }

            // X-axis curves (y=0)
            const zeros = (n: number) => new Array(n).fill(0);
            for (const curve of [{ x: h_x1, t: h_t1 }, { x: h_x2, t: h_t2 }, { x: h_x3, t: h_t3 }, { x: h_x4, t: h_t4 }]) {
                const tr = transformWorldlineCoordinates(
                    { t: curve.t, x: curve.x, y: zeros(curve.x.length), z: zeros(curve.x.length) },
                    MCRF.Lambda, MCRF.X_origin, MCRF.tau
                );
                appendLine(hyperX, hyperY, hyperZ, tr);
            }
            // Y-axis curves (x=0)
            for (const curve of [{ y: h_x1, t: h_t1 }, { y: h_x2, t: h_t2 }, { y: h_x3, t: h_t3 }, { y: h_x4, t: h_t4 }]) {
                const tr = transformWorldlineCoordinates(
                    { t: curve.t, x: zeros(curve.y.length), y: curve.y, z: zeros(curve.y.length) },
                    MCRF.Lambda, MCRF.X_origin, MCRF.tau
                );
                appendLine(hyperX, hyperY, hyperZ, tr);
            }
        }

        // Return only 3 traces instead of ~150
        const traces: Plotly.Data[] = [];
        if (mainX.length > 0) {
            traces.push({
                type: 'scatter3d', mode: 'lines',
                x: mainX, y: mainY, z: mainZ,
                line: { color: '#475569', width: 3 },
                hoverinfo: 'skip', hovertemplate: '', showlegend: false, connectgaps: false,
            } as any);
        }
        if (subX.length > 0) {
            traces.push({
                type: 'scatter3d', mode: 'lines',
                x: subX, y: subY, z: subZ,
                line: { color: '#334155', width: 1 },
                hoverinfo: 'skip', hovertemplate: '', showlegend: false, connectgaps: false,
            } as any);
        }
        if (hyperX.length > 0) {
            traces.push({
                type: 'scatter3d', mode: 'lines',
                x: hyperX, y: hyperY, z: hyperZ,
                line: { color: '#0f766e', width: 2, dash: 'dot' },
                hoverinfo: 'skip', hovertemplate: '', showlegend: false, connectgaps: false,
            } as any);
        }

        return traces;
    }, [MCRF, tauRange]);

    // Simultaneity plane at current playhead time
    const simultaneityPlane = useMemo(() => {
        const r = tauRange;
        const tVal = isNaN(playheadTime) ? 0 : playheadTime;
        return {
            type: 'surface',
            x: [[-r, r], [-r, r]],
            y: [[-r, -r], [r, r]],
            z: [[tVal, tVal], [tVal, tVal]],
            opacity: 0.06,
            colorscale: [[0, '#94a3b8'], [1, '#94a3b8']],
            showscale: false,
            hoverinfo: 'skip' as any,
            showlegend: false,
        } as Plotly.Data;
    }, [playheadTime]);

    const isLabFrame = activeReferenceFrameId === 'Lab';
    const prime = isLabFrame ? '' : "'";

    // Stable layout ref — camera is only set on initial render.
    // Plotly preserves the camera across data updates thanks to scene.uirevision.
    const layoutRef = useRef({
        uirevision: activeReferenceFrameId,
        title: { text: '' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#94a3b8', family: 'JetBrains Mono, monospace' },
        scene: {
            uirevision: 'camera-stable', // Preserves camera across data refreshes
            xaxis: {
                title: { text: 'x' },
                range: [-tauRange, tauRange],
                gridcolor: 'rgba(255, 255, 255, 0.05)',
                zerolinecolor: 'rgba(6, 182, 212, 0.4)',
                backgroundcolor: 'rgba(0, 0, 0, 0)',
                showbackground: false,
            },
            yaxis: {
                title: { text: 'y' },
                range: [-tauRange, tauRange],
                gridcolor: 'rgba(255, 255, 255, 0.05)',
                zerolinecolor: 'rgba(6, 182, 212, 0.4)',
                backgroundcolor: 'rgba(0, 0, 0, 0)',
                showbackground: false,
            },
            zaxis: {
                title: { text: 't' },
                range: [-tauRange, tauRange],
                gridcolor: 'rgba(255, 255, 255, 0.05)',
                zerolinecolor: 'rgba(6, 182, 212, 0.4)',
                backgroundcolor: 'rgba(0, 0, 0, 0)',
                showbackground: false,
            },
            aspectmode: 'cube',
            bgcolor: 'transparent',
            camera: {
                eye: { x: 1.5, y: 1.5, z: 1.5 },
                up: { x: 0, y: 0, z: 1 }
            },
        },
        margin: { l: 0, r: 0, b: 0, t: 0 },
        showlegend: true,
        legend: { font: { family: 'JetBrains Mono' }, x: 0.02, y: 0.98, bgcolor: 'rgba(0,0,0,0.5)', bordercolor: 'rgba(255,255,255,0.1)', borderwidth: 1 },
        autosize: true,
    });

    // Update mutable parts of layout without resetting camera
    useMemo(() => {
        const l = layoutRef.current;
        l.title.text = `3D Spacetime (x${prime}-y${prime}-t${prime}, c=1)`;
        l.scene.xaxis.title.text = `x${prime}`;
        l.scene.yaxis.title.text = `y${prime}`;
        l.scene.zaxis.title.text = `t${prime}`;

        // Update ranges dynamically
        l.scene.xaxis.range = [-tauRange, tauRange];
        l.scene.yaxis.range = [-tauRange, tauRange];
        l.scene.zaxis.range = [-tauRange, tauRange];

        // Reset camera when frame changes OR a new preset is loaded
        l.scene.uirevision = `${activeReferenceFrameId}-${loadedPresetId}`;
        l.uirevision = `${activeReferenceFrameId}-${loadedPresetId}`;
    }, [activeReferenceFrameId, prime, loadedPresetId, tauRange]);

    return (
        <div className="w-full h-full relative p-4">
            <Plot
                data={[...lightConeData, ...gridData, simultaneityPlane, ...plotData, ...markerData]}
                layout={layoutRef.current as any}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false, scrollZoom: true, responsive: true }}
                ref={plotRef}
            />

            {/* Auto-rotate toggle */}
            <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`absolute top-6 right-6 px-4 py-2 rounded-full font-mono text-xs font-bold transition-all z-10 backdrop-blur-md border shadow-lg ${autoRotate
                    ? 'bg-cyan-neon/20 border-cyan-neon text-cyan-neon shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                title={autoRotate ? 'Click to stop rotation (or drag the graph)' : 'Click to auto-rotate'}
            >
                {autoRotate ? '⟳ Rotating' : '⟳ Auto-rotate'}
            </button>
        </div>
    );
};
