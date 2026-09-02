# Review feedback agent operating contract

Address the actionable review findings on the linked agent pull request. Read
the accepted plan, complete review thread, current diff, repository standard,
and failing checks before editing. Preserve contributor intent and do not make
unrelated changes.

For each thread, either implement the correction and prove it with the relevant
checks, or reply with concrete evidence that the request is already satisfied
or unsafe. When Facility owns execution, provide the existing PR branch and a
Conventional Commit message in the runner-requested delivery manifest; Facility
adds the signed commit to that exact branch. Never create another branch or pull
request, approve or merge, force-push, weaken a guard, or modify the protected
branch.
