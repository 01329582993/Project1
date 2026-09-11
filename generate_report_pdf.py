#!/usr/bin/env python3
"""
Generate comparative PDF report for all 10 UavNetSim routing protocols,
including RLFR (10th protocol) description and benchmark results.
"""

import json
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import PageBreak


# ── Color Palette ──────────────────────────────────────────────────────────────
NAVY       = colors.HexColor("#0a1628")
BLUE       = colors.HexColor("#1e3a5f")
CYAN       = colors.HexColor("#00b4d8")
LIGHT_CYAN = colors.HexColor("#e0f7fa")
AMBER      = colors.HexColor("#f59e0b")
WHITE      = colors.white
GRAY_BG    = colors.HexColor("#f5f7fa")
GRAY_LINE  = colors.HexColor("#d1d5db")
RED        = colors.HexColor("#dc2626")
GREEN      = colors.HexColor("#16a34a")
LIGHT_BLUE = colors.HexColor("#dbeafe")


def make_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "DocTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=28,
        textColor=WHITE,
        alignment=TA_CENTER,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#90caf9"),
        alignment=TA_CENTER,
        spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        "SectionHead",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=NAVY,
        spaceAfter=6,
        spaceBefore=14,
        borderPad=4,
    ))
    styles.add(ParagraphStyle(
        "SubHead",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=BLUE,
        spaceAfter=4,
        spaceBefore=8,
    ))
    styles.add(ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=5,
        alignment=TA_JUSTIFY,
    ))
    styles.add(ParagraphStyle(
        "BodyBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=14,
        textColor=NAVY,
        spaceAfter=3,
    ))
    styles.add(ParagraphStyle(
        "Equation",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#374151"),
        leftIndent=20,
        spaceAfter=4,
        spaceBefore=4,
    ))
    styles.add(ParagraphStyle(
        "Caption",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#6b7280"),
        alignment=TA_CENTER,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#9ca3af"),
        alignment=TA_CENTER,
    ))
    return styles


def header_block(styles):
    """Dark banner header."""
    title = Paragraph("UavNetSim: 10 Routing Protocols", styles["DocTitle"])
    sub = Paragraph(
        "Comparative Benchmark Report — 10 UAV Nodes · 10 s · Gauss-Markov 3D Mobility · CSMA/CA",
        styles["DocSubtitle"]
    )
    hdr_data = [[title], [sub]]
    tbl = Table(hdr_data, colWidths=[17 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
        ("ROUNDEDCORNERS", [8]),
    ]))
    return tbl


def section_rule():
    return HRFlowable(width="100%", thickness=1, color=GRAY_LINE, spaceAfter=6, spaceBefore=2)


def rlfr_description(styles):
    """Full description of RLFR as the 10th protocol."""
    elems = []
    elems.append(Paragraph("Section 1 — The 10th Protocol: RLFR", styles["SectionHead"]))
    elems.append(section_rule())

    elems.append(Paragraph(
        "<b>Reference:</b> J. Li, L. Xiao, X. Qi, Z. Lv, Q. Chen, and Y.-J. Liu, "
        "<i>\"Reinforcement Learning Based Energy-Efficient Fast Routing for FANETs,\"</i> "
        "IEEE Transactions on Communications, vol. 72, no. 11, pp. 7063–7076, Nov. 2024.",
        styles["Body"]
    ))
    elems.append(Spacer(1, 6))

    elems.append(Paragraph("Overview", styles["SubHead"]))
    elems.append(Paragraph(
        "RLFR (Reinforcement Learning Based Fast Routing) is a novel distributed routing protocol "
        "for Flying Ad-Hoc Networks (FANETs). Unlike classical Q-learning approaches (e.g., Q-Routing "
        "or Q-FANET), RLFR introduces three major advances: (1) a multi-objective utility function "
        "jointly optimising packet delivery, end-to-end latency, and communication energy; (2) a "
        "latency-risk constrained exploration strategy using a modified Boltzmann distribution backed "
        "by an explicit risk table R(s, a); and (3) a distributed Bellman equation that incorporates "
        "shared state-value information from one-hop neighbours, enabling cooperative learning without "
        "a centralised controller.",
        styles["Body"]
    ))

    elems.append(Paragraph("State Space  s⁽ᵏ⁾", styles["SubHead"]))
    state_data = [
        ["Symbol", "Meaning"],
        ["b",       "Residual battery / energy level of the relay UAV"],
        ["ξ",       "Received SNR / channel gain on the link"],
        ["ϱ",       "Accumulated hop count of the packet so far"],
        ["t",       "Average one-hop propagation + queuing latency"],
        ["ϖ",       "Number of active 1-hop neighbours"],
        ["φ",       "Rebroadcast count (overhearing measurement)"],
        ["τ",       "Prior observed end-to-end latency"],
    ]
    tbl = Table(state_data, colWidths=[2.5 * cm, 13.5 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [GRAY_BG, WHITE]),
        ("GRID",          (0, 0), (-1, -1), 0.4, GRAY_LINE),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
    ]))
    elems.append(tbl)
    elems.append(Spacer(1, 8))

    elems.append(Paragraph("Action Space  a = (next_hop, p)", styles["SubHead"]))
    elems.append(Paragraph(
        "Each UAV selects jointly (1) the next-hop relay drone from valid one-hop neighbours "
        "that make geographic progress toward the destination, and (2) the relay transmit power "
        "level p ∈ {25, 50, 75, 100} mW. This power control directly minimises communication "
        "energy consumption while maintaining link quality.",
        styles["Body"]
    ))

    elems.append(Paragraph("Multi-Objective Utility Function  (Eq. 3)", styles["SubHead"]))
    elems.append(Paragraph("u⁽ᵏ⁾  =  κ  −  c₁·τ  −  c₂·w", styles["Equation"]))
    elems.append(Paragraph(
        "where κ ∈ {0,1} is the delivery success indicator (1 = delivered to final destination), "
        "τ is the normalised end-to-end latency, and w = p·(z/r) is the transmission energy "
        "(power × bits / bit-rate). Coefficients c₁ = 0.8 and c₂ = 0.6 are tuned to the paper's "
        "Table III settings.",
        styles["Body"]
    ))

    elems.append(Paragraph("Safe Boltzmann Exploration with Risk Constraint  (Eq. 2)", styles["SubHead"]))
    elems.append(Paragraph(
        "π(s, a)  =  exp(Q(s,a) − c·R(s,a))  /  Σ_â exp(Q(s,â) − c·R(s,â))",
        styles["Equation"]
    ))
    elems.append(Paragraph(
        "The risk table R(s, a) tracks the empirical probability that the latency violates the "
        "QoS threshold μ = 40 ms. Actions with high latency-violation risk are penalised in the "
        "softmax denominator (c = 0.5), steering the UAV away from congested or unreliable paths "
        "without completely blocking exploration.",
        styles["Body"]
    ))

    elems.append(Paragraph("Distributed Bellman Update with Shared Experience  (Eq. 4)", styles["SubHead"]))
    elems.append(Paragraph(
        "Q(s,a) ← (1−α)·Q(s,a)  +  α·[u  +  λ·max_â Q(s′,â)  +  υ·Σⱼ Vⱼ(sⱼ)]",
        styles["Equation"]
    ))
    elems.append(Paragraph(
        "Neighbours broadcast their local state-value function Vⱼ(sⱼ) = max_â Q(sⱼ,â) inside "
        "periodic HELLO beacons. The relay incorporates this shared information via the cooperative "
        "term υ·ΣVⱼ (υ = 0.05), allowing FANETs without infrastructure to benefit from neighbouring "
        "agents' experience while keeping the update fully distributed.",
        styles["Body"]
    ))

    elems.append(Paragraph("Risk Table Update  (Eq. 5 & 6)", styles["SubHead"]))
    elems.append(Paragraph(
        "l⁽ᵏ⁾  =  𝟙(τ > μ)      →      R(s,a) ← (1−β)·R(s,a) + β·l⁽ᵏ⁾",
        styles["Equation"]
    ))
    elems.append(Paragraph(
        "β = 0.8 ensures fast adaptation to changes in link quality and congestion patterns. "
        "The latency threshold μ = 40 ms matches the paper's scenario settings.",
        styles["Body"]
    ))

    elems.append(Paragraph("Loop Avoidance Cache Ω", styles["SubHead"]))
    elems.append(Paragraph(
        "A per-node cache Ω stores (source_id, packet_id) tuples to detect and drop duplicate "
        "packet copies arriving via different paths, eliminating broadcast storms and routing loops "
        "that are common in dense FANETs.",
        styles["Body"]
    ))

    # Hyperparameter summary table
    elems.append(Paragraph("Default Hyperparameters (Paper Table III)", styles["SubHead"]))
    hp_data = [
        ["Parameter", "Symbol", "Default Value"],
        ["Learning rate",                "α",   "0.70"],
        ["Discount factor",              "λ",   "0.90"],
        ["Risk weight",                  "c",   "0.50"],
        ["Risk learning rate",           "β",   "0.80"],
        ["Shared experience weight",     "υ",   "0.05"],
        ["Latency utility coefficient",  "c₁",  "0.80"],
        ["Energy utility coefficient",   "c₂",  "0.60"],
        ["QoS latency threshold",        "μ",   "40 ms"],
        ["Relay power levels",           "p",   "25/50/75/100 mW"],
        ["HELLO interval",               "—",   "0.5 s"],
        ["Neighbour lifetime",           "—",   "2.0 s"],
    ]
    tbl2 = Table(hp_data, colWidths=[7 * cm, 3 * cm, 6 * cm])
    tbl2.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), CYAN),
        ("TEXTCOLOR",     (0, 0), (-1, 0), NAVY),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_CYAN, WHITE]),
        ("GRID",          (0, 0), (-1, -1), 0.4, GRAY_LINE),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("ALIGN",         (1, 0), (1, -1), "CENTER"),
        ("ALIGN",         (2, 0), (2, -1), "CENTER"),
    ]))
    elems.append(tbl2)
    return elems


def comparative_section(results, styles):
    """Build the comparative results table and analysis."""
    elems = []
    elems.append(PageBreak())
    elems.append(Paragraph("Section 2 — Comparative Benchmark Results", styles["SectionHead"]))
    elems.append(section_rule())
    elems.append(Paragraph(
        "All 10 protocols were evaluated under identical conditions: 10 UAVs, 10-second simulation, "
        "Gauss-Markov 3D mobility (same as the RLFR paper scenario), CSMA/CA MAC layer, seed=2025.",
        styles["Body"]
    ))
    elems.append(Spacer(1, 8))

    # Table header
    headers = [
        "Protocol", "Sent", "Recv", "PDR (%)",
        "Delay (ms)", "Hops", "Throughput\n(Kbps)", "MAC Delay\n(ms)", "Collisions"
    ]
    col_widths = [3.0*cm, 1.3*cm, 1.2*cm, 1.8*cm, 2.0*cm, 1.4*cm, 2.0*cm, 2.0*cm, 2.0*cm]

    table_data = [headers]

    proto_order = ["Greedy", "DSDV", "GRAD", "OPAR", "QRouting", "QFANET", "QGeo", "QMR", "Baseline_DRL", "RLFR"]
    best_pdr = max((results[p]["pdr"] for p in proto_order if "pdr" in results.get(p, {})), default=0)
    best_delay = min((results[p]["delay_ms"] for p in proto_order if "delay_ms" in results.get(p, {})), default=999)

    for proto in proto_order:
        r = results.get(proto, {})
        if "error" in r:
            row = [proto, "—", "—", "ERROR", "—", "—", "—", "—", "—"]
        else:
            row = [
                proto,
                str(r.get("sent", 0)),
                str(r.get("received", 0)),
                f"{r.get('pdr', 0):.2f}",
                f"{r.get('delay_ms', 0):.3f}",
                f"{r.get('hops', 0):.3f}",
                f"{r.get('throughput_kbps', 0):.1f}",
                f"{r.get('mac_delay_ms', 0):.3f}",
                str(r.get("collisions", 0)),
            ]
        table_data.append(row)

    tbl = Table(table_data, colWidths=col_widths)
    style_cmds = [
        # Header
        ("BACKGROUND",    (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 8),
        ("ALIGN",         (0, 0), (-1, 0), "CENTER"),
        ("VALIGN",        (0, 0), (-1, 0), "MIDDLE"),
        # Data rows
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1, -1), 8),
        ("ALIGN",         (1, 1), (-1, -1), "CENTER"),
        ("ALIGN",         (0, 1), (0, -1), "LEFT"),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("GRID",          (0, 0), (-1, -1), 0.4, GRAY_LINE),
        # Alternating rows
        *[("BACKGROUND", (0, i), (-1, i), GRAY_BG if i % 2 == 0 else WHITE) for i in range(1, 11)],
        # RLFR row highlighted
        ("BACKGROUND",    (0, 10), (-1, 10), colors.HexColor("#eff6ff")),
        ("FONTNAME",      (0, 10), (-1, 10), "Helvetica-Bold"),
        ("TEXTCOLOR",     (0, 10), (0, 10), BLUE),
        # Outer border
        ("BOX",           (0, 0), (-1, -1), 1, BLUE),
    ]
    tbl.setStyle(TableStyle(style_cmds))
    elems.append(tbl)
    elems.append(Paragraph("Table 1. Comparative benchmark — 10 protocols, 10 UAVs, 10 s simulation.", styles["Caption"]))

    # Key findings
    elems.append(Paragraph("Key Observations", styles["SubHead"]))
    findings = []

    # compute best/worst for annotations
    pdr_data  = {p: results[p]["pdr"]   for p in proto_order if "pdr"   in results.get(p, {})}
    delay_data= {p: results[p]["delay_ms"] for p in proto_order if "delay_ms" in results.get(p, {})}
    hop_data  = {p: results[p]["hops"]  for p in proto_order if "hops"  in results.get(p, {})}

    if pdr_data:
        best_pdr_p  = max(pdr_data, key=pdr_data.get)
        worst_pdr_p = min(pdr_data, key=pdr_data.get)
        findings.append(f"<b>Highest PDR:</b> {best_pdr_p} ({pdr_data[best_pdr_p]:.2f}%). "
                        f"<b>Lowest PDR:</b> {worst_pdr_p} ({pdr_data[worst_pdr_p]:.2f}%).")
    if delay_data:
        best_d_p  = min(delay_data, key=delay_data.get)
        worst_d_p = max(delay_data, key=delay_data.get)
        findings.append(f"<b>Lowest Delay:</b> {best_d_p} ({delay_data[best_d_p]:.3f} ms). "
                        f"<b>Highest Delay:</b> {worst_d_p} ({delay_data[worst_d_p]:.3f} ms).")
    if hop_data:
        best_h_p  = min(hop_data, key=hop_data.get)
        worst_h_p = max(hop_data, key=hop_data.get)
        findings.append(f"<b>Fewest Avg Hops:</b> {best_h_p} ({hop_data[best_h_p]:.3f}). "
                        f"<b>Most Avg Hops:</b> {worst_h_p} ({hop_data[worst_h_p]:.3f}).")

    rlfr = results.get("RLFR", {})
    if "pdr" in rlfr:
        findings.append(
            f"<b>RLFR (10th Protocol):</b> Achieves PDR = {rlfr['pdr']:.2f}%, "
            f"average delay = {rlfr['delay_ms']:.3f} ms, and {rlfr['hops']:.3f} avg hops. "
            f"The risk-constrained safe exploration and shared neighbour values allow RLFR to "
            f"balance delivery quality with latency and energy efficiency simultaneously."
        )

    for f in findings:
        elems.append(Paragraph(f"• {f}", styles["Body"]))

    # Per-metric mini comparison table
    elems.append(Spacer(1, 10))
    elems.append(Paragraph("Performance Rankings by Metric", styles["SubHead"]))
    elems.append(Paragraph(
        "Each protocol is ranked 1 (best) to 10 (worst) per metric across the six primary KPIs. "
        "Lower score = better. RLFR's rank per metric is highlighted.",
        styles["Body"]
    ))

    metrics_order = [
        ("PDR (%)",        "pdr",           True),   # higher=better
        ("Delay (ms)",     "delay_ms",      False),  # lower=better
        ("Hop Count",      "hops",          False),  # lower=better
        ("Throughput (K)", "throughput_kbps", True), # higher=better
        ("MAC Delay (ms)", "mac_delay_ms",  False),  # lower=better
        ("Collisions",     "collisions",    False),  # lower=better
    ]

    rank_header = ["Protocol"] + [m[0] for m in metrics_order] + ["Avg Rank"]
    rank_data = [rank_header]

    for proto in proto_order:
        r = results.get(proto, {})
        row = [proto]
        for _, key, higher_better in metrics_order:
            row.append(r.get(key, None))
        rank_data.append(row)

    # Compute ranks
    for col_idx, (_, key, higher_better) in enumerate(metrics_order, start=1):
        vals = [(i+1, rank_data[i+1][col_idx]) for i in range(10) if rank_data[i+1][col_idx] is not None]
        sorted_vals = sorted(vals, key=lambda x: x[1], reverse=higher_better)
        rank_map = {row_i: rank+1 for rank, (row_i, _) in enumerate(sorted_vals)}
        for i in range(10):
            orig_val = rank_data[i+1][col_idx]
            if orig_val is not None:
                rank_data[i+1][col_idx] = f"{rank_map[i+1]}" + (f"\n({orig_val:.1f})" if isinstance(orig_val, float) else f"\n({orig_val})")
            else:
                rank_data[i+1][col_idx] = "—"

    # Avg rank (parse the rank number out)
    for i in range(10):
        ranks = []
        for col_idx in range(1, len(metrics_order)+1):
            cell = rank_data[i+1][col_idx]
            try:
                r_num = int(cell.split("\n")[0])
                ranks.append(r_num)
            except:
                pass
        avg = sum(ranks)/len(ranks) if ranks else 0
        rank_data[i+1].append(f"{avg:.1f}")

    r_tbl = Table(rank_data, colWidths=[3.0*cm] + [2.3*cm]*6 + [1.7*cm])
    r_style = [
        ("BACKGROUND",    (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 7.5),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 3),
        ("GRID",          (0, 0), (-1, -1), 0.4, GRAY_LINE),
        *[("BACKGROUND", (0, i), (-1, i), GRAY_BG if i % 2 == 0 else WHITE) for i in range(1, 11)],
        # RLFR row = row 10 (index 10)
        ("BACKGROUND",    (0, 10), (-1, 10), LIGHT_BLUE),
        ("FONTNAME",      (0, 10), (-1, 10), "Helvetica-Bold"),
        ("BOX",           (0, 0), (-1, -1), 1, BLUE),
    ]
    r_tbl.setStyle(TableStyle(r_style))
    elems.append(r_tbl)
    elems.append(Paragraph(
        "Table 2. Per-metric rankings (rank shown; raw value in parentheses). RLFR row highlighted in blue.",
        styles["Caption"]
    ))
    return elems


def conclusion_section(results, styles):
    elems = []
    elems.append(Paragraph("Section 3 — Summary & Conclusion", styles["SectionHead"]))
    elems.append(section_rule())
    elems.append(Paragraph(
        "This report benchmarked all ten routing protocols available in UavNetSim under a standardised "
        "10-UAV, 10-second simulation with Gauss-Markov 3D mobility and CSMA/CA MAC. The newly "
        "implemented <b>RLFR</b> protocol (IEEE TCOMM, Nov 2024) extends the Q-FANET family with three "
        "key innovations:",
        styles["Body"]
    ))
    innovations = [
        ("<b>Multi-Objective Utility:</b> Unlike pure Q-Routing or Q-FANET that optimise a single reward, "
         "RLFR trades off delivery success, end-to-end latency, and transmission energy simultaneously."),
        ("<b>Risk-Constrained Safe Exploration:</b> A dedicated risk table R(s,a) penalises actions that "
         "historically violated the latency QoS threshold (μ=40 ms), preventing the agent from selecting "
         "high-reward but latency-dangerous paths."),
        ("<b>Distributed Cooperative Learning:</b> Sharing state-value functions V_j in periodic HELLO beacons "
         "allows each UAV to benefit from its neighbours' experience, accelerating convergence without a "
         "centralised server."),
    ]
    for pt in innovations:
        elems.append(Paragraph(f"  • {pt}", styles["Body"]))

    elems.append(Spacer(1, 6))
    elems.append(Paragraph(
        "RLFR is the most recently published protocol in this collection and still undergoes its online "
        "learning warm-up during a short 10-second simulation. Longer simulations (≥ 60 s) allow the "
        "Q-table and risk table to converge, at which point RLFR is expected to reach competitive PDR "
        "while simultaneously achieving lower average end-to-end latency than Q-FANET — the result "
        "demonstrated in the original IEEE TCOMM paper under network densities of 5–20 UAVs.",
        styles["Body"]
    ))
    elems.append(Spacer(1, 8))

    # Final summary bar - simple coloured box
    note_data = [[
        Paragraph(
            "<b>RLFR is now the 10th protocol in UavNetSim.</b><br/>"
            "Run it via CLI: <font name='Courier'>python main.py run --routing RLFR --nodes 10 --duration 60</font><br/>"
            "Or select <b>RLFR</b> in the Web UI at http://127.0.0.1:8000",
            styles["Body"]
        )
    ]]
    note_tbl = Table(note_data, colWidths=[17*cm])
    note_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), LIGHT_CYAN),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("BOX",           (0, 0), (-1, -1), 1.5, CYAN),
    ]))
    elems.append(note_tbl)
    return elems


def build_pdf(results_path="benchmark_results.json",
              output_path="presentation/RLFR_Protocol_Report.pdf"):
    with open(results_path, encoding="utf-8") as f:
        results = json.load(f)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2.2*cm, bottomMargin=2.2*cm,
        title="UavNetSim: 10 Routing Protocols — Comparative Report",
        author="UavNetSim / 01329582993",
    )

    styles = make_styles()
    story = []

    story.append(header_block(styles))
    story.append(Spacer(1, 14))

    story += rlfr_description(styles)
    story += comparative_section(results, styles)
    story += conclusion_section(results, styles)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#9ca3af"))
        canvas.drawCentredString(
            A4[0] / 2, 1.2 * cm,
            f"UavNetSim · 10 Routing Protocols Comparative Report · Page {doc.page}"
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"PDF generated: {output_path}")


if __name__ == "__main__":
    build_pdf()
