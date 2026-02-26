import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { evaluateVectorAtTau, findTauForLabTime, checkCausalityViolation, type NumericVector4 } from '../engine/cas';
import { getLorentzBoostMatrix, transformWorldlineCoordinates } from '../engine/physics';

const STEPS = 500;

export const SpacetimeGraph: React.FC = () => {
    const { particles, activeReferenceFrameId, activeDimension, animationTime, tauRange } = useSimulatorStore();

    const GRID_RANGE = tauRange;

    // Determine active Momentarily Comoving Reference Frame (MCRF)
    // For INERTIAL frames: pure Lorentz boost, no translation. Grid tilts naturally.
    // For ACCELERATING frames: time-dependent Poincaré transformation (MCRF).
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

        // Detect if particle is inertial (velocity has no tau dependency)
        const isInertial = !frameParticle.velocityExpr.some(comp => comp.includes('tau'));

        if (isInertial) {
            // Pure Lorentz boost — no Poincaré translation. The grid tilts naturally
            // and the playhead moves along the boosted time axis.
            const U = evaluateVectorAtTau(frameParticle.velocityExpr, 0);
            if (Math.abs(U[0]) < 1e-5) {
                return { MCRF: { Lambda: getLorentzBoostMatrix([0, 0, 0]), X_origin: [0, 0, 0, 0] as NumericVector4, tau: 0 }, playheadTime: animationTime };
            }
            const v3: [number, number, number] = [U[1] / U[0], U[2] / U[0], U[3] / U[0]];
            const v2 = v3[0] * v3[0] + v3[1] * v3[1] + v3[2] * v3[2];
            if (v2 >= 0.99999) {
                return { MCRF: { Lambda: getLorentzBoostMatrix([0, 0, 0]), X_origin: [0, 0, 0, 0] as NumericVector4, tau: 0 }, playheadTime: animationTime };
            }
            // playheadTime = proper time tau for this particle at the current Lab animation time
            const ptau = findTauForLabTime(frameParticle.positionExpr, animationTime);
            return {
                MCRF: { Lambda: getLorentzBoostMatrix(v3), X_origin: [0, 0, 0, 0] as NumericVector4, tau: 0 },
                playheadTime: ptau
            };
        }

        // ACCELERATING particle: time-dependent MCRF (Poincaré = boost + translation)
        const tau = findTauForLabTime(frameParticle.positionExpr, animationTime);
        const X_origin = evaluateVectorAtTau(frameParticle.positionExpr, tau);
        const U = evaluateVectorAtTau(frameParticle.velocityExpr, tau);

        if (Math.abs(U[0]) < 1e-5) return { MCRF: { Lambda: getLorentzBoostMatrix([0, 0, 0]), X_origin, tau }, playheadTime: tau };

        const v3: [number, number, number] = [U[1] / U[0], U[2] / U[0], U[3] / U[0]];
        const v2 = v3[0] * v3[0] + v3[1] * v3[1] + v3[2] * v3[2];
        if (v2 >= 0.99999) return { MCRF: { Lambda: getLorentzBoostMatrix([0, 0, 0]), X_origin, tau }, playheadTime: tau };

        return { MCRF: { Lambda: getLorentzBoostMatrix(v3), X_origin, tau }, playheadTime: tau };
    }, [activeReferenceFrameId, particles, animationTime]);

    // Dimension mapping for horizontal axis
    const dimIndex = activeDimension === 'x' ? 1 : activeDimension === 'y' ? 2 : 3;

    // Generate plot data for particles
    const plotData = useMemo(() => {
        return particles.map(p => {
            // Skip entirely if particle is FTL anywhere in its trajectory
            if (checkCausalityViolation(p.velocityExpr)) {
                return { type: 'scatter', mode: 'lines', name: p.name, x: [], y: [], line: { color: p.color, width: 3 } } as Plotly.Data;
            }

            // Evaluate parametrically over tau
            const t = [], x = [], y = [], z = [];
            const step = (tauRange * 2) / STEPS;
            for (let tau = -tauRange; tau <= tauRange; tau += step) {
                const val = evaluateVectorAtTau(p.positionExpr, tau);
                t.push(val[0]); x.push(val[1]); y.push(val[2]); z.push(val[3]);
            }

            // Apply Poincare Transform to translate to origin and Lorentz Boost
            const transformed = transformWorldlineCoordinates({ t, x, y, z }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);

            const horizontalAxis = dimIndex === 1 ? transformed.x : dimIndex === 2 ? transformed.y : transformed.z;

            // Ensure valid numbers only
            const filteredH: number[] = [];
            const filteredV: number[] = [];
            if (horizontalAxis && transformed.t) {
                for (let i = 0; i < horizontalAxis.length; i++) {
                    if (typeof horizontalAxis[i] === 'number' && typeof transformed.t[i] === 'number'
                        && !isNaN(horizontalAxis[i]) && !isNaN(transformed.t[i])) {
                        filteredH.push(horizontalAxis[i]);
                        filteredV.push(transformed.t[i]);
                    }
                }
            }

            return {
                type: 'scatter',
                mode: 'lines',
                name: p.name,
                x: filteredH,
                y: filteredV,
                line: { color: p.color, width: 3 },
            } as Plotly.Data;
        });
    }, [particles, MCRF, dimIndex, tauRange]);

    const markerData = useMemo(() => {
        return particles.map(p => {
            const pColor = p.color;
            if (!p.positionExpr || !p.velocityExpr) {
                return { type: 'scatter', mode: 'markers', x: [], y: [], hoverinfo: 'skip' } as Plotly.Data;
            }

            // Hide marker for FTL particles
            if (checkCausalityViolation(p.velocityExpr)) {
                return { type: 'scatter', mode: 'markers', x: [], y: [], hoverinfo: 'skip' } as Plotly.Data;
            }

            // Exactly pinpoint the particle proper time corresponding to the Lab playback clock
            const particle_tau = findTauForLabTime(p.positionExpr, animationTime);
            const lab_coords = evaluateVectorAtTau(p.positionExpr, particle_tau);

            if (lab_coords.some(Number.isNaN)) {
                return { type: 'scatter', mode: 'markers', x: [], y: [], hoverinfo: 'skip' } as Plotly.Data;
            }

            const transformed = transformWorldlineCoordinates(
                { t: [lab_coords[0]], x: [lab_coords[1]], y: [lab_coords[2]], z: [lab_coords[3]] },
                MCRF.Lambda, MCRF.X_origin, MCRF.tau
            );
            const horizontalAxis = dimIndex === 1 ? transformed.x : dimIndex === 2 ? transformed.y : transformed.z;

            if (horizontalAxis && transformed.t && !isNaN(horizontalAxis[0]) && !isNaN(transformed.t[0])) {
                return {
                    type: 'scatter',
                    mode: 'markers',
                    x: [horizontalAxis[0]],
                    y: [transformed.t[0]],
                    marker: { color: '#ffffff', size: 10, line: { color: pColor, width: 3 } },
                    showlegend: false,
                    hoverinfo: 'skip'
                } as Plotly.Data;
            } else {
                return { type: 'scatter', mode: 'markers', x: [], y: [], hoverinfo: 'skip' } as Plotly.Data;
            }
        });
    }, [particles, animationTime, MCRF, dimIndex]);

    // Generate dynamic skewed worldgrid lines
    const gridData: Plotly.Data[] = useMemo(() => {
        const lines: Plotly.Data[] = [];

        for (let c = -GRID_RANGE; c <= GRID_RANGE; c++) {
            if (c === 0) continue;

            // Constant Time Line (t = c)
            let t_lab1 = [c, c];
            let x_lab1 = [-GRID_RANGE, GRID_RANGE];
            let y_lab1 = [0, 0];
            let z_lab1 = [0, 0];
            if (activeDimension === 'y') { y_lab1 = x_lab1; x_lab1 = [0, 0]; }
            if (activeDimension === 'z') { z_lab1 = x_lab1; x_lab1 = [0, 0]; }

            const transformedT = transformWorldlineCoordinates({ t: t_lab1, x: x_lab1, y: y_lab1, z: z_lab1 }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);
            const horizT = dimIndex === 1 ? transformedT.x : (dimIndex === 2 ? transformedT.y : transformedT.z);

            lines.push({
                type: 'scatter', mode: 'lines',
                x: horizT, y: transformedT.t,
                line: { color: '#334155', width: 1 },
                hoverinfo: 'skip', showlegend: false
            });

            // Constant Space Line (e.g. x = c)
            let t_lab2 = [-GRID_RANGE, GRID_RANGE];
            let x_lab2 = [c, c];
            let y_lab2 = [0, 0];
            let z_lab2 = [0, 0];
            if (activeDimension === 'y') { y_lab2 = x_lab2; x_lab2 = [0, 0]; }
            if (activeDimension === 'z') { z_lab2 = x_lab2; x_lab2 = [0, 0]; }

            const transformedS = transformWorldlineCoordinates({ t: t_lab2, x: x_lab2, y: y_lab2, z: z_lab2 }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);
            const horizS = dimIndex === 1 ? transformedS.x : (dimIndex === 2 ? transformedS.y : transformedS.z);

            lines.push({
                type: 'scatter', mode: 'lines',
                x: horizS, y: transformedS.t,
                line: { color: '#334155', width: 1 },
                hoverinfo: 'skip', showlegend: false
            });
        }

        // Hyperbolic curves
        for (let c = 2; c < GRID_RANGE; c += 2) {
            const h_x1 = [], h_t1 = [], h_x2 = [], h_t2 = [];
            const h_x3 = [], h_t3 = [], h_x4 = [], h_t4 = [];
            for (let val = -GRID_RANGE; val <= GRID_RANGE; val += 0.2) {
                const t_val = Math.sqrt(c * c + val * val);
                if (t_val <= GRID_RANGE) {
                    h_x1.push(val); h_t1.push(t_val);
                    h_x2.push(val); h_t2.push(-t_val);
                }
                const x_val = Math.sqrt(c * c + val * val);
                if (x_val <= GRID_RANGE) {
                    h_t3.push(val); h_x3.push(x_val);
                    h_t4.push(val); h_x4.push(-x_val);
                }
            }

            [{ x: h_x1, t: h_t1 }, { x: h_x2, t: h_t2 }, { x: h_x3, t: h_t3 }, { x: h_x4, t: h_t4 }].forEach(curve => {
                let x_lab = curve.x, y_lab = Array(curve.x.length).fill(0), z_lab = Array(curve.x.length).fill(0);
                if (activeDimension === 'y') { y_lab = x_lab; x_lab = y_lab.map(() => 0); }
                if (activeDimension === 'z') { z_lab = x_lab; x_lab = z_lab.map(() => 0); }

                const transformed = transformWorldlineCoordinates({ t: curve.t, x: x_lab, y: y_lab, z: z_lab }, MCRF.Lambda, MCRF.X_origin, MCRF.tau);
                const horiz = dimIndex === 1 ? transformed.x : (dimIndex === 2 ? transformed.y : transformed.z);
                lines.push({
                    type: 'scatter', mode: 'lines',
                    x: horiz, y: transformed.t,
                    line: { color: '#0f766e', width: 1, dash: 'dot' },
                    hoverinfo: 'skip', showlegend: false
                });
            });
        }
        return lines;
    }, [MCRF, activeDimension, dimIndex]);

    // Generate Light Cones: t' = ±dim' (always exactly 45° in every frame)
    // Light cone invariance: c=1 means photons always travel at 45° in ANY Minkowski diagram.
    // Center the light cone on the active reference frame's particle position:
    //   - Lab frame: origin (0, 0)
    //   - Particle frame: particle is at (x'=0, t'=playheadTime) by construction
    const lightConeData: Plotly.Data[] = useMemo(() => {
        const range = GRID_RANGE * 3;

        // The light cone vertex: centered on the coordinate origin for Lab,
        // or the active particle's current event for particle frames.
        const ox = 0;
        const ot = activeReferenceFrameId === 'Lab' ? 0 : playheadTime;

        // Light cone lines: t' - ot = ±(dim' - ox)
        return [
            {
                type: 'scatter',
                mode: 'lines',
                name: 'Light Cone',
                x: [ox - range, ox + range],
                y: [ot - range, ot + range],
                line: { color: '#fbbf24', width: 2, dash: 'dash' },
                showlegend: false,
                hoverinfo: 'skip'
            },
            {
                type: 'scatter',
                mode: 'lines',
                name: 'Light Cone',
                x: [ox + range, ox - range],
                y: [ot - range, ot + range],
                line: { color: '#fbbf24', width: 2, dash: 'dash' },
                showlegend: false,
                hoverinfo: 'skip'
            }
        ];
    }, [activeReferenceFrameId, playheadTime, GRID_RANGE]);

    // Current animation time indicator (horizontal line)
    // Note: 'animationTime' is currently strictly the global coordinate time t in the transformed frame
    const timeLineData: Plotly.Data = useMemo(() => {
        const tauVal = isNaN(playheadTime) ? 0 : playheadTime;
        return {
            type: 'scatter',
            mode: 'lines',
            name: 'Simultaneity (t)',
            x: [-GRID_RANGE, GRID_RANGE],
            y: [tauVal, tauVal],
            line: { color: '#94a3b8', width: 1, dash: 'dot' },
            showlegend: false,
            hoverinfo: 'skip'
        };
    }, [playheadTime]);

    const isLabFrame = activeReferenceFrameId === 'Lab';
    const axisPrefix = isLabFrame ? '' : "'";

    return (
        <div className="w-full h-full relative p-4">
            <Plot
                data={[...gridData, ...lightConeData, ...plotData, ...markerData, timeLineData]}
                layout={{
                    uirevision: activeReferenceFrameId, // Reset zoom when frame changes
                    title: { text: `Minkowski Spacetime (t${axisPrefix}-${activeDimension}${axisPrefix} plane, c=1)` },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#94a3b8', family: 'Inter' },
                    xaxis: {
                        title: { text: `${activeDimension}${axisPrefix} (m)` },
                        range: [-10, 10],
                        zeroline: true,
                        zerolinecolor: '#475569',
                        showgrid: false,
                    },
                    yaxis: {
                        title: { text: `t${axisPrefix} (s)` },
                        range: [-10, 10],
                        zeroline: true,
                        zerolinecolor: '#475569',
                        showgrid: false,
                        scaleanchor: 'x',
                        scaleratio: 1,
                    },
                    margin: { l: 60, r: 40, b: 60, t: 60 },
                    showlegend: true,
                    legend: { x: 0, y: 1 },
                    autosize: true
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: true, scrollZoom: true, responsive: true }}
            />
        </div>
    );
};
