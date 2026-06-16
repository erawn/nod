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

- add restart time to nodConfig
- Add to NodConfig how the program should be restarted — (i.e. allowed to finish or interrupted, and if interrupted, with what signal). Obv smart defaults are our friend here.
- format for notebook converstion with jupytext (light, percent, etc)
- allow optional bypassing of readonly after edits?
- if you want to test your program output after quit, you just gotta use the command line version

TODO

<!-- - make other frames read only after edit -->
<!-- - add banner at the top on read only NBs  -->
- move restart button -- make it a "refresh" button?
  - maybe a "push and pull" setup?
  - or maybe integrate jupytext more fully?( maybe not, I think thats more confusing tbh)
- test unlock
- nod on exception https://ipython.readthedocs.io/en/stable/interactive/magics.html#magic-pdb
- rename nb files to function--class
- throw warning if spec not installed
- Maybe have the current NOD Instance notebook be undeleteable and a different color?
- frozen modules?
[E 2026-06-09 16:28:22.375 ServerApp] 0.00s - Debugger warning: It seems that frozen modules are being used, which may
    0.00s - make the debugger miss breakpoints. Please pass -Xfrozen_modules=off
    0.00s - to python to disable frozen modules.
    0.00s - Note: Debugging will proceed. Set PYDEVD_DISABLE_FILE_VALIDATION=1 to disable this validation.
- dont quit existing sessions if jupyter lab closes?
-  ERROR:asyncio:Task was destroyed but it is pending!    130 ↵
task: <Task pending name='Task-72' coro=<Kernel.dispatch_control() running at /Users/erawn/.virtualenvs/nod-vryx/lib/python3.14/site-packages/ipykernel/kernelbase.py:344> cb=[ZMQStream._run_callback.<locals>._log_error() at /Users/erawn/.virtualenvs/nod-vryx/lib/python3.14/site-packages/zmq/eventloop/zmqstream.py:563]>
/opt/homebrew/Cellar/python@3.14/3.14.5/Frameworks/Python.framework/Versions/3.14/lib/python3.14/asyncio/base_events.py:744: RuntimeWarning: coroutine 'Kernel.dispatch_control' was never awaited
  self._ready.clear()
RuntimeWarning: Enable tracemalloc to get the object allocation traceback
- JupyterHub Integration?
  - paste CWD of JupyterLab for --existing?
  - how to get CWD string to subprocess? Pass as env variable? yes this should work
  - can we add as a CMD from the front end?
  - or an --existing flag to the nod call, then we add the command to the connection file
  - left hand pane that users can add CWD (or just specify the command to run directly from the pane?)
  - how to get info from pane to kernel provisioner?
  - if the python program is being run as a subprocess, we can set an enviornment variable for the connection directory
  - print CWD on bottom pane to paste into existing arg
    - problem with this is that we can't use existing provisioner architecture, bc the kernel doesn't own the subprocess
    - but we probably want stdout in some way
    - we can pipe the subprocess to the terminal? Can Jupyterhub people access the console?
    - no they can't, but maybe stdout doesn't matter? people can debug their programs to hit the notebook call ahead of time? If theres a bug before notebook we're gonna have a problem anyways
    - on the other hand, being able to continue with a program and see the output is cool
    — existing is working and we can see the data show up on the web front end, now we just need to 1. Check on the server side whether the process is actually running, 2. Build a ui to show any open sessions in the bottom left corner of the nod panel (copy the kernel menu?), and 3. Set a runner to continually check for new kernel files. 

- add exit without saving to menu
- "continue" option now that the provisioner is handling the subprocess?
- rename setting to "how_exit"?
  - maybe we don't need this -- people can just send a "quit" manually if they want to continue the program

Nice to have

- persist lock through reload?
- - clear old kernels from jupyter (get shutdown registering properly??)
    - layoutrestorer, restorablepool
- test timeouts to optimize (and on networked connections?)
- play with opacity on the surrounding code?
- mode to create function at call site?
- mark cells above nod() call as run?
- Change tracker --- which cells are unedited
- Add check interface where it shows side by side
  - final preview of exported code?
- debug nod with nod!!
  - need to specify the connection file directly in the cmd line args
  - or just change the cwd in the outer command? aka nod cd folder && nod python -m module

NOD Log Todo
nod.log(x)

- Nod log right sidebar
- just deep copy it and put it in a dict
- clicking on the side panel puts it in state
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

Nod log

- Look for cycles in taint analysis
- Fallback — compare outputs of each log session, if on forward eval they change, raise a big warning
- Argument isn’t that we’re inventing map, or array programming, but that once we focus on how notebooks let us reify dynamic parts of our program, we can let you do things for free that would normally require totally rewriting your program (aka applying a statement on one variable to an array of values)
  https://pyre-check.org/docs/pysa-basics/
- maybe we just need forward eval, and log is nod.log(savevariables)
  - problem with this is that we want the stack frame at the _beginning_ of the run, not the end.
  - maybe its just the user's problem if they don't include something that matters in the function call?

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
