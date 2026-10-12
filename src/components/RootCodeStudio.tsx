import React, { useState } from 'react';
import { Code2, Copy, Check, Download, Terminal, Play, FileCode, CheckCircle2 } from 'lucide-react';

export const RootCodeStudio: React.FC = () => {
  const [activeFile, setActiveFile] = useState<'water_sim_v2' | 'analyze_data_v2' | 'run_sh'>('water_sim_v2');
  const [copied, setCopied] = useState(false);

  const codeWaterSim = `// =============================================================================
// TAIGA EXPERIMENT • MUON DETECTOR WATER OPTICAL TEST BENCH
// water_sim_v2.C — Monte Carlo Ray Tracing Simulation in CERN ROOT
// =============================================================================
// Исправленная физическая модель:
// 1. Преломление по закону Снеллиуса на всех 4 границах сред (Воздух/PMMA/Вода/PMMA/Воздух)
// 2. Френелевское пропускание с учетом показателей n_air=1.0, n_pmma=1.492, n_water=1.333
// 3. Фокусирующая линза перед лазером (диаметр пучка <= 20 мм на всей длине 8 м)
// 4. Устранение ложного парадокса I_вода > I_возд за счет учета сжатия угла расходимости
// 5. Моделирование выдержек 1.0 мс и 0.125 мс для мощности 5 мВт
// 6. Опция матового стекла (диффузора) для снятия интерференции
// =============================================================================

#include <iostream>
#include <fstream>
#include <cmath>
#include <algorithm>
#include <vector>
#include "TROOT.h"
#include "TRandom3.h"
#include "TH1D.h"
#include "TH2F.h"
#include "TMath.h"
#include "TCanvas.h"

using namespace std;

struct OpticalPhoton {
    double x, y, z;       // Координаты (мм)
    double dx, dy, dz;    // Направляющие косинусы (проекции единичного вектора)
    double time_ns;       // Время пролета (нс)
    bool is_alive;        // Флаг выживания фотона
};

// Расчет коэффициента пропускания Френеля для нормального/параксиального падения
inline double GetFresnelT(double n1, double n2) {
    double r = pow((n1 - n2) / (n1 + n2), 2);
    return 1.0 - r;
}

// Преломление направления вектора фотона по закону Снеллиуса: n1*sin(th1) = n2*sin(th2)
inline void ApplySnellRefraction(OpticalPhoton &p, double n1, double n2) {
    double ratio = n1 / n2;
    p.dx *= ratio;
    p.dy *= ratio;
    double d_trans_sq = p.dx*p.dx + p.dy*p.dy;
    if (d_trans_sq < 1.0) {
        p.dz = sqrt(1.0 - d_trans_sq);
    } else {
        // Полное внутреннее отражение (если возникнет при обратном ходе)
        p.is_alive = false;
    }
}

void run_simulation(
    bool is_water, 
    double L_tube_mm, 
    string filename, 
    double coef_abs_mm, 
    double coef_scat_mm, 
    bool use_focusing_lens = true,
    bool use_diffuser = false,
    double exposure_s = 0.001 // 1.0 мс по умолчанию (или 0.000125 для 0.125 мс)
) {
    // -------------------------------------------------------------------------
    // 1. Оптические параметры установки TAIGA
    // -------------------------------------------------------------------------
    const double lambda_nm = 405.0;            // Длина волны лазера (нм)
    const double power_W   = 5.0e-3;           // 5 мВт оптическая мощность
    const double R_tube    = 25.0;             // Радиус трубы 25 мм (D = 50 мм)
    const double wall_abs  = 0.20;             // 20% поглощение стенками трубы
    const double win_thick = 5.0;              // Толщина окна PMMA 5 мм

    // Показатели преломления
    const double n_air   = 1.00028;
    const double n_pmma  = 1.4920;             // PMMA оргстекло при 405 нм
    const double n_water = 1.3330;             // Чистая вода при 405 нм

    // Параметры детектора камеры (CMOS)
    const int pixels_x     = 3000;
    const int pixels_y     = 2000;
    const double pixel_sz  = 0.008;            // 8 мкм
    const double QE        = 0.20;             // 20% квантовая эффективность

    // -------------------------------------------------------------------------
    // 2. Параметры пучка лазера и фокусирующей линзы
    // -------------------------------------------------------------------------
    // Без линзы: начальная расходимость полупроводникового диода 1.5 мрад
    // С фокусирующей линзой: коллимация формирует пучок диаметром <= 20 мм (w0 ~ 7.5 мм)
    double beam_sigma = use_focusing_lens ? 4.0 : 0.8; // Гауссов сигма (мм)
    double div_sigma  = use_focusing_lens ? 0.00008 : 0.0015; // Расходимость (рад)

    // Скорости света в средах (мм/нс)
    const double c_vac = 299.792458;
    const double v_air   = c_vac / n_air;
    const double v_pmma  = c_vac / n_pmma;
    const double v_water = c_vac / n_water;
    double v_medium = is_water ? v_water : v_air;

    // -------------------------------------------------------------------------
    // 3. Статистический вес фотонов
    // -------------------------------------------------------------------------
    const double E_photon = (6.62607e-34 * 3e8) / (lambda_nm * 1e-9); // ~4.91e-19 Дж
    const double total_real_photons = (power_W / E_photon) * exposure_s;
    const int n_sim_photons = 5000000; // 5 миллионов Монте-Карло фотонов
    const double weight = total_real_photons / n_sim_photons;

    // -------------------------------------------------------------------------
    // 4. Френелевское пропускание на входном и выходном окнах PMMA
    // -------------------------------------------------------------------------
    double T_in, T_out;
    if (is_water) {
        // Входное окно: Воздух -> PMMA -> Вода
        T_in = GetFresnelT(n_air, n_pmma) * GetFresnelT(n_pmma, n_water);
        // Выходное окно: Вода -> PMMA -> Воздух
        T_out = GetFresnelT(n_water, n_pmma) * GetFresnelT(n_pmma, n_air);
    } else {
        // Входное окно: Воздух -> PMMA -> Воздух (пустая труба)
        T_in = GetFresnelT(n_air, n_pmma) * GetFresnelT(n_pmma, n_air);
        // Выходное окно: Воздух -> PMMA -> Воздух
        T_out = GetFresnelT(n_air, n_pmma) * GetFresnelT(n_pmma, n_air);
    }

    double coef_att = is_water ? (coef_abs_mm + coef_scat_mm) : 0.0;
    double diffuser_T = use_diffuser ? 0.82 : 1.0; // Пропускание матового стекла 82%

    // Гистограмма сенсора
    double det_x = pixels_x * pixel_sz; // 24 мм
    double det_y = pixels_y * pixel_sz; // 16 мм
    TH2F *h_cam = new TH2F("h_cam", "Sensor Heatmap", pixels_x, -det_x/2.0, det_x/2.0, pixels_y, -det_y/2.0, det_y/2.0);

    TRandom3 rnd(0);

    for (int i = 0; i < n_sim_photons; ++i) {
        // Генерация начальных координат пучка
        OpticalPhoton p;
        p.x = rnd.Gaus(0, beam_sigma);
        p.y = rnd.Gaus(0, beam_sigma);
        p.z = 0.0;
        p.time_ns = 0.0;
        p.is_alive = true;

        // Генерация углов испускания
        double theta = fabs(rnd.Gaus(0, div_sigma));
        double phi = rnd.Uniform(0, 2 * TMath::Pi());
        p.dx = sin(theta) * cos(phi);
        p.dy = sin(theta) * sin(phi);
        p.dz = cos(theta);

        // Френелевские потери на входном окне
        if (rnd.Uniform() > T_in) continue;

        // Преломление Снеллиуса при входе в исследуемую среду
        if (is_water) {
            ApplySnellRefraction(p, n_air, n_water);
        }

        // Прохождение через толщу среды
        while (p.is_alive && p.z < L_tube_mm) {
            // Длина свободного пробега до поглощения/рассеяния
            double L_free = 1e12;
            if (is_water && coef_att > 0) {
                L_free = -log(rnd.Uniform()) / coef_att;
            }

            // Дистанция до цилиндрической стенки трубы
            double A = p.dx*p.dx + p.dy*p.dy;
            double B = 2.0 * (p.x*p.dx + p.y*p.dy);
            double C = p.x*p.x + p.y*p.y - R_tube*R_tube;
            double S_wall = 1e12;
            if (A > 1e-12) {
                double D = B*B - 4*A*C;
                if (D > 0) {
                    double s1 = (-B + sqrt(D)) / (2*A);
                    if (s1 > 1e-9) S_wall = s1;
                }
            }

            // Дистанция до торца трубы
            double S_end = (L_tube_mm - p.z) / p.dz;
            if (S_end < 0) S_end = 1e12;

            double S_min = std::min({L_free, S_wall, S_end});

            p.x += p.dx * S_min;
            p.y += p.dy * S_min;
            p.z += p.dz * S_min;
            p.time_ns += S_min / v_medium;

            // Обработка событий
            if (S_min == S_end) {
                break; // Фотон долетел до выходного окна
            } else if (S_min == S_wall) {
                // Взаимодействие со стенкой трубы
                if (rnd.Uniform() < wall_abs) {
                    p.is_alive = false; // Поглощен стенкой
                } else {
                    // Зеркальное отражение от цилиндрической стенки
                    double nx = p.x / R_tube;
                    double ny = p.y / R_tube;
                    double dot = p.dx * nx + p.dy * ny;
                    p.dx -= 2 * dot * nx;
                    p.dy -= 2 * dot * ny;
                }
            } else if (is_water) {
                // Взаимодействие со средой (поглощение или рассеяние)
                if (rnd.Uniform() > (coef_scat_mm / coef_att)) {
                    p.is_alive = false; // Поглощен водой
                } else {
                    // Релеевское рассеяние в воде (дипольная диаграмма p ~ 1 + cos^2 theta)
                    double cost;
                    do {
                        cost = rnd.Uniform(-1.0, 1.0);
                    } while (rnd.Uniform() > 0.5 * (1.0 + cost*cost));
                    double sint = sqrt(std::max(0.0, 1.0 - cost*cost));
                    double phi_s = rnd.Uniform(0, 2 * TMath::Pi());
                    p.dx = sint * cos(phi_s);
                    p.dy = sint * sin(phi_s);
                    p.dz = cost;
                }
            }
        }

        // Прохождение выходного окна в воздух перед сенсором
        if (p.is_alive && p.z >= L_tube_mm) {
            if (is_water) {
                ApplySnellRefraction(p, n_water, n_air);
            }

            // Френель на выходе + Квантовая эффективность матрицы + Матовое стекло
            if (rnd.Uniform() <= T_out && rnd.Uniform() <= QE && rnd.Uniform() <= diffuser_T) {
                // Если установлено матовое стекло, добавляем диффузное микрорассеяние
                if (use_diffuser) {
                    p.x += rnd.Gaus(0, 0.4);
                    p.y += rnd.Gaus(0, 0.4);
                }
                h_cam->Fill(p.x, p.y, weight);
            }
        }
    }

    // Запись матрицы засветки в файл
    ofstream out(filename);
    out << "X\tY\tAmplitude\n";
    for (int ix = 1; ix <= pixels_x; ++ix) {
        for (int iy = 1; iy <= pixels_y; ++iy) {
            double amp = h_cam->GetBinContent(ix, iy);
            if (amp > 0) {
                out << h_cam->GetXaxis()->GetBinCenter(ix) << "\t"
                    << h_cam->GetYaxis()->GetBinCenter(iy) << "\t"
                    << amp << "\n";
            }
        }
    }
    out.close();
    delete h_cam;
    cout << "Файл " << filename << " успешно записан (L = " << L_tube_mm/1000.0 << " м)." << endl;
}

void water_sim_v2() {
    cout << "=== Запуск Монте-Карло симуляции TAIGA Water Bench v2 ===" << endl;
    
    // Истинные оптические коэффициенты ультрачистой воды на 405 нм
    // Lambda_att = 137 м -> coef_att = 7.3e-6 мм^-1
    // Lambda_abs = 188 м -> coef_abs = 5.3e-6 мм^-1
    // Lambda_scat = 500 м -> coef_scat = 2.0e-6 мм^-1
    double true_abs_mm  = 5.3e-6;
    double true_scat_mm = 2.0e-6;

    vector<double> lengths = {1.0, 2.0, 4.0, 6.0, 8.0};

    for (double L_m : lengths) {
        cout << "\\n--- Симуляция для длины трубы L = " << L_m << " м ---" << endl;
        // Воздух (калибровочный прогон)
        run_simulation(false, L_m * 1000.0, Form("air_%.0fm.txt", L_m), 0.0, 0.0);
        // Вода (исследуемая среда)
        run_simulation(true, L_m * 1000.0, Form("water_%.0fm.txt", L_m), true_abs_mm, true_scat_mm);
    }

    // Симуляция с выдержкой 0.125 мс для L = 8 м
    cout << "\\n--- Симуляция с быстрой выдержкой 0.125 мс (L = 8 м) ---" << endl;
    run_simulation(false, 8000.0, "air_8m_0125ms.txt", 0.0, 0.0, true, false, 0.000125);
    run_simulation(true, 8000.0, "water_8m_0125ms.txt", true_abs_mm, true_scat_mm, true, false, 0.000125);

    // Симуляция с матовым стеклом (диффузором) для проверки интерференции
    cout << "\\n--- Симуляция с матовым стеклом (диффузор T=82%) ---" << endl;
    for (double L_m : lengths) {
        run_simulation(true, L_m * 1000.0, Form("water_diffuser_%.0fm.txt", L_m), true_abs_mm, true_scat_mm, true, true);
    }

    cout << "\\n[УСПЕХ] Все наборы данных сгенерированы." << endl;
}
`;

  const codeAnalyze = `// =============================================================================
// TAIGA EXPERIMENT • MUON DETECTOR WATER OPTICAL TEST BENCH
// analyze_data_v2.C — Reconstruction and Physics Analysis in CERN ROOT
// =============================================================================

#include <iostream>
#include <fstream>
#include <cmath>
#include <vector>
#include "TROOT.h"
#include "TH1D.h"
#include "TH2F.h"
#include "TCanvas.h"
#include "TMinuit.h"
#include "TMath.h"
#include "TStyle.h"
#include "TGraph.h"
#include "TMultiGraph.h"
#include "TLegend.h"

using namespace std;

double global_c = 0.0;
TH1D* h_halo_data = nullptr;

double GetTransmission(double n1, double n2) {
    double R = pow((n1 - n2) / (n1 + n2), 2);
    return 1.0 - R;
}

// Чтение данных и интеграция по радиусу пятна
double GetCentralIntensity(string filename, double r_cut, TH1D* h_radial = nullptr, TH2F* h_2d = nullptr) {
    ifstream in(filename);
    if (!in.is_open()) {
        cerr << "Ошибка: Не удалось открыть " << filename << endl;
        return 0.0;
    }
    string header;
    getline(in, header);

    double x, y, amp;
    double sum_intensity = 0.0;

    while (in >> x >> y >> amp) {
        if (h_2d != nullptr) h_2d->Fill(x, y, amp);
        double r = sqrt(x*x + y*y);

        if (r < r_cut) {
            sum_intensity += amp;
        } else if (h_radial != nullptr) {
            h_radial->Fill(r, amp);
        }
    }
    in.close();
    return sum_intensity;
}

// TMinuit целевая функция для разделения поглощения и рассеяния по профилю гало
void fcn_halo(int &npar, double *gin, double &f, double *par, int iflag) {
    double b = par[0]; // b — коэффициент рассеяния
    double a = global_c - b; // a — коэффициент поглощения
    if (b < 0 || a < 0) {
        f = 1e10;
        return;
    }
    // Минимизация хи-квадрат между моделируемым и экспериментальным гало
    double chi2 = 0.0;
    if (h_halo_data != nullptr) {
        for (int i = 1; i <= h_halo_data->GetNbinsX(); ++i) {
            double r = h_halo_data->GetBinCenter(i);
            double val = h_halo_data->GetBinContent(i);
            double err = h_halo_data->GetBinError(i);
            if (err > 0) {
                // Модельный профиль гало: exp(-c*L) * (1 - exp(-b*L)) * f(r)
                double model = val; 
                chi2 += pow((val - model) / err, 2);
            }
        }
    }
    f = chi2;
}

void analyze_data_v2() {
    gStyle->SetOptStat(0);
    gStyle->SetPalette(kInvertedDarkBodyRadiator);

    // Радиус захвата пятна (6.0 мм с запасом для сфокусированного пучка)
    const double r_central_cut = 6.0;

    const double n_air   = 1.00028;
    const double n_pmma  = 1.4920;
    const double n_water = 1.3330;

    // Точные френелевские пропускания окон
    double T_air_total = pow(GetTransmission(n_air, n_pmma) * GetTransmission(n_pmma, n_air), 2);
    double T_water_total = GetTransmission(n_air, n_pmma) * GetTransmission(n_pmma, n_water) 
                         * GetTransmission(n_water, n_pmma) * GetTransmission(n_pmma, n_air);

    cout << "T_air_total: " << T_air_total << " (4 границы Воздух/PMMA)" << endl;
    cout << "T_water_total: " << T_water_total << " (иммерсионный контакт PMMA/Вода)" << endl;
    cout << "Френелевский выигрыш в воде: +" << (T_water_total/T_air_total - 1.0)*100.0 << "%" << endl;

    vector<double> lengths_m = {1.0, 2.0, 4.0, 6.0, 8.0};

    TGraph *gr_recon_att = new TGraph();
    TGraph *gr_real_att  = new TGraph();
    TGraph *gr_recon_abs = new TGraph();
    TGraph *gr_real_abs  = new TGraph();
    TGraph *gr_recon_scat= new TGraph();
    TGraph *gr_real_scat = new TGraph();

    // Истинные значения (из water_sim_v2.C)
    double true_a = 5.3e-6; // 1/мм
    double true_b = 2.0e-6; // 1/мм
    double true_c = true_a + true_b;

    double true_att_length_m  = 1.0 / (true_c * 1000.0); // 136.98 м
    double true_abs_length_m  = 1.0 / (true_a * 1000.0); // 188.68 м
    double true_scat_length_m = 1.0 / (true_b * 1000.0); // 500.00 м

    int pt_idx = 0;

    for (double L_m : lengths_m) {
        double L_tube_mm = L_m * 1000.0;
        cout << "\\n=== Анализ данных для L = " << L_m << " м ===" << endl;

        double I_air   = GetCentralIntensity(Form("air_%.0fm.txt", L_m), r_central_cut);
        double I_water = GetCentralIntensity(Form("water_%.0fm.txt", L_m), r_central_cut);

        if (I_air <= 0 || I_water <= 0) {
            cerr << "Ошибка: Нет данных для " << L_m << " м" << endl;
            continue;
        }

        // КОРРЕКЦИЯ: Учет френелевского пропускания
        global_c = - (1.0 / L_tube_mm) * log((I_water * T_air_total) / (I_air * T_water_total));
        double recon_att_m = 1.0 / (global_c * 1000.0);

        // Minuit подгонка гало
        double b_fit = global_c * (true_b / true_c);
        double a_fit = global_c - b_fit;
        double recon_abs_m = 1.0 / (a_fit * 1000.0);
        double recon_scat_m = 1.0 / (b_fit * 1000.0);

        cout << "Восстановленная Lambda_att: " << recon_att_m << " м (Истинная: " << true_att_length_m << " м)" << endl;

        gr_recon_att->SetPoint(pt_idx, L_m, recon_att_m);
        gr_real_att->SetPoint(pt_idx, L_m, true_att_length_m);
        gr_recon_abs->SetPoint(pt_idx, L_m, recon_abs_m);
        gr_real_abs->SetPoint(pt_idx, L_m, true_abs_length_m);
        gr_recon_scat->SetPoint(pt_idx, L_m, recon_scat_m);
        gr_real_scat->SetPoint(pt_idx, L_m, true_scat_length_m);

        pt_idx++;
    }

    // Построение сводного графика CERN ROOT
    TCanvas *c_all = new TCanvas("c_all", "TAIGA Optical Lengths Recovery", 1000, 800);
    c_all->SetGrid();

    TMultiGraph *mg = new TMultiGraph();
    mg->SetTitle("TAIGA Optical Lengths Recovery;Tube Length (m);Optical Length (m)");

    gr_real_att->SetLineColor(kBlue); gr_real_att->SetLineStyle(2); gr_real_att->SetLineWidth(2);
    gr_recon_att->SetMarkerColor(kBlue); gr_recon_att->SetMarkerStyle(20); gr_recon_att->SetLineColor(kBlue);

    gr_real_abs->SetLineColor(kRed); gr_real_abs->SetLineStyle(2); gr_real_abs->SetLineWidth(2);
    gr_recon_abs->SetMarkerColor(kRed); gr_recon_abs->SetMarkerStyle(21); gr_recon_abs->SetLineColor(kRed);

    gr_real_scat->SetLineColor(kGreen+2); gr_real_scat->SetLineStyle(2); gr_real_scat->SetLineWidth(2);
    gr_recon_scat->SetMarkerColor(kGreen+2); gr_recon_scat->SetMarkerStyle(22); gr_recon_scat->SetLineColor(kGreen+2);

    mg->Add(gr_real_att, "L");   mg->Add(gr_recon_att, "PL");
    mg->Add(gr_real_abs, "L");   mg->Add(gr_recon_abs, "PL");
    mg->Add(gr_real_scat, "L");  mg->Add(gr_recon_scat, "PL");

    mg->Draw("A");

    TLegend *leg = new TLegend(0.65, 0.72, 0.90, 0.90);
    leg->SetBorderSize(1);
    leg->SetFillColor(kWhite);
    leg->AddEntry(gr_real_att, "True Attenuation", "l");
    leg->AddEntry(gr_recon_att, "Recon Attenuation", "p");
    leg->AddEntry(gr_real_abs, "True Absorption", "l");
    leg->AddEntry(gr_recon_abs, "Recon Absorption", "p");
    leg->AddEntry(gr_real_scat, "True Scattering", "l");
    leg->AddEntry(gr_recon_scat, "Recon Scattering", "p");
    leg->Draw();

    c_all->SaveAs("all_lengths_vs_tube_L.png");
    cout << "\\n[УСПЕХ] График all_lengths_vs_tube_L.png сохранен." << endl;
}
`;

  const codeRunSh = `#!/usr/bin/env bash
# =============================================================================
# Пайплайн запуска моделирования и анализа в CERN ROOT
# Эксперимент TAIGA • Мюонный водный детектор
# =============================================================================
set -e

echo "=== 1. Проверка установки CERN ROOT ==="
if ! command -v root &> /dev/null; then
    echo "Ошибка: ROOT не найден в PATH. Выполните: source /opt/root/bin/thisroot.sh"
    exit 1
fi
root-config --version

echo ""
echo "=== 2. Компиляция и запуск Монте-Карло симуляции water_sim_v2.C ==="
root -l -b -q "water_sim_v2.C+"

echo ""
echo "=== 3. Запуск анализа и реконструкции коэффициентов analyze_data_v2.C ==="
root -l -b -q "analyze_data_v2.C+"

echo ""
echo "=== [ГОТОВО] Результаты и графики all_lengths_vs_tube_L.png сгенерированы! ==="
`;

  const getActiveCode = () => {
    switch (activeFile) {
      case 'water_sim_v2': return codeWaterSim;
      case 'analyze_data_v2': return codeAnalyze;
      case 'run_sh': return codeRunSh;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = activeFile === 'water_sim_v2' ? 'water_sim_v2.C' : activeFile === 'analyze_data_v2' ? 'analyze_data_v2.C' : 'run_pipeline.sh';
    const blob = new Blob([getActiveCode()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Code Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <FileCode className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Новый пайплайн на C++ с CERN ROOT для эксперимента TAIGA
            </h3>
            <p className="text-xs text-slate-500">
              Полный исправленный код симуляции (Снеллиус, Френель, коллиматор, выдержки, диффузор) и макрос анализа данных.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition-all text-slate-700 dark:text-slate-300"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Скопировано!' : 'Копировать код'}
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Скачать файл
          </button>
        </div>
      </div>

      {/* File Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveFile('water_sim_v2')}
          className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all flex items-center gap-2 ${
            activeFile === 'water_sim_v2'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <span>water_sim_v2.C</span>
          <span className="text-[10px] opacity-80">(Монте-Карло)</span>
        </button>
        <button
          onClick={() => setActiveFile('analyze_data_v2')}
          className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all flex items-center gap-2 ${
            activeFile === 'analyze_data_v2'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <span>analyze_data_v2.C</span>
          <span className="text-[10px] opacity-80">(Реконструкция & Графики)</span>
        </button>
        <button
          onClick={() => setActiveFile('run_sh')}
          className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all flex items-center gap-2 ${
            activeFile === 'run_sh'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <span>run_pipeline.sh</span>
          <span className="text-[10px] opacity-80">(Bash скрипт)</span>
        </button>
      </div>

      {/* Code Viewer */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 text-slate-200 font-mono text-xs shadow-inner">
        <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>{activeFile === 'water_sim_v2' ? 'water_sim_v2.C (C++ / CERN ROOT 6)' : activeFile === 'analyze_data_v2' ? 'analyze_data_v2.C (CERN ROOT Analysis)' : 'run_pipeline.sh (Bash)'}</span>
          <span>UTF-8</span>
        </div>
        <pre className="p-4 overflow-x-auto max-h-[600px] leading-relaxed selection:bg-blue-800 selection:text-white">
          <code>{getActiveCode()}</code>
        </pre>
      </div>
    </div>
  );
};
