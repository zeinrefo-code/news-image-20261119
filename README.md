# The World in One Day — 19 November 2026

[![make.fun](https://make.fun/badge/news-image-20261119.svg)](https://make.fun/bounty/news-image-20261119)
[![rank](https://make.fun/badge/news-image-20261119/zeinrefo-code/news-image-20261119/rank.svg)](https://make.fun/bounty/news-image-20261119)
[![reward](https://make.fun/badge/news-image-20261119/zeinrefo-code/news-image-20261119/reward.svg)](https://make.fun/bounty/news-image-20261119)

A procedurally drawn newspaper front page summing up **Thursday 19 November 2026** in five stories: Trump, Xi and Putin shake hands in Shenzhen at a first-ever trilateral summit on the APEC sidelines, GTA VI launches worldwide after a 13-year wait, Iran expands its strikes to US bases in Kuwait, Anthropic debuts on the Nasdaq as ANT in the biggest IPO ever, and a Van Gogh with a Nazi-era past sells for a record $190.4M.

The program (`main.ts`, Node 22, standard library only) draws the whole 1024×1024 poster at runtime — hand-rolled PNG encoder (node:zlib deflate, CRC32 written in code) and a 5×7 bitmap font defined in code. No image assets, no network, deterministic output.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024×1024, under 1 MiB). Two runs produce byte-identical output.

## Bounty

[news-image-20261119 on make.fun](https://make.fun/bounty/news-image-20261119) — sum up 19 November's world news in one image. Referral: https://make.fun/r/bxjfe4p7
