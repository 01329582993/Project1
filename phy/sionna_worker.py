import math
import os
import sys
import time
from pathlib import Path

# Ensure LLVM DLLs are discoverable on Windows for DrJit / Mitsuba / Sionna in worker process
if sys.platform == "win32":
    llvm_candidates = [
        Path(sys.prefix) / "Lib" / "site-packages" / "drjit",
        Path.home() / "llvm17" / "bin",
        Path(r"C:\Program Files\LLVM\bin"),
    ]
    for candidate in llvm_candidates:
        if candidate.is_dir():
            try:
                os.add_dll_directory(str(candidate))
            except Exception:
                pass
            os.environ["PATH"] = str(candidate) + os.pathsep + os.environ.get("PATH", "")
            llvm_dll = candidate / "LLVM-C.dll"
            if llvm_dll.is_file() and "DRJIT_LIBLLVM_PATH" not in os.environ:
                os.environ["DRJIT_LIBLLVM_PATH"] = str(llvm_dll)

import numpy as np

from scene.airspace import Airspace
from scene.models import SceneModel
from utils import config


class WorkerSceneContext:
    def __init__(self, scene_path, frequency_hz):
        self.scene_path = Path(scene_path)
        self.frequency_hz = float(frequency_hz)
        self.sionna_scene = None
        self.airspace = None
        self._init_sionna()
        self._init_airspace()

    def _init_sionna(self):
        self.sionna_scene = None

    def _init_airspace(self):
        try:
            json_path = self.scene_path.with_suffix(".json")
            if not json_path.is_file():
                json_path = self.scene_path.parent / "scene.json"
            if json_path.is_file():
                scene_model = SceneModel.model_validate_json(json_path.read_text(encoding="utf-8"))
                self.airspace = Airspace(scene_model, max_height=config.MAP_HEIGHT)
        except Exception:
            self.airspace = None


def _remove_devices(scene):
    if scene is None:
        return
    for name in list(scene.transmitters):
        scene.remove(name)
    for name in list(scene.receivers):
        scene.remove(name)


def _solve_snapshot_analytical(context, request):
    started = time.perf_counter()
    transmitters = request["transmitters"]
    receivers = request["receivers"]
    fc = context.frequency_hz or config.CARRIER_FREQUENCY
    c = 3e8
    wavelength = c / fc
    airspace = context.airspace

    tx_count = len(transmitters)
    rx_count = len(receivers)
    gains = np.zeros((tx_count, rx_count), dtype=float)

    for tx_idx, tx in enumerate(transmitters):
        tx_pos = tx["position"]
        for rx_idx, rx in enumerate(receivers):
            if tx["id"] == rx["id"]:
                continue
            rx_pos = rx["position"]
            d = max(0.1, math.dist(tx_pos, rx_pos))

            # Check 3D line-of-sight blockage by buildings and terrain
            is_los = True
            if airspace is not None:
                collision = airspace.path_collision(tx_pos, rx_pos)
                is_los = (collision is None)

            # Friis Free-Space Path Loss in linear power gain
            fspl = (wavelength / (4.0 * math.pi * d)) ** 2

            if is_los:
                gain = fspl
            else:
                # NLoS attenuation due to building shadowing (25 dB loss)
                nlos_loss_linear = 10.0 ** (-25.0 / 10.0)
                gain = fspl * nlos_loss_linear

            gains[tx_idx, rx_idx] = gain

    return {
        "gains": gains.tolist(),
        "transmitter_ids": [item["id"] for item in transmitters],
        "receiver_ids": [item["id"] for item in receivers],
        "solve_time_ms": (time.perf_counter() - started) * 1000,
    }


def _solve_snapshot(context, request):
    return _solve_snapshot_analytical(context, request)


def run_worker(connection):
    context = None
    try:
        while True:
            request = connection.recv()
            request_type = request.get("type")
            if request_type == "configure":
                context = WorkerSceneContext(request["scene_path"], request["frequency_hz"])
                connection.send({"ok": True})
            elif request_type == "snapshot":
                if context is None:
                    raise RuntimeError("Sionna scene is not configured")
                result = _solve_snapshot(context, request)
                connection.send({"ok": True, "result": result})
            elif request_type == "stop":
                connection.close()
                os._exit(0)
    except BaseException as error:
        try:
            connection.send({"ok": False, "error": f"{type(error).__name__}: {error}"})
        except Exception:
            pass
        finally:
            connection.close()
            os._exit(1)
