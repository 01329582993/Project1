import json
import simpy
from simulator.simulator import Simulator
from utils import config


def run_benchmark():
    protocols = ["Greedy", "DSDV", "GRAD", "OPAR", "QRouting", "QFANET", "QGeo", "QMR", "Baseline_DRL", "RLFR"]
    results = {}

    print("Running benchmark across all 10 protocols (10 nodes, 10s, GaussMarkov3D)...")
    for proto in protocols:
        print(f"--> Simulating {proto}...")
        config.ROUTING_PROTOCOL = proto
        config.MAC_PROTOCOL = "CSMA_CA"
        config.MOBILITY_MODEL = "GaussMarkov3D"
        config.NUMBER_OF_DRONES = 10
        config.MAX_TTL = 11
        config.GL_ID_DATA_PACKET = 0
        config.GL_ID_HELLO_PACKET = 10000
        config.GL_ID_ACK_PACKET = 20000

        env = simpy.Environment()
        sim = Simulator(seed=2025, env=env, n_drones=10, total_simulation_time=10.0 * 1e6, drone_speed=10.0)
        try:
            env.run(until=10.0 * 1e6)
            snap = sim.metrics.snapshot()
            results[proto] = {
                "sent":              snap["generated"],
                "received":          snap["delivered"],
                "pdr":               round(snap["pdr_percent"], 2),
                "delay_ms":          round(snap["e2e_delay_ms"], 3),
                "hops":              round(snap["average_hops"], 3),
                "throughput_kbps":   round(snap["throughput_kbps"], 2),
                "mac_delay_ms":      round(snap["average_mac_delay_ms"], 3),
                "collisions":        snap["collisions"],
                "routing_load":      round(snap["routing_load"], 4),
            }
            print(f"    PDR={results[proto]['pdr']}%, Delay={results[proto]['delay_ms']}ms, Hops={results[proto]['hops']}")
        except Exception as e:
            import traceback
            print(f"    Error in {proto}: {e}")
            traceback.print_exc()
            results[proto] = {"error": str(e)}
        finally:
            sim.close()

    with open("benchmark_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("\nBenchmark complete! Saved to benchmark_results.json")


if __name__ == '__main__':
    run_benchmark()
