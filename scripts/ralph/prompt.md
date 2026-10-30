# Ralph Loop Agent Iteration Prompt

You are an autonomous engineering agent running in a fresh context iteration of the **Ralph Loop** on the **REWIND Agent Lab** repository.

Your objective is to make steady, verifiable progress by executing **EXACTLY ONE** atomic task from `PRD.md`.

---

## Operating Protocol

1. **Re-Orient:**
   - Read `PRD.md` to review the architectural invariants, Definition of Done, and task list.
   - Inspect the recent git commit log (`git log -n 3 --oneline`) and working tree (`git status`).

2. **Select Task:**
   - Identify the **FIRST** unchecked task `[ ]` in `PRD.md`.
   - Do NOT work on multiple tasks in this single iteration. Focus exclusively on this one task.

3. **Implement:**
   - Follow the Search-First discipline: search/grep relevant code before reading entire files.
   - Author or refactor the required code cleanly.
   - Do NOT introduce any third-party npm runtime dependencies. Keep Node.js `>=22` native ES modules (`.mjs`).

4. **Verify:**
   - Write corresponding automated tests in `test/`.
   - Run verification locally:
     ```bash
     npm run check && npm test
     ```
   - Both must exit with code 0. All previous tests plus new tests must pass.

5. **Commit & Update:**
   - Stage changed files.
   - Commit using standard format:
     ```bash
     git commit -m "<type>(<scope>): <summary>"
     ```
   - Update `PRD.md`: mark the completed task as `[x]` and append a row to the **Execution Progress Log** table with the iteration number, task ID, description, and commit hash.
   - Commit the PRD update:
     ```bash
     git commit -m "docs(prd): mark <TASK-ID> as complete"
     ```

6. **End Turn:**
   - Output a brief summary of what was accomplished, the verification output, and the commit hash.
   - Conclude your turn to allow the Ralph loop to clear context and start the next iteration.
