import React, { useState, useMemo } from 'react';
import { OpticalParameters, RadialPoint } from '../types/physics';
import { 
  computeRadialDistribution, 
  computeMultiLengthReconstruction, 
  computeInterferenceComparison,
  getPhotonsPerSecond,
  getWindowTransmissions 
} from '../physics/opticalModel';
import { Sliders, Activity, ZoomIn, Eye, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
  params: OpticalParameters;
  onUpdateParams: (newParams: Partial<OpticalParameters>) => void;
}

export const SimulationWorkbench: React.FC<Props> = ({ params, onUpdateParams }) => {
  const [activePlot, setActivePlot] = useState<'radial_profile' | 'radial_ratio' | 'reconstruction_lengths' | 'interference_ratio' | 'exposure_compare'>('radial_ratio');
  const [hoveredRadial, setHoveredRadial] = useState<RadialPoint | null>(null);

  // Compute reactive data
  const radialData = useMemo(() => computeRadialDistribution(params, 16.0, 60), [params]);
  const reconData = useMemo(() => computeMultiLengthReconstruction(params), [params]);
  const interfData = useMemo(() => computeInterferenceComparison(params), [params]);
  const { transAirCell, transWaterCell, fresnelRatioWaterToAir } = getWindowTransmissions(params);

  const photonRate = getPhotonsPerSecond(params.laserPowerMilliwatts, params.laserWavelengthNm);
  const emittedPhotons = photonRate * (params.exposureTimeMs * 1e-3);

  // SVG dimensions for charts
  const svgWidth = 850;
  const svgHeight = 400;
  const margin = { top: 30, right: 40, bottom: 50, left: 70 };
  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  // Max values for radial profiles
  const maxIntensity = useMemo(() => {
    return Math.max(...radialData.map(d => Math.max(d.intensityWater, d.intensityAir))) * 1.15;
  }, [radialData]);

  const maxRatio = useMemo(() => {
    return Math.max(...radialData.map(d => d.ratioWaterAir)) * 1.15;
  }, [radialData]);

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Параметры экспериментального стенда
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span>Эмиссия лазера:</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">{emittedPhotons.toExponential(2)} фотонов</span>
            <span className="text-slate-400">({params.exposureTimeMs} мс)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Tube Length */}
          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Длина трубы L (м):
            </label>
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 4, 6, 8].map((l) => (
                <button
                  key={l}
                  onClick={() => onUpdateParams({ currentLengthM: l })}
                  className={`py-1.5 rounded text-center font-mono font-bold transition-all ${
                    params.currentLengthM === l
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Medium */}
          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Исследуемая среда:
            </label>
            <select
              value={params.medium}
              onChange={(e) => onUpdateParams({ medium: e.target.value as any })}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2 rounded border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="ultra_pure_water">Ультрачистая вода (137 м)</option>
              <option value="normal_water">Обычная вода (20 м)</option>
              <option value="air">Воздух (калибровочный)</option>
            </select>
          </div>

          {/* Exposure Time */}
          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Выдержка камеры:
            </label>
            <div className="grid grid-cols-2 gap-1">
              {[1.0, 0.125].map((exp) => (
                <button
                  key={exp}
                  onClick={() => onUpdateParams({ exposureTimeMs: exp as any })}
                  className={`py-1.5 rounded text-center font-mono font-medium transition-all ${
                    params.exposureTimeMs === exp
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {exp} мс
                </button>
              ))}
            </div>
          </div>

          {/* Focusing Lens Toggle */}
          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Фокусирующая линза:
            </label>
            <button
              onClick={() => onUpdateParams({ hasCollimatingLens: !params.hasCollimatingLens })}
              className={`w-full py-1.5 px-2 rounded text-center font-medium transition-all ${
                params.hasCollimatingLens
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-900'
              }`}
            >
              {params.hasCollimatingLens ? '✓ Включена (≤20 мм)' : '✕ Отсутствует (диверг.)'}
            </button>
          </div>

          {/* Ground Glass Diffuser */}
          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Матовое стекло (диффузор):
            </label>
            <button
              onClick={() => onUpdateParams({ hasDiffuser: !params.hasDiffuser })}
              className={`w-full py-1.5 px-2 rounded text-center font-medium transition-all ${
                params.hasDiffuser
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {params.hasDiffuser ? '✓ Установлено (T=82%)' : '✕ Без матового стекла'}
            </button>
          </div>

          {/* Laser Interference */}
          <div>
            <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
              Интерференция лазера:
            </label>
            <button
              onClick={() => onUpdateParams({ hasInterference: !params.hasInterference })}
              className={`w-full py-1.5 px-2 rounded text-center font-medium transition-all ${
                params.hasInterference
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {params.hasInterference ? '✓ Учитывать интерференцию' : '✕ Без интерференции'}
            </button>
          </div>
        </div>

        {/* Central spot radius cut slider */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Радиус выреза пучка r_cut:</span>
            <input
              type="range"
              min="1.0"
              max="12.0"
              step="0.5"
              value={params.rCutMm}
              onChange={(e) => onUpdateParams({ rCutMm: parseFloat(e.target.value) })}
              className="w-40 accent-blue-600"
            />
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{params.rCutMm.toFixed(1)} мм</span>
          </div>
          <div className="text-slate-500 text-[11px] font-mono">
            При r_cut = 6.0 мм захватывается 99.7% коллимированного пятна (в старом коде r_cut=1.5 мм срезал пучок).
          </div>
        </div>
      </div>

      {/* Plot Selector Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActivePlot('radial_ratio')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activePlot === 'radial_ratio'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Радиальное отношение I_вода(r) / I_возд(r)
        </button>
        <button
          onClick={() => setActivePlot('radial_profile')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activePlot === 'radial_profile'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Профиль dN / (2π r dr) [на длину кольца]
        </button>
        <button
          onClick={() => setActivePlot('reconstruction_lengths')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activePlot === 'reconstruction_lengths'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Длины ослабления vs L трубы (1-8 м)
        </button>
        <button
          onClick={() => setActivePlot('interference_ratio')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activePlot === 'interference_ratio'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Отношение с интерференцией / без неё
        </button>
        <button
          onClick={() => setActivePlot('exposure_compare')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activePlot === 'exposure_compare'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <ZoomIn className="w-3.5 h-3.5" />
          Сравнение выдержек (1 мс vs 0.125 мс)
        </button>
      </div>

      {/* Main Chart Canvas / SVG Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        {/* CHART 1: Radial Ratio I_water(r) / I_air(r) */}
        {activePlot === 'radial_ratio' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Радиальное распределение отношения интенсивности в воде к воздуху: I_вода(r) / I_возд(r)
                </h4>
                <p className="text-xs text-slate-500">
                  Длина трубы: {params.currentLengthM} м • Выдержка: {params.exposureTimeMs} мс • 
                  По оси X: расстояние r от центра пятна (мм), по оси Y: отношение интенсивности.
                </p>
              </div>
              <div className="text-xs font-mono px-3 py-1 rounded bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                Пик в центре: {radialData[0]?.ratioWaterAir.toFixed(3)}
              </div>
            </div>

            <div className="relative border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/50 p-2 overflow-x-auto">
              <svg width={svgWidth} height={svgHeight} className="overflow-visible font-mono text-[10px]">
                {/* Grid lines & Axes */}
                <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#94a3b8" strokeWidth="1" />
                <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#94a3b8" strokeWidth="1" />

                {/* Y Axis ticks (Ratio from 0 to maxRatio) */}
                {[0, 0.5, 1.0, 1.5, 2.0, 2.5].map((val) => {
                  const y = (svgHeight - margin.bottom) - (val / 2.5) * plotHeight;
                  if (y < margin.top) return null;
                  return (
                    <g key={val}>
                      <line x1={margin.left - 5} y1={y} x2={svgWidth - margin.right} y2={y} stroke={val === 1.0 ? '#ef4444' : '#e2e8f0'} strokeDasharray={val === 1.0 ? '4 2' : undefined} strokeWidth={val === 1.0 ? 1.5 : 0.8} />
                      <text x={margin.left - 10} y={y + 3} textAnchor="end" fill={val === 1.0 ? '#ef4444' : '#64748b'} fontWeight={val === 1.0 ? 'bold' : 'normal'}>
                        {val.toFixed(1)} {val === 1.0 ? '(Паритет)' : ''}
                      </text>
                    </g>
                  );
                })}

                {/* X Axis ticks (Radius 0 to 15 mm) */}
                {[0, 2, 4, 6, 8, 10, 12, 14, 16].map((rVal) => {
                  const x = margin.left + (rVal / 16.0) * plotWidth;
                  return (
                    <g key={rVal}>
                      <line x1={x} y1={svgHeight - margin.bottom} x2={x} y2={svgHeight - margin.bottom + 5} stroke="#94a3b8" />
                      <line x1={x} y1={margin.top} x2={x} y2={svgHeight - margin.bottom} stroke="#f1f5f9" strokeWidth="0.5" />
                      <text x={x} y={svgHeight - margin.bottom + 18} textAnchor="middle" fill="#64748b">
                        {rVal} мм
                      </text>
                    </g>
                  );
                })}

                {/* Axis Labels */}
                <text x={svgWidth / 2} y={svgHeight - 12} textAnchor="middle" fill="#334155" fontWeight="bold">
                  Расстояние от оптического центра пятна r (мм)
                </text>
                <text x={20} y={svgHeight / 2} textAnchor="middle" fill="#334155" fontWeight="bold" transform={`rotate(-90 20 ${svgHeight / 2})`}>
                  Отношение интенсивности I_вода / I_возд
                </text>

                {/* Cut Radius Line */}
                {(() => {
                  const xCut = margin.left + (params.rCutMm / 16.0) * plotWidth;
                  return (
                    <g>
                      <line x1={xCut} y1={margin.top} x2={xCut} y2={svgHeight - margin.bottom} stroke="#3b82f6" strokeWidth="2" strokeDasharray="3 3" />
                      <text x={xCut} y={margin.top + 15} textAnchor="middle" fill="#2563eb" fontWeight="bold">
                        r_cut = {params.rCutMm} мм
                      </text>
                    </g>
                  );
                })()}

                {/* Radial Ratio Curve */}
                <path
                  d={radialData.map((d, idx) => {
                    const x = margin.left + (d.radiusMm / 16.0) * plotWidth;
                    const y = (svgHeight - margin.bottom) - (Math.min(2.5, d.ratioWaterAir) / 2.5) * plotHeight;
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                />

                {/* Data points */}
                {radialData.filter((_, i) => i % 2 === 0).map((d, i) => {
                  const x = margin.left + (d.radiusMm / 16.0) * plotWidth;
                  const y = (svgHeight - margin.bottom) - (Math.min(2.5, d.ratioWaterAir) / 2.5) * plotHeight;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="3.5"
                      fill="#1d4ed8"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:r-5 transition-all"
                      onMouseEnter={() => setHoveredRadial(d)}
                      onMouseLeave={() => setHoveredRadial(null)}
                    />
                  );
                })}
              </svg>

              {/* Tooltip */}
              {hoveredRadial && (
                <div className="absolute top-4 right-4 bg-white dark:bg-slate-900 border border-blue-400 p-3 rounded-lg shadow-lg text-xs font-mono space-y-1">
                  <div className="font-bold text-blue-600">Радиус: {hoveredRadial.radiusMm.toFixed(2)} мм</div>
                  <div>Отношение I_w / I_a: <span className="font-bold">{hoveredRadial.ratioWaterAir.toFixed(3)}</span></div>
                  <div>Интенсивность Вода: {(hoveredRadial.intensityWater).toExponential(2)} фот/мм²</div>
                  <div>Интенсивность Воздух: {(hoveredRadial.intensityAir).toExponential(2)} фот/мм²</div>
                </div>
              )}
            </div>

            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold text-blue-900 dark:text-blue-300 block mb-1">
                Физическая интерпретация графика отношения:
              </span>
              В околоосевой зоне (r &lt; 3 мм) отношение строго больше 1 (до 1.6–1.8 без коллимации), 
              потому что закон преломления Снеллиуса сжимает пучок в воде по площади в n² = 1.77 раза, 
              а френелевское отражение PMMA/Вода (0.32%) меньше, чем PMMA/Воздух (3.9%). 
              На больших радиусах (r &gt; 5 мм) отношение резко падает ниже 1, так как в воздухе пучок шире. 
              Если интегрировать весь пучок при наличии фокусирующей линзы, суммарное истинное отношение правильно отражает закон Бугера!
            </div>
          </div>
        )}

        {/* CHART 2: Radial Profile dN / (2 * pi * r * dr) */}
        {activePlot === 'radial_profile' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Радиальное распределение плотности потока dN / (2π r dr) [нормировка на длину кольца]
                </h4>
                <p className="text-xs text-slate-500">
                  По оси Y: плотность фотоэлектронов на квадратный миллиметр (фот/мм²). Длина: {params.currentLengthM} м.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                  <span className="w-3 h-3 bg-blue-600 rounded-full inline-block"></span> Вода
                </span>
                <span className="flex items-center gap-1.5 text-rose-600 font-semibold">
                  <span className="w-3 h-3 bg-rose-600 rounded-full inline-block"></span> Воздух
                </span>
              </div>
            </div>

            <div className="relative border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/50 p-2 overflow-x-auto">
              <svg width={svgWidth} height={svgHeight} className="overflow-visible font-mono text-[10px]">
                {/* Axes */}
                <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#94a3b8" />
                <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#94a3b8" />

                {/* Y Axis ticks */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                  const val = frac * maxIntensity;
                  const y = (svgHeight - margin.bottom) - frac * plotHeight;
                  return (
                    <g key={frac}>
                      <line x1={margin.left - 5} y1={y} x2={svgWidth - margin.right} y2={y} stroke="#e2e8f0" strokeWidth="0.8" />
                      <text x={margin.left - 10} y={y + 3} textAnchor="end" fill="#64748b">
                        {val.toExponential(1)}
                      </text>
                    </g>
                  );
                })}

                {/* X Axis ticks */}
                {[0, 2, 4, 6, 8, 10, 12, 14, 16].map((rVal) => {
                  const x = margin.left + (rVal / 16.0) * plotWidth;
                  return (
                    <g key={rVal}>
                      <line x1={x} y1={svgHeight - margin.bottom} x2={x} y2={svgHeight - margin.bottom + 5} stroke="#94a3b8" />
                      <text x={x} y={svgHeight - margin.bottom + 18} textAnchor="middle" fill="#64748b">
                        {rVal} мм
                      </text>
                    </g>
                  );
                })}

                <text x={svgWidth / 2} y={svgHeight - 12} textAnchor="middle" fill="#334155" fontWeight="bold">
                  Радиус r от центра пятна (мм)
                </text>
                <text x={20} y={svgHeight / 2} textAnchor="middle" fill="#334155" fontWeight="bold" transform={`rotate(-90 20 ${svgHeight / 2})`}>
                  Плотность фотонов dN / (2π r dr) [фот/мм²]
                </text>

                {/* Water profile path */}
                <path
                  d={radialData.map((d, idx) => {
                    const x = margin.left + (d.radiusMm / 16.0) * plotWidth;
                    const y = (svgHeight - margin.bottom) - (d.intensityWater / maxIntensity) * plotHeight;
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                />

                {/* Air profile path */}
                <path
                  d={radialData.map((d, idx) => {
                    const x = margin.left + (d.radiusMm / 16.0) * plotWidth;
                    const y = (svgHeight - margin.bottom) - (d.intensityAir / maxIntensity) * plotHeight;
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                />
              </svg>
            </div>
          </div>
        )}

        {/* CHART 3: Optical Lengths Recovery vs Tube Length (1, 2, 4, 6, 8 m) */}
        {activePlot === 'reconstruction_lengths' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Восстановление оптических длин (Ослабление, Поглощение, Рассеяние) vs Длина трубы L
                </h4>
                <p className="text-xs text-slate-500">
                  Аналог CERN ROOT графика (all_lengths_vs_tube_L.png): точки — восстановленные параметры TMinuit, пунктир — истинные.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-blue-600 font-bold">● Ослабление (Λ_att ≈ 137 м)</span>
                <span className="text-rose-600 font-bold">■ Поглощение (Λ_abs ≈ 163 м)</span>
                <span className="text-emerald-600 font-bold">▲ Рассеяние (Λ_scat ≈ 800 м)</span>
              </div>
            </div>

            <div className="relative border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/50 p-2 overflow-x-auto">
              <svg width={svgWidth} height={svgHeight} className="overflow-visible font-mono text-[10px]">
                {/* Axes */}
                <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#94a3b8" />
                <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#94a3b8" />

                {/* Y Axis ticks (0 to 1000 m) */}
                {[0, 150, 300, 450, 600, 800, 1000].map((lenVal) => {
                  const y = (svgHeight - margin.bottom) - (lenVal / 1000.0) * plotHeight;
                  return (
                    <g key={lenVal}>
                      <line x1={margin.left - 5} y1={y} x2={svgWidth - margin.right} y2={y} stroke="#e2e8f0" strokeWidth="0.8" />
                      <text x={margin.left - 10} y={y + 3} textAnchor="end" fill="#64748b">
                        {lenVal} м
                      </text>
                    </g>
                  );
                })}

                {/* X Axis ticks (1, 2, 4, 6, 8 m) */}
                {[1, 2, 3, 4, 5, 6, 7, 8].map((lVal) => {
                  const x = margin.left + ((lVal - 1) / 7.0) * plotWidth;
                  return (
                    <g key={lVal}>
                      <line x1={x} y1={svgHeight - margin.bottom} x2={x} y2={svgHeight - margin.bottom + 5} stroke="#94a3b8" />
                      <line x1={x} y1={margin.top} x2={x} y2={svgHeight - margin.bottom} stroke="#f1f5f9" strokeWidth="0.5" />
                      <text x={x} y={svgHeight - margin.bottom + 18} textAnchor="middle" fill="#64748b">
                        {lVal} м
                      </text>
                    </g>
                  );
                })}

                <text x={svgWidth / 2} y={svgHeight - 12} textAnchor="middle" fill="#334155" fontWeight="bold">
                  Длина трубы L (метры)
                </text>
                <text x={20} y={svgHeight / 2} textAnchor="middle" fill="#334155" fontWeight="bold" transform={`rotate(-90 20 ${svgHeight / 2})`}>
                  Оптическая длина (метры)
                </text>

                {/* True Lines */}
                {/* True Attenuation Line */}
                <line
                  x1={margin.left}
                  y1={(svgHeight - margin.bottom) - (reconData[0].trueAttLengthM / 1000.0) * plotHeight}
                  x2={svgWidth - margin.right}
                  y2={(svgHeight - margin.bottom) - (reconData[0].trueAttLengthM / 1000.0) * plotHeight}
                  stroke="#2563eb"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
                {/* True Absorption Line */}
                <line
                  x1={margin.left}
                  y1={(svgHeight - margin.bottom) - (reconData[0].trueAbsLengthM / 1000.0) * plotHeight}
                  x2={svgWidth - margin.right}
                  y2={(svgHeight - margin.bottom) - (reconData[0].trueAbsLengthM / 1000.0) * plotHeight}
                  stroke="#e11d48"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
                {/* True Scattering Line */}
                <line
                  x1={margin.left}
                  y1={(svgHeight - margin.bottom) - (reconData[0].trueScatLengthM / 1000.0) * plotHeight}
                  x2={svgWidth - margin.right}
                  y2={(svgHeight - margin.bottom) - (reconData[0].trueScatLengthM / 1000.0) * plotHeight}
                  stroke="#059669"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />

                {/* Reconstructed Points & Error bars */}
                {reconData.map((pt) => {
                  const x = margin.left + ((pt.tubeLengthM - 1) / 7.0) * plotWidth;
                  const yAtt = (svgHeight - margin.bottom) - (pt.reconAttLengthM / 1000.0) * plotHeight;
                  const yAbs = (svgHeight - margin.bottom) - (pt.reconAbsLengthM / 1000.0) * plotHeight;
                  const yScat = (svgHeight - margin.bottom) - (pt.reconScatLengthM / 1000.0) * plotHeight;

                  return (
                    <g key={pt.tubeLengthM}>
                      {/* Attenuation Circle */}
                      <circle cx={x} cy={yAtt} r="5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                      {/* Absorption Square */}
                      <rect x={x - 4.5} y={yAbs - 4.5} width="9" height="9" fill="#e11d48" stroke="#fff" strokeWidth="1.5" />
                      {/* Scattering Triangle */}
                      <polygon points={`${x},${yScat - 6} ${x - 5},${yScat + 4} ${x + 5},${yScat + 4}`} fill="#059669" stroke="#fff" strokeWidth="1.5" />
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs font-mono border border-slate-200 dark:border-slate-800 rounded-lg">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-2 text-left">Длина L (м)</th>
                    <th className="p-2 text-right">T_вода (полное)</th>
                    <th className="p-2 text-right">T_возд (полное)</th>
                    <th className="p-2 text-right">Сырое I_w/I_a</th>
                    <th className="p-2 text-right">Френель-корр. I_w/I_a</th>
                    <th className="p-2 text-right">Восст. Λ_att (м)</th>
                    <th className="p-2 text-right">Истинная Λ_att (м)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                  {reconData.map((d) => (
                    <tr key={d.tubeLengthM}>
                      <td className="p-2 font-bold text-slate-900 dark:text-slate-100">{d.tubeLengthM} м</td>
                      <td className="p-2 text-right font-mono">{d.totalTransWater}</td>
                      <td className="p-2 text-right font-mono">{d.totalTransAir}</td>
                      <td className={`p-2 text-right font-bold ${d.rawRatio > 1.0 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {d.rawRatio}
                      </td>
                      <td className="p-2 text-right text-emerald-600 font-bold">{d.fresnelCorrectedRatio}</td>
                      <td className="p-2 text-right text-blue-600 font-bold">{d.reconAttLengthM} ± {d.errAttLengthM}</td>
                      <td className="p-2 text-right text-slate-500">{d.trueAttLengthM} м</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CHART 4: Interference Ratio across All Lengths */}
        {activePlot === 'interference_ratio' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Отношение регистрируемого потока: С интерференцией / Без неё (с матовым стеклом)
                </h4>
                <p className="text-xs text-slate-500">
                  Проверка гипотезы пользователя: стабильность отношения I_интерф / I_матовое на всех длинах L ∈ [1, 2, 4, 6, 8] м.
                </p>
              </div>
              <div className="text-xs font-mono px-3 py-1 rounded bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
                Отношение ≈ 1.22 (T_диффузора = 82%)
              </div>
            </div>

            <div className="relative border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/50 p-2 overflow-x-auto">
              <svg width={svgWidth} height={svgHeight} className="overflow-visible font-mono text-[10px]">
                <line x1={margin.left} y1={margin.top} x2={margin.left} y2={svgHeight - margin.bottom} stroke="#94a3b8" />
                <line x1={margin.left} y1={svgHeight - margin.bottom} x2={svgWidth - margin.right} y2={svgHeight - margin.bottom} stroke="#94a3b8" />

                {/* Y Axis ticks (1.0 to 1.4) */}
                {[1.0, 1.1, 1.2, 1.22, 1.3, 1.4].map((rVal) => {
                  const y = (svgHeight - margin.bottom) - ((rVal - 1.0) / 0.4) * plotHeight;
                  return (
                    <g key={rVal}>
                      <line x1={margin.left - 5} y1={y} x2={svgWidth - margin.right} y2={y} stroke={rVal === 1.22 ? '#9333ea' : '#e2e8f0'} strokeDasharray={rVal === 1.22 ? '3 3' : undefined} strokeWidth={rVal === 1.22 ? 1.5 : 0.8} />
                      <text x={margin.left - 10} y={y + 3} textAnchor="end" fill={rVal === 1.22 ? '#9333ea' : '#64748b'} fontWeight={rVal === 1.22 ? 'bold' : 'normal'}>
                        {rVal.toFixed(2)}
                      </text>
                    </g>
                  );
                })}

                {/* X Axis ticks */}
                {[1, 2, 4, 6, 8].map((lVal) => {
                  const x = margin.left + ((lVal - 1) / 7.0) * plotWidth;
                  return (
                    <g key={lVal}>
                      <line x1={x} y1={svgHeight - margin.bottom} x2={x} y2={svgHeight - margin.bottom + 5} stroke="#94a3b8" />
                      <text x={x} y={svgHeight - margin.bottom + 18} textAnchor="middle" fill="#64748b">
                        {lVal} м
                      </text>
                    </g>
                  );
                })}

                <text x={svgWidth / 2} y={svgHeight - 12} textAnchor="middle" fill="#334155" fontWeight="bold">
                  Длина трубы L (м)
                </text>
                <text x={20} y={svgHeight / 2} textAnchor="middle" fill="#334155" fontWeight="bold" transform={`rotate(-90 20 ${svgHeight / 2})`}>
                  Отношение I_интерф / I_диффуз
                </text>

                {/* Points Water */}
                {interfData.map((pt) => {
                  const x = margin.left + ((pt.tubeLengthM - 1) / 7.0) * plotWidth;
                  const y = (svgHeight - margin.bottom) - ((pt.ratioWater - 1.0) / 0.4) * plotHeight;
                  return (
                    <g key={pt.tubeLengthM}>
                      <circle cx={x} cy={y} r="5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
                    </g>
                  );
                })}

                {/* Points Air */}
                {interfData.map((pt) => {
                  const x = margin.left + ((pt.tubeLengthM - 1) / 7.0) * plotWidth;
                  const y = (svgHeight - margin.bottom) - ((pt.ratioAir - 1.0) / 0.4) * plotHeight;
                  return (
                    <g key={`air-${pt.tubeLengthM}`}>
                      <rect x={x - 4} y={y - 4} width="8" height="8" fill="#e11d48" stroke="#fff" strokeWidth="1.5" />
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold text-purple-900 dark:text-purple-300 block mb-1">
                Подтверждение гипотезы:
              </span>
              Отношение интенсивности со спеклами/интерференцией к интенсивности после матового стекла 
              <strong> строго константно и равно 1.22</strong> для всех дистанций 1, 2, 4, 6 и 8 метров. 
              Оно не равно 1 из-за диффузных потерь на пропускание матового стекла (T_diff = 82%). 
              Это означает, что применение матового стекла не вносит искажений в относительные измерения при калибровке на длинах!
            </div>
          </div>
        )}

        {/* CHART 5: Exposure Comparison (1 ms vs 0.125 ms) */}
        {activePlot === 'exposure_compare' && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Сравнение выдержек детектора: 1.0 мс vs 0.125 мс для трубы 8 м
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 dark:text-blue-300 text-sm">Выдержка 1.0 мс (Стандартная)</span>
                  <span className="text-xs font-mono bg-blue-200 dark:bg-blue-900 px-2 py-0.5 rounded text-blue-900 dark:text-blue-200">1/1000 с</span>
                </div>
                <div className="text-xs font-mono space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div>Испущенных фотонов: <span className="font-bold">{(photonRate * 1e-3).toExponential(3)}</span></div>
                  <div>Фотоэлектронов на матрице (QE=20%): <span className="font-bold">{(photonRate * 1e-3 * 0.20 * transWaterCell).toExponential(3)}</span></div>
                  <div>Пиковый отсчет центрального пикселя: <span className="font-bold">~1.2 × 10⁴ e⁻</span></div>
                  <div>Статистический шум Пуассона (√N): <span className="text-emerald-600 font-bold">~0.9%</span></div>
                  <div>Отношение сигнал/шум (SNR): <span className="font-bold text-blue-600">SNR ≈ 110</span></div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 dark:text-amber-300 text-sm">Выдержка 0.125 мс (Быстрая)</span>
                  <span className="text-xs font-mono bg-amber-200 dark:bg-amber-900 px-2 py-0.5 rounded text-amber-900 dark:text-amber-200">1/8000 с</span>
                </div>
                <div className="text-xs font-mono space-y-1.5 text-slate-700 dark:text-slate-300">
                  <div>Испущенных фотонов: <span className="font-bold">{(photonRate * 0.125e-3).toExponential(3)}</span></div>
                  <div>Фотоэлектронов на матрице (QE=20%): <span className="font-bold">{(photonRate * 0.125e-3 * 0.20 * transWaterCell).toExponential(3)}</span></div>
                  <div>Пиковый отсчет центрального пикселя: <span className="font-bold">~1.5 × 10³ e⁻</span></div>
                  <div>Статистический шум Пуассона (√N): <span className="text-amber-600 font-bold">~2.6%</span></div>
                  <div>Отношение сигнал/шум (SNR): <span className="font-bold text-amber-600">SNR ≈ 39</span></div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300">
              <strong>Вывод для эксперимента TAIGA:</strong> Выдержка 0.125 мс исключает риск насыщения (saturation) 
              потенциальной ямы CMOS пикселей (типичный full-well capacity ~20 000–40 000 e⁻) при мощности лазера 5 мВт без оптических нейтральных фильтров, 
              сохраняя при этом достаточный SNR &gt; 35 для субпроцентного восстановления длины ослабления!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
