import React, { useMemo, useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { evaluateVectorAtTau, findTauForLabTime, checkCausalityViolation, getCompiledExpression, type NumericVector4 } from '../engine/cas';
import { getLorentzBoostMatrix, transformWorldlineCoordinates } from '../engine/physics';


export const Spacetime3DGraph: React.FC = () => {
    const { particles, activeReferenceFrameId, animationTime, tauRange, loadedPresetId } = useSimulatorStore();

    const [autoRotate, setAutoRotate] = useState(true);
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

    // Generate 3D worldline traces
    const plotData = useMemo(() => {
        const traces: Plotly.Data[] = [];

        particles.forEach(p => {
            if (checkCausalityViolation(p.velocityExpr)) {
                return; // Skip FTL
            }

            const t: number[] = [], x: number[] = [], y: number[] = [], z: number[] = [];
            const dynamicSteps = Math.max(500, tauRange * 10);
            const step = (tauRange * 2) / dynamicSteps;
            // Pre-compile expressions to avoid massive overhead in the loop
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

                // If the math blows up at extreme bounds, push 0 or skip
                if (isNaN(vt) || isNaN(vx) || isNaN(vy) || isNaN(vz)) {
                    t.push(0); x.push(0); y.push(0); z.push(0);
                } else {
                    t.push(vt); x.push(vx); y.push(vy); z.push(vz);
                }
            }

            const tr = transformWorldlineCoordinates({ t, x, y, z }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);

            // Filter valid points
            const fx: number[] = [], fy: number[] = [], fz: number[] = [], ft: number[] = [];
            for (let i = 0; i < tr.t.length; i++) {
                if (isFinite(tr.x[i]) && isFinite(tr.y[i]) && isFinite(tr.z[i]) && isFinite(tr.t[i])) {
                    if (Math.abs(tr.x[i]) < 20000 && Math.abs(tr.y[i]) < 20000 && Math.abs(tr.z[i]) < 20000 && Math.abs(tr.t[i]) < 20000) {
                        fx.push(tr.x[i]); fy.push(tr.y[i]); fz.push(tr.z[i]); ft.push(tr.t[i]);
                    }
                }
            }

            // Worldline as 3D scatter line (x, y, t as vertical axis)
            traces.push({
                type: 'scatter3d',
                mode: 'lines',
                name: p.name,
                x: fx,
                y: fy,
                z: ft, // time is the vertical axis
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
                    text: [`<b>${p.name}</b><br>Lab t: ${animationTime.toFixed(1)}s<br>Proper τ: ${particle_tau.toFixed(1)}s`],
                    textfont: { family: 'JetBrains Mono', color: p.color, size: 12 },
                    textposition: 'top center',
                    mode: 'markers+text' as any,
                    showlegend: false,
                    hoverinfo: 'skip' as any,
                } as any);
            }
        });

        return traces;
    }, [particles, animationTime, MCRF]);

    // Light cone surface: x² + y² = t² → a cone in (x, y, t) space
    const lightConeData = useMemo(() => {
        const N = 40;
        const range = tauRange;
        const xSurf: number[][] = [];
        const ySurf: number[][] = [];
        const zSurf: number[][] = [];

        // Center the light cone on the active reference frame's origin
        const ot = activeReferenceFrameId === 'Lab' ? 0 : playheadTime;

        for (let i = 0; i <= N; i++) {
            const th = (2 * Math.PI * i) / N;
            const xRow: number[] = [], yRow: number[] = [], zRow: number[] = [];
            for (let j = 0; j <= N; j++) {
                const t = (range * j) / N;
                xRow.push(t * Math.cos(th));
                yRow.push(t * Math.sin(th));
                zRow.push(t + ot); // Shift future cone up by ot
            }
            xSurf.push(xRow); ySurf.push(yRow); zSurf.push(zRow);
        }

        // Future light cone
        const futureCone: Plotly.Data = {
            type: 'surface',
            x: xSurf,
            y: ySurf,
            z: zSurf,
            opacity: 0.08,
            colorscale: [[0, '#fbbf24'], [1, '#fbbf24']],
            showscale: false,
            hoverinfo: 'skip' as any,
            showlegend: false,
        } as any;

        // Past light cone
        // For past cone, time goes backwards from ot, so z = ot - t
        const pastZSurf: number[][] = [];
        for (let i = 0; i <= N; i++) {
            const zRow: number[] = [];
            for (let j = 0; j <= N; j++) {
                const t = (range * j) / N;
                zRow.push(ot - t);
            }
            pastZSurf.push(zRow);
        }

        const pastCone: Plotly.Data = {
            type: 'surface',
            x: xSurf,
            y: ySurf,
            z: pastZSurf,
            opacity: 0.08,
            colorscale: [[0, '#fbbf24'], [1, '#fbbf24']],
            showscale: false,
            hoverinfo: 'skip' as any,
            showlegend: false,
        } as any;

        return [futureCone, pastCone];
    }, [activeReferenceFrameId, playheadTime]);

    // Dimension mapping for 2D is not needed here, we do true 3D
    const gridData = useMemo(() => {
        const traces: Plotly.Data[] = [];
        const RANGE = tauRange;
        const STEP = Math.max(2, Math.floor(tauRange / 5));

        // 1. Grid of constant T planes (just t=0, and maybe t=±tauRange/2)
        const tStep = tauRange / 2;
        for (let t_plane of [-tStep, 0, tStep]) {
            // Lines parallel to X (varying x, fixed y)
            for (let y = -RANGE; y <= RANGE; y += STEP) {
                const t_lab = [t_plane, t_plane];
                const x_lab = [-RANGE, RANGE];
                const y_lab = [y, y];
                const z_lab = [0, 0];

                const tr = transformWorldlineCoordinates({ t: t_lab, x: x_lab, y: y_lab, z: z_lab }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);
                traces.push({
                    type: 'scatter3d', mode: 'lines',
                    x: tr.x, y: tr.y, z: tr.t,
                    line: { color: t_plane === 0 ? '#475569' : '#334155', width: t_plane === 0 ? 3 : 1 },
                    hoverinfo: 'skip', showlegend: false
                } as any);
            }
            // Lines parallel to Y (varying y, fixed x)
            for (let x = -RANGE; x <= RANGE; x += STEP) {
                const t_lab = [t_plane, t_plane];
                const x_lab = [x, x];
                const y_lab = [-RANGE, RANGE];
                const z_lab = [0, 0];

                const tr = transformWorldlineCoordinates({ t: t_lab, x: x_lab, y: y_lab, z: z_lab }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);
                traces.push({
                    type: 'scatter3d', mode: 'lines',
                    x: tr.x, y: tr.y, z: tr.t,
                    line: { color: t_plane === 0 ? '#475569' : '#334155', width: t_plane === 0 ? 3 : 1 },
                    hoverinfo: 'skip', showlegend: false
                } as any);
            }
        }

        // 2. Vertical lines (constant X, constant Y, varying T)
        for (let x = -RANGE; x <= RANGE; x += STEP * 2) {
            for (let y = -RANGE; y <= RANGE; y += STEP * 2) {
                const t_lab = [-RANGE, RANGE];
                const x_lab = [x, x];
                const y_lab = [y, y];
                const z_lab = [0, 0];

                const tr = transformWorldlineCoordinates({ t: t_lab, x: x_lab, y: y_lab, z: z_lab }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);
                traces.push({
                    type: 'scatter3d', mode: 'lines',
                    x: tr.x, y: tr.y, z: tr.t,
                    line: { color: '#334155', width: 1 },
                    hoverinfo: 'skip', showlegend: false
                } as any);
            }
        }

        // 3. Hyperbolic invariant intervals (on x-t and y-t planes)
        for (let c = STEP; c <= RANGE; c += STEP) {
            const vals = [];
            for (let v = -RANGE; v <= RANGE; v += STEP / 4) vals.push(v);

            const h_x1 = [], h_t1 = [], h_x2 = [], h_t2 = []; // Time-like
            const h_x3 = [], h_t3 = [], h_x4 = [], h_t4 = []; // Space-like

            for (const val of vals) {
                const t_val = Math.sqrt(c * c + val * val);
                if (t_val <= RANGE) {
                    h_x1.push(val); h_t1.push(t_val);
                    h_x2.push(val); h_t2.push(-t_val);
                }
                const x_val = Math.sqrt(c * c + val * val);
                if (x_val <= RANGE) {
                    h_t3.push(val); h_x3.push(x_val);
                    h_t4.push(val); h_x4.push(-x_val);
                }
            }

            // Apply to X axis (y=0)
            [{ x: h_x1, t: h_t1 }, { x: h_x2, t: h_t2 }, { x: h_x3, t: h_t3 }, { x: h_x4, t: h_t4 }].forEach(curve => {
                const tr = transformWorldlineCoordinates({ t: curve.t, x: curve.x, y: curve.x.map(() => 0), z: curve.x.map(() => 0) }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);
                traces.push({
                    type: 'scatter3d', mode: 'lines',
                    x: tr.x, y: tr.y, z: tr.t,
                    line: { color: '#0f766e', width: 2, dash: 'dot' },
                    hoverinfo: 'skip', showlegend: false
                } as any);
            });

            // Apply to Y axis (x=0)
            [{ y: h_x1, t: h_t1 }, { y: h_x2, t: h_t2 }, { y: h_x3, t: h_t3 }, { y: h_x4, t: h_t4 }].forEach(curve => {
                const tr = transformWorldlineCoordinates({ t: curve.t, x: curve.y.map(() => 0), y: curve.y, z: curve.y.map(() => 0) }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);
                traces.push({
                    type: 'scatter3d', mode: 'lines',
                    x: tr.x, y: tr.y, z: tr.t,
                    line: { color: '#0f766e', width: 2, dash: 'dot' },
                    hoverinfo: 'skip', showlegend: false
                } as any);
            });
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
                eye: { x: 1.5, y: 1.5, z: 1.2 },
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
        // Reset camera when frame changes OR a new preset is loaded
        l.scene.uirevision = `${activeReferenceFrameId}-${loadedPresetId}`;
        l.uirevision = `${activeReferenceFrameId}-${loadedPresetId}`;
    }, [activeReferenceFrameId, prime, loadedPresetId]);

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
