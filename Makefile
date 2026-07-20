.PHONY: all install build test toolchain guest-toolchain bun run web web-preview release clean

all: build

install:
	npm install

build:
	npm run build

test:
	npm test

toolchain:
	npm run test:toolchain

guest-toolchain:
	npm run test:guest-toolchain

bun:
	npm run test:bun

run:
	bun run mikuos.ts

web:
	npm run web

web-preview:
	npm run serve:web

release:
	npm run release:source

clean:
	npm run clean
