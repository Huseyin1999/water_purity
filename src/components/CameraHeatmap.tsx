import React, { useRef, useEffect, useState } from 'react';
import { OpticalParameters } from '../types/physics';
import { getBeamRadiusAtZ, getWindowTransmissions, getPhotonsPerSecond } from '../physics/opticalModel';
import { Camera, Maximize2, Palette, ShieldCheck, Crosshair } from 'lucide-react';

interface Props {
  params: OpticalParameters;
  onUpdateParams: (newParams: Partial<OpticalParameters>) => void;
}

export const CameraHeatmap: React.FC<Props> = ({ params, onUpdateParams }) => {
  const canvasAirRef = useRef<HTMLCanvasElement>(null);
  const canvasWaterRef = useRef<HTMLCanvasElement>(null);

  const [palette, setPalette] = useState<'root_darkbody' | 'inferno' | 'viridis'>('root_darkbody');
  const [hoverCoords, setHoverCoords] = useState<{ xMm: number; yMm: number; valWater: number; valAir: number } | null>(null);

  // Sensor geometry: 3000 x 2000 pixels at 8 um -> 24 mm x 16 mm
  const sensorWidthMm = 24.0;
  const sensorHeightMm = 16.0;

  useEffect(() => {
    const drawHeatmap = (canvas: HTMLCanvasElement | null, isWater: boolean) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const imgData = ctx.createImageData(width, height);
      const data = imgData.data;

      const wRadius = getBeamRadiusAtZ(
        params.currentLengthM,
        isWater ? params.nWater : params.nAir,
        params.hasCollimatingLens,
        params.initialBeamDiameterMm
      );

      const sigmaMm = wRadius / 2.0;
      const { transAirCell, transWaterCell } = getWindowTransmissions(params);
      const cellTrans = isWater ? transWaterCell : transAirCell;
      const bulkTrans = isWater ? Math.exp(-params.currentLengthM / params.ultraPureAbsLengthM) : 1.0;
      const diffuserFactor = params.hasDiffuser ? 0.82 : 1.0;
      const totalTrans = cellTrans * bulkTrans * diffuserFactor;

      // Color mapping function
      const getColor = (normVal: number): [number, number, number] => {
        const v = Math.max(0, Math.min(1, normVal));
        if (palette === 'root_darkbody') {
          // ROOT kInvertedDarkBodyRadiator: 0 -> white/light yellow, 0.5 -> yellow/orange, 1.0 -> dark brown/black
          // User's ROOT palette: background is white, low intensity is yellow/orange, high intensity is dark red/black
          if (v < 0.02) return [255, 255, 255]; // background
          if (v < 0.3) {
            const t = (v - 0.02) / 0.28;
            return [255, Math.floor(255 - t * 40), Math.floor(180 - t * 180)]; // yellow
          }
          if (v < 0.7) {
            const t = (v - 0.3) / 0.4;
            return [Math.floor(255 - t * 120), Math.floor(215 - t * 160), 0]; // orange-red
          }
          const t = (v - 0.7) / 0.3;
          return [Math.floor(135 - t * 105), Math.floor(55 - t * 45), 0]; // dark brown/black
        } else if (palette === 'inferno') {
          // Inferno palette
          const r = Math.floor(Math.min(255, v * 280));
          const g = Math.floor(Math.min(255, Math.pow(v, 1.6) * 255));
          const b = Math.floor(Math.min(255, Math.pow(v, 3) * 255));
          return [r, g, b];
        } else {
          // Viridis
          const r = Math.floor(Math.sin(v * Math.PI) * 70 + (1 - v) * 60);
          const g = Math.floor(v * 210 + 20);
          const b = Math.floor(Math.cos(v * Math.PI * 0.5) * 120 + 80);
          return [r, g, b];
        }
      };

      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const xMm = ((px / width) - 0.5) * sensorWidthMm;
          const yMm = -((py / height) - 0.5) * sensorHeightMm;
          const rMm = Math.sqrt(xMm * xMm + yMm * yMm);

          // Gaussian beam intensity
          let val = totalTrans * Math.exp(-(rMm * rMm) / (2 * sigmaMm * sigmaMm));

          // If interference enabled without diffuser: add speckle & Fabry-Perot rings
          if (params.hasInterference && !params.hasDiffuser) {
            const ringPhase = Math.sin((rMm * rMm * 3.14159) / 4.0);
            const fringeMod = isWater ? 0.03 : 0.16; // Much stronger in air due to larger delta n!
            val *= (1.0 + fringeMod * ringPhase);
          }

          // Small halo scattering in water
          if (isWater && params.medium === 'ultra_pure_water') {
            val += 0.003 * totalTrans * Math.exp(-rMm / 4.0);
          }

          const rgb = getColor(val);
          const idx = (py * width + px) * 4;
          data[idx] = rgb[0];
          data[idx + 1] = rgb[1];
          data[idx + 2] = rgb[2];
          data[idx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Draw overlays: cut circle, scale crosshair
      ctx.save();
      ctx.translate(width / 2, height / 2);

      // Scale factor: pixels per mm
      const pxPerMm = width / sensorWidthMm;

      // Draw Cut radius r_cut
      ctx.beginPath();
      ctx.arc(0, 0, params.rCutMm * pxPerMm, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();

      // Tube wall circle (R = 25 mm)
      ctx.beginPath();
      ctx.arc(0, 0, 25.0 * pxPerMm, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2, 4]);
      ctx.stroke();

      // Center crosshair
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
      ctx.moveTo(0, -8); ctx.lineTo(0, 8);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([]);
      ctx.stroke();

      ctx.restore();
    };

    drawHeatmap(canvasAirRef.current, false);
    drawHeatmap(canvasWaterRef.current, true);
  }, [params, palette]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const xMm = ((px / rect.width) - 0.5) * sensorWidthMm;
    const yMm = -((py / rect.height) - 0.5) * sensorHeightMm;
    setHoverCoords({
      xMm: parseFloat(xMm.toFixed(2)),
      yMm: parseFloat(yMm.toFixed(2)),
      valWater: 1.2e9,
      valAir: 0.9e9,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Camera className="w-4 h-4 text-blue-600" />
            Двумерные изображения сенсора камеры (3000 × 2000 пикселей, 24 × 16 мм)
          </h3>
          <p className="text-xs text-slate-500">
            Сравнение пятна в воздухе и воде на дистанции L = {params.currentLengthM} м. 
            Синий пунктир — апертурный вырез r_cut = {params.rCutMm} мм.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Palette className="w-4 h-4 text-slate-500" />
          <span className="text-slate-600 dark:text-slate-400 font-medium">Палитра:</span>
          <select
            value={palette}
            onChange={(e) => setPalette(e.target.value as any)}
            className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono"
          >
            <option value="root_darkbody">ROOT DarkBodyRadiator</option>
            <option value="inferno">Inferno</option>
            <option value="viridis">Viridis</option>
          </select>
        </div>
      </div>

      {/* Side-by-Side Heatmaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Air Camera Image */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider font-mono">
              Air Camera Image ({params.currentLengthM} m tube)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {params.hasCollimatingLens ? 'Коллимирован (≤20 мм)' : 'Расходящийся пучок'}
            </span>
          </div>

          <div className="relative border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
            <canvas
              ref={canvasAirRef}
              width={480}
              height={320}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverCoords(null)}
              className="w-full h-auto cursor-crosshair"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>X: -12.0 ... +12.0 мм</span>
            <span>Y: -8.0 ... +8.0 мм</span>
          </div>
        </div>

        {/* Water Camera Image */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider font-mono">
              Water Camera Image ({params.currentLengthM} m tube)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Сжатие Снеллиуса θ = θ₀ / 1.33
            </span>
          </div>

          <div className="relative border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
            <canvas
              ref={canvasWaterRef}
              width={480}
              height={320}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverCoords(null)}
              className="w-full h-auto cursor-crosshair"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>X: -12.0 ... +12.0 мм</span>
            <span>Y: -8.0 ... +8.0 мм</span>
          </div>
        </div>
      </div>

      {/* Coordinate inspector banner */}
      {hoverCoords && (
        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-mono flex items-center justify-between text-blue-900 dark:text-blue-200">
          <div className="flex items-center gap-3">
            <Crosshair className="w-4 h-4 text-blue-600" />
            <span>Координаты курсора: X = {hoverCoords.xMm} мм, Y = {hoverCoords.yMm} мм</span>
            <span>Радиус r = {Math.sqrt(hoverCoords.xMm ** 2 + hoverCoords.yMm ** 2).toFixed(2)} мм</span>
          </div>
          <div>
            Попадание в вырез r_cut: {Math.sqrt(hoverCoords.xMm ** 2 + hoverCoords.yMm ** 2) <= params.rCutMm ? '✓ Внутри' : '✕ Вне выреза'}
          </div>
        </div>
      )}
    </div>
  );
};
