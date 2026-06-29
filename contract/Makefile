.PHONY: default all test build docs fmt fmt-check clippy clean

default: build

all: test

test: build
	cargo test
	cargo test --doc

build:
	cargo build --target wasm32v1-none --release
	@ls -l target/wasm32v1-none/release/*.wasm

docs:
	cargo doc --no-deps

fmt:
	cargo fmt --all

fmt-check:
	cargo fmt --all -- --check

clippy:
	cargo clippy --all --all-targets -- -D warnings

clean:
	cargo clean
