PYTHON ?= python3
DOCS_VENV ?= .venv-docs

.PHONY: docs-install docs-build docs-serve docs-clean

$(DOCS_VENV)/bin/activate: docs/requirements.txt
	$(PYTHON) -m venv $(DOCS_VENV)
	. $(DOCS_VENV)/bin/activate && pip install --upgrade pip
	. $(DOCS_VENV)/bin/activate && pip install -r docs/requirements.txt
	touch $(DOCS_VENV)/bin/activate

docs-install: $(DOCS_VENV)/bin/activate

# Build static site into ./site/ using MkDocs Material.
docs-build: $(DOCS_VENV)/bin/activate
	. $(DOCS_VENV)/bin/activate && mkdocs build --strict

# Serve documentation with live reload.
docs-serve: $(DOCS_VENV)/bin/activate
	. $(DOCS_VENV)/bin/activate && mkdocs serve

docs-clean:
	rm -rf site $(DOCS_VENV)
