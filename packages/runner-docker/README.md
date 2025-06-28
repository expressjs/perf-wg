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


