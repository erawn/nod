# nod

<!-- https://stackoverflow.com/questions/31382405/ipython-notebook-how-to-connect-to-existing-kernel?rq=3 -->
404 GET /api/kernels/e9d194aa-bfbc-495d-8295-593039ab17e8/channels?session_id=6740bec7-2acd-4d6f-a6e2-33973306dfa4 (127.0.0.1): Kernel does not exist: e9d194aa-bfbc-495d-8295-593039ab17e8

Session not found: session_id='2e3651ad-e58a-41ec-8b90-ce370cf3d153'



SIGNALS
- SIGINT
    - should pause execution of kernel, not send to notebook process, and not reset state


- SIGKILL

- SIGTERM

COMMANDS
- shutdown

- restart button
    - launches kernel again

NOTES:
- cant watch connection dir from server, because we can't trigger a client update from server
- run python program from provisioner now that we can pass the command to it --- it can just manage the process like its a kernel? 
- still have to find the kernel proper, but restart can now just restart the entire python process, just gotta relook for new connection file to pop up -- gotta wait for this to happen if the program takes a minute 
- reconcile connection files --- might not be returning something I need to from launch_kernel, or the dummy processes are returning the wrong thing.
-- why isn't connection info being rewritten during reset?? 
    --alternatively, set the kernels of all the other notebooks to the existing kernel
TODO 
- install kernel automatically 
    - install in the local env folder 
- change stack frame when different notebook selected 
- Give user a way to send a signal to the python program (aka specify how program should be restarted, pass this to provisioner)
- Add config type to nodConfig (e.g. forward, copy, no-copy)
- Display variables for each call stack in green/red depending on whether they’re problematic, display warnings 
- Add to NodConfig how the program should be restarted — (i.e. allowed to finish or interrupted, and if interrupted, with what signal). Obv smart defaults are our friend here. 
- Change tracker --- which cells are unedited 
- final preview of exported code?
- make other frames read only after edit
- multiple returns --- we need a magic which will stop execution of the cell 
- convert notebook export with jupytext back to pylight 
    - server extension should handle this
- glob pattern on module include
- nod on exception https://ipython.readthedocs.io/en/stable/interactive/magics.html#magic-pdb 

- mode order -- 1. just do forward eval, 2. deep-copy for expensive programs, 3. adult-mode.
    - how to switch modes? notebook() args? 
- figure out why jupytext isn't respecting the kernelinfo metadata, so that we can restart the notebook without switching to normal python kernel
    - alternatively, figure out how to switch the kernel always to python
    - ok maybe its actually switching properly but restart has wiped the state 
- restart python program by getting original arguments from python, sending to jupyter, then sending "quit" to ipython and re-running the args 
    - backup-- a nodConfig() object to paste the command? 
- clear old kernels from jupyter (get shutdown registering properly??)
- rename nb files to function--class
- select NOD kernel at notebook open
    - throw warning if spec not installed
- convert system to background runner - look for incoming kernel files and update UI to match 
    - Watch for changes + update
- Maybe have the current NOD Instance notebook be undeleteable and a different color? 
- JupyterHub Integration? 
- if the python program is being run as a subprocess, we can set an enviornment variable for the connection directory 
- add restart time to nodConfig
- Logging system 
- Force re-runs on export (manual? How to trigger from nb?)

- Auto install kernel file 

NOD Log Todo
- Nod log right sidebar 
- Linked editing on all nod-logged stack frames? 

Nod log
- Look for cycles in taint analysis 
- Fallback — compare outputs of each log session, if on forward eval they change, raise a big warning
- Argument isn’t that we’re inventing map, or array programming, but that once we focus on how notebooks let us reify dynamic parts of our program, we can let you do things for free that would normally require totally rewriting your program (aka applying a statement on one variable to an array of values) 
https://pyre-check.org/docs/pysa-basics/ 


Decorator vs imbedded — decorator gives clear points for taint analysis, doesn’t let us leverage the user logic though. 

Inter-function, the sources and sinks are anything referenced in the body, and the sinks 

Will the taint analysis catch things like for loops tho? If not, this would be an argument to use a decorator instead






- show side panel on start
- grey out shutdown button
- test timeouts to optimize (and on networked connections?)
- on export and exit, close the window? 
- test restart on in-place operations
- dont orphan notebook process when sent "quit" 
save cell output -- display somehow in main code? 
- add exit without saving to menu
- autosplit option
- mark cells above nod() call as run? 
- mode to create function at call site? 
- add param to nod() for stack frame/indent depth?
- Add check interface where it shows side by side 
Settings 
- format for notebook converstion with jupytext (light, percent, etc)
- name the kernel something unique in the menu
- remove kernel actions from pallette 
- make current test notebook with same name, only add iid to previous versions