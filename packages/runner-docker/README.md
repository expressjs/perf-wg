# Express Performance Runner (Docker)

A cross-platform Docker-based performance testing runner for Express.js applications.

## Cross-Platform Support

This package has been updated to support Windows, macOS, and Linux by replacing shell scripts with Node.js scripts:

- `scripts/build.mjs` - Builds the Docker image
- `scripts/run.mjs` - Runs performance tests in Docker
- `scripts/start.mjs` - Starts the server with profiling

## Usage

```bash
# Build the Docker image
npm run build

# Run performance tests
npm run run [cwd] [repo] [ref] [test]

# Start server with profiling
npm run start
```

## Requirements

- Node.js 18+
- Docker Desktop (on Windows/macOS) or Docker Engine (on Linux)

## Environment Variables

- `TEST` - The test package to run (required for start script)
- `REPO` - Git repository URL (for run script)
- `REF` - Git reference/branch (for run script)
- `NO_SPIN` - Disable spinner animation

# Plans


1. Start a workfow
    - input: `behchmark` & version `overrides`
2. Workflow provisions resources
    - 3 containers passing the inputs (pass inputs as `user_data`)
    - 1 balancer
3. Workflow starts load test
    - Containers report to DD
    - Containers collect FlameGraphs & maybe heap dumps?
    - Client reports metrics (maybe to dd?)
4. Clean up
5. Generate report


