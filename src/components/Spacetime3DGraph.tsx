import React, { useMemo, useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { evaluateVectorAtTau, findTauForLabTime, checkCausalityViolation, type NumericVector4 } from '../engine/cas';
import { getLorentzBoostMatrix, transformWorldlineCoordinates } from '../engine/physics';

const STEPS = 500;

export const Spacetime3DGraph: React.FC = () => {
    const { particles, activeReferenceFrameId, animationTime, tauRange } = useSimulatorStore();

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
            const step = (tauRange * 2) / STEPS;
            for (let tau = -tauRange; tau <= tauRange; tau += step) {
                const val = evaluateVectorAtTau(p.positionExpr, tau);
                t.push(val[0]); x.push(val[1]); y.push(val[2]); z.push(val[3]);
            }

            const tr = transformWorldlineCoordinates({ t, x, y, z }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);

            // Filter valid points
            const fx: number[] = [], fy: number[] = [], fz: number[] = [], ft: number[] = [];
            for (let i = 0; i < tr.t.length; i++) {
                if (isFinite(tr.x[i]) && isFinite(tr.y[i]) && isFinite(tr.z[i]) && isFinite(tr.t[i])) {
                    fx.push(tr.x[i]); fy.push(tr.y[i]); fz.push(tr.z[i]); ft.push(tr.t[i]);
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
                    mode: 'markers',
                    x: [tr.x[0]],
                    y: [tr.y[0]],
                    z: [tr.t[0]],
                    marker: { color: '#ffffff', size: 5, line: { color: p.color, width: 2 }, symbol: 'circle' },
                    showlegend: false,
                    hoverinfo: 'skip' as any,
                } as Plotly.Data);
            }
        });

        return traces;
    }, [particles, animationTime, MCRF]);

    // Light cone surface: x² + y² = t² → a cone in (x, y, t) space
    const lightConeData = useMemo(() => {
        const N = 40;
        const range = 10;
        const xSurf: number[][] = [];
        const ySurf: number[][] = [];
        const zSurf: number[][] = [];

        for (let i = 0; i <= N; i++) {
            const th = (2 * Math.PI * i) / N;
            const xRow: number[] = [], yRow: number[] = [], zRow: number[] = [];
            for (let j = 0; j <= N; j++) {
                const t = (range * j) / N;
                xRow.push(t * Math.cos(th));
                yRow.push(t * Math.sin(th));
                zRow.push(t);
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

        // Past light cone (negate z)
        const pastCone: Plotly.Data = {
            type: 'surface',
            x: xSurf,
            y: ySurf,
            z: zSurf.map(row => row.map(v => -v)),
            opacity: 0.08,
            colorscale: [[0, '#fbbf24'], [1, '#fbbf24']],
            showscale: false,
            hoverinfo: 'skip' as any,
            showlegend: false,
        } as any;

        return [futureCone, pastCone];
    }, []);

    // Simultaneity plane at current playhead time
    const simultaneityPlane = useMemo(() => {
        const r = 10;
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
        font: { color: '#94a3b8', family: 'Inter' },
        scene: {
            uirevision: 'camera-stable', // Preserves camera across data refreshes
            xaxis: {
                title: { text: 'x' },
                range: [-10, 10],
                gridcolor: '#334155',
                zerolinecolor: '#475569',
                backgroundcolor: 'rgba(15, 23, 42, 0.5)',
            },
            yaxis: {
                title: { text: 'y' },
                range: [-10, 10],
                gridcolor: '#334155',
                zerolinecolor: '#475569',
                backgroundcolor: 'rgba(15, 23, 42, 0.5)',
            },
            zaxis: {
                title: { text: 't' },
                range: [-10, 10],
                gridcolor: '#334155',
                zerolinecolor: '#475569',
                backgroundcolor: 'rgba(15, 23, 42, 0.5)',
            },
            aspectmode: 'cube',
            bgcolor: 'transparent',
            camera: {
                eye: { x: 1.5, y: 1.5, z: 1.2 },
                up: { x: 0, y: 0, z: 1 }
            },
        },
        margin: { l: 0, r: 0, b: 0, t: 60 },
        showlegend: true,
        legend: { x: 0, y: 1 },
        autosize: true,
    });

    // Update mutable parts of layout without resetting camera
    useMemo(() => {
        const l = layoutRef.current;
        l.title.text = `3D Spacetime (x${prime}-y${prime}-t${prime}, c=1)`;
        l.scene.xaxis.title.text = `x${prime}`;
        l.scene.yaxis.title.text = `y${prime}`;
        l.scene.zaxis.title.text = `t${prime}`;
        // Only reset camera when frame changes (change scene.uirevision)
        l.scene.uirevision = activeReferenceFrameId;
        l.uirevision = activeReferenceFrameId;
    }, [activeReferenceFrameId, prime]);

    return (
        <div className="w-full h-full relative p-4">
            <Plot
                data={[...lightConeData, simultaneityPlane, ...plotData, ...markerData]}
                layout={layoutRef.current as any}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: true, scrollZoom: true, responsive: true }}
                ref={plotRef}
            />

            {/* Auto-rotate toggle */}
            <button
                onClick={() => setAutoRotate(prev => !prev)}
                className={`absolute bottom-6 right-6 z-10 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg backdrop-blur border ${autoRotate
                    ? 'bg-emerald-600/80 border-emerald-500/50 text-white hover:bg-emerald-500/80'
                    : 'bg-slate-800/80 border-slate-600/50 text-slate-300 hover:bg-slate-700/80'
                    }`}
                title={autoRotate ? 'Click to stop rotation (or drag the graph)' : 'Click to auto-rotate'}
            >
                {autoRotate ? '⟳ Rotating' : '⟳ Auto-rotate'}
            </button>
        </div>
    );
};
