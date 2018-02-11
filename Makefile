#=============================================================================
# Makefile for linting redis-cache-wrap
#
#=============================================================================

# Disable verbosity
MAKEFLAGS += --silent

all: lint test check_nsp

test:
	node test/basic-usage.js
.PHONY: test

lint:
	./node_modules/.bin/eslint --quiet .
.PHONY: lint

lint_fix:
	./node_modules/.bin/eslint --quiet --fix .
.PHONY: lint_fix

check_nsp:
	./node_modules/.bin/nsp check --output checkstyle
.PHONY: check_nsp

changelog:
	./node_modules/.bin/changelog-maker alexdulin redis-cache-wrap --all > CHANGELOG.md
.PHONY: changelog
