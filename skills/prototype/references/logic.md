# Logic prototype

One self-contained HTML file that lets anyone drive a state model by clicking
buttons. Use it for business rules, state transitions, and data shapes: the
things that read fine on paper and feel wrong once real cases run through them.
Because it is one file, it can go to a designer, a clinician, or a client, so
it speaks their language, not the code's.

## Steps

1. **State the question** in one visible paragraph at the top of the page: the
   model, and what you are checking about it.
2. **Isolate the logic** in one `<script>` block as a small pure module that
   could move into the real codebase unchanged. Pick the shape the question
   needs:
   - a reducer, `(state, action) => state`, for discrete events;
   - a state machine, when "which actions are legal now" is part of the
     question;
   - pure functions over a plain data type, when there is no current state;
   - a class with a clear method surface, when the logic owns ongoing state.

   The module never touches the page. The page calls into it.
3. **Build the page**, top to bottom: title and the question; the current state
   as labelled fields (not raw JSON), re-rendered after every click with the
   change called out; one free-play button per action; and guided walkthroughs,
   one tab per scenario, each resetting to a known start and stepping through
   real buttons. Cover the happy path, an awkward edge case, and something that
   should be illegal.
4. **Use domain words** on every label. Plain HTML, CSS, and JavaScript; no
   framework, bundler, or server. Clean type, generous spacing, one accent
   color.
5. **Hand it over** and watch for "wait, that should not be possible": those
   are the bugs in the idea. Add actions or scenarios as they ask.
6. **Capture** the verdict, then lift the validated module into the real code
   (where `build` gives it tests) and commit the HTML shell to the prototype
   branch.
