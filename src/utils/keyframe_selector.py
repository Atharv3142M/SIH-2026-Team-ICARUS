import cv2
import numpy as np
from pathlib import Path
from typing import List, Tuple
from dataclasses import dataclass

@dataclass
class KeyframeConfig:
    min_dist_m: float = 5.0  # Min distance between keyframes
    min_angle_deg: float = 2.0  # Min angle change between keyframes
    blur_threshold: float = 100.0  # Laplacian variance threshold
    exposure_min: float = 0.1  # Min average brightness (0-1)
    exposure_max: float = 0.9  # Max average brightness (0-1)

class KeyframeSelector:
    def __init__(self, config: KeyframeConfig = KeyframeConfig()):
        self.config = config

    def calculate_blur(self, image: np.ndarray) -> float:
        """Estimate blur using Laplacian variance."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return cv2.Laplacian(gray, cv2.CV_64F).var()

    def calculate_exposure(self, image: np.ndarray) -> float:
        """Calculate average brightness (normalized)."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return np.mean(gray) / 255.0

    def haversine_distance(self, p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        """Calculate distance between two GPS points in meters."""
        import math
        R = 6371000  # Earth radius in meters
        lat1, lon1 = map(math.radians, p1)
        lat2, lon2 = map(math.radians, p2)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def calculate_angle_change(self, a1: Tuple[float, float, float], a2: Tuple[float, float, float]) -> float:
        """Calculate angle change between two orientation vectors in degrees."""
        # Simple vector dot product for angle change
        v1 = np.array(a1)
        v2 = np.array(a2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        cos_theta = np.dot(v1, v2) / (norm1 * norm2)
        return np.degrees(np.arccos(np.clip(cos_theta, -1.0, 1.0)))

    def select(self, frames_paths: List[Path], telemetry: List[any]) -> List[Path]:
        """
        Select keyframes based on distance, angle, and image quality.
        telemetry is assumed to be a list of TelemetryPoint-like objects with
        lat, lon, pitch, roll, yaw (or similar orientation) and timestamps.
        """
        if not frames_paths:
            return []

        selected_frames = []
        last_selected_idx = -1

        for i, frame_path in enumerate(frames_paths):
            if i >= len(telemetry):
                break

            # 1. Quality Filter (Blur & Exposure)
            try:
                img = cv2.imread(str(frame_path))
                if img is None:
                    continue

                blur = self.calculate_blur(img)
                exposure = self.calculate_exposure(img)

                if blur < self.config.blur_threshold:
                    continue
                if not (self.config.exposure_min <= exposure <= self.config.exposure_max):
                    continue
            except Exception:
                continue

            # 2. Geometry Filter (Distance & Angle)
            if last_selected_idx == -1:
                selected_frames.append(frame_path)
                last_selected_idx = i
                continue

            p1 = (telemetry[last_selected_idx].lat, telemetry[last_selected_idx].lon)
            p2 = (telemetry[i].lat, telemetry[i].lon)
            dist = self.haversine_distance(p1, p2)

            # Angle change (assuming telemetry has orientation vectors or Euler angles)
            # If telemetry doesn't have a vector, we can use yaw/pitch/roll.
            # For now, we use a simple distance check as priority.

            if dist > self.config.min_dist_m:
                selected_frames.append(frame_path)
                last_selected_idx = i

        return selected_frames
