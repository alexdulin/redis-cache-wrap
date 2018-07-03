#=============================================================================
# Makefile for linting redis-cache-wrap
#
#=============================================================================

# Disable verbosity
MAKEFLAGS += --silent

all: test check_nsp

test: lint
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


install:
	@yarn install --force --silent --no-progress --non-interactive
	@npm rebuild --silent > /dev/null
.PHONY: install
