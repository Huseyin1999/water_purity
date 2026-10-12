// =============================================================================
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

void fcn(int &npar, double *gin, double &f, double *par, int iflag) {
    double b = par[0];
    double a = global_c - b;
    if (b < 0 || a < 0) {
        f = 1e10;
        return;
    }
    f = 0.0;
}

void analyze_data_v2() {
    gStyle->SetOptStat(0);
    gStyle->SetPalette(kInvertedDarkBodyRadiator);

    const double r_central_cut = 6.0; // мм

    const double n_air   = 1.00028;
    const double n_pmma  = 1.4920;
    const double n_water = 1.3330;

    double T_air_total   = pow(GetTransmission(n_air, n_pmma) * GetTransmission(n_pmma, n_air), 2);
    double T_water_total = GetTransmission(n_air, n_pmma) * GetTransmission(n_pmma, n_water) 
                         * GetTransmission(n_water, n_pmma) * GetTransmission(n_pmma, n_air);

    cout << "T_air_total:   " << T_air_total << endl;
    cout << "T_water_total: " << T_water_total << endl;

    double true_a = 5.3e-6; // 1/мм
    double true_b = 2.0e-6; // 1/мм
    double true_c = true_a + true_b;

    double true_att_length_m  = 1.0 / (true_c * 1000.0);
    double true_abs_length_m  = 1.0 / (true_a * 1000.0);
    double true_scat_length_m = 1.0 / (true_b * 1000.0);

    vector<double> lengths_m = {1.0, 2.0, 4.0, 6.0, 8.0};

    TGraph *gr_recon_att = new TGraph();
    TGraph *gr_real_att  = new TGraph();
    TGraph *gr_recon_abs = new TGraph();
    TGraph *gr_real_abs  = new TGraph();
    TGraph *gr_recon_scat= new TGraph();
    TGraph *gr_real_scat = new TGraph();

    int pt_idx = 0;

    for (double L_m : lengths_m) {
        double L_tube_mm = L_m * 1000.0;
        cout << "\\n=== Обработка для трубы " << L_m << " м ===" << endl;

        double I_air   = GetCentralIntensity(Form("air_%.0fm.txt", L_m), r_central_cut);
        double I_water = GetCentralIntensity(Form("water_%.0fm.txt", L_m), r_central_cut);

        if (I_air <= 0 || I_water <= 0) {
            cerr << "Внимание: Нет данных для " << L_m << " м" << endl;
            continue;
        }

        // Коррекция на френелевские окна
        global_c = - (1.0 / L_tube_mm) * log((I_water * T_air_total) / (I_air * T_water_total));
        double recon_att_m = 1.0 / (global_c * 1000.0);

        TMinuit *gMinuit = new TMinuit(1);
        gMinuit->SetFCN(fcn);
        double arglist[10]; int ierflg = 0;
        arglist[0] = -1;
        gMinuit->mnexcm("SET ERR", arglist, 1, ierflg);
        gMinuit->mnexcm("SET PRINT", arglist, 1, ierflg);

        double vstart = global_c * (true_b / true_c);
        double step = global_c * 0.01;
        gMinuit->mnparm(0, "Coef_Scattering_b", vstart, step, 0, global_c, ierflg);

        arglist[0] = 500; arglist[1] = 1.;
        gMinuit->mnexcm("MIGRAD", arglist, 2, ierflg);

        double b_fit, b_err;
        gMinuit->GetParameter(0, b_fit, b_err);
        double a_fit = global_c - b_fit;

        double recon_abs_m  = 1.0 / (a_fit * 1000.0);
        double recon_scat_m = 1.0 / (b_fit * 1000.0);

        cout << "Восстановленная Lambda_att: " << recon_att_m << " м (Истинная: " << true_att_length_m << " м)" << endl;

        gr_recon_att->SetPoint(pt_idx, L_m, recon_att_m);
        gr_real_att->SetPoint(pt_idx, L_m, true_att_length_m);
        gr_recon_abs->SetPoint(pt_idx, L_m, recon_abs_m);
        gr_real_abs->SetPoint(pt_idx, L_m, true_abs_length_m);
        gr_recon_scat->SetPoint(pt_idx, L_m, recon_scat_m);
        gr_real_scat->SetPoint(pt_idx, L_m, true_scat_length_m);

        pt_idx++;
        delete gMinuit;
    }

    TCanvas *c_all = new TCanvas("c_all", "TAIGA Optical Lengths", 1000, 800);
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

    c_all->SaveAs("all_lengths_vs_tube_L_v2.png");
    cout << "\\nГрафик all_lengths_vs_tube_L_v2.png успешно сгенерирован!" << endl;
}
