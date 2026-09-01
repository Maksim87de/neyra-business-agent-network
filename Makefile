PYTHON ?= python3
SHELL := /usr/bin/env bash
.PHONY: check validate-contracts validate-deployment validate-release test-release-contract tree

check: validate-contracts validate-deployment validate-release test-release-contract

validate-contracts:
	@$(PYTHON) -m json.tool shared/schemas/task-envelope.schema.json >/dev/null
	@$(PYTHON) -m json.tool shared/schemas/evidence.schema.json >/dev/null
	@$(PYTHON) -m json.tool shared/schemas/handoff.schema.json >/dev/null
	@$(PYTHON) -m json.tool shared/schemas/knowledge-ingestion.schema.json >/dev/null
	@$(PYTHON) scripts/validate_contracts.py

validate-deployment:
	@bash -n scripts/install.sh scripts/doctor.sh scripts/provider-onboarding.sh scripts/acceptance.sh scripts/build-image.sh tests/test_deployment.sh
	@$(PYTHON) scripts/validate_deployment.py
	@bash tests/test_deployment.sh

validate-release:
	@$(PYTHON) scripts/validate_release.py

test-release-contract:
	@$(PYTHON) -m unittest -v tests/test_release_contract.py

tree:
	@$(PYTHON) scripts/validate_contracts.py --tree
