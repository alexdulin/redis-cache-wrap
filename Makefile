#=============================================================================
# Makefile for linting redis-cache-wrap
#
#=============================================================================

# Disable verbosity
MAKEFLAGS += --silent

all: lint test

test:
	node test/basic-usage.js
.PHONY: test

lint:
	./node_modules/.bin/eslint --quiet .
.PHONY: lint


lint_fix:
	./node_modules/.bin/eslint --quiet --fix .
.PHONY: lint_fix

