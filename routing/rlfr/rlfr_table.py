#!/usr/bin/env python
# -*- coding: UTF-8 -*-
"""
RLFR Routing Table & Safe Exploration Q/R Tables
References:
    [1] J. Li, L. Xiao, X. Qi, Z. Lv, Q. Chen, and Y.-J. Liu,
    "Reinforcement Learning Based Energy-Efficient Fast Routing for FANETs,"
    IEEE Transactions on Communications, vol. 72, no. 11, pp. 7063-7076, Nov. 2024.
"""

import math
from collections import defaultdict
import numpy as np

from routing.base.base_table import BaseTable
from routing.parameters import routing_parameter
from utils import config, util_function
from utils.radio import routing_neighbor_distance
from utils.util_function import euclidean_distance_3d


class RLFRTable(BaseTable):
    """
    Manages neighbor states, Q-values, Risk-values (latency constraint violations),
    and Boltzmann policy distribution for RLFR.
    """

    # Discrete relay power levels in mW: {25, 50, 75, 100} mW (Table III in paper)
    POWER_LEVELS_MW = [25.0, 50.0, 75.0, 100.0]

    def __init__(self, env, my_drone, rng_routing):
        super().__init__(env, my_drone)
        self.env = env
        self.my_drone = my_drone
        self.rng_routing = rng_routing

        # Neighbor table: neighbor_id -> {
        #   'pos': coords, 'velocity': vel, 'energy': residual_energy,
        #   'sinr': float, 'delay': float, 'state_value': float, 'timestamp': float
        # }
        self.table = {}

        # Duplicate & loop avoidance cache: set of (src_id, packet_id)
        self.packet_cache = set()

        # Rebroadcast tracking for overhearing: packet_id -> count
        self.rebroadcast_count = defaultdict(int)

        n_drones = my_drone.simulator.n_drones
        self.num_power_levels = len(self.POWER_LEVELS_MW)

        # Q-table: shape (n_drones, num_power_levels, n_drones) -> [next_hop, power_idx, dst_id]
        # Initialized to default optimistic expectation
        self.q_table = np.full((n_drones, self.num_power_levels, n_drones), 0.5, dtype=float)

        # Risk table: shape (n_drones, num_power_levels, n_drones) -> tracks latency violation risk
        self.r_table = np.zeros((n_drones, self.num_power_levels, n_drones), dtype=float)

        self.max_comm_range = routing_neighbor_distance()

        # Hyperparameters loaded from routing parameters or defaults (Table III in paper)
        self.alpha = routing_parameter("learning_rate", 0.7)
        self.gamma = routing_parameter("discount_factor", 0.9)
        self.upsilon = routing_parameter("shared_experience_weight", 0.05)
        self.risk_weight_c = routing_parameter("risk_weight", 0.5)
        self.beta = routing_parameter("risk_learning_rate", 0.8)
        self.c1 = routing_parameter("c1_latency_weight", 0.8)
        self.c2 = routing_parameter("c2_energy_weight", 0.6)
        self.latency_threshold_us = routing_parameter("latency_threshold_ms", 40.0) * 1e3

    def is_item(self, drone_id):
        """Check if the drone entry exists, is not expired, and is within comm range."""
        if drone_id not in self.table:
            return False
        entry = self.table[drone_id]
        if entry["timestamp"] + self.entry_life_time <= self.env.now:
            return False
        dist = euclidean_distance_3d(self.my_drone.coords, entry["pos"])
        return dist <= self.max_comm_range

    def purge(self):
        """Purge stale neighbors from table."""
        expired = [nid for nid, data in self.table.items()
                   if data["timestamp"] + self.entry_life_time <= self.env.now]
        for nid in expired:
            del self.table[nid]

    def add_item(self, hello_packet, cur_time, cur_sinr=None):
        """Record or update neighbor status from HELLO beacon."""
        src_id = hello_packet.src_drone.identifier
        if src_id == self.my_drone.identifier:
            return
        delay = cur_time - hello_packet.creation_time

        self.table[src_id] = {
            "pos": hello_packet.cur_position,
            "velocity": hello_packet.cur_velocity,
            "energy": getattr(hello_packet, "src_energy", 1.0),
            "sinr": cur_sinr if cur_sinr is not None else 15.0,
            "delay": delay,
            "state_value": getattr(hello_packet, "state_value", 0.0),
            "neighbor_count": getattr(hello_packet, "neighbor_count", 1),
            "timestamp": cur_time
        }

    def record_overhearing(self, packet_id):
        """Overhear rebroadcast to evaluate local contention."""
        self.rebroadcast_count[packet_id] += 1

    def get_self_state_value(self, dst_id):
        """
        Compute V_i(s_i) = max_a Q(s, a) for the current node towards destination.
        This value is broadcasted in HELLO packets to coordinate learning with 1-hop neighbors.
        """
        valid_neighbors = [nid for nid in self.table if self.is_item(nid)]
        if not valid_neighbors:
            return 0.0
        max_v = -float("inf")
        for nid in valid_neighbors:
            for p_idx in range(self.num_power_levels):
                val = self.q_table[nid, p_idx, dst_id]
                if val > max_v:
                    max_v = val
        return max_v if max_v != -float("inf") else 0.0

    def void_area_judgment(self, dst_drone):
        """Check if any valid neighbor makes geographic progress towards destination."""
        self.purge()
        if not self.table:
            return 1
        d_myself = euclidean_distance_3d(self.my_drone.coords, dst_drone.coords)
        for neighbor_id in self.table:
            if not self.is_item(neighbor_id):
                continue
            d_neighbor = euclidean_distance_3d(self.table[neighbor_id]["pos"], dst_drone.coords)
            if d_neighbor < d_myself:
                return 0
        return 1

    def select_action(self, packet, dst_drone, greedy=False):
        """
        Select next-hop neighbor and relay power level using the paper's
        safe exploration modified Boltzmann distribution:
            pi(s, a) = exp(Q(s, a) - c * R(s, a)) / sum(exp(Q(s, a^) - c * R(s, a^)))
        """
        self.purge()
        dst_id = dst_drone.identifier

        valid_neighbors = [nid for nid in self.table if self.is_item(nid)]
        if not valid_neighbors:
            # Void area or isolated
            return self.my_drone.identifier, 0, 0.0

        # Filter candidate neighbors moving closer or with positive speed projection
        d_myself = euclidean_distance_3d(self.my_drone.coords, dst_drone.coords)
        progress_neighbors = [
            nid for nid in valid_neighbors
            if euclidean_distance_3d(self.table[nid]["pos"], dst_drone.coords) <= d_myself
        ]
        candidates = progress_neighbors if progress_neighbors else valid_neighbors

        # Formulate action set: (neighbor_id, power_idx)
        actions = []
        logits = []
        for nid in candidates:
            for p_idx in range(self.num_power_levels):
                q_val = self.q_table[nid, p_idx, dst_id]
                r_val = self.r_table[nid, p_idx, dst_id]
                # Modified Boltzmann exponent (Eq. 2)
                score = q_val - self.risk_weight_c * r_val
                actions.append((nid, p_idx))
                logits.append(score)

        if not actions:
            return self.my_drone.identifier, 0, 0.0

        logits = np.array(logits, dtype=float)
        # Numerical stability shift
        logits -= np.max(logits)
        exp_scores = np.exp(np.clip(logits, -20.0, 20.0))
        sum_exp = np.sum(exp_scores)

        if sum_exp <= 0 or np.isnan(sum_exp):
            probs = np.ones(len(actions)) / len(actions)
        else:
            probs = exp_scores / sum_exp

        if greedy:
            best_idx = int(np.argmax(probs))
        else:
            best_idx = self.rng_routing.choices(range(len(actions)), weights=probs, k=1)[0]

        chosen_neighbor, chosen_power_idx = actions[best_idx]
        chosen_power_mw = self.POWER_LEVELS_MW[chosen_power_idx]
        return chosen_neighbor, chosen_power_idx, chosen_power_mw

    def update_experience(self, next_hop_id, power_idx, dst_id,
                          delivery_success, end_to_end_latency_us,
                          one_hop_latency_us, packet_size_bits=1024 * 8):
        """
        Update Q-table and R-table using Eq. 3, 4, 5, 6 from the paper:
            u = kappa - c1 * tau - c2 * w
            Q <- (1 - alpha) * Q + alpha * (u + gamma * max_a' Q(s', a') + upsilon * sum V_j)
            l = 1(tau > mu)
            R <- (1 - beta) * R + beta * l
        """
        if next_hop_id not in range(self.q_table.shape[0]):
            return

        # 1. Normalize latency against deadline (or reference threshold)
        ref_latency = max(1.0, self.latency_threshold_us)
        tau_norm = min(5.0, end_to_end_latency_us / ref_latency)

        # 2. Transmission energy calculation: w = p * (z / r)
        p_watt = self.POWER_LEVELS_MW[power_idx] * 1e-3
        bit_rate = getattr(config, "BIT_RATE", 12e6)
        tx_duration_s = packet_size_bits / bit_rate
        w_joules = p_watt * tx_duration_s
        w_norm = min(5.0, w_joules * 1e5)  # scaled normalized energy

        # 3. Multi-objective Utility (Eq. 3)
        kappa = 1.0 if delivery_success else 0.0
        utility = kappa - self.c1 * tau_norm - self.c2 * w_norm

        # 4. Neighbor shared state values: upsilon * sum_{j in N} V_j(s_j)
        valid_neighbors = [nid for nid in self.table if self.is_item(nid)]
        sum_v_neighbors = sum(self.table[nid].get("state_value", 0.0) for nid in valid_neighbors)

        # 5. Future expected utility: max_{a'} Q(s', a')
        next_hop_entry = self.table.get(next_hop_id)
        if next_hop_entry and self.is_item(next_hop_id):
            max_future_q = float(np.max(self.q_table[next_hop_id, :, dst_id]))
        else:
            max_future_q = 0.0

        # 6. Bellman distributed update (Eq. 4)
        old_q = self.q_table[next_hop_id, power_idx, dst_id]
        td_target = utility + self.gamma * max_future_q + self.upsilon * sum_v_neighbors
        self.q_table[next_hop_id, power_idx, dst_id] = (1.0 - self.alpha) * old_q + self.alpha * td_target

        # 7. Latency violation check & Risk table update (Eq. 5 & 6)
        latency_violation = 1.0 if end_to_end_latency_us > self.latency_threshold_us else 0.0
        old_risk = self.r_table[next_hop_id, power_idx, dst_id]
        self.r_table[next_hop_id, power_idx, dst_id] = (1.0 - self.beta) * old_risk + self.beta * latency_violation

    def penalize(self, next_hop_id, power_idx, dst_id):
        """Penalize an action when delivery times out or packet is dropped."""
        if next_hop_id in range(self.q_table.shape[0]):
            old_q = self.q_table[next_hop_id, power_idx, dst_id]
            self.q_table[next_hop_id, power_idx, dst_id] = (1.0 - self.alpha) * old_q + self.alpha * (-1.0)
            old_r = self.r_table[next_hop_id, power_idx, dst_id]
            self.r_table[next_hop_id, power_idx, dst_id] = (1.0 - self.beta) * old_r + self.beta * 1.0
