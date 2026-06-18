default: build

all: test

test: build
	cargo test

build:
	cargo build
	@ls -l target/wasm32v1-none/release/*.wasm

fmt:
	cargo fmt --all

fmt-check:
	cargo fmt --all -- --check

clippy:
	cargo clippy --all --all-targets -- -D warnings

clean:
	cargo clean
