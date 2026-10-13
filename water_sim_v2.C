// =============================================================================
// TAIGA EXPERIMENT • MUON DETECTOR WATER OPTICAL TEST BENCH
// water_sim_v2.C — Monte Carlo Ray Tracing Simulation in CERN ROOT
// =============================================================================
// Физические исправления:
// 1. Преломление по закону Снеллиуса на границах Воздух / PMMA / Вода.
// 2. Френелевское пропускание с учетом показателей:
//    n_air = 1.00028, n_pmma = 1.4920, n_water = 1.3330.
//    (В пустой трубе 4 границы Воздух/PMMA: T ≈ 0.853;
//     в воде 2 границы Воздух/PMMA и 2 границы PMMA/Вода: T ≈ 0.918).
// 3. Фокусирующая линза перед лазером: формирует параллельный пучок диаметром <= 20 мм,
//    предотвращая касание стенок трубы D = 50 мм (R = 25 мм) на длине до 8 м.
// 4. Расчет для выдержек 1.0 мс и 0.125 мс при мощности лазера 5 мВт (405 нм).
// 5. Опция диффузора (матового стекла) для усреднения спеклов и интерференции Фабри-Перо.
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

using namespace std;

struct OpticalPhoton {
    double x, y, z;       // Координаты в мм
    double dx, dy, dz;    // Направляющие косинусы
    double time_ns;       // Время пролета в нс
    bool is_alive;
};

// Пропускание Френеля для нормального падения
inline double GetFresnelT(double n1, double n2) {
    double r = pow((n1 - n2) / (n1 + n2), 2);
    return 1.0 - r;
}

// Преломление Снеллиуса: n1 * sin(th1) = n2 * sin(th2)
inline void ApplySnellRefraction(OpticalPhoton &p, double n1, double n2) {
    double ratio = n1 / n2;
    p.dx *= ratio;
    p.dy *= ratio;
    double d_trans_sq = p.dx*p.dx + p.dy*p.dy;
    if (d_trans_sq < 1.0) {
        p.dz = sqrt(1.0 - d_trans_sq);
    } else {
        p.is_alive = false; // Полное внутреннее отражение
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
    double exposure_s = 0.001 // 1.0 мс по умолчанию
) {
    const double lambda_nm = 405.0;            // Длина волны 405 нм
    const double power_W   = 5.0e-3;           // 5 мВт
    const double R_tube    = 25.0;             // Радиус трубы 25 мм (D = 50 мм)
    const double wall_abs  = 0.20;             // 20% поглощение стенками трубы
    const double win_thick = 5.0;              // Толщина окна PMMA 5 мм

    const double n_air   = 1.00028;
    const double n_pmma  = 1.4920;             // PMMA
    const double n_water = 1.3330;             // Вода при 405 нм

    const int pixels_x     = 3000;
    const int pixels_y     = 2000;
    const double pixel_sz  = 0.008;            // 8 мкм
    const double QE        = 0.20;             // 20% QE

    // Параметры пучка лазера с линзой:
    // Коллимация обеспечивает перетяжку пучка с радиусом sigma ~ 4.0 мм (D ~ 16 мм <= 20 мм на 8 м)
    double beam_sigma = use_focusing_lens ? 4.0 : 0.8;
    double div_sigma  = use_focusing_lens ? 0.00008 : 0.0015;

    const double c_vac = 299.792458;
    const double v_medium = is_water ? (c_vac / n_water) : (c_vac / n_air);

    // Расчет фотонов
    const double E_photon = (6.62607e-34 * 3e8) / (lambda_nm * 1e-9);
    const double total_real_photons = (power_W / E_photon) * exposure_s;
    const int n_sim_photons = 5000000; // 5 млн макрофотонов
    const double weight = total_real_photons / n_sim_photons;

    // Френелевское пропускание
    double T_in, T_out;
    if (is_water) {
        T_in  = GetFresnelT(n_air, n_pmma) * GetFresnelT(n_pmma, n_water);
        T_out = GetFresnelT(n_water, n_pmma) * GetFresnelT(n_pmma, n_air);
    } else {
        T_in  = GetFresnelT(n_air, n_pmma) * GetFresnelT(n_pmma, n_air);
        T_out = GetFresnelT(n_air, n_pmma) * GetFresnelT(n_pmma, n_air);
    }

    double coef_att = is_water ? (coef_abs_mm + coef_scat_mm) : 0.0;
    double diffuser_T = use_diffuser ? 0.82 : 1.0;

    double det_x = pixels_x * pixel_sz;
    double det_y = pixels_y * pixel_sz;
    TH2F *h_cam = new TH2F("h_cam", "Camera", pixels_x, -det_x/2.0, det_x/2.0, pixels_y, -det_y/2.0, det_y/2.0);

    TRandom3 rnd(0);

    for (int i = 0; i < n_sim_photons; ++i) {
        OpticalPhoton p;
        p.x = rnd.Gaus(0, beam_sigma);
        p.y = rnd.Gaus(0, beam_sigma);
        p.z = 0.0;
        p.time_ns = 0.0;
        p.is_alive = true;

        double theta = fabs(rnd.Gaus(0, div_sigma));
        double phi = rnd.Uniform(0, 2 * TMath::Pi());
        p.dx = sin(theta) * cos(phi);
        p.dy = sin(theta) * sin(phi);
        p.dz = cos(theta);

        if (rnd.Uniform() > T_in) continue;

        if (is_water) {
            ApplySnellRefraction(p, n_air, n_water);
        }

        while (p.is_alive && p.z < L_tube_mm) {
            double L_free = 1e12;
            if (is_water && coef_att > 0) {
                L_free = -log(rnd.Uniform()) / coef_att;
            }

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

            double S_end = (L_tube_mm - p.z) / p.dz;
            if (S_end < 0) S_end = 1e12;

            double S_min = std::min({L_free, S_wall, S_end});

            p.x += p.dx * S_min;
            p.y += p.dy * S_min;
            p.z += p.dz * S_min;
            p.time_ns += S_min / v_medium;

            if (S_min == S_end) {
                break;
            } else if (S_min == S_wall) {
                if (rnd.Uniform() < wall_abs) {
                    p.is_alive = false;
                } else {
                    double nx = p.x / R_tube;
                    double ny = p.y / R_tube;
                    double dot = p.dx * nx + p.dy * ny;
                    p.dx -= 2 * dot * nx;
                    p.dy -= 2 * dot * ny;
                }
            } else if (is_water) {
                if (rnd.Uniform() > (coef_scat_mm / coef_att)) {
                    p.is_alive = false;
                } else {
                    // Релеевское рассеяние
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

        if (p.is_alive && p.z >= L_tube_mm) {
            if (is_water) {
                ApplySnellRefraction(p, n_water, n_air);
            }

            if (rnd.Uniform() <= T_out && rnd.Uniform() <= QE && rnd.Uniform() <= diffuser_T) {
                if (use_diffuser) {
                    p.x += rnd.Gaus(0, 0.4);
                    p.y += rnd.Gaus(0, 0.4);
                }
                h_cam->Fill(p.x, p.y, weight);
            }
        }
    }

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
    cout << "Файл " << filename << " успешно записан (" << L_tube_mm/1000.0 << " м)." << endl;
}

void water_sim_v2() {
    cout << "=== Старт Монте-Карло симуляции water_sim_v2 ===" << endl;
    double true_a = 5.3e-6; // 1/мм
    double true_b = 2.0e-6; // 1/мм

    vector<double> lengths = {1.0, 2.0, 4.0, 6.0, 8.0};
    for (double L_m : lengths) {
        run_simulation(false, L_m * 1000.0, Form("air_%.0fm.txt", L_m), 0.0, 0.0);
        run_simulation(true,  L_m * 1000.0, Form("water_%.0fm.txt", L_m), true_a, true_b);
    }
    
    // Экспозиция 0.125 мс для 8 м
    run_simulation(false, 8000.0, "air_8m_0125ms.txt", 0.0, 0.0, true, false, 0.000125);
    run_simulation(true,  8000.0, "water_8m_0125ms.txt", true_a, true_b, true, false, 0.000125);

    // Матовое стекло (диффузор)
    for (double L_m : lengths) {
        run_simulation(true, L_m * 1000.0, Form("water_diffuser_%.0fm.txt", L_m), true_a, true_b, true, true);
    }
    cout << "Все симуляции завершены." << endl;
}
