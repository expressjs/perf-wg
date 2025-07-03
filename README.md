# Performance Working Group

## Charter

### Mission Statement
The Express Performance Working Group establishes a framework for evaluating performance changes in Express, providing consistent measurement criteria, tooling, and guidance to ensure performance-related decisions are made with data and context.

### Core Philosophy
We focus on **evaluation, not prescription**. Rather than dictating how to write fast code, we:
- Define how Express evaluates performance work
- Measure whether changes are meaningful
- Ensure performance PRs are evaluated consistently and in context

### Responsibilities

#### Performance Evaluation Framework
- Establish evaluation criteria (latency, throughput, memory usage)
- Define what constitutes "meaningful" performance changes
- Create standards for testing under various conditions (concurrency, payload size, middleware stack)

#### Tooling & Infrastructure
- Provide environments and tools to make measurements possible
- Help contributors run performance tests and interpret results
- Maintain two categories of tests:
  - Focused unit benchmarks (in package repos)
  - E2E load tests of realistic applications (in express repo)

#### Key Questions We Answer
- Does this proposed change meaningfully improve performance under realistic load?
- By how much? (p95 latency, req/sec, CPU usage)
- Under what conditions?

#### Ecosystem Collaboration
- Work with Node.js core on unlocking performance improvements
- Maintain relationships with monitoring providers through OSS programs
- Support public benchmark maintenance

## Current Initiatives

| Initiative | Champion | Status | Links |
|------------|----------|--------|-------|
| Setup Charter | [@wesleytodd](https://github.com/wesleytodd) | In progress | [#3](https://github.com/expressjs/perf-wg/issues/3) |

## Members

The Performance WG is made up of volunteers, you do not need to be a member to participate, but once you participate
please open a PR to add youself here.

Two teams exist for mentioning the group and managing access:

- @expressjs/perf-wg: everyone participating in the WG has write access to this repo
- @expressjs/perf-wg-captains: the repository captians as per Express project guidelines

### Team Members

- [Wes Todd](https://github.com/wesleytodd) (Captain)
- [Chris de Almeida](https://github.com/ctcpip)
- [Jean Burellier](https://github.com/sheplu)
- [Sebastian Beltran](https://github.com/bjohansebas)
- [Ulises Gascón](https://github.com/ulisesGascon)
- [Murat Kirazkaya](https://github.com/GroophyLifefor)

## Meetings

The Performance Working Group meets bi-weekly (see [meeting issues](https://github.com/expressjs/perf-wg/issues?q=is%3Aissue%20state%3Aopen%20label%3Ameeting)). The meeting is open to the public. The agenda and meeting notes
are published in this repository. You can find the calendar entries in the [OpenJS Foundation calendar](https://openjsf.org/collaboration).

## Offline Discussions

The Performance Working Group uses [GitHub issues](https://github.com/expressjs/perf-wg/issues) for offline discussion.
The discussions are open to the public and anyone may participate. Also, the group uses the channel `#express-perf-wg`
in the [OpenJS Foundation Slack](https://openjsf.org/collaboration) for realtime discussions.

## Code of Conduct

The [Express Project's CoC](https://github.com/expressjs/.github/blob/master/CODE_OF_CONDUCT.md) applies to this repo.

