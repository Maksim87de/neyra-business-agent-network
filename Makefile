PYTHON ?= python3
SHELL := /usr/bin/env bash
.PHONY: check validate-contracts validate-deployment tree

check: validate-contracts validate-deployment

validate-contracts:
	@$(PYTHON) -m json.tool shared/schemas/task-envelope.schema.json >/dev/null
	@$(PYTHON) -m json.tool shared/schemas/evidence.schema.json >/dev/null
	@$(PYTHON) scripts/validate_contracts.py

validate-deployment:
	@bash -n scripts/install.sh scripts/doctor.sh tests/test_deployment.sh
	@$(PYTHON) scripts/validate_deployment.py
	@bash tests/test_deployment.sh

tree:
	@$(PYTHON) scripts/validate_contracts.py --tree
