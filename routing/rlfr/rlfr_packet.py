#!/usr/bin/env python
# -*- coding: UTF-8 -*-
"""
RLFR Packet Definitions
References:
    [1] J. Li, L. Xiao, X. Qi, Z. Lv, Q. Chen, and Y.-J. Liu,
    "Reinforcement Learning Based Energy-Efficient Fast Routing for FANETs,"
    IEEE Transactions on Communications, vol. 72, no. 11, pp. 7063-7076, Nov. 2024.
"""

from entities.packet import Packet


class RLFRHelloPacket(Packet):
    """
    HELLO beacon packet in RLFR.
    Exchanges local state information including position, velocity,
    residual battery level, and state-value function V(s) for
    distributed value function coordination among one-hop neighbors.
    """

    def __init__(self,
                 src_drone,
                 creation_time,
                 id_hello_packet,
                 hello_packet_length,
                 simulator,
                 channel_id,
                 state_value=0.0,
                 neighbor_count=0):
        super().__init__(id_hello_packet, hello_packet_length, creation_time, simulator, channel_id)
        self.src_drone = src_drone
        self.cur_position = src_drone.coords
        self.cur_velocity = src_drone.velocity
        self.src_energy = src_drone.residual_energy
        self.mobility_model = src_drone.mobility_model
        self.state_value = float(state_value)
        self.neighbor_count = int(neighbor_count)


class RLFRAckPacket(Packet):
    """
    Feedback ACK packet in RLFR.
    Generated upon packet delivery to report delivery success indicator (kappa),
    end-to-end latency (tau), and channel/link quality feedback.
    """

    def __init__(self,
                 src_drone,
                 dst_drone,
                 ack_packet_id,
                 ack_packet_length,
                 acked_packet,
                 delivery_success,
                 end_to_end_latency,
                 one_hop_latency,
                 sinr,
                 simulator,
                 channel_id,
                 creation_time=None):
        super().__init__(ack_packet_id, ack_packet_length, creation_time or simulator.env.now, simulator, channel_id)
        self.src_drone = src_drone
        self.dst_drone = dst_drone
        self.src_coords = src_drone.coords
        self.src_velocity = src_drone.velocity
        self.acked_packet = acked_packet
        self.delivery_success = int(delivery_success)
        self.end_to_end_latency = float(end_to_end_latency)
        self.one_hop_latency = float(one_hop_latency)
        self.sinr = float(sinr)
