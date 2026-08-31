PYTHON ?= python3
.PHONY: check validate-contracts tree
check: validate-contracts
	@$(PYTHON) scripts/validate_contracts.py
validate-contracts:
	@$(PYTHON) -m json.tool shared/schemas/task-envelope.schema.json >/dev/null
	@$(PYTHON) -m json.tool shared/schemas/evidence.schema.json >/dev/null
tree:
	@$(PYTHON) scripts/validate_contracts.py --tree
