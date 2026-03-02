import { create } from 'zustand';
import type { ParticleState, Vector4, NumericVector4 } from '../engine/cas';
import { solveFromPosition, solveFromVelocity, solveFromAcceleration, evaluateVectorAtTau } from '../engine/cas';
import { extract3Velocity } from '../engine/physics';
import { PARADOX_PRESETS } from '../constants/ParadoxPresets';

export type SpatialDimension = 'x' | 'y' | 'z';
export type InputType = 'position' | 'velocity' | 'acceleration';
export type ViewMode = '2d' | '3d';

export interface SimulatorState {
    particles: ParticleState[];
    activeReferenceFrameId: string | 'Lab';
    animationTime: number;
    activeDimension: SpatialDimension;
    viewMode: ViewMode;
    tauRange: number;
    timeMin: number;
    timeMax: number;
    loadedPresetId: string | null;
    showClocks: boolean;

    // Actions
    addParticle: () => void;
    removeParticle: (id: string) => void;
    updateParticleName: (id: string, name: string) => void;
    updateParticleColor: (id: string, color: string) => void;
    updateParticleInput: (id: string, inputType: InputType, input: Vector4) => void;
    updateParticleInitialConditions: (id: string, X0?: NumericVector4, U0?: NumericVector4) => void;
    loadPreset: (presetId: string) => void;

    setActiveReferenceFrame: (id: string | 'Lab') => void;
    setAnimationTime: (t: number) => void;
    setActiveDimension: (dim: SpatialDimension) => void;
    setViewMode: (mode: ViewMode) => void;
    setTauRange: (range: number) => void;
    setTimeMin: (val: number) => void;
    setTimeMax: (val: number) => void;
    setShowClocks: (val: boolean) => void;

    // Selectors
    getLabVelocityForParticle: (id: string) => [number, number, number];
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const getRandomColor = () => {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5e9'];
    return colors[Math.floor(Math.random() * colors.length)];
};

const createDefaultParticle = (): ParticleState => {
    const id = generateId();
    return {
        id,
        name: `Particle ${id.substring(0, 4)}`,
        color: getRandomColor(),
        mass: 1,
        initialPosition: [0, 0, 0, 0],
        initialVelocity: [1, 0, 0, 0], // Gamma = 1 at rest
        inputPosition: ['tau', '0', '0', '0'], // Default rest particle
        positionExpr: ['tau', '0', '0', '0'],
        velocityExpr: ['1', '0', '0', '0'],
        accelerationExpr: ['0', '0', '0', '0'],
    };
};

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
    particles: [createDefaultParticle()],
    activeReferenceFrameId: 'Lab',
    animationTime: 0,
    activeDimension: 'x',
    viewMode: '2d',
    tauRange: 50,
    timeMin: -10,
    timeMax: 10,
    loadedPresetId: null,
    showClocks: true,

    addParticle: () => set((state) => ({ particles: [...state.particles, createDefaultParticle()] })),

    removeParticle: (id) => set((state) => ({
        particles: state.particles.filter(p => p.id !== id),
        activeReferenceFrameId: state.activeReferenceFrameId === id ? 'Lab' : state.activeReferenceFrameId
    })),

    updateParticleName: (id, name) => set((state) => ({
        particles: state.particles.map(p => p.id === id ? { ...p, name } : p)
    })),

    updateParticleColor: (id, color) => set((state) => ({
        particles: state.particles.map(p => p.id === id ? { ...p, color } : p)
    })),

    updateParticleInput: (id, inputType, input) => set((state) => ({
        particles: state.particles.map(p => {
            if (p.id !== id) return p;
            let X: Vector4 = [...p.positionExpr];
            let U: Vector4 = [...p.velocityExpr];
            let A: Vector4 = [...p.accelerationExpr];

            const newP = { ...p };

            try {
                if (inputType === 'position') {
                    newP.inputPosition = input;
                    delete newP.inputVelocity; delete newP.inputAcceleration;
                    const sol = solveFromPosition(input);
                    X = sol.X; U = sol.U; A = sol.A;
                } else if (inputType === 'velocity') {
                    newP.inputVelocity = input;
                    delete newP.inputPosition; delete newP.inputAcceleration;
                    const sol = solveFromVelocity(input, p.initialPosition);
                    X = sol.X; U = sol.U; A = sol.A;
                } else if (inputType === 'acceleration') {
                    newP.inputAcceleration = input;
                    delete newP.inputPosition; delete newP.inputVelocity;
                    const sol = solveFromAcceleration(input, p.initialVelocity, p.initialPosition);
                    X = sol.X; U = sol.U; A = sol.A;
                }
            } catch (e) {
                console.warn("Failed to update particle math", e);
                // Fallback to previous math state if derivation fails due to invalid syntax
            }

            return {
                ...newP,
                positionExpr: X,
                velocityExpr: U,
                accelerationExpr: A
            };
        })
    })),

    updateParticleInitialConditions: (id, X0, U0) => set((state) => {
        return {
            particles: state.particles.map(p => {
                if (p.id !== id) return p;
                const nextX0 = X0 || p.initialPosition;
                const nextU0 = U0 || p.initialVelocity;

                let X = [...p.positionExpr] as Vector4;
                let U = [...p.velocityExpr] as Vector4;
                let A = [...p.accelerationExpr] as Vector4;

                try {
                    if (p.inputVelocity) {
                        const sol = solveFromVelocity(p.inputVelocity, nextX0);
                        X = sol.X; U = sol.U; A = sol.A;
                    } else if (p.inputAcceleration) {
                        const sol = solveFromAcceleration(p.inputAcceleration, nextU0, nextX0);
                        X = sol.X; U = sol.U; A = sol.A;
                    }
                } catch (e) {
                    console.warn("Failed to update derived vectors from ICs", e);
                }

                return {
                    ...p,
                    initialPosition: nextX0,
                    initialVelocity: nextU0,
                    positionExpr: X,
                    velocityExpr: U,
                    accelerationExpr: A
                };
            })
        };
    }),

    loadPreset: (presetId) => set((state) => {
        const preset = PARADOX_PRESETS.find(p => p.id === presetId);
        if (!preset) return state;

        const newParticles: ParticleState[] = preset.particles.map(pt => {
            const p: ParticleState = {
                id: generateId(),
                name: pt.name,
                color: pt.color,
                mass: 1,
                initialPosition: pt.initialPosition,
                initialVelocity: pt.initialVelocity,
                positionExpr: ['0', '0', '0', '0'],
                velocityExpr: ['0', '0', '0', '0'],
                accelerationExpr: ['0', '0', '0', '0']
            };

            // Pass input type along to store
            if (pt.inputType) {
                (p as any).inputType = pt.inputType; // Fallback mapping as UI drives off of inputPosition existences directly
            }

            if (pt.inputType === 'position') {
                p.inputPosition = pt.input;
                const sol = solveFromPosition(pt.input);
                p.positionExpr = sol.X; p.velocityExpr = sol.U; p.accelerationExpr = sol.A;
            } else if (pt.inputType === 'velocity') {
                p.inputVelocity = pt.input;
                const sol = solveFromVelocity(pt.input, p.initialPosition);
                p.positionExpr = sol.X; p.velocityExpr = sol.U; p.accelerationExpr = sol.A;
            } else if (pt.inputType === 'acceleration') {
                p.inputAcceleration = pt.input;
                const sol = solveFromAcceleration(pt.input, p.initialVelocity, p.initialPosition);
                p.positionExpr = sol.X; p.velocityExpr = sol.U; p.accelerationExpr = sol.A;
            }
            return p;
        });

        return {
            particles: newParticles,
            timeMin: preset.timeMin,
            timeMax: preset.timeMax,
            tauRange: preset.tauRange,
            viewMode: preset.viewMode,
            animationTime: preset.timeMin, // Reset playhead
            activeReferenceFrameId: 'Lab', // Always reset to Lab frame for presets
            loadedPresetId: presetId
        };
    }),

    setActiveReferenceFrame: (id) => set({ activeReferenceFrameId: id }),
    setAnimationTime: (t) => set({ animationTime: t }),
    setActiveDimension: (dim) => set({ activeDimension: dim }),
    setViewMode: (mode) => set({ viewMode: mode }),
    setTauRange: (range) => set({ tauRange: Math.max(10, Math.min(1000, range)) }),
    setTimeMin: (val) => set((s) => ({ timeMin: Math.min(val, s.timeMax - 0.1) })),
    setTimeMax: (val) => set((s) => ({ timeMax: Math.max(val, s.timeMin + 0.1) })),
    setShowClocks: (val) => set({ showClocks: val }),

    getLabVelocityForParticle: (id) => {
        const { particles, animationTime } = get();
        const p = particles.find(x => x.id === id);
        if (!p) return [0, 0, 0];

        // Evaluate 4-velocity at the current proper time. 
        // For simplicity, tracking the current proper time tau = current animation coordinate time t.
        // In strict SR, t and tau differ. We'd map t to tau. As an approximation/demo, evaluate at tau=t.
        const U_num = evaluateVectorAtTau(p.velocityExpr, animationTime);
        return extract3Velocity(U_num);
    }
}));
