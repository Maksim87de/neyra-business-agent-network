#!/usr/bin/env python3
"""Regression tests for publicly installable releases and specialist handoffs."""
from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ReleaseContractTests(unittest.TestCase):
    def test_public_install_references_the_published_v010_release(self) -> None:
        deploy = (ROOT / "deploy/deploy.env.example").read_text(encoding="utf-8")
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("ghcr.io/maksim87de/neyra-business-agent-network:v0.1.0", deploy)
        self.assertIn(
            "releases/download/v0.1.0/neyra-business-agent-network-v0.1.0.tar.gz",
            deploy,
        )
        self.assertNotIn("v0.1.0-test", deploy)
        self.assertNotIn("v0.1.0-test", readme)
        self.assertIn("releases/tag/v0.1.0", readme)

    def test_functional_smoke_uses_the_runtime_default_model(self) -> None:
        acceptance = (ROOT / "scripts/acceptance.sh").read_text(encoding="utf-8")
        self.assertIn("NEYRA_MODEL_SMOKE_OK", acceptance)
        self.assertNotIn('--provider "$NEYRA_PROVIDER" -m "$NEYRA_MODEL"', acceptance)

    def test_specialist_envelope_has_an_assignee_and_evidence_requirement(self) -> None:
        envelope = json.loads((ROOT / "shared/schemas/task-envelope.schema.json").read_text())
        self.assertIn("assignee", envelope["required"])
        self.assertEqual(envelope["properties"]["assignee"]["enum"], ["legal", "finance"])
        self.assertEqual(envelope["properties"]["expected_evidence"]["minItems"], 1)

    def test_specialists_block_instead_of_claiming_a_result_without_evidence(self) -> None:
        for profile in ("legal", "finance"):
            policy = (ROOT / "agents" / profile / "runtime" / "AGENTS.md").read_text(encoding="utf-8")
            self.assertIn("kanban_block", policy)
            self.assertIn("evidence", policy)

    def test_orchestrator_marks_missing_specialist_evidence_as_unverified(self) -> None:
        policy = (ROOT / "agents/orchestrator/policy.md").read_text(encoding="utf-8")
        self.assertIn("неподтверждённым", policy)
        self.assertIn("юридическим или финансовым заключением", policy)


if __name__ == "__main__":
    unittest.main()
