/**
 * UavNetSim: 3D Greedy Forwarding Animated Simulation Engine
 * High-fidelity 3D aerial visualization, runtime state machine & code synchronizer.
 */

(function () {
  'use strict';

  // ===========================================================================
  // 1. Simulation Data & 3D Aerial Coordinate Space
  // ===========================================================================

  const WORLD = {
    length: 600, // meters
    width: 600,  // meters
    height: 120, // meters
    txRange: 180, // meters in simulation projection scale
  };

  // 5 UAV nodes matching simulation setup
  const DRONES = [
    { id: 0, role: 'source', label: 'UAV 0 (Source)', x: 90, y: 120, z: 65, vx: 5, vy: 2, vz: 0, battery: 19850, queue: 1 },
    { id: 1, role: 'neighbor', label: 'UAV 1', x: 210, y: 240, z: 75, vx: -3, vy: 4, vz: 1, battery: 19400, queue: 0 },
    { id: 2, role: 'neighbor', label: 'UAV 2', x: 270, y: 140, z: 80, vx: 4, vy: -2, vz: 0, battery: 19100, queue: 0 },
    { id: 3, role: 'mobile', label: 'UAV 3 (Mobile)', x: 320, y: 340, z: 85, vx: 12, vy: -15, vz: -2, battery: 18900, queue: 0 },
    { id: 4, role: 'destination', label: 'UAV 4 (Destination)', x: 510, y: 220, z: 60, vx: 0, vy: 0, vz: 0, battery: 20000, queue: 0 },
  ];

  // Urban obstacle buildings
  const BUILDINGS = [
    { x: 160, y: 170, width: 60, depth: 60, height: 50 },
    { x: 360, y: 140, width: 70, depth: 80, height: 75 },
    { x: 330, y: 260, width: 55, depth: 55, height: 60 },
    { x: 230, y: 40, width: 65, depth: 50, height: 45 },
  ];

  // ===========================================================================
  // 2. Step-by-Step Scenario Definition (8 Discrete Stages)
  // ===========================================================================

  const STEPS = [
    // -------------------------------------------------------------------------
    // STEP 1: Initialization & Parameters
    // -------------------------------------------------------------------------
    {
      title: "1. Simulator Configuration & UAV Initialization",
      shortTitle: "Config & Init",
      simTimeUs: 0,
      description: "Simulation boots with 5 UAVs positioned in 3D airspace (600m &times; 600m &times; 120m). Routing protocol dynamically instantiated as Greedy.",
      file: "simulator/simulator.py",
      func: "Simulator.__init__()",
      activeLine: 7,
      code: [
        "1: def _create_routing_protocol(self):",
        "2:     protocol_map = {",
        "3:         'DSDV': Dsdv,",
        "4:         'GREEDY': Greedy,   # Selected routing protocol",
        "5:         'QROUTING': QRouting,",
        "6:         'QMR': QMR,",
        "7:     }",
        "8:     return protocol_map['GREEDY'](self.simulator, self)",
      ],
      vars: {
        "ROUTING_PROTOCOL": "'Greedy'",
        "NUMBER_OF_DRONES": "5",
        "AIRSPACE_BOUNDS": "600x600x120m",
        "HELLO_INTERVAL": "0.5 s",
      },
      algoExplanation: "The simulator instantiates the 3D airspace model and initializes each drone at random obstacle-free 3D coordinates. The drone configures its internal queues, MAC layer (CSMA/CA), and instantiates the <code>Greedy</code> protocol class.",
      math: `
        <div class="eq-block">
          <div class="eq-title">UAV 3D Position Vector:</div>
          <div class="eq-main">P<sub>i</sub> = [x<sub>i</sub>, y<sub>i</sub>, z<sub>i</sub>]<sup>T</sup> &in; [0, 600] &times; [0, 600] &times; [20, 120] m</div>
          <div class="eq-desc">Each drone is placed at altitude between 20m and 120m.</div>
        </div>
        <div class="eq-block">
          <div class="eq-title">Building Clearance Constraint:</div>
          <div class="eq-main">&forall; b &in; Buildings : Distance(P<sub>i</sub>, b) &ge; d<sub>clearance</sub> (1.0 m)</div>
          <div class="eq-desc">Guarantees no UAV spawns inside or touching buildings.</div>
        </div>
      `,
      rationale: "UavNetSim uses SimPy discrete-event scheduling. Isolating the routing protocol into an interchangeable module allows exact comparison between Greedy, DSDV, and RL protocols.",
      speech: "Here you can see the simulator starting. We set the parameter <code>--routing Greedy</code> with 5 drones in a 600 by 600 meter 3D airspace. The simulator instantiates the <code>Greedy</code> class on every single drone. Notice that no global routing tables are initialized—the protocol is completely stateless at startup.",
      tipQuestion: "Why doesn't Greedy initialize a global routing table at startup like DSDV or OSPF?",
      tipAnswer: "Because Greedy routing is completely stateless and geographic. It only requires knowing its immediate 1-hop physical neighbors, so it has zero startup flooding overhead.",
      packetState: null,
      beaconActive: false,
      selectedNodeId: 0,
      showDistanceToDst: false,
      voidActive: false,
      dronePositions: [
        { id: 0, x: 90, y: 120, z: 65 },
        { id: 1, x: 210, y: 240, z: 75 },
        { id: 2, x: 270, y: 140, z: 80 },
        { id: 3, x: 320, y: 340, z: 85 },
        { id: 4, x: 510, y: 220, z: 60 },
      ]
    },

    // -------------------------------------------------------------------------
    // STEP 2: Periodic Hello Beaconing & Jitter
    // -------------------------------------------------------------------------
    {
      title: "2. Periodic Neighbor Discovery via Hello Beacons",
      shortTitle: "Hello Beacons",
      simTimeUs: 501240,
      description: "UAVs periodically broadcast GreedyHelloPacket with random delay jitter (1000-2000 us) to avoid synchronized MAC channel collisions.",
      file: "routing/greedy/greedy.py",
      func: "broadcast_hello_packet_periodically()",
      activeLine: 4,
      code: [
        "1: def broadcast_hello_packet_periodically(self):",
        "2:     while True:",
        "3:         self.broadcast_hello_packet(self.my_drone)",
        "4:         jitter = self.rng_routing.randint(1000, 2000)  # delay jitter in us",
        "5:         yield self.simulator.env.timeout(self.hello_interval + jitter)",
      ],
      vars: {
        "hello_interval": "500,000 us (0.5s)",
        "jitter": "1,240 us",
        "tx_mode": "1 (Broadcast)",
        "packet_type": "GreedyHelloPacket",
      },
      algoExplanation: "Every 0.5 seconds, each drone wakes up its SimPy process and broadcasts a <code>GreedyHelloPacket</code> containing its current 3D position <code>[x, y, z]</code>. A random delay jitter of 1 to 2 ms is added to break synchronization and prevent beacon collisions.",
      math: `
        <div class="eq-block">
          <div class="eq-title">Periodic Beacon Dispatch Timing:</div>
          <div class="eq-main">T<sub>next_beacon</sub> = T<sub>now</sub> + &Delta;t<sub>hello</sub> + &delta;<sub>jitter</sub></div>
          <div class="eq-desc">Where &Delta;t<sub>hello</sub> = 500,000 &mu;s (0.5s) and &delta;<sub>jitter</sub> &sim; Uniform(1000, 2000) &mu;s.</div>
        </div>
        <div class="eq-block">
          <div class="eq-title">Broadcast Beacon Payload:</div>
          <div class="eq-main">Payload = { ID: drone_id, Position: [x, y, z], Timestamp: T<sub>now</sub> }</div>
          <div class="eq-desc">Used by receiving nodes to populate and refresh their neighbor tables.</div>
        </div>
      `,
      rationale: "In wireless CSMA/CA networks, if multiple drones broadcast beacons on exact identical clock ticks, carrier sense fails and beacons collide. The jitter ensures high packet delivery ratio for control packets.",
      speech: "Now look at the animation waves expanding from the UAVs. Every 0.5 seconds, each drone broadcasts a <code>GreedyHelloPacket</code>. In the code on line 4, notice this jitter term: <code>randint(1000, 2000)</code> microseconds. We deliberately introduce this slight random offset so drones don't broadcast at the exact same microsecond, which would destroy the packet via MAC layer collisions.",
      tipQuestion: "What is inside the GreedyHelloPacket?",
      tipAnswer: "It carries the sender's unique drone identifier, creation timestamp, and its exact 3D coordinates [x, y, z] in the airspace.",
      packetState: null,
      beaconActive: true,
      selectedNodeId: 0,
      showDistanceToDst: false,
      voidActive: false,
      dronePositions: [
        { id: 0, x: 90, y: 120, z: 65 },
        { id: 1, x: 210, y: 240, z: 75 },
        { id: 2, x: 270, y: 140, z: 80 },
        { id: 3, x: 320, y: 340, z: 85 },
        { id: 4, x: 510, y: 220, z: 60 },
      ]
    },

    // -------------------------------------------------------------------------
    // STEP 3: Neighbor Table Maintenance & Aging / Purge
    // -------------------------------------------------------------------------
    {
      title: "3. Neighbor Table Maintenance & Aging (purge)",
      shortTitle: "Table Purge",
      simTimeUs: 1200000,
      description: "Received beacons populate the GreedyNeighborTable. Before every routing decision, purge() drops entries older than 2.0 seconds.",
      file: "routing/base/base_table.py",
      func: "BaseTable.purge()",
      activeLine: 6,
      code: [
        "1: def purge(self):",
        "2:     if not bool(self.table):",
        "3:         return",
        "4:     for key in list(self.table):",
        "5:         updated_time = self.get_updated_time(key)",
        "6:         if updated_time + self.entry_life_time < self.env.now:",
        "7:             self.remove_item(key)  # Drop stale neighbor!",
      ],
      vars: {
        "entry_life_time": "2,000,000 us (2.0s)",
        "UAV 0 Neighbors": "UAV 1, UAV 2",
        "UAV 1 Status": "Active (updated 0.1s ago)",
        "UAV 2 Status": "Active (updated 0.2s ago)",
      },
      algoExplanation: "Upon receiving a Hello packet, <code>add_item()</code> updates the table dictionary <code>{drone_id: [coords, updated_time]}</code>. In <code>BaseTable.purge()</code>, any neighbor whose last contact exceeds 2.0s is pruned, ensuring we never select a departed drone.",
      math: `
        <div class="eq-block">
          <div class="eq-title">Neighbor Table Lifetime Expiration Rule:</div>
          <div class="eq-main">IsExpired(node_k) = (T<sub>now</sub> - T<sub>updated</sub>) &gt; &tau;<sub>lifetime</sub></div>
          <div class="eq-desc">Where &tau;<sub>lifetime</sub> = 2.0 seconds (2,000,000 &mu;s).</div>
        </div>
        <div class="eq-block">
          <div class="eq-title">Purge Decision Action:</div>
          <div class="eq-main">If IsExpired(node_k) &rArr; Table.remove(node_k)</div>
          <div class="eq-desc">Prevents forward attempts to nodes that have flown out of transmission range.</div>
        </div>
      `,
      rationale: "Because UAVs fly at 10-30 m/s, an un-purged table would contain 'phantom neighbors' that have long flown out of transmission range, causing subsequent unicast transmissions to fail.",
      speech: "Here you can see UAV 0's neighbor table. It holds UAV 1 and UAV 2 with their 3D coordinates and timestamps. On lines 5 and 6 of <code>BaseTable</code>, the <code>purge()</code> function is called. If a drone hasn't sent a hello packet within 2.0 seconds, it is immediately deleted. This prevents the drone from attempting to transmit to a node that has already flown away.",
      tipQuestion: "How does the simulator determine if two drones can hear each other's Hello packets?",
      tipAnswer: "Through the PHY channel model. In our simulation, signal-to-interference-plus-noise ratio (SINR) is computed taking into account free-space path loss and building line-of-sight blockage.",
      packetState: null,
      beaconActive: false,
      selectedNodeId: 0,
      showNeighborTable: true,
      showDistanceToDst: false,
      voidActive: false,
      dronePositions: [
        { id: 0, x: 90, y: 120, z: 65 },
        { id: 1, x: 210, y: 240, z: 75 },
        { id: 2, x: 270, y: 140, z: 80 },
        { id: 3, x: 320, y: 340, z: 85 },
        { id: 4, x: 510, y: 220, z: 60 },
      ]
    },

    // -------------------------------------------------------------------------
    // STEP 4: Next Hop Selection - 3D Distance Minimization
    // -------------------------------------------------------------------------
    {
      title: "4. Data Generation & 3D Distance Minimization",
      shortTitle: "Next-Hop Math",
      simTimeUs: 1205000,
      description: "UAV 0 generates Data Packet for Destination UAV 4. It iterates over active neighbors and picks the one minimizing 3D Euclidean distance.",
      file: "routing/greedy/greedy_neighbor_table.py",
      func: "best_neighbor(my_drone, dst_drone)",
      activeLine: 8,
      code: [
        "1: def best_neighbor(self, my_drone, dst_drone):",
        "2:     best_distance = euclidean_distance_3d(my_drone.coords, dst_drone.coords)",
        "3:     best_id = my_drone.identifier",
        "4:     for key in self.table.keys():",
        "5:         next_hop_position = self.table[key][0]",
        "6:         temp_distance = euclidean_distance_3d(next_hop_position, dst_drone.coords)",
        "7:         if temp_distance < best_distance:",
        "8:             best_distance = temp_distance",
        "9:             best_id = key  # UAV 2 chosen! (239.8m < 424.5m)",
        "10:    return best_id",
      ],
      vars: {
        "d(UAV 0, Dst)": "424.5 m (Baseline)",
        "d(UAV 1, Dst)": "290.7 m",
        "d(UAV 2, Dst)": "239.8 m (MINIMUM)",
        "Selected Next Hop": "UAV 2",
      },
      algoExplanation: "UAV 0 calculates 3D Euclidean distance to destination UAV 4 for itself and all active neighbors. UAV 2 is at 239.8m, which is strictly less than UAV 0's 424.5m and neighbor UAV 1's 290.7m. UAV 2 is selected as next hop.",
      math: `
        <div class="eq-block">
          <div class="eq-title">3D Euclidean Distance Function:</div>
          <div class="eq-main">d(P<sub>k</sub>, P<sub>Dst</sub>) = &radic;[ (x<sub>k</sub> - x<sub>Dst</sub>)&sup2; + (y<sub>k</sub> - y<sub>Dst</sub>)&sup2; + (z<sub>k</sub> - z<sub>Dst</sub>)&sup2; ]</div>
        </div>
        <div class="eq-block">
          <div class="eq-title">Greedy Neighbor Minimization:</div>
          <div class="eq-main">N* = argmin<sub>k &in; {1, 2}</sub> d(P<sub>k</sub>, P<sub>Dst</sub>) = UAV 2</div>
          <div class="eq-desc">Verification: d(UAV 2, Dst) = 239.8 m &lt; d(UAV 0, Dst) = 424.5 m &rArr; <span style="color:#00e5a3; font-weight:bold;">Progress Confirmed!</span></div>
        </div>
      `,
      rationale: "Geographic routing requires no route-discovery round trip. The forwarding decision takes <code>O(|N|)</code> time where |N| is the small number of 1-hop neighbors.",
      speech: "Here you can see how the greedy choice is computed. UAV 0 has a packet destined for UAV 4. On line 2, it calculates its own distance to the destination: 424.5 meters. Then lines 4 to 9 loop through its neighbors: neighbor 1 is 290.7 meters away, while neighbor 2 is only 239.8 meters away. Because 239.8 is the minimum and strictly smaller than 424.5, UAV 2 is chosen as the next hop.",
      tipQuestion: "What happens if two neighbors have the exact same distance to the destination?",
      tipAnswer: "The first neighbor evaluated in the table iteration is kept, because temp_distance must be strictly less than best_distance (temp_distance < best_distance) to update.",
      packetState: { from: 0, to: 2, progress: 0, kind: 'data' },
      beaconActive: false,
      selectedNodeId: 0,
      showDistanceToDst: true,
      voidActive: false,
      dronePositions: [
        { id: 0, x: 90, y: 120, z: 65 },
        { id: 1, x: 210, y: 240, z: 75 },
        { id: 2, x: 270, y: 140, z: 80 },
        { id: 3, x: 320, y: 340, z: 85 },
        { id: 4, x: 510, y: 220, z: 60 },
      ]
    },

    // -------------------------------------------------------------------------
    // STEP 5: Hop 1 Transmission, Enqueue & SIFS ACK Handshake
    // -------------------------------------------------------------------------
    {
      title: "5. Unicast Transmission & CSMA/CA SIFS ACK",
      shortTitle: "Hop 1 & ACK",
      simTimeUs: 1218000,
      description: "Packet unicast from UAV 0 to UAV 2. UAV 2 checks queue capacity, enqueues packet, and returns AckPacket after SIFS_DURATION (10 us).",
      file: "routing/greedy/greedy.py",
      func: "packet_reception(packet, src_drone_id)",
      activeLine: 10,
      code: [
        "1: elif isinstance(packet, DataPacket):",
        "2:     if self.my_drone.transmitting_queue.qsize() < self.my_drone.max_queue_size:",
        "3:         self.my_drone.transmitting_queue.put(packet_copy)  # Enqueue",
        "4:         ack_packet = AckPacket(src_drone=self.my_drone, dst_drone=src_drone,",
        "5:                                ack_packet_id=config.GL_ID_ACK_PACKET,",
        "6:                                ack_packet=packet_copy, channel_id=packet_copy.channel_id)",
        "7:         yield self.simulator.env.timeout(config.SIFS_DURATION)  # 10 us",
        "8:         self.my_drone.mac_protocol.phy.unicast(ack_packet, src_drone_id)",
      ],
      vars: {
        "Packet ID": "DataPacket #1",
        "Hop": "UAV 0 -> UAV 2",
        "Queue Occupancy": "1 / 200",
        "SIFS Duration": "10 us",
        "MAC Retry Count": "0 / 5",
      },
      algoExplanation: "When UAV 2 receives the data packet, it confirms queue space is available. It generates an <code>AckPacket</code>, waits <code>SIFS_DURATION</code> (Short Interframe Space), and transmits the ACK directly. Sender UAV 0 receives the ACK, ending its <code>wait_ack</code> timeout process.",
      math: `
        <div class="eq-block">
          <div class="eq-title">Packet Transmission Latency:</div>
          <div class="eq-main">t<sub>tx</sub> = [ (Payload + Headers) / BitRate ] &times; 10<sup>6</sup> &mu;s</div>
          <div class="eq-desc">Bit rate = 11 Mbps (802.11b), Payload = 1024 bytes (8192 bits).</div>
        </div>
        <div class="eq-block">
          <div class="eq-title">Hop Round-Trip Acknowledgement:</div>
          <div class="eq-main">t<sub>ACK_rx</sub> = t<sub>tx</sub> + SIFS (10 &mu;s) + t<sub>ACK_tx</sub></div>
          <div class="eq-desc">Sender UAV 0 receives ACK &rArr; marks hop successful, cancels timeout.</div>
        </div>
      `,
      rationale: "Immediate link-layer ACKs guarantee hop-by-hop reliability. If an ACK is lost, CSMA/CA retransmits up to MAX_RETRANSMISSION_ATTEMPT (5 times) before dropping.",
      speech: "Notice the golden packet traveling along the wireless link from UAV 0 to UAV 2. Once UAV 2 receives it, look at line 2: it checks that its transmission buffer isn't full. Then on lines 6 and 7, it generates an <code>AckPacket</code>, pauses for 10 microseconds—the IEEE 802.11 SIFS duration—and sends the ACK back to UAV 0. UAV 0 marks the hop successful.",
      tipQuestion: "What happens if UAV 2's queue is full?",
      tipAnswer: "If transmitting_queue.qsize() >= max_queue_size, the packet is dropped due to buffer overflow, no ACK is replied, and the sender's timeout will trigger a retransmission.",
      packetState: { from: 0, to: 2, progress: 1, kind: 'ack' },
      beaconActive: false,
      selectedNodeId: 2,
      showDistanceToDst: false,
      voidActive: false,
      dronePositions: [
        { id: 0, x: 90, y: 120, z: 65 },
        { id: 1, x: 210, y: 240, z: 75 },
        { id: 2, x: 270, y: 140, z: 80 },
        { id: 3, x: 320, y: 340, z: 85 },
        { id: 4, x: 510, y: 220, z: 60 },
      ]
    },

    // -------------------------------------------------------------------------
    // STEP 6: 3D Routing Void (Local Minimum) Encountered
    // -------------------------------------------------------------------------
    {
      title: "6. The 3D Routing Void (Local Minimum) Problem",
      shortTitle: "Routing Void!",
      simTimeUs: 1230000,
      description: "At UAV 2, all its current neighbors (UAV 0, UAV 1) are farther from destination than UAV 2 itself. best_id == my_drone.identifier => has_route = False!",
      file: "routing/greedy/greedy.py",
      func: "next_hop_selection(packet)",
      activeLine: 6,
      code: [
        "1: best_next_hop_id = self.neighbor_table.best_neighbor(self.my_drone, dst_drone)",
        "2: if best_next_hop_id is self.my_drone.identifier:",
        "3:     has_route = False  # Local Minimum! No neighbor is closer to Dst",
        "4: else:",
        "5:     packet.next_hop_id = best_next_hop_id",
        "6: return has_route, packet, enquire",
      ],
      vars: {
        "d(UAV 2, Dst)": "239.8 m (Current Node)",
        "d(UAV 1, Dst)": "290.7 m (> 239.8m)",
        "d(UAV 0, Dst)": "424.5 m (> 239.8m)",
        "has_route": "FALSE (VOID)",
      },
      algoExplanation: "UAV 2 is geographically closer to the destination than any neighbor currently within its radio range. Since moving to any available neighbor would move the packet backwards, Greedy routing detects a <b>Local Minimum</b> and returns <code>has_route = False</code>.",
      math: `
        <div class="eq-block alert">
          <div class="eq-title" style="color:#ff4060;">3D Local Minimum (Void) Condition:</div>
          <div class="eq-main">&forall; j &in; Neighbors(UAV 2) : d(P<sub>j</sub>, P<sub>Dst</sub>) &gt; d(P<sub>2</sub>, P<sub>Dst</sub>)</div>
          <div class="eq-desc">&rArr; No neighbor provides forward progress towards destination!</div>
        </div>
        <div class="eq-block alert">
          <div class="eq-title" style="color:#ff4060;">Algorithm Branch:</div>
          <div class="eq-main">best_id == my_drone.identifier &rArr; <span style="color:#ff4060; font-weight:bold;">has_route = False</span></div>
          <div class="eq-desc">Packet cannot be transmitted immediately and must be buffered.</div>
        </div>
      `,
      rationale: "Routing voids are the #1 challenge of geographic routing, especially in 3D airspaces where sparse deployments or building obstacles create dead ends.",
      speech: "This is the most critical concept: the <b>Routing Void or Local Minimum problem</b>. Look at UAV 2. Its distance to destination is 239.8 meters. Neighbor 1 is at 290 meters, and neighbor 0 is at 424 meters. Every single neighbor is further away from the destination than UAV 2! On line 2 and 3, <code>best_neighbor</code> returns UAV 2 itself, so <code>has_route</code> becomes <code>False</code>. Standard greedy forwarding is stuck.",
      tipQuestion: "Why don't we use GPSR Perimeter/Face routing here like in 2D sensor networks?",
      tipAnswer: "Because face routing relies on planar graph embedding (right-hand rule on 2D faces). In 3D space, graphs cannot be planarized without cutting valid edges, making 3D perimeter routing mathematically prone to infinite loops.",
      packetState: null,
      beaconActive: false,
      selectedNodeId: 2,
      showDistanceToDst: true,
      voidActive: true,
      dronePositions: [
        { id: 0, x: 90, y: 120, z: 65 },
        { id: 1, x: 210, y: 240, z: 75 },
        { id: 2, x: 270, y: 140, z: 80 },
        { id: 3, x: 320, y: 340, z: 85 },
        { id: 4, x: 510, y: 220, z: 60 },
      ]
    },

    // -------------------------------------------------------------------------
    // STEP 7: Store-and-Carry Buffer & Mobility-Assisted Recovery
    // -------------------------------------------------------------------------
    {
      title: "7. Store-and-Carry Recovery via waiting_list",
      shortTitle: "Mobility Recovery",
      simTimeUs: 1830000,
      description: "Packet is placed into waiting_list. Meanwhile, UAV 3 flies forward. check_waiting_list() wakes up after 0.6s, discovers mobile UAV 3, and resumes forwarding!",
      file: "routing/greedy/greedy.py",
      func: "check_waiting_list()",
      activeLine: 9,
      code: [
        "1: def check_waiting_list(self):",
        "2:     while True:",
        "3:         yield self.simulator.env.timeout(self.check_interval) # 0.6s",
        "4:         for waiting_pkd in list(self.my_drone.waiting_list):",
        "5:             if self.simulator.env.now > waiting_pkd.creation_time + waiting_pkd.deadline:",
        "6:                 self.my_drone.waiting_list.remove(waiting_pkd) # Expired",
        "7:             else:",
        "8:                 best_next_hop = self.neighbor_table.best_neighbor(self.my_drone, waiting_pkd.dst_drone)",
        "9:                 if best_next_hop != self.my_drone.identifier:",
        "10:                    self.my_drone.transmitting_queue.put(waiting_pkd)  # RECOVERED!",
        "11:                    self.my_drone.waiting_list.remove(waiting_pkd)",
      ],
      vars: {
        "check_interval": "600,000 us (0.6s)",
        "UAV 3 Position": "Drifted to [390, 200, 72]",
        "d(UAV 3, Dst)": "122.3 m (NEW BEST!)",
        "Void Status": "RESOLVED via Mobility",
      },
      algoExplanation: "When a void occurs, the packet is moved to <code>waiting_list</code>. A periodic background process <code>check_waiting_list()</code> wakes every 0.6s. Because UAVs are mobile (Gauss-Markov 3D model), UAV 3 flies into the gap. The re-evaluation on line 8 finds UAV 3 as a valid next hop, and the packet is re-queued!",
      math: `
        <div class="eq-block">
          <div class="eq-title">Mobility-Assisted Void Resolution:</div>
          <div class="eq-main">&exist; mobile drone m : d(P<sub>m</sub>(t + &Delta;t), P<sub>Dst</sub>) &lt; d(P<sub>2</sub>, P<sub>Dst</sub>)</div>
          <div class="eq-desc">UAV 3 flies forward &rArr; distance to Dst drops to 122.3 m &lt; 239.8 m.</div>
        </div>
        <div class="eq-block">
          <div class="eq-title">Queue Recovery Trigger:</div>
          <div class="eq-main">best_next_hop &ne; self.id &rArr; transmitting_queue.put(waiting_pkt)</div>
          <div class="eq-desc">Packet is removed from waiting_list and resumes forward transmission!</div>
        </div>
      `,
      rationale: "In FANETs, drone mobility is not just a challenge—it is an asset! Store-and-carry DTN (Delay-Tolerant Networking) exploits mobility to bridge disconnected clusters.",
      speech: "So how does UavNetSim solve this void without dropping the packet? Look at the code on lines 1 to 11. The packet is placed in a <code>waiting_list</code>. In the animation, watch UAV 3 fly down across the airspace. Every 0.6 seconds, <code>check_waiting_list()</code> checks if any neighbor has moved closer. Once UAV 3 arrives at 122 meters from the destination, line 9 and 10 trigger, pulling the packet out of waiting and putting it back into the transmission queue!",
      tipQuestion: "What happens if no drone flies near and the void persists?",
      tipAnswer: "On line 5, the packet deadline is checked. If current simulation time exceeds creation_time + deadline (e.g. 10 seconds), the packet is dropped to avoid stale data accumulation.",
      packetState: { from: 2, to: 3, progress: 0.5, kind: 'data' },
      beaconActive: false,
      selectedNodeId: 2,
      showDistanceToDst: true,
      voidActive: false,
      dronePositions: [
        { id: 0, x: 95, y: 122, z: 65 },
        { id: 1, x: 205, y: 245, z: 76 },
        { id: 2, x: 275, y: 142, z: 80 },
        { id: 3, x: 390, y: 200, z: 72 }, // Mobile drone moved into position!
        { id: 4, x: 510, y: 220, z: 60 },
      ]
    },

    // -------------------------------------------------------------------------
    // STEP 8: Final Hop Delivery & End-to-End Metrics
    // -------------------------------------------------------------------------
    {
      title: "8. Final Hop Delivery & Simulation Metrics Calculation",
      shortTitle: "Final Delivery",
      simTimeUs: 1845000,
      description: "UAV 3 forwards to Destination UAV 4. Destination marks delivery, records end-to-end latency, and calculates simulation-wide metrics.",
      file: "routing/greedy/greedy.py",
      func: "packet_reception() -> calculate_metrics()",
      activeLine: 4,
      code: [
        "1: if packet_copy.dst_drone.identifier == self.my_drone.identifier:",
        "2:     if packet_copy.packet_id not in self.simulator.metrics.datapacket_arrived:",
        "3:         self.simulator.metrics.calculate_metrics(packet_copy)",
        "4:         logger.info('Data packet %s received by dst UAV: %s', packet_copy.packet_id, self.my_drone.identifier)",
        "5:     # Reply final ACK...",
      ],
      vars: {
        "Total Hops": "3 (UAV 0 -> 2 -> 3 -> 4)",
        "End-to-End Delay": "104.2 ms",
        "PDR": "100.0%",
        "Routing Load": "0.79",
      },
      algoExplanation: "The packet reaches destination UAV 4. <code>calculate_metrics()</code> calculates total travel delay (t<sub>arrival</sub> - t<sub>creation</sub>), updates delivery count, hop count, and throughput. Destination sends the final ACK back to UAV 3.",
      math: `
        <div class="eq-block">
          <div class="eq-title">End-to-End Latency Calculation:</div>
          <div class="eq-main">Delay<sub>e2e</sub> = (T<sub>arrival</sub> - T<sub>creation</sub>) / 1000 = 104.2 ms</div>
          <div class="eq-desc">Total transit time from creation at UAV 0 through 3 hops to destination UAV 4.</div>
        </div>
        <div class="eq-block">
          <div class="eq-title">Packet Delivery Ratio (PDR):</div>
          <div class="eq-main">PDR = [ &sum; Packets Received / &sum; Packets Generated ] &times; 100% = 100%</div>
          <div class="eq-desc">All generated data packets were successfully delivered without loss.</div>
        </div>
      `,
      rationale: "Logging metrics at the destination matches real RFC network benchmarks, providing clean data on delay, throughput, and hop count for research evaluation.",
      speech: "Finally, UAV 3 hops the packet directly to destination UAV 4. On line 1 to 4, UAV 4 detects it is the final destination, registers the packet arrival, and calculates the end-to-end latency, which comes out to 104.2 milliseconds across 3 hops. The packet delivery ratio remains 100%. That concludes the complete life cycle of 3D Greedy routing in UavNetSim.",
      tipQuestion: "What are the main advantages and disadvantages of Greedy in this test?",
      tipAnswer: "Advantages: Very fast forwarding and zero path-discovery delay. Disadvantage: Susceptible to local minimum voids, requiring waiting buffers or advanced reinforcement learning (like QMR) for optimal routing.",
      packetState: { from: 3, to: 4, progress: 1, kind: 'success' },
      beaconActive: false,
      selectedNodeId: 4,
      showDistanceToDst: false,
      voidActive: false,
      dronePositions: [
        { id: 0, x: 95, y: 122, z: 65 },
        { id: 1, x: 205, y: 245, z: 76 },
        { id: 2, x: 275, y: 142, z: 80 },
        { id: 3, x: 400, y: 210, z: 70 },
        { id: 4, x: 510, y: 220, z: 60 },
      ]
    }
  ];

  // ===========================================================================
  // 3. State & DOM References
  // ===========================================================================

  let currentStepIndex = 0;
  let isPlaying = false;
  let playTimer = null;
  let animProgress = 0;
  let playbackSpeed = 1.0;
  let animFrameId = null;
  let pulseTimer = 0;

  // DOM Elements
  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const playLabel = document.getElementById('playLabel');
  const btnReset = document.getElementById('btnReset');
  const speedSelect = document.getElementById('speedSelect');

  const metricSimTime = document.getElementById('metricSimTime');
  const metricPdr = document.getElementById('metricPdr');
  const metricHopCount = document.getElementById('metricHopCount');

  const stageIndicators = document.getElementById('stageIndicators');
  const stepNumberBadge = document.getElementById('stepNumberBadge');
  const captionTitle = document.getElementById('captionTitle');
  const captionDescription = document.getElementById('captionDescription');

  const codeFilename = document.getElementById('codeFilename');
  const codeFuncBadge = document.getElementById('codeFuncBadge');
  const codeSnippetArea = document.getElementById('codeSnippetArea');
  const runtimeVariables = document.getElementById('runtimeVariables');

  const algoStepExplanation = document.getElementById('algoStepExplanation');
  const mathEquationBlock = document.getElementById('mathEquationBlock');
  const designRationale = document.getElementById('designRationale');

  const speechText = document.getElementById('speechText');
  const speechTipQuestion = document.getElementById('speechTipQuestion');
  const speechTipAnswer = document.getElementById('speechTipAnswer');

  const distanceOverlay = document.getElementById('distanceOverlay');
  const uavTablePopover = document.getElementById('uavTablePopover');

  const chkRanges = document.getElementById('chkRanges');
  const chkDistLines = document.getElementById('chkDistLines');
  const chkAltitude = document.getElementById('chkAltitude');

  // ===========================================================================
  // 4. Isometric 3D to 2D Screen Projection Engine
  // ===========================================================================

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  window.addEventListener('resize', resizeCanvas);

  // 3D coordinate transform
  function project3D(x, y, z) {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    // Centered anchor: world origin (0,0,0) maps here.
    // Shift up so the whole 600x600 grid + altitude fits in view.
    const centerX = w * 0.50;
    const centerY = h * 0.30;

    const isoAngle = Math.PI / 6; // 30 degrees
    const scaleX = (w / 800) * 0.70;
    const scaleY = (h / 650) * 0.47;
    const scaleZ = 0.82;

    // Isometric projection
    const screenX = centerX + (x - y) * Math.cos(isoAngle) * scaleX;
    const screenY = centerY + (x + y) * Math.sin(isoAngle) * scaleY - (z * scaleZ);

    // Shadow on ground (z=0)
    const shadowX = centerX + (x - y) * Math.cos(isoAngle) * scaleX;
    const shadowY = centerY + (x + y) * Math.sin(isoAngle) * scaleY;

    return { x: screenX, y: screenY, groundX: shadowX, groundY: shadowY };
  }

  // 3D Euclidean distance calculation
  function dist3D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // ===========================================================================
  // 5. Canvas Drawing Functions
  // ===========================================================================

  function drawGrid() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    ctx.clearRect(0, 0, w, h);

    // Subtle background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#070a12');
    bgGrad.addColorStop(1, '#0c1322');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Ground Grid
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(30, 45, 70, 0.45)';

    const step = 60;
    for (let x = 0; x <= WORLD.length; x += step) {
      const p1 = project3D(x, 0, 0);
      const p2 = project3D(x, WORLD.width, 0);
      ctx.beginPath();
      ctx.moveTo(p1.groundX, p1.groundY);
      ctx.lineTo(p2.groundX, p2.groundY);
      ctx.stroke();
    }

    for (let y = 0; y <= WORLD.width; y += step) {
      const p1 = project3D(0, y, 0);
      const p2 = project3D(WORLD.length, y, 0);
      ctx.beginPath();
      ctx.moveTo(p1.groundX, p1.groundY);
      ctx.lineTo(p2.groundX, p2.groundY);
      ctx.stroke();
    }

    // Outer Map Boundary Box
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 1.5;
    const c0 = project3D(0, 0, 0);
    const c1 = project3D(WORLD.length, 0, 0);
    const c2 = project3D(WORLD.length, WORLD.width, 0);
    const c3 = project3D(0, WORLD.width, 0);

    ctx.beginPath();
    ctx.moveTo(c0.groundX, c0.groundY);
    ctx.lineTo(c1.groundX, c1.groundY);
    ctx.lineTo(c2.groundX, c2.groundY);
    ctx.lineTo(c3.groundX, c3.groundY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawBuildings() {
    BUILDINGS.forEach(b => {
      // 4 base corners
      const p0 = project3D(b.x, b.y, 0);
      const p1 = project3D(b.x + b.width, b.y, 0);
      const p2 = project3D(b.x + b.width, b.y + b.depth, 0);
      const p3 = project3D(b.x, b.y + b.depth, 0);

      // 4 top corners
      const t0 = project3D(b.x, b.y, b.height);
      const t1 = project3D(b.x + b.width, b.y, b.height);
      const t2 = project3D(b.x + b.width, b.y + b.depth, b.height);
      const t3 = project3D(b.x, b.y + b.depth, b.height);

      // Building shadow footprint
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.moveTo(p0.groundX, p0.groundY);
      ctx.lineTo(p1.groundX, p1.groundY);
      ctx.lineTo(p2.groundX, p2.groundY);
      ctx.lineTo(p3.groundX, p3.groundY);
      ctx.closePath();
      ctx.fill();

      // Side 1
      ctx.fillStyle = 'rgba(25, 38, 58, 0.85)';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(p0.groundX, p0.groundY);
      ctx.lineTo(p1.groundX, p1.groundY);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t0.x, t0.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Side 2
      ctx.fillStyle = 'rgba(32, 48, 72, 0.85)';
      ctx.beginPath();
      ctx.moveTo(p1.groundX, p1.groundY);
      ctx.lineTo(p2.groundX, p2.groundY);
      ctx.lineTo(t2.x, t2.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Roof
      ctx.fillStyle = 'rgba(40, 62, 92, 0.9)';
      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.lineTo(t3.x, t3.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Building label
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = '10px monospace';
      ctx.fillText(`h=${b.height}m`, t0.x + 6, t0.y - 4);
    });
  }

  function drawDrones(step) {
    const positions = step.dronePositions;
    const time = Date.now() * 0.003;

    positions.forEach((p, idx) => {
      const droneDef = DRONES[idx];
      const proj = project3D(p.x, p.y, p.z);

      // 1. Altitude Drop Shadow Line
      if (chkAltitude.checked) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(proj.groundX, proj.groundY);
        ctx.lineTo(proj.x, proj.y);
        ctx.stroke();

        // Shadow circle on ground
        ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
        ctx.beginPath();
        ctx.ellipse(proj.groundX, proj.groundY, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Transmission Range Circle
      if (chkRanges.checked) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = (droneDef.id === step.selectedNodeId)
          ? 'rgba(0, 240, 255, 0.35)'
          : 'rgba(75, 105, 145, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(proj.groundX, proj.groundY, WORLD.txRange * 0.75, WORLD.txRange * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Hello Beacon Animated Wave
      if (step.beaconActive) {
        ctx.save();
        const waveProgress = (pulseTimer % 60) / 60;
        const waveRadius = waveProgress * WORLD.txRange * 0.8;
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.7 * (1 - waveProgress)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(proj.x, proj.y, waveRadius, waveRadius * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 4. Void Node Pulsing Warning
      if (step.voidActive && droneDef.id === 2) {
        ctx.save();
        const voidWave = (pulseTimer % 40) / 40;
        ctx.strokeStyle = `rgba(255, 64, 96, ${0.9 * (1 - voidWave)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 22 + voidWave * 26, 0, Math.PI * 2);
        ctx.stroke();

        // Warning Label
        ctx.fillStyle = '#ff4060';
        ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
        ctx.fillText('! 3D ROUTING VOID', proj.x - 48, proj.y - 28);
        ctx.restore();
      }

      // 5. Draw Drone Body (Quadcopter)
      ctx.save();
      const isSelected = (droneDef.id === step.selectedNodeId);

      // Color coding by role
      let bodyColor = '#00e5a3'; // neighbor
      if (droneDef.role === 'source') bodyColor = '#3b82f6';
      if (droneDef.role === 'destination') bodyColor = '#ffb800';
      if (step.voidActive && droneDef.id === 2) bodyColor = '#ff4060';

      // Rotor arms
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(proj.x - 12, proj.y - 8);
      ctx.lineTo(proj.x + 12, proj.y + 8);
      ctx.moveTo(proj.x - 12, proj.y + 8);
      ctx.lineTo(proj.x + 12, proj.y - 8);
      ctx.stroke();

      // Spinning rotor discs
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      const rAngle = time * 8;
      [-12, 12].forEach(ox => {
        [-8, 8].forEach(oy => {
          ctx.beginPath();
          ctx.ellipse(proj.x + ox, proj.y + oy, 5, 2, rAngle, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // Central avionics hull
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, isSelected ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Drone Name & 3D Coordinates Label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
      ctx.fillText(`UAV ${droneDef.id}`, proj.x + 12, proj.y - 6);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(`(${p.x}, ${p.y}, ${p.z}m)`, proj.x + 12, proj.y + 7);

      ctx.restore();
    });
  }

  function drawDistanceLines(step) {
    if (!chkDistLines.checked || !step.showDistanceToDst) return;

    const positions = step.dronePositions;
    const dstPos = positions[4]; // UAV 4
    const dstProj = project3D(dstPos.x, dstPos.y, dstPos.z);

    // Candidates evaluated
    const candidates = [0, 1, 2];
    if (step.dronePositions[3].x > 350) {
      candidates.push(3); // mobile drone in range
    }

    candidates.forEach(candId => {
      const p = positions[candId];
      const proj = project3D(p.x, p.y, p.z);
      const d = dist3D(p, dstPos).toFixed(1);

      ctx.save();
      const isBest = (candId === 2 && !step.dronePositions[3].x > 350) || (candId === 3 && step.dronePositions[3].x > 350);

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = isBest ? 'rgba(0, 240, 255, 0.85)' : 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = isBest ? 2 : 1;

      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y);
      ctx.lineTo(dstProj.x, dstProj.y);
      ctx.stroke();

      // Distance tag midway
      const midX = (proj.x + dstProj.x) / 2;
      const midY = (proj.y + dstProj.y) / 2;

      ctx.fillStyle = isBest ? '#00f0ff' : '#94a3b8';
      ctx.font = isBest ? 'bold 10px JetBrains Mono' : '9px JetBrains Mono';
      ctx.fillText(`d=${d}m`, midX, midY - 4);
      ctx.restore();
    });
  }

  function drawPacketAnimation(step) {
    if (!step.packetState) return;

    const { from, to, progress, kind } = step.packetState;
    const pFrom = step.dronePositions[from];
    const pTo = step.dronePositions[to];

    const proj1 = project3D(pFrom.x, pFrom.y, pFrom.z);
    const proj2 = project3D(pTo.x, pTo.y, pTo.z);

    // Active wireless transmission link
    ctx.save();
    ctx.strokeStyle = kind === 'ack' ? 'rgba(168, 85, 247, 0.6)' : 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(proj1.x, proj1.y);
    ctx.lineTo(proj2.x, proj2.y);
    ctx.stroke();

    // Moving packet position (interpolated with animated progress)
    const t = (animProgress % 100) / 100;
    const curX = proj1.x + (proj2.x - proj1.x) * t;
    const curY = proj1.y + (proj2.y - proj1.y) * t;

    // Packet glowing bead
    if (kind === 'ack') {
      ctx.fillStyle = '#a855f7';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(curX, curY, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.fillText('ACK', curX + 8, curY - 6);
    } else {
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(curX, curY, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.fillText('Data #1', curX + 9, curY - 6);
    }

    ctx.restore();
  }

  // ===========================================================================
  // 6. UI Synchronization & Panel Updates
  // ===========================================================================

  function renderStageIndicators() {
    stageIndicators.innerHTML = '';
    STEPS.forEach((step, idx) => {
      const pill = document.createElement('div');
      pill.className = `stage-pill ${idx === currentStepIndex ? 'active' : ''} ${idx < currentStepIndex ? 'completed' : ''}`;
      pill.innerHTML = `<span class="stage-num">${idx + 1}</span><span>${step.shortTitle}</span>`;
      pill.onclick = () => jumpToStep(idx);
      stageIndicators.appendChild(pill);
    });
  }

  function updateInspectorPanels(step) {
    // 1. Top Metrics Bar
    metricSimTime.textContent = (step.simTimeUs / 1e6).toFixed(3) + ' s';
    metricHopCount.textContent = step.vars["Total Hops"] ? step.vars["Total Hops"].split(' ')[0] : (currentStepIndex > 4 ? '1' : '0');

    // 2. Subtitle Caption Banner
    stepNumberBadge.textContent = `STEP ${currentStepIndex + 1}/${STEPS.length}`;
    captionTitle.textContent = step.title;
    captionDescription.innerHTML = step.description;

    // 3. Tab 1: Code View
    codeFilename.textContent = step.file;
    codeFuncBadge.textContent = step.func;

    codeSnippetArea.innerHTML = '';
    step.code.forEach((lineStr, lineIdx) => {
      const lineNum = lineIdx + 1;
      const isLineActive = (lineNum === step.activeLine);
      const span = document.createElement('span');
      span.className = `code-line ${isLineActive ? 'active' : 'dim'}`;
      span.textContent = lineStr;
      codeSnippetArea.appendChild(span);
    });

    // Runtime variables
    runtimeVariables.innerHTML = '';
    for (const [vName, vVal] of Object.entries(step.vars)) {
      const badge = document.createElement('div');
      badge.className = 'var-badge';
      badge.innerHTML = `<span class="var-name">${vName}</span><span class="var-val">${vVal}</span>`;
      runtimeVariables.appendChild(badge);
    }

    // 4. Tab 2: Math & Algorithm Logic
    algoStepExplanation.innerHTML = step.algoExplanation;
    mathEquationBlock.innerHTML = step.math;
    designRationale.innerHTML = step.rationale;

    // 5. Tab 3: Spoken Explanation
    speechText.innerHTML = `&ldquo;${step.speech}&rdquo;`;
    speechTipQuestion.textContent = step.tipQuestion;
    speechTipAnswer.textContent = step.tipAnswer;

    // Distance HUD Overlay
    if (step.showDistanceToDst) {
      distanceOverlay.classList.remove('hidden');
      const pDst = step.dronePositions[4];
      distanceOverlay.innerHTML = `<h5>3D DISTANCE TO DESTINATION (UAV 4)</h5>`;
      step.dronePositions.forEach((p, idx) => {
        if (idx === 4) return;
        const d = dist3D(p, pDst).toFixed(1);
        const isBest = (idx === 2 && step.dronePositions[3].x < 350) || (idx === 3 && step.dronePositions[3].x > 350);
        const entry = document.createElement('div');
        entry.className = `dist-entry ${isBest ? 'best' : ''}`;
        entry.innerHTML = `<span>UAV ${idx}:</span><span>${d} m ${isBest ? '&#9733; (Min)' : ''}</span>`;
        distanceOverlay.appendChild(entry);
      });
    } else {
      distanceOverlay.classList.add('hidden');
    }

    // Neighbor table popover
    if (step.showNeighborTable) {
      uavTablePopover.classList.remove('hidden');
      uavTablePopover.innerHTML = `
        <h5><span>UAV 0 NEIGHBOR TABLE</span><span>purge() active</span></h5>
        <table>
          <thead>
            <tr><th>Neighbor</th><th>Coordinates (x,y,z)</th><th>Updated</th></tr>
          </thead>
          <tbody>
            <tr><td>UAV 1</td><td>(210, 240, 75)</td><td>1.1 s</td></tr>
            <tr><td>UAV 2</td><td>(270, 140, 80)</td><td>1.0 s</td></tr>
          </tbody>
        </table>
      `;
    } else {
      uavTablePopover.classList.add('hidden');
    }
  }

  function jumpToStep(idx) {
    currentStepIndex = Math.max(0, Math.min(idx, STEPS.length - 1));
    animProgress = 0;
    renderStageIndicators();
    updateInspectorPanels(STEPS[currentStepIndex]);
  }

  function nextStep() {
    if (currentStepIndex < STEPS.length - 1) {
      jumpToStep(currentStepIndex + 1);
    } else {
      pauseVideo();
    }
  }

  function prevStep() {
    if (currentStepIndex > 0) {
      jumpToStep(currentStepIndex - 1);
    }
  }

  function playVideo() {
    isPlaying = true;
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    playLabel.textContent = 'Pause';
    startAutoPlayTimer();
  }

  function pauseVideo() {
    isPlaying = false;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    playLabel.textContent = 'Play Video';
    if (playTimer) clearTimeout(playTimer);
  }

  function togglePlayPause() {
    if (isPlaying) {
      pauseVideo();
    } else {
      if (currentStepIndex >= STEPS.length - 1) {
        jumpToStep(0);
      }
      playVideo();
    }
  }

  function startAutoPlayTimer() {
    if (!isPlaying) return;
    const baseDuration = 6500; // 6.5s per step in normal 1x speed
    const stepDuration = baseDuration / playbackSpeed;

    if (playTimer) clearTimeout(playTimer);
    playTimer = setTimeout(() => {
      if (!isPlaying) return;
      if (currentStepIndex < STEPS.length - 1) {
        nextStep();
        startAutoPlayTimer();
      } else {
        pauseVideo();
      }
    }, stepDuration);
  }

  // ===========================================================================
  // 7. Main Rendering Loop (60 FPS)
  // ===========================================================================

  function renderLoop() {
    pulseTimer++;
    animProgress += 1.2 * playbackSpeed;

    const step = STEPS[currentStepIndex];

    drawGrid();
    drawBuildings();
    drawDistanceLines(step);
    drawDrones(step);
    drawPacketAnimation(step);

    animFrameId = requestAnimationFrame(renderLoop);
  }

  // ===========================================================================
  // 8. Event Listeners & Tab Switching
  // ===========================================================================

  btnPrev.onclick = () => { pauseVideo(); prevStep(); };
  btnNext.onclick = () => { pauseVideo(); nextStep(); };
  btnPlayPause.onclick = togglePlayPause;
  btnReset.onclick = () => { pauseVideo(); jumpToStep(0); };

  speedSelect.onchange = (e) => {
    playbackSpeed = parseFloat(e.target.value);
    if (isPlaying) startAutoPlayTimer();
  };

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'ArrowRight') {
      pauseVideo();
      nextStep();
    } else if (e.code === 'ArrowLeft') {
      pauseVideo();
      prevStep();
    }
  });

  // Tab switcher
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.getElementById(tabId).classList.add('active');
    };
  });

  // Canvas click interaction: select nearest drone
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const step = STEPS[currentStepIndex];
    let closestId = -1;
    let minDist = 30;

    step.dronePositions.forEach((p, idx) => {
      const proj = project3D(p.x, p.y, p.z);
      const d = Math.hypot(proj.x - clickX, proj.y - clickY);
      if (d < minDist) {
        minDist = d;
        closestId = idx;
      }
    });

    if (closestId !== -1) {
      step.selectedNodeId = closestId;
      // Show neighbor table
      uavTablePopover.classList.remove('hidden');
      uavTablePopover.innerHTML = `
        <h5><span>UAV ${closestId} TELEMETRY HUD</span><span>ID: #${closestId}</span></h5>
        <div style="font-family: monospace; font-size: 11px; margin-top: 4px; color: #00f0ff;">
          Position: [${step.dronePositions[closestId].x}, ${step.dronePositions[closestId].y}, ${step.dronePositions[closestId].z}] m<br>
          Battery: ${DRONES[closestId].battery} J<br>
          Queue: ${DRONES[closestId].queue} / 200 packets<br>
          Status: Ready (CSMA/CA)
        </div>
      `;
    }
  });

  // ===========================================================================
  // 9. Startup Initialization
  // ===========================================================================

  resizeCanvas();
  renderStageIndicators();
  jumpToStep(0);
  renderLoop();

})();
