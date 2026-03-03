import type { InputType, ViewMode } from '../store/useSimulatorStore';
import type { Vector4, NumericVector4 } from '../engine/cas';

export interface ParadoxPreset {
    id: string;
    title: string;
    description: string;
    particles: {
        name: string;
        color: string;
        mass?: number;
        inputType: InputType;
        input: Vector4;
        initialPosition: NumericVector4;
        initialVelocity: NumericVector4;
    }[];
    timeMin: number;
    timeMax: number;
    tauRange: number;
    viewMode: ViewMode;
}

export const PARADOX_PRESETS: ParadoxPreset[] = [
    {
        id: 'twin-paradox',
        title: 'The Twin Paradox',
        description: 'Alice stays on Earth while Bob accelerates away at a constant rate, then immediately reverses acceleration to return. They reunite at the same lab coordinate but with completely different proper ages.',
        timeMin: 0,
        timeMax: 10,
        tauRange: 10,
        viewMode: '2d',
        particles: [
            {
                name: 'Alice (Earth)',
                color: '#3b82f6', // blue
                inputType: 'position',
                input: ['tau', '0', '0', '0'],
                initialPosition: [0, 0, 0, 0],
                initialVelocity: [1, 0, 0, 0]
            },
            {
                name: 'Bob (Rocket)',
                color: '#ef4444', // red
                inputType: 'position',
                // Proper acceleration of g=1.
                // Uses sinh(tau) and cosh(tau)-1 so he starts at origin at tau=0
                input: ['sinh(tau)', 'cosh(tau) - 1', '0', '0'],
                initialPosition: [0, 0, 0, 0],
                initialVelocity: [1, 0, 0, 0]
            }
        ]
    },
    {
        id: 'rindler-horizon',
        title: 'Rindler Horizon (Black Hole)',
        description: 'A rocket experiences constant proper acceleration. Light waves emitted from behind the origin can never reach the rocket, defining an inescapable Rindler Event Horizon.',
        timeMin: 0,
        timeMax: 5,
        tauRange: 5,
        viewMode: '2d',
        particles: [
            {
                name: 'Light Ray (Photon)',
                color: '#fbbf24', // yellow
                inputType: 'velocity',
                input: ['1', '1', '0', '0'], // v=c
                initialPosition: [0, 0, 0, 0], // Starts at origin
                initialVelocity: [1, 1, 0, 0]
            },
            {
                name: 'Accelerating Rocket',
                color: '#10b981', // green
                inputType: 'position',
                input: ['sinh(tau)', 'cosh(tau)', '0', '0'], // Starts at x=1, accelerating right
                initialPosition: [0, 1, 0, 0],
                initialVelocity: [1, 0, 0, 0]
            }
        ]
    },
    {
        id: 'cyclotron',
        title: 'Particle Accelerator (3D)',
        description: 'A charged particle traces out a helix in 3D spacetime as it spins in a uniform magnetic field at high relativistic speeds.',
        timeMin: -10,
        timeMax: 10,
        tauRange: 20,
        viewMode: '3d',
        particles: [
            {
                name: 'Helical Proton',
                color: '#ec4899', // pink
                inputType: 'position',
                // Spiralling around Z axis over time. 
                // U^mu U_mu = -(3)^2 + (2)^2 + (2)^2 + (-2)^2 = -1 (Wait, -9 + 4 + 4 + 0? No, v_x= -2sin, v_y= 2cos, v_z= 2 -> -9+4+4+4 = -1) Wait. (-2)^2 + (2)^2 + (2)^2 = 12. -9 + 12 = 3. That violates.
                // Let's use: t=3*tau, x=2*cos(tau), y=2*sin(tau), z=2*tau.
                // v_t = 3, v_x = -2sin, v_y = 2cos, v_z = 2
                // U^2 = -9 + 4 + 4 = -1. Perfect!
                input: ['3*tau', '2*cos(tau)', '2*sin(tau)', '2*tau'],
                initialPosition: [0, 2, 0, 0],
                initialVelocity: [3, 0, 2, 2]
            }
        ]
    }
];
