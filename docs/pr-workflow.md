# Pull Request Workflow

To run a load test against a pull request, the repo needs to implement the shared PR workflow. This can be done by
adding the following workflow file.

```yaml
name: PR Load Test
on:
  pull_request:

jobs:
  load:
    name: Run Load Tests
    uses: expressjs/perf-wg/.github/workflows/pr.yml
```

This will create a run like the following (todo get better screenshots once this is merged and working):

![Example PR job run](docs/assets/pull-request-workflow.png)

This will run the same load test against the current branch *and* the target branch then compare the results. Both runs
output and the comparison should be available in the job status.
