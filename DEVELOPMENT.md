# nod

<!-- https://stackoverflow.com/questions/31382405/ipython-notebook-how-to-connect-to-existing-kernel?rq=3 -->
404 GET /api/kernels/e9d194aa-bfbc-495d-8295-593039ab17e8/channels?session_id=6740bec7-2acd-4d6f-a6e2-33973306dfa4 (127.0.0.1): Kernel does not exist: e9d194aa-bfbc-495d-8295-593039ab17e8

Session not found: session_id='2e3651ad-e58a-41ec-8b90-ce370cf3d153'


NOTES:

- just use Nod log to deep copy things, have no args capture all, args capture variables, and have a not=[] field to capture all but some. Restart shouldn't do anything different because it can't reset the whole stackframe, but you can just click back into a specific frame to reset the state. 
    - this also gets you out of having to do the full-adult mode, because users can just nodlog the things they want to checkpoint and leave out a huge dataset which can't be copied but can be modified.
-how to do linked execution? when you select one nod.log, maybe the rest of the same nodlogs also light up with a button to do linked execution 
- how to mark globals? Can we do this somehow with just the structure of the program? 
-  --existing flag and left hand pane to specify CWD VS specifying command directly from the panel?
    - 1. is potentially less work but more clunky, also might be difficult to find the right path, and you get no feedback if it doesn't work. Maybe the --existing spits out a path string to paste into the frontend
    - 2. might not be that hard to do if we can just specify the kernelspec command when we execute and that will work as expected. But I'm not thrilled about the idea of writing a terminal command in a plaintext window. 

NODCONFIG
- add restart time to nodConfig
- Add to NodConfig how the program should be restarted — (i.e. allowed to finish or interrupted, and if interrupted, with what signal). Obv smart defaults are our friend here. 
- format for notebook converstion with jupytext (light, percent, etc)
- allow optional bypassing of readonly after edits? 
- module list --- shouldn't be changing the tracing 
TODO 
- paste CWD of JupyterLab for --existing?
- Change tracker --- which cells are unedited 
<!-- - make other frames read only after edit -->
    - add banner at the top on read only NBs 
    - test unlock
- get exporting working again
- multiple returns --- we need a magic which will stop execution of the cell
    - ast transform to something that will throw an error and display the result.
    - how to silence the error? Intercept at front end level?  
- convert markdown back to notebook with nbcovert or jupytext
    - server extension should handle this
- glob pattern on module include
- nod on exception https://ipython.readthedocs.io/en/stable/interactive/magics.html#magic-pdb 
- add label in left panel to edited notebook. 
- allow running cells across notebooks before editing? 


- clear old kernels from jupyter (get shutdown registering properly??)
- rename nb files to function--class
<!-- - select NOD kernel at notebook open -->
    - throw warning if spec not installed
- Maybe have the current NOD Instance notebook be undeleteable and a different color? 
- JupyterHub Integration? 
    - can we add as a CMD from the front end?
    - or an --existing flag to the nod call, then we add the command to the connection file 
    - left hand pane that users can add CWD (or just specify the command to run directly from the pane?)
    - how to get info from pane to kernel provisioner?
    - if the python program is being run as a subprocess, we can set an enviornment variable for the connection directory 
- test timeouts to optimize (and on networked connections?)
- test restart on in-place operations
- add exit without saving to menu
- mark cells above nod() call as run? 
- post-hoc filter on callstack? 
- play with opacity on the surrounding code? 

Nice to have
- mode to create function at call site? 
- Add check interface where it shows side by side 
    - final preview of exported code?
- debug nod with nod!!
    - need to specify the connection file directly in the cmd line args

<!-- - mode order -- 1. just do forward eval, 2. deep-copy for expensive programs, 3. adult-mode.
    - how to switch modes? notebook() args?  -->
<!-- - figure out why jupytext isn't respecting the kernelinfo metadata, so that we can restart the notebook without switching to normal python kernel
    - alternatively, figure out how to switch the kernel always to python
    - ok maybe its actually switching properly but restart has wiped the state  -->

NOD Log Todo
nod.log(x)
- Nod log right sidebar 
- just deep copy it and put it in a dict
- clicking on the side panel puts it in state 

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
    - problem with this is that we want the stack frame at the *beginning* of the run, not the end.
    - maybe its just the user's problem if they don't include something that matters in the function call?

Stretch
- Display variables for each call stack in green/red depending on whether they’re problematic, display warnings 

Decorator vs imbedded — decorator gives clear points for taint analysis, doesn’t let us leverage the user logic though. 

Inter-function, the sources and sinks are anything referenced in the body, and the sinks 

Will the taint analysis catch things like for loops tho? If not, this would be an argument to use a decorator instead





