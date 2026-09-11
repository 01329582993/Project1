# Teacher Presentation Script & Live Simulator Walkthrough Guide

This guide gives you the **exact words, live code references, and demonstration steps** to present Greedy Routing directly in the simulator and through the animated simulation studio.

---

## Part 1: How to Open and Run the Tools During Your Presentation

### A. How to Run the Real Simulator in the Terminal
Open your terminal in the `UavNetSim` project directory:
```bash
# Run a live test with 5 UAV nodes for 10 seconds using Greedy routing:
.\.venv\Scripts\python.exe main.py run --routing Greedy --nodes 5 --duration 10 --uav-speed 10
```
**Point out the console output to your teacher:**
- Total packets sent
- Packet delivery ratio (PDR)
- End-to-end delay (ms)
- Average hop count (~1.1 to 3 hops)
- Collision count and MAC delay

### B. How to Open the Live 3D Web Interface
```bash
.\.venv\Scripts\python.exe main.py serve --host 127.0.0.1 --port 8000
```
Open **http://127.0.0.1:8000** in your browser. Show the teacher:
1. Setting Routing Protocol to `Greedy`.
2. Setting Node Count to `8` and Duration to `20`.
3. Clicking **Start Simulation** and observing the 3D airspace visualization.

### C. How to Open the Dedicated Step-by-Step Animation Studio
Simply open the file in Chrome or Edge:
```
c:\Users\limas\OneDrive\Desktop\CSE\Project\Net\UavNetSim\presentation\animation\index.html
```
Or start a local web server:
```bash
npx serve presentation/animation
```
*Hit the **"Play Video"** button to let it run automatically like a video, or press **Right Arrow** to step through each move manually while you speak!*

---

## Part 2: Step-by-Step Spoken Script for Your Teacher

Below is what to say for each of the 8 stages shown in the animation studio and in the codebase:

---

### Step 1: Simulator Configuration & Instantiation
- **What is happening on screen:** 5 drones spawn in a 600m &times; 600m &times; 120m airspace with 3D buildings.
- **Code file:** `simulator/simulator.py` (lines 191–219)
- **What to say to your teacher:**
  > *"Professor, here is our simulator initializing. In `simulator.py`, when we pass `--routing Greedy`, the simulator invokes `_create_routing_protocol()`. This dynamically creates an instance of the `Greedy` class from `routing/greedy/greedy.py` on every single drone.*
  > 
  > *Notice that, unlike DSDV or OLSR, Greedy routing does **not** exchange initial routing tables or flood discovery packets. The protocol is completely **stateless** and relies solely on immediate 1-hop geographic proximity."*

---

### Step 2: Periodic Neighbor Discovery (Hello Protocol with Jitter)
- **What is happening on screen:** Glowing cyan radio wave pulses radiate from each UAV.
- **Code file:** `routing/greedy/greedy.py` (`broadcast_hello_packet_periodically()`)
- **What to say to your teacher:**
  > *"Every 0.5 seconds, each UAV broadcasts a `GreedyHelloPacket`. In this packet, the drone sends its unique ID, timestamp, and its current 3D coordinates `[x, y, z]`.*
  > 
  > *Notice line 4 in `greedy.py`: `jitter = self.rng_routing.randint(1000, 2000)` microseconds. We introduce this random 1 to 2 millisecond jitter so that drones don't broadcast on the exact same microsecond. Without jitter, periodic beacons would synchronize and collide on the CSMA/CA MAC layer, causing catastrophic packet loss."*

---

### Step 3: Neighbor Table Maintenance & Aging (`purge()`)
- **What is happening on screen:** UAV 0's neighbor table HUD opens, showing active neighbors UAV 1 and UAV 2 with timestamps.
- **Code file:** `routing/base/base_table.py` (`purge()`) & `routing/greedy/greedy_neighbor_table.py`
- **What to say to your teacher:**
  > *"When a drone receives a Hello packet, it adds or updates the entry in its `GreedyNeighborTable`. Each entry contains `[coordinates, updated_time]`.*
  > 
  > *Because UAVs fly at high speeds (10 to 30 m/s), an old neighbor entry becomes stale very quickly. Before making any routing decision, the drone calls `purge()` in `base_table.py`. If a neighbor hasn't refreshed its beacon within the entry lifetime of 2.0 seconds, it is immediately deleted. This prevents forwarding packets to a node that has already flown out of range."*

---

### Step 4: Next-Hop Decision — 3D Euclidean Distance Minimization
- **What is happening on screen:** Dotted distance measurement vectors stretch from UAV 0, 1, and 2 to Destination UAV 4. Distances are calculated and displayed.
- **Code file:** `routing/greedy/greedy_neighbor_table.py` (`best_neighbor()`)
- **What to say to your teacher:**
  > *"Now UAV 0 has generated a Data Packet for Destination UAV 4. It calls `next_hop_selection()`.*
  > 
  > *Look at `best_neighbor()` in `greedy_neighbor_table.py`:*
  > 1. *UAV 0 calculates its own distance to the destination: **424.5 meters**.*
  > 2. *It calculates Neighbor 1's distance: **290.7 meters**.*
  > 3. *It calculates Neighbor 2's distance: **239.8 meters**.*
  > 
  > *Because 239.8m is strictly smaller than 424.5m and is the minimum among all neighbors, the algorithm selects **UAV 2** as the next hop. This guarantees forward progress toward the destination."*

---

### Step 5: Unicast Transmission & CSMA/CA SIFS ACK Handshake
- **What is happening on screen:** Golden data packet travels from UAV 0 to UAV 2. UAV 2 replies with a purple ACK.
- **Code file:** `routing/greedy/greedy.py` (`packet_reception()`)
- **What to say to your teacher:**
  > *"The packet is unicast to UAV 2. When UAV 2 receives the packet, it checks its queue capacity:*
  > `if self.my_drone.transmitting_queue.qsize() < self.my_drone.max_queue_size:`
  > 
  > *If there is space, it stores the packet. Then, on lines 6 and 7, it waits for `SIFS_DURATION` (10 microseconds in 802.11) and unicasts an `AckPacket` back to UAV 0.*
  > 
  > *Once UAV 0 receives the ACK, it interrupts its `wait_ack` timeout and removes the packet from its retransmission buffer. This guarantees hop-by-hop reliability."*

---

### Step 6: Encountering the 3D Routing Void (Local Minimum)
- **What is happening on screen:** Packet is at UAV 2. A red pulsing warning circle appears: `! 3D ROUTING VOID`.
- **Code file:** `routing/greedy/greedy.py` (`next_hop_selection()`)
- **What to say to your teacher:**
  > *"Now, professor, here is the most important theoretical challenge in Greedy routing: **The 3D Routing Void (Local Minimum)**.*
  > 
  > *UAV 2 is now at a distance of 239.8 meters from the destination. But look at its available neighbors: UAV 1 is at 290 meters, and UAV 0 is at 424 meters. All neighbors are farther from the destination than UAV 2!*
  > 
  > *In `best_neighbor()`, the loop finds no neighbor with a distance less than 239.8m. Therefore, `best_id` remains UAV 2 itself. In `greedy.py`, line 2 checks:*
  > `if best_next_hop_id is self.my_drone.identifier:`
  > 
  > *This sets `has_route = False`. The greedy algorithm has reached a dead end."*

---

### Step 7: Store-and-Carry Buffer & Mobility Recovery
- **What is happening on screen:** Packet is placed in `waiting_list`. UAV 3 flies forward across the airspace into the gap.
- **Code file:** `routing/greedy/greedy.py` (`check_waiting_list()`)
- **What to say to your teacher:**
  > *"How does UavNetSim handle this void without dropping the packet?*
  > 
  > *In 2D networks, algorithms like GPSR use perimeter face routing. But in 3D airspaces, face routing is mathematically unstable and creates loops.*
  > 
  > *Instead, UavNetSim exploits **UAV mobility via Store-and-Carry**:*
  > 1. *The packet is moved to `self.my_drone.waiting_list`.*
  > 2. *A SimPy process, `check_waiting_list()`, wakes up every **0.6 seconds**.*
  > 3. *Meanwhile, drones move using the 3D Gauss-Markov mobility model. As you can see, UAV 3 has flown into the airspace between UAV 2 and the destination.*
  > 4. *When `check_waiting_list()` re-evaluates `best_neighbor()`, UAV 3 is now discovered at a distance of only **122.3 meters**!*
  > 5. *Because 122.3m < 239.8m, the void is resolved! The packet is moved back to the transmission queue and forwarded to UAV 3."*

---

### Step 8: Final Delivery & Metric Calculation
- **What is happening on screen:** Packet hops from UAV 3 to Destination UAV 4. Green delivery particles appear.
- **Code file:** `routing/greedy/greedy.py` (`packet_reception()`) & `simulator/metrics.py`
- **What to say to your teacher:**
  > *"Finally, UAV 3 forwards the packet directly to destination UAV 4.*
  > 
  > *In `packet_reception()`, UAV 4 sees `dst_drone.identifier == self.my_drone.identifier`. It calls `self.simulator.metrics.calculate_metrics(packet_copy)`.*
  > 
  > *Here are the final metrics for this transmission:*
  > - **Total Hops:** 3 hops (UAV 0 &rarr; UAV 2 &rarr; UAV 3 &rarr; UAV 4)
  > - **End-to-End Latency:** 104.2 milliseconds
  > - **Packet Delivery Ratio:** 100%
  > 
  > *This demonstrates how Greedy routing achieves ultra-low latency when a path exists, and how mobility-assisted store-and-carry recovers from 3D voids."*

---

## Part 3: Teacher Questions & How to Answer Them

### Q1: "What is the computational complexity of the next-hop decision in Greedy?"
> **Answer:** *"It is strictly $O(|\mathcal{N}|)$, where $|\mathcal{N}|$ is the number of active 1-hop neighbors (typically 3 to 8 drones in radio range). It only requires calculating 3D Euclidean distances to the neighbors and finding the minimum. This is vastly lighter than Dijkstra's algorithm in link-state protocols."*

### Q2: "What is the biggest weakness of Greedy routing in FANETs?"
> **Answer:** *"The Local Minimum problem. If the swarm density is too sparse, or if drones scatter around obstacles, packets get trapped in routing voids. Furthermore, pure Greedy routing only considers geometric distance—it ignores radio interference, fading, and node battery levels. That is why advanced protocols like QMR (Q-learning Multi-objective Routing) in this simulator use reinforcement learning to combine distance, SINR, and residual energy."*

### Q3: "What happens if a packet stays in the `waiting_list` forever?"
> **Answer:** *"In `check_waiting_list()`, line 5 checks:*
> `if self.simulator.env.now > waiting_pkd.creation_time + waiting_pkd.deadline:`
> *Every packet has a maximum lifetime (e.g. 10 seconds). If no drone arrives within that deadline, the expired packet is dropped to prevent queue congestion."*
