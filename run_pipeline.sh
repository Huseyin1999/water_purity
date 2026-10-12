#!/usr/bin/env bash
set -e

echo "=== Пайплайн моделирования оптического стенда TAIGA ==="
if ! command -v root &> /dev/null; then
    echo "Предупреждение: CERN ROOT не найден в текущем окружении PATH."
    echo "Для запуска на сервере с ROOT выполните: source /path/to/root/bin/thisroot.sh"
    exit 0
fi

echo "CERN ROOT обнаружен: $(root-config --version)"
echo "Запуск Монте-Карло симуляции..."
root -l -b -q "water_sim_v2.C+"
echo "Запуск реконструкции параметров..."
root -l -b -q "analyze_data_v2.C+"
echo "Готово! Сгенерирован график all_lengths_vs_tube_L_v2.png"
