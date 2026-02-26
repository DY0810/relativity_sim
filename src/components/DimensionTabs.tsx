import React from 'react';
import type { SpatialDimension } from '../store/useSimulatorStore';
import { useSimulatorStore } from '../store/useSimulatorStore';

export const DimensionTabs: React.FC = () => {
    const { activeDimension, setActiveDimension, viewMode, setViewMode } = useSimulatorStore();

    const dimensions: { id: SpatialDimension; label: string }[] = [
        { id: 'x', label: 't–x' },
        { id: 'y', label: 't–y' },
        { id: 'z', label: 't–z' }
    ];

    return (
        <div className="absolute top-4 left-4 z-10 flex bg-slate-800/80 backdrop-blur rounded-lg border border-slate-700 overflow-hidden shadow-lg p-1 gap-0.5">
            {/* 2D slice tabs */}
            {dimensions.map(dim => (
                <button
                    key={dim.id}
                    className={`px-3 py-1.5 text-xs font-medium transition-all rounded-md ${viewMode === '2d' && activeDimension === dim.id
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                        }`}
                    onClick={() => { setViewMode('2d'); setActiveDimension(dim.id); }}
                >
                    {dim.label}
                </button>
            ))}

            {/* Separator */}
            <div className="w-px bg-slate-600 mx-1 self-stretch" />

            {/* 3D tab */}
            <button
                className={`px-3 py-1.5 text-xs font-medium transition-all rounded-md ${viewMode === '3d'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                    }`}
                onClick={() => setViewMode('3d')}
            >
                3D (x-y-t)
            </button>
        </div>
    );
};
