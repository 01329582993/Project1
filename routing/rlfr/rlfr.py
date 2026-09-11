#!/usr/bin/env python
# -*- coding: UTF-8 -*-
"""
RLFR: Reinforcement Learning Based Energy-Efficient Fast Routing for FANETs
References:
    [1] J. Li, L. Xiao, X. Qi, Z. Lv, Q. Chen, and Y.-J. Liu,
    "Reinforcement Learning Based Energy-Efficient Fast Routing for FANETs,"
    IEEE Transactions on Communications, vol. 72, no. 11, pp. 7063-7076, Nov. 2024.
"""

import copy
import random
from simulator.log import logger
from entities.packet import DataPacket
from routing.rlfr.rlfr_packet import RLFRHelloPacket, RLFRAckPacket
from routing.rlfr.rlfr_table import RLFRTable
from routing.parameters import routing_interval_us
from utils import config


class RLFR:
    """
    Main protocol controller for RLFR (Reinforcement Learning Fast Routing).
    Implements:
    - Multi-objective utility (PDR, latency, transmission power).
    - Latency-risk constrained modified Boltzmann exploration.
    - Distributed Bellman equation with shared 1-hop neighbor values.
    - Overhearing and duplicate-filtering cache.
    """

    def __init__(self, simulator, my_drone):
        self.simulator = simulator
        self.my_drone = my_drone
        self.rng_routing = random.Random(my_drone.identifier + simulator.seed + 101)

        self.hello_interval = routing_interval_us("hello_interval_s", 0.5)
        self.check_interval = 0.6 * 1e6
        self.table = RLFRTable(simulator.env, my_drone, self.rng_routing)

        # Start periodic processes
        self.simulator.env.process(self.broadcast_hello_packet_periodically())
        self.simulator.env.process(self.check_waiting_list())

    def broadcast_hello_packet(self):
        """Broadcast HELLO beacon sharing coords, energy, and state value V(s)."""
        config.GL_ID_HELLO_PACKET += 1
        channel_id = self.my_drone.channel_assigner.channel_assign()

        # Representative state value (average across potential destinations)
        state_v = 0.0
        if self.simulator.drones:
            dst_candidates = [d.identifier for d in self.simulator.drones if d.identifier != self.my_drone.identifier]
            if dst_candidates:
                state_v = sum(self.table.get_self_state_value(did) for did in dst_candidates) / len(dst_candidates)

        hello_pkt = RLFRHelloPacket(
            src_drone=self.my_drone,
            creation_time=self.simulator.env.now,
            id_hello_packet=config.GL_ID_HELLO_PACKET,
            hello_packet_length=config.HELLO_PACKET_LENGTH,
            simulator=self.simulator,
            channel_id=channel_id,
            state_value=state_v,
            neighbor_count=len(self.table.table)
        )
        hello_pkt.transmission_mode = 1
        logger.info(
            'At time: %s (us) ---- UAV: %s broadcasts RLFR HELLO (ID: %s, V: %.2f)',
            self.simulator.env.now, self.my_drone.identifier, hello_pkt.packet_id, state_v
        )
        self.simulator.metrics.control_packet_num += 1
        self.my_drone.transmitting_queue.put(hello_pkt)

    def broadcast_hello_packet_periodically(self):
        """Broadcast HELLO packets periodically with jitter."""
        while True:
            self.broadcast_hello_packet()
            jitter = self.rng_routing.randint(1000, 2000)
            yield self.simulator.env.timeout(self.hello_interval + jitter)

    def next_hop_selection(self, packet):
        """
        Select next-hop neighbor and relay power according to the
        paper's safe exploration modified Boltzmann distribution.
        """
        enquire = False
        has_route = True
        self.table.purge()
        dst_drone = packet.dst_drone

        if self.my_drone.identifier not in packet.intermediate_drones:
            packet.intermediate_drones.append(self.my_drone.identifier)

        best_next_hop, power_idx, power_mw = self.table.select_action(packet, dst_drone)

        if best_next_hop == self.my_drone.identifier:
            has_route = False
        else:
            packet.next_hop_id = best_next_hop
            packet.relay_power_idx = power_idx
            packet.relay_power_mw = power_mw

        return has_route, packet, enquire

    def packet_reception(self, packet, src_drone_id):
        """Handle incoming packets at network layer."""
        current_time = self.simulator.env.now
        src_drone = self.simulator.drones[src_drone_id]

        if isinstance(packet, RLFRHelloPacket):
            packet_copy = copy.copy(packet)
            current_sinr = self.cal_p2p_sinr(packet_copy, src_drone_id)
            self.table.add_item(packet_copy, current_time, current_sinr)
            logger.info(
                'At time: %s (us) ---- UAV: %s receives RLFR HELLO from %s (SINR: %.1f dB, V: %.2f)',
                current_time, self.my_drone.identifier, src_drone_id, current_sinr, packet.state_value
            )

        elif isinstance(packet, DataPacket):
            packet_copy = copy.copy(packet)
            cache_key = (packet_copy.src_drone.identifier, packet_copy.packet_id)

            # Check loop avoidance cache Omega (Algorithm 1, Lines 9-10)
            if cache_key in self.table.packet_cache:
                logger.info(
                    'At time: %s (us) ---- UAV: %s drops duplicate/loop packet %s from UAV: %s',
                    current_time, self.my_drone.identifier, packet_copy.packet_id, src_drone_id
                )
                return

            self.table.packet_cache.add(cache_key)
            self.table.record_overhearing(packet_copy.packet_id)

            dst_id = packet_copy.dst_drone.identifier
            sinr = self.cal_p2p_sinr(packet_copy, src_drone_id)
            ack_packet = None

            if dst_id == self.my_drone.identifier:
                # Final destination reached!
                if packet_copy.packet_id not in self.simulator.metrics.datapacket_arrived:
                    self.simulator.metrics.calculate_metrics(packet_copy)

                config.GL_ID_ACK_PACKET += 1
                end_to_end_lat = current_time - packet_copy.creation_time
                one_hop_lat = current_time - (packet_copy.time_transmitted_at_last_hop or current_time)

                ack_packet = RLFRAckPacket(
                    src_drone=self.my_drone,
                    dst_drone=src_drone,
                    ack_packet_id=config.GL_ID_ACK_PACKET,
                    ack_packet_length=config.ACK_PACKET_LENGTH,
                    acked_packet=packet_copy,
                    delivery_success=1,
                    end_to_end_latency=end_to_end_lat,
                    one_hop_latency=one_hop_lat,
                    sinr=sinr,
                    simulator=self.simulator,
                    channel_id=packet_copy.channel_id,
                    creation_time=current_time
                )
            else:
                # Intermediate relay node
                if self.my_drone.transmitting_queue.qsize() < self.my_drone.max_queue_size:
                    self.my_drone.transmitting_queue.put(packet_copy)
                    void_flag = self.table.void_area_judgment(packet_copy.dst_drone)
                    delivery_success = 0 if void_flag else 1
                    end_to_end_lat = current_time - packet_copy.creation_time
                    one_hop_lat = current_time - (packet_copy.time_transmitted_at_last_hop or current_time)

                    config.GL_ID_ACK_PACKET += 1
                    ack_packet = RLFRAckPacket(
                        src_drone=self.my_drone,
                        dst_drone=src_drone,
                        ack_packet_id=config.GL_ID_ACK_PACKET,
                        ack_packet_length=config.ACK_PACKET_LENGTH,
                        acked_packet=packet_copy,
                        delivery_success=delivery_success,
                        end_to_end_latency=end_to_end_lat,
                        one_hop_latency=one_hop_lat,
                        sinr=sinr,
                        simulator=self.simulator,
                        channel_id=packet_copy.channel_id,
                        creation_time=current_time
                    )

            if ack_packet is not None:
                yield self.simulator.env.timeout(config.SIFS_DURATION)
                if not self.my_drone.sleep:
                    ack_packet.increase_ttl()
                    self.my_drone.mac_protocol.phy.unicast(ack_packet, src_drone_id)
                    yield self.simulator.env.timeout(ack_packet.packet_length / config.BIT_RATE * 1e6)

        elif isinstance(packet, RLFRAckPacket):
            data_packet_acked = packet.acked_packet
            dst_id = packet.acked_packet.dst_drone.identifier
            mac_delay = current_time - data_packet_acked.first_attempt_time
            self.simulator.metrics.mac_delay.append(mac_delay / 1e3)

            power_idx = getattr(data_packet_acked, "relay_power_idx", 1)
            packet_bits = data_packet_acked.packet_length * 8

            # Update Q-table & Risk-table using experience
            self.table.update_experience(
                next_hop_id=src_drone_id,
                power_idx=power_idx,
                dst_id=dst_id,
                delivery_success=(packet.delivery_success == 1),
                end_to_end_latency_us=packet.end_to_end_latency,
                one_hop_latency_us=packet.one_hop_latency,
                packet_size_bits=packet_bits
            )

            self.my_drone.remove_from_queue(data_packet_acked)
            key2 = 'wait_ack' + str(self.my_drone.identifier) + '_' + str(data_packet_acked.packet_id)

            if self.my_drone.mac_protocol.wait_ack_process_finish.get(key2, 0) == 0:
                if key2 in self.my_drone.mac_protocol.wait_ack_process_dict:
                    if not self.my_drone.mac_protocol.wait_ack_process_dict[key2].triggered:
                        self.my_drone.mac_protocol.wait_ack_process_finish[key2] = 1
                        self.my_drone.mac_protocol.wait_ack_process_dict[key2].interrupt()

    def check_waiting_list(self):
        """Periodically re-evaluate packets in waiting list."""
        while True:
            if not self.my_drone.sleep:
                yield self.simulator.env.timeout(self.check_interval)
                for waiting_pkt in list(self.my_drone.waiting_list):
                    if self.simulator.env.now > waiting_pkt.creation_time + waiting_pkt.deadline:
                        self.my_drone.waiting_list.remove(waiting_pkt)
                    else:
                        has_route, packet, _ = self.next_hop_selection(waiting_pkt)
                        if has_route:
                            self.my_drone.transmitting_queue.put(waiting_pkt)
                            self.my_drone.waiting_list.remove(waiting_pkt)
            else:
                break

    def cal_p2p_sinr(self, data_packet, previous_drone_id):
        """Calculate point-to-point SINR."""
        return self.simulator.channel.point_to_point_sinr(
            self.my_drone.identifier,
            previous_drone_id,
            data_packet.channel_id,
        )

    def penalize(self, packet):
        """Penalize the Q-table and Risk-table when packet transmission fails."""
        dst_id = packet.dst_drone.identifier
        next_hop_id = getattr(packet, "next_hop_id", None)
        power_idx = getattr(packet, "relay_power_idx", 0)
        if next_hop_id is not None:
            self.table.penalize(next_hop_id, power_idx, dst_id)

    def get_current_transmitting_nodes(self):
        """Get nodes transmitting currently."""
        return [
            [item.transmitter_id, item.channel_id]
            for item in self.simulator.channel.current_transmitters()
        ]
