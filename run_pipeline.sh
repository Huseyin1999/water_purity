#!/usr/bin/env bash
set -e

echo "=== Пайплайн моделирования оптического стенда TAIGA ==="
mkdir -p result

if ! command -v root &> /dev/null; then
    echo "Предупреждение: CERN ROOT не найден в текущем окружении PATH."
    echo "Для запуска на сервере с ROOT выполните: source /path/to/root/bin/thisroot.sh"
    exit 0
fi

echo "CERN ROOT обнаружен: $(root-config --version)"
echo "1. Запуск Монте-Карло симуляции water_sim_v2.C..."
root -l -b -q "water_sim_v2.C+"
echo "2. Запуск анализа и построения графиков analyze_data_v2.C..."
root -l -b -q "analyze_data_v2.C+"
echo "=== [УСПЕХ] Все графики успешно сгенерированы в каталоге 'result/'! ==="
ls -lh result/
