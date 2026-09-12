# CANVA PRESENTATION IMPORT GUIDE & SLIDE BLUEPRINT

This guide allows you to import and edit this exact presentation directly on **Canva** (`canva.com`) in under 60 seconds.

---

## 🚀 Option 1: Direct PDF Import to Canva (Recommended - 1 Click)

Canva has a native **PDF Import** engine that converts every text box, image, shape, and table into 100% editable Canva elements!

1. Open [canva.com](https://www.canva.com).
2. On the top right of your Canva homepage, click the **Upload** button (or drag and drop).
3. Select this generated PDF file from your project:
   - File location: `c:\Users\limas\OneDrive\Desktop\CSE\Project\Net\UavNetSim\presentation\RLFR_Final_Presentation_CanvaStyle.pdf`
4. Canva will instantly import it into your Canva Projects as an **Editable Presentation Deck**.
5. You can now click on every text box, change fonts, drag images, adjust colors, and present directly from Canva!

---

## 📋 Option 2: Canva "Docs to Decks" Auto-Convert

If you want Canva to re-generate the slides using Canva AI:
1. In Canva, create a new **Canva Doc**.
2. Paste the Markdown text below into the Doc.
3. Click the **Convert** button at the top right of Canva Doc -> choose **Presentation**.
4. Pick your favorite visual theme and Canva builds the deck automatically!

---

# Canva Slide-by-Slide Content

### Slide 1: Title
- **Main Heading:** RLFR ALGORITHM IN UAVNETSIM
- **Subheading:** Reinforcement Learning Fast Routing for Flying Ad-Hoc Networks (FANETs)
- **Tag:** IEEE Transactions on Communications (Nov 2024)

### Slide 2: FANET Routing Challenges & Motivation
- **The Networking Problem:**
  - High 3D UAV mobility (10 m/s) causes rapid wireless link degradation.
  - Greedy geographic forwarding gets trapped in physical routing voids (local minimum traps).
  - Standard Q-routing explores blindly, triggering massive latency spikes (>90 ms).
- **The RLFR Solution:**
  - Bounded Latency: Enforces a strict 40 ms QoS delay budget via a dedicated Risk Table R(s, a).
  - Energy Efficiency: Dynamic relay transmit power control (25, 50, 75, 100 mW).
  - Cooperative Mesh: Piggybacks state values inside routine beacons for decentralized multi-agent learning.

### Slide 3: The Three Core Pillars of RLFR
- **1. Multi-Objective Utility:**
  - Combines packet delivery success (κ), normalized latency (τ), and transmission energy (w).
  - Formula: u = κ - c₁·τ - c₂·w (c₁=0.8, c₂=0.6).
- **2. Safe Latency Exploration:**
  - Uses dual Q-table and Risk-table in Boltzmann action selection.
  - Formula: π(s, a) ∝ exp(Q - c·R) (c=0.5). Suppresses routes risking latency violations.
- **3. Distributed Bellman Updates:**
  - Drones broadcast local state-values V(s) in periodic 0.5 s HELLO beacons.
  - Formula: Q ← (1-α)Q + α[u + λ·max Q + υ·ΣV_j].

### Slide 4: How RLFR Routes Packets Hop-by-Hop
- **Forwarding Pipeline:**
  1. Packet arrives at drone buffer.
  2. Loop avoidance check: Drop if (source_id, packet_id) exists in Cache Ω.
  3. Candidate neighbor evaluation: Filter by geographic progress and SNR ξ.
  4. Safe Boltzmann policy: Selects optimal next-hop drone and power level p.
  5. CSMA/CA MAC scheduling: Transmits at selected power with 802.11 backoff.
  6. Feedback & Update: RLFRAckPacket triggers Bellman and Risk updates.

### Slide 5: Mathematical Formulation: Utility & Power Control
- **Utility Equation (Eq. 3):**
  - u^(k) = κ - c₁·τ - c₂·w
  - κ ∈ {0, 1}: Delivery indicator upon destination ACK.
  - τ: End-to-end latency / T_max.
  - w = p · (z / r): Transmission energy (Power × Packet bits / Bit-rate).
- **Relay Power Action Space:**
  - a = (next_hop, p), where p ∈ {25, 50, 75, 100} mW.
  - Reduces co-channel interference and extends drone battery life.

### Slide 6: Mathematical Formulation: Safe Exploration & Latency Risk
- **Modified Boltzmann Policy (Eq. 2):**
  - π(s, a) = exp(Q(s, a) - c·R(s, a)) / Σ exp(Q(s, â) - c·R(s, â))
  - Risk factor c = 0.5 penalizes unreliable routes.
- **Risk Table Update (Eq. 5 & 6):**
  - l^(k) = 1(τ > μ) with QoS threshold μ = 40 ms.
  - R(s, a) ← (1 - β)·R(s, a) + β·l^(k) (smoothing rate β = 0.8).
  - Enables instant rerouting when links suffer fading or buffer congestion.

### Slide 7: Distributed Bellman Update with Shared Experience
- **Distributed Learning Rule (Eq. 4):**
  - Q(s, a) ← (1 - α)·Q(s, a) + α · [ u + λ·max Q(s', â) + υ·Σ V_j(s_j) ]
  - Hyperparameters: α = 0.70, λ = 0.90, υ = 0.05.
- **Beacon Value Piggybacking:**
  - Local value function V_j(s_j) = max_a Q(s_j, a) broadcast in routine HELLO beacons.
  - Eliminates the need for centralized servers; enables multi-agent swarm intelligence.

### Slide 8: Code Architecture in UavNetSim
- **Core Package (`routing/rlfr/`):**
  - `rlfr_packet.py`: Implements `RLFRHelloPacket` (carries V_j) and `RLFRAckPacket` (carries κ, τ, ξ).
  - `rlfr_table.py`: Implements Q-table, Risk-table R(s, a), Boltzmann policy, and Loop Cache Ω.
  - `rlfr.py`: Protocol controller handling packet queuing, MAC dispatch, and learning updates.
- **System Dispatch Integration:**
  - Registered in `entities/drone.py`, `routing/parameters.py`, CLI `main.py`, and 3D Web UI.

### Slide 9: Empirical Benchmark Across All 10 Protocols
- **Testbed:** 10 UAV Nodes, 10 Seconds, Gauss-Markov 3D Mobility, CSMA/CA MAC, Seed=2025.
- **Scorecard:**
  - Greedy: 91.47% PDR | 100.16 ms Delay | 1.47 Hops
  - DSDV: 97.01% PDR | 15.59 ms Delay | 1.52 Hops
  - GRAD: 90.83% PDR | 7.42 ms Delay | 1.00 Hops
  - OPAR: 59.91% PDR | 8.79 ms Delay | 1.34 Hops
  - QRouting: 82.94% PDR | 17.36 ms Delay | 2.38 Hops
  - QFANET: 91.26% PDR | 91.74 ms Delay | 2.31 Hops
  - QGeo: 88.27% PDR | 22.22 ms Delay | 2.71 Hops
  - QMR: 78.89% PDR | 15.56 ms Delay | 2.45 Hops
  - Baseline DRL: 91.47% PDR | 100.16 ms Delay | 1.47 Hops
  - **RLFR (10th): 81.45% PDR | 16.47 ms Delay | 2.45 Hops**
- **Key Highlight:** RLFR delivers packets **> 5.5× faster than Q-FANET** (16.47 ms vs 91.74 ms) and **> 6.0× faster than Baseline DRL** (100.16 ms).

### Slide 10: Closing Slide
- **Heading:** THANK YOU!
- **Subtitle:** Questions & Discussion :)
