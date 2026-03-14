"""
Utilities for cumulative engagement tracking across optimization rounds.

Name intentionally matches the requested tool name: open_clicks_preditor.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

DEFAULT_AUTO_OPTIMIZATION_ROUNDS = 2

@dataclass
class OpenClicksPreditor:
    """
    Tracks cumulative open/click performance across rounds.

    Two update modes are supported:
    1) ID mode: union of opened/clicked customer IDs (legacy behavior).
    2) Increment mode: add round-level open/click percentage gains.
    """

    total_audience: int
    opened_ids: set[str] = field(default_factory=set)
    clicked_ids: set[str] = field(default_factory=set)
    cumulative_open_rate: float = 0.0
    cumulative_click_rate: float = 0.0

    def record_round(
        self,
        opened_ids: Iterable[str] | None = None,
        clicked_ids: Iterable[str] | None = None,
        *,
        incremental_open_rate: float | None = None,
        incremental_click_rate: float | None = None,
    ) -> dict[str, float | int]:

        if incremental_open_rate is not None or incremental_click_rate is not None:
            open_gain = max(0.0, float(incremental_open_rate or 0.0))
            click_gain = max(0.0, float(incremental_click_rate or 0.0))
            self.cumulative_open_rate = min(100.0, round(self.cumulative_open_rate + open_gain, 1))
            self.cumulative_click_rate = min(100.0, round(self.cumulative_click_rate + click_gain, 1))

            opened = min(self.total_audience, int(round((self.total_audience * self.cumulative_open_rate) / 100)))
            clicked = min(self.total_audience, int(round((self.total_audience * self.cumulative_click_rate) / 100)))
            return {
                "audience": self.total_audience,
                "opened": opened,
                "clicked": clicked,
                "open_rate": self.cumulative_open_rate,
                "click_rate": self.cumulative_click_rate,
            }

        self.opened_ids.update(str(cid) for cid in (opened_ids or []))
        self.clicked_ids.update(str(cid) for cid in (clicked_ids or []))
        return self.metrics()

    def metrics(self) -> dict[str, float | int]:
        if self.cumulative_open_rate > 0 or self.cumulative_click_rate > 0:
            opened = min(self.total_audience, int(round((self.total_audience * self.cumulative_open_rate) / 100)))
            clicked = min(self.total_audience, int(round((self.total_audience * self.cumulative_click_rate) / 100)))
            return {
                "audience": self.total_audience,
                "opened": opened,
                "clicked": clicked,
                "open_rate": self.cumulative_open_rate,
                "click_rate": self.cumulative_click_rate,
            }

        denominator = self.total_audience if self.total_audience > 0 else max(1, len(self.opened_ids | self.clicked_ids))
        opened = len(self.opened_ids)
        clicked = len(self.clicked_ids)
        open_rate = round((opened / denominator) * 100, 1) if denominator else 0.0
        click_rate = round((clicked / denominator) * 100, 1) if denominator else 0.0
        return {
            "audience": denominator,
            "opened": opened,
            "clicked": clicked,
            "open_rate": open_rate,
            "click_rate": click_rate,
        }

def open_clicks_preditor(total_audience: int) -> OpenClicksPreditor:
    """Factory function exposed as the requested tool entry point."""
    return OpenClicksPreditor(total_audience=max(0, int(total_audience)))
