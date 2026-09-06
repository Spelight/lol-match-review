# LoL Match Review / 英雄联盟本地对局复盘仪表盘

![Node.js](https://img.shields.io/badge/Node.js-20+-339933)
![Local first](https://img.shields.io/badge/Data-local--first-2563eb)
![Dashboard](https://img.shields.io/badge/Review-dashboard-7c3aed)
![License](https://img.shields.io/badge/License-MIT-green)

## About Me / 关于我

I am Dxir. I turn scattered interests, data, and practice into things people can open, use, verify, and keep exploring: Windows automation, local analytics, game tooling, and lightweight web products.

我是 Dxir。我喜欢把零散的兴趣、数据与实践，做成别人可以真正进入、使用、验证并继续探索的东西：Windows 自动化、本地数据分析、游戏工具和轻量 Web 产品。

## Overview / 项目概览

LoL Match Review is a local-first League of Legends match review dashboard. It connects to a locally running League Client, collects ranked match data through LCU/SGP endpoints, and turns multi-match history into evidence-based player reports.

`LoL Match Review` 是一个本地优先的英雄联盟对局复盘仪表盘。它连接本机正在运行的 League Client，通过 LCU/SGP 接口采集排位对局数据，并把多场历史战绩整理成可复核的玩家报告。

The project is designed for personal review and coaching workflows: select friends, choose ranked queues, collect match samples, inspect trends, and export CSV/JSON without uploading private game data to a server.

项目面向个人复盘和训练建议场景：选择好友、选择排位队列、采集样本、查看趋势，并导出 CSV/JSON。真实数据保留在本地，不上传到远程服务。

## Features / 功能

| English | 中文 |
| --- | --- |
| Local HTTP dashboard powered by Node.js | 基于 Node.js 的本地 HTTP 仪表盘 |
| No external database service required | 不需要外部数据库服务 |
| League Client lockfile discovery and local LCU authentication | 自动发现 League Client lockfile 并进行本地 LCU 认证 |
| SGP-first collection with LCU fallback | 优先使用 SGP 采集，必要时回退 LCU |
| Ranked queue filtering for solo/duo and flex | 支持单双排、灵活组排筛选 |
| Built-in demo dataset | 内置演示数据，不登录游戏也能查看界面 |
| KDA, win rate, role, champion, timeline, and participant analysis | KDA、胜率、位置、英雄、时间线和参赛者分析 |
| Evidence-style recommendations and training plan | 基于证据的建议与训练计划 |
| Optional AI deep review through environment variables | 可选环境变量启用 AI 深度复盘 |
| CSV/JSON export | 支持 CSV/JSON 导出 |

## Privacy Boundary / 隐私边界

This repository intentionally excludes local runtime data.

本仓库刻意排除了本地运行数据。

- `data/` is ignored except for `.gitkeep` / `data/` 除 `.gitkeep` 外被忽略
- Static generated reports and real player archives are not included / 静态报告和真实玩家归档不入库
- The app reads the local League Client lockfile at runtime and does not store the client password/token in source files / 运行时读取本地 lockfile，不在源码中保存客户端密码或 token
- Optional OpenAI API keys are read from environment variables only / 可选 OpenAI API key 只从环境变量读取
- The app does not read chat content and does not modify game state / 不读取聊天内容，也不修改游戏状态

## Quick Start / 快速启动

Requirements / 环境要求：

- Windows
- Node.js 20 or newer
- League of Legends client, if you want to collect real local data / 如需采集真实数据，需要本机英雄联盟客户端

```powershell
npm install
npm start
```

Open / 打开：

```text
http://127.0.0.1:3790
```

To explore without the League Client, click `查看演示数据` in the UI.

如果没有启动游戏客户端，可以在界面中点击 `查看演示数据`。

## Environment / 环境变量

If automatic lockfile discovery does not find the client, set the lockfile path explicitly:

如果自动发现 lockfile 失败，可以手动指定：

```powershell
$env:LOL_LOCKFILE = 'C:\Riot Games\League of Legends\lockfile'
$env:LOL_REGION = 'TENCENT'
$env:LOL_RSO_PLATFORM_ID = 'HN1'
npm start
```

Optional AI review / 可选 AI 复盘：

```cmd
set OPENAI_API_KEY=your_api_key
set OPENAI_MODEL=gpt-4o-mini
npm start
```

When `OPENAI_API_KEY` is not set, the dashboard still provides the built-in local review and training plan.

没有设置 `OPENAI_API_KEY` 时，仪表盘仍会提供内置本地复盘和训练计划。

## Workflow / 使用流程

1. Open the dashboard and load demo data or local client friends / 打开仪表盘，加载演示数据或本地客户端好友
2. Select one or more players / 选择一个或多个玩家
3. Choose ranked queues and match count / 选择排位队列和采集场数
4. Collect match data from SGP/LCU / 从 SGP/LCU 采集对局数据
5. Review trends, role/champion breakdowns, timeline evidence, and recommendations / 查看趋势、位置/英雄分布、时间线证据和建议
6. Export CSV or JSON when needed / 按需导出 CSV 或 JSON

## Project Structure / 项目结构

```text
server.mjs      Local HTTP server, LCU/SGP collection, analysis engine
public/         Dashboard UI
tools/          Local data migration and compaction helpers
data/           Runtime cache, ignored by Git
```

```text
server.mjs      本地 HTTP 服务、LCU/SGP 采集、分析引擎
public/         仪表盘前端
tools/          本地数据迁移与压缩工具
data/           运行时缓存，Git 忽略
```

## Notes / 说明

This is an unofficial local tool and is not endorsed by Riot Games. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.

这是一个非官方本地工具，未获得 Riot Games 背书。League of Legends 与 Riot Games 是 Riot Games, Inc. 的商标或注册商标。

## License / 许可证

MIT. See [`LICENSE`](LICENSE).
