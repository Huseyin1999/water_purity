import React, { useState } from 'react';
import { OpticalParameters } from './types/physics';
import { DEFAULT_OPTICAL_PARAMS } from './physics/opticalModel';
import { PhysicsDiagnostics } from './components/PhysicsDiagnostics';
import { SimulationWorkbench } from './components/SimulationWorkbench';
import { CameraHeatmap } from './components/CameraHeatmap';
import { RootCodeStudio } from './components/RootCodeStudio';
import { Geant4Studio } from './components/Geant4Studio';
import { 
  Zap, 
  Activity, 
  Camera, 
  Code2, 
  Atom, 
  ShieldAlert, 
  Sliders, 
  HelpCircle,
  FileText,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export default function App() {
  const [params, setParams] = useState<OpticalParameters>(DEFAULT_OPTICAL_PARAMS);
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'simulation' | 'heatmap' | 'root_pipeline' | 'geant4'>('simulation');

  const updateParams = (newParams: Partial<OpticalParameters>) => {
    setParams(prev => ({ ...prev, ...newParams }));
  };

  const applyPreset = (preset: 'standard' | 'bug_repro' | 'fast_exp' | 'diffuser_test') => {
    switch (preset) {
      case 'standard':
        setParams({
          ...DEFAULT_OPTICAL_PARAMS,
          medium: 'ultra_pure_water',
          currentLengthM: 8.0,
          hasCollimatingLens: true,
          hasDiffuser: false,
          hasInterference: false,
          exposureTimeMs: 1.0,
          rCutMm: 6.0,
        });
        break;
      case 'bug_repro':
        setParams({
          ...DEFAULT_OPTICAL_PARAMS,
          medium: 'ultra_pure_water',
          currentLengthM: 8.0,
          hasCollimatingLens: false, // Natural divergence causes spot squeezing in water & wall losses in air
          hasDiffuser: false,
          hasInterference: true,
          exposureTimeMs: 1.0,
          rCutMm: 1.5, // Small cut radius exaggerates Water > Air
        });
        break;
      case 'fast_exp':
        setParams({
          ...DEFAULT_OPTICAL_PARAMS,
          exposureTimeMs: 0.125,
          currentLengthM: 8.0,
          hasCollimatingLens: true,
        });
        break;
      case 'diffuser_test':
        setParams({
          ...DEFAULT_OPTICAL_PARAMS,
          hasDiffuser: true,
          hasInterference: true,
          hasCollimatingLens: true,
        });
        break;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm font-bold tracking-wider">
                TG
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 dark:text-slate-50">
                    TAIGA • Оптический стенд ультрачистой воды
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                    Мюонный детектор
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Моделирование ослабления лазерного пучка (405 нм, 5 мВт) в CERN ROOT и Geant4
                </p>
              </div>
            </div>

            {/* Quick Presets Pill Bar */}
            <div className="flex items-center flex-wrap gap-1.5 text-xs">
              <span className="text-[11px] text-slate-400 font-medium mr-1">Пресеты:</span>
              <button
                onClick={() => applyPreset('standard')}
                className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-colors"
              >
                Стандартный (8 м, Линза ВКЛ)
              </button>
              <button
                onClick={() => applyPreset('bug_repro')}
                className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900 font-medium transition-colors"
              >
                Воспроизведение бага (Вода &gt; Воздух)
              </button>
              <button
                onClick={() => applyPreset('fast_exp')}
                className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 font-medium transition-colors"
              >
                Выдержка 0.125 мс
              </button>
              <button
                onClick={() => applyPreset('diffuser_test')}
                className="px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900 font-medium transition-colors"
              >
                Матовое стекло
              </button>
            </div>
          </div>

          {/* Main Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-4 mt-3 border-t border-slate-100 dark:border-slate-800 pt-2 overflow-x-auto text-xs sm:text-sm font-medium">
            <button
              onClick={() => setActiveTab('simulation')}
              className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'simulation'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Activity className="w-4 h-4" />
              Радиальные профили & Графики
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'diagnostics'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Физическое обоснование & Диагностика
            </button>
            <button
              onClick={() => setActiveTab('heatmap')}
              className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'heatmap'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Camera className="w-4 h-4" />
              2D Сенсор камеры (Air vs Water)
            </button>
            <button
              onClick={() => setActiveTab('root_pipeline')}
              className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'root_pipeline'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Code2 className="w-4 h-4" />
              CERN ROOT Пайплайн (C++)
            </button>
            <button
              onClick={() => setActiveTab('geant4')}
              className={`pb-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'geant4'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Atom className="w-4 h-4" />
              Модель Geant4
            </button>
          </nav>
        </div>
      </header>

      {/* Main App Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'simulation' && (
          <SimulationWorkbench params={params} onUpdateParams={updateParams} />
        )}
        {activeTab === 'diagnostics' && (
          <PhysicsDiagnostics params={params} onUpdateParams={updateParams} />
        )}
        {activeTab === 'heatmap' && (
          <CameraHeatmap params={params} onUpdateParams={updateParams} />
        )}
        {activeTab === 'root_pipeline' && (
          <RootCodeStudio />
        )}
        {activeTab === 'geant4' && (
          <Geant4Studio />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Коллаборация TAIGA • Эксперимент по физике космических лучей и гамма-астрономии
            </span>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Оптический стенд измерения прозрачности ультрачистой воды: Lambda_att = 120–150 м (405 нм, 5 мВт, труба D = 50 мм, PMMA окна)
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span>CERN ROOT 6.x</span>
            <span>•</span>
            <span>Geant4 11.x</span>
            <span>•</span>
            <span>Rayleigh + Fresnel + Snell</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
