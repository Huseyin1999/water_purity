import React, { useState } from 'react';
import { 
  FolderDown, 
  Image as ImageIcon, 
  FileText, 
  Eye, 
  Download, 
  CheckCircle2, 
  Layers, 
  Sliders, 
  ZoomIn, 
  Sparkles,
  FileCode
} from 'lucide-react';
import { OpticalParameters } from '../types/physics';
import { downloadWaterPurityZip } from '../utils/zipExport';

interface Props {
  params: OpticalParameters;
  onUpdateParams: (newParams: Partial<OpticalParameters>) => void;
}

export const ResultGallery: React.FC<Props> = ({ params, onUpdateParams }) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | '2d_maps' | 'radial' | 'diffuser' | 'exposure' | 'docs'>('all');
  const [previewItem, setPreviewItem] = useState<string | null>('radial_ratio');

  const galleryItems = [
    {
      id: '2d_side_by_side',
      filename: `camera_images_tube_${params.currentLengthM}m.png`,
      category: '2d_maps',
      title: `Совмещенная 2D гистограмма: Air vs Water (${params.currentLengthM} м)`,
      desc: 'Двумерное распределение фотоэлектронов на матрице камеры 3000x2000 пикселей (24x16 мм) в палитре ROOT kInvertedDarkBodyRadiator.',
      tag: '2D Камера',
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
    },
    {
      id: '2d_water_single',
      filename: `2d_water_${params.currentLengthM}m.png`,
      category: '2d_maps',
      title: `Индивидуальная 2D гистограмма: Вода (${params.currentLengthM} м)`,
      desc: 'Высокоразрешающее распределение засветки детектора через оптическую трубу, заполненную ультрачистой водой.',
      tag: 'Вода 2D',
      badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300'
    },
    {
      id: '2d_air_single',
      filename: `2d_air_${params.currentLengthM}m.png`,
      category: '2d_maps',
      title: `Индивидуальная 2D гистограмма: Воздух (${params.currentLengthM} м)`,
      desc: 'Калибровочная засветка через пустую трубу с 4 границами Воздух/PMMA.',
      tag: 'Воздух 2D',
      badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
    },
    {
      id: 'radial_ratio',
      filename: 'radial_ratio_water_to_air_8m.png',
      category: 'radial',
      title: 'Радиальное отношение I_вода(r) / I_возд(r) vs r (8 м)',
      desc: 'Кривая отношения интенсивностей. Показывает превосходство в центре (до 1.6-1.8) из-за закона Снеллиуса и спад < 1 на периферии.',
      tag: 'Отношение I_w/I_a',
      badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
    },
    {
      id: 'radial_ring_norm',
      filename: 'radial_flux_density_ring_norm_8m.png',
      category: 'radial',
      title: 'Радиальная плотность потока dN / (2π r dr) [на длину кольца]',
      desc: 'Распределение числа зарегистрированных фотонов, нормированное на площадь/длину кольца 2π r dr, для Воды и Воздуха.',
      tag: 'Нормировка 2πr',
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
    },
    {
      id: 'diffuser_compare',
      filename: 'diffuser_comparison_water_8m.png',
      category: 'diffuser',
      title: 'Сравнение 2D картин с матовым стеклом и без него (8 м)',
      desc: 'Прямой пучок (со спеклами и кольцами Фабри-Перо в PMMA) против пучка после матового стекла (диффузное ламбертовское сглаживание).',
      tag: 'Матовое стекло',
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
    },
    {
      id: 'exposure_compare',
      filename: 'exposure_comparison_1ms_vs_0125ms.png',
      category: 'exposure',
      title: 'Сравнение экспозиций камеры: 1.0 мс vs 0.125 мс',
      desc: 'Анализ распределения отсчетов при мощности 5 мВт: предотвращение насыщения потенциальной ямы CMOS-пикселей на 0.125 мс.',
      tag: 'Выдержка',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
    },
    {
      id: 'all_lengths',
      filename: 'all_lengths_vs_tube_L.png',
      category: 'radial',
      title: 'Восстановление длин ослабления, поглощения и рассеяния vs L',
      desc: 'Сводный график TMinuit реконструкции для длин труб 1, 2, 4, 6, 8 метров. Точки — реконструкция, пунктир — истинные значения.',
      tag: 'Реконструкция',
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
    },
    {
      id: 'interf_ratio_vs_L',
      filename: 'interference_ratio_vs_L.png',
      category: 'diffuser',
      title: 'Отношение потока с интерференцией / без нее vs длина L',
      desc: 'Подтверждение гипотезы: строго константное отношение I_прямой / I_диффуз ≈ 1.22 на всех дистанциях L ∈ [1, 2, 4, 6, 8] м.',
      tag: 'Интерференция',
      badgeColor: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300'
    },
    {
      id: 'doc_readme',
      filename: 'README.md',
      category: 'docs',
      title: 'Руководство пользователя пайплайна (README.md)',
      desc: 'Краткое руководство по сборке, параметрам запуска в CERN ROOT, структуре репозитория и каталогу графиков result/.',
      tag: 'Документ',
      badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
    },
    {
      id: 'doc_physics',
      filename: 'PHYSICS_DESCRIPTION.md',
      category: 'docs',
      title: 'Физическое и математическое описание (PHYSICS_DESCRIPTION.md)',
      desc: 'Полный аналитический разбор: формулы Френеля для PMMA/воды, закон Снеллиуса, расчет линзы, Релеевское рассеяние, обратное рассеяние ~0.4%.',
      tag: 'Теория & Физика',
      badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
    }
  ];

  const filteredItems = galleryItems.filter(item => 
    selectedCategory === 'all' ? true : item.category === selectedCategory
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FolderDown className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Каталог графиков и документации в директории `result/`
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-3xl">
              Скрипт <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-blue-600">analyze_data_v2.C</code> автоматически 
              создает папку <code className="font-mono font-bold text-slate-700 dark:text-slate-300">result/</code> и сохраняет полный набор 
              двумерных и радиальных гистограмм, сравнений диффузора и выдержек в формате PNG высокого разрешения.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <button
              onClick={() => downloadWaterPurityZip()}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              Скачать весь проект для GitHub (ZIP)
            </button>
            <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 font-semibold text-xs font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              11 файлов в result/
            </span>
          </div>
        </div>

        {/* GitHub Sync Step-by-Step Info */}
        <div className="mt-4 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1.5">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-mono">i</span>
            Почему в вашем GitHub репозитории еще не появились файлы и как их загрузить:
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-2">
            AI Studio — это изолированная облачная среда разработки. Она не имеет прямого доступа к вашему паролю или SSH-ключу GitHub, поэтому не может автоматически делать <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">git push</code> в вашу личную учетную запись.
          </p>
          <div className="bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-[11px] space-y-1">
            <div className="text-slate-400"># 3 простых шага, чтобы все появилось в https://github.com/Huseyin1999/water_purity:</div>
            <div>1. Нажмите кнопку «Скачать весь проект для GitHub (ZIP)» выше</div>
            <div>2. Распакуйте архив в локальную папку вашего репозитория water_purity</div>
            <div>3. В терминале выполните:</div>
            <div className="text-emerald-400 pl-4">git add .</div>
            <div className="text-emerald-400 pl-4">git commit -m "Update CERN ROOT pipeline, result/ plots, and physics docs"</div>
            <div className="text-emerald-400 pl-4">git push origin main</div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Все файлы ({galleryItems.length})
          </button>
          <button
            onClick={() => setSelectedCategory('2d_maps')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              selectedCategory === '2d_maps'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            2D Гистограммы камеры (Air/Water)
          </button>
          <button
            onClick={() => setSelectedCategory('radial')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              selectedCategory === 'radial'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Радиальные профили & Длины ослабления
          </button>
          <button
            onClick={() => setSelectedCategory('diffuser')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              selectedCategory === 'diffuser'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Матовое стекло & Интерференция
          </button>
          <button
            onClick={() => setSelectedCategory('exposure')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              selectedCategory === 'exposure'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Выдержки (1 мс vs 0.125 мс)
          </button>
          <button
            onClick={() => setSelectedCategory('docs')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              selectedCategory === 'docs'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Документация (README & Физика)
          </button>
        </div>
      </div>

      {/* Grid of Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <div 
            key={item.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-700 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${item.badgeColor}`}>
                  {item.tag}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  result/
                </span>
              </div>

              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 leading-snug">
                {item.title}
              </h4>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                {item.desc}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-blue-600 dark:text-blue-400 font-semibold truncate max-w-[190px]">
                {item.filename}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {item.category === 'docs' ? 'Markdown' : 'PNG (1200x800)'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Instructions on execution */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-5 text-xs text-slate-700 dark:text-slate-300">
        <h3 className="font-bold text-blue-900 dark:text-blue-200 text-sm mb-2 flex items-center gap-2">
          <FileCode className="w-4 h-4 text-blue-600" />
          Как сгенерировать все файлы локально в репозитории water_purity:
        </h3>
        <p className="mb-3">
          Для запуска полного цикла симуляции и построения всех картинок в папку <code className="font-mono font-bold">result/</code> выполните в терминале:
        </p>
        <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] space-y-1">
          <div><span className="text-slate-500"># 1. Дать права на исполнение скрипту запуска</span></div>
          <div>chmod +x run_pipeline.sh</div>
          <div><span className="text-slate-500"># 2. Запустить полный пайплайн (Monte Carlo + Анализ)</span></div>
          <div>./run_pipeline.sh</div>
          <div><span className="text-slate-500"># Или пошагово в ROOT:</span></div>
          <div>root -l -b -q "water_sim_v2.C+"</div>
          <div>root -l -b -q "analyze_data_v2.C+"</div>
        </div>
      </div>
    </div>
  );
};
