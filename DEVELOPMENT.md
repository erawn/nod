# nod

<!-- https://stackoverflow.com/questions/31382405/ipython-notebook-how-to-connect-to-existing-kernel?rq=3 -->

404 GET /api/kernels/e9d194aa-bfbc-495d-8295-593039ab17e8/channels?session_id=6740bec7-2acd-4d6f-a6e2-33973306dfa4 (127.0.0.1): Kernel does not exist: e9d194aa-bfbc-495d-8295-593039ab17e8

Session not found: session_id='2e3651ad-e58a-41ec-8b90-ce370cf3d153'

pip install --force-reinstall nodpy-0.2.0-py3-none-any.whl  
NOTES:

- old kernel 404's --- WORKSPACE FILE. HOW to fix?
- just use Nod log to deep copy things, have no args capture all, args capture variables, and have a not=[] field to capture all but some. Restart shouldn't do anything different because it can't reset the whole stackframe, but you can just click back into a specific frame to reset the state. - this also gets you out of having to do the full-adult mode, because users can just nodlog the things they want to checkpoint and leave out a huge dataset which can't be copied but can be modified.
  -how to do linked execution? when you select one nod.log, maybe the rest of the same nodlogs also light up with a button to do linked execution
- how to mark globals? Can we do this somehow with just the structure of the program?
- --existing flag and left hand pane to specify CWD VS specifying command directly from the panel?
  - 1. is potentially less work but more clunky, also might be difficult to find the right path, and you get no feedback if it doesn't work. Maybe the --existing spits out a path string to paste into the frontend
  - 2. might not be that hard to do if we can just specify the kernelspec command when we execute and that will work as expected. But I'm not thrilled about the idea of writing a terminal command in a plaintext window.

NODCONFIG

- add restart time to nodConfig? (hmm maybe)

Nod Tracking

- set tracking where?

- notebook()
  - NodInfo (but with code transformed)
  - NodLog (but with code transformed)
- write request
  - Program info before (but with code transformed)
  - Program info after (but with code transformed)
- execute cell
- navigate stackframe
- save notebook
- restart
  - whether we write or not

TODO

- path concat bug
- merge and publish
- add question on forum
- figure out how to install jupyter server extension in jupyter hub
  - https://discourse.jupyter.org/t/how-to-enable-javascript-in-jupyter-notebook/20371
  - try to build nod from brand new template???
- test on savio and tinyhub
- nod on exception https://ipython.readthedocs.io/en/stable/interactive/magics.html#magic-pdb
- rename setting to "how_exit"?
  -and actually implement it
- change quit kernel to send quit first, stop process at notebook() if the setting is set
- Change tracker --- which cells are unedited
- frozen modules?
  [E 2026-06-09 16:28:22.375 ServerApp] 0.00s - Debugger warning: It seems that frozen modules are being used, which may
  0.00s - make the debugger miss breakpoints. Please pass -Xfrozen_modules=off
  0.00s - to python to disable frozen modules.
  0.00s - Note: Debugging will proceed. Set PYDEVD_DISABLE_FILE_VALIDATION=1 to disable this validation.

Nice to have

- persist lock through reload?
- - clear old kernels from jupyter (get shutdown registering properly??)
    - layoutrestorer, restorablepool
    - this is happening because old webpages are still trying to load stuff - we need to disable this? (maybe a hook on deactivate/disconnect)

- test timeouts to optimize (and on networked connections?)
- play with opacity on the surrounding code?
- mode to create function at call site?
- mark cells above nod() call as run?

- Add check interface where it shows side by side
  - final preview of exported code?
- debug nod with nod!!
  - need to specify the connection file directly in the cmd line args
  - or just change the cwd in the outer command? aka nod cd folder && nod python -m module

NOD Log Todo

- have a 'unique' boolean in nod.log() that doesn't save if it compares equal to another obj in the list

Nod Save Args
nod.save_args(f, [x,y,z])

- Linked editing on all saved args
- refuse to run if any free vars
- can call from anywhere in the program
- args must be deep copyable
- group saved args by whether f is identical
- user can just rewrite the function to have an inner pure func to call save_args on.
- allow_globals flag?

<!-- Nod log

- Look for cycles in taint analysis
- Fallback — compare outputs of each log session, if on forward eval they change, raise a big warning
- Argument isn’t that we’re inventing map, or array programming, but that once we focus on how notebooks let us reify dynamic parts of our program, we can let you do things for free that would normally require totally rewriting your program (aka applying a statement on one variable to an array of values)
  https://pyre-check.org/docs/pysa-basics/
- maybe we just need forward eval, and log is nod.log(savevariables)
  - problem with this is that we want the stack frame at the _beginning_ of the run, not the end.
  - maybe its just the user's problem if they don't include something that matters in the function call? -->

Stretch

- Display variables for each call stack in green/red depending on whether they’re problematic, display warnings

Decorator vs imbedded — decorator gives clear points for taint analysis, doesn’t let us leverage the user logic though.

Inter-function, the sources and sinks are anything referenced in the body, and the sinks

Will the taint analysis catch things like for loops tho? If not, this would be an argument to use a decorator instead

<!-- - mode order -- 1. just do forward eval, 2. deep-copy for expensive programs, 3. adult-mode.
    - how to switch modes? notebook() args?  -->
<!-- - figure out why jupytext isn't respecting the kernelinfo metadata, so that we can restart the notebook without switching to normal python kernel
    - alternatively, figure out how to switch the kernel always to python
    - ok maybe its actually switching properly but restart has wiped the state  -->
