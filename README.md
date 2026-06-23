# NOD: Notebook-On-Demand

#### Put a Notebook Anywhere

Nod is a JupyterLab extension for inserting a notebook anywhere in a running Python program, allowing you to make edits while interacting with the real state of your program wherever you want. Nod is like a breakpoint with a notebook inside.

To install run `pip install nodpy && nod --install-kernel`

## Usage

In a Python file call `notebook()` anywhere:

```python
#myfile.py
from nodpy import notebook

def f():
    x = 1
    notebook()
f()
```

then run the python program with `nod <command>`:

```bash
nod python -m myfile
```

and you'll see a Jupyter editor with the current state of your program when you called `notebook()`:
![](media/nod_demo.png)

Nod will open everything in the _current function body_ to edit.

On the left side is a panel to navigate up and down your callstack---your notebook state will switch automatically to the variables at that place in the program. You'll notice three buttons at the top of the Nod Panel:

- <img src="media/nod_dl.png" alt="markdown language" height="30" > Sends any text changes made in the notebook back to your source files. By default, the notebook is converted to [light](https://jupytext.org/formats/scripts/#the-light-format) format \(see [Config](#nodconfig) for more options.\)
- <img src="media/nod_restart.png" alt="markdown language" height="30" > Restarts your original python program by re-executing the `<command>` from your `nod <command>` command line invocation, and updates the Jupyter editor to match. If you want to make changes directly to your source file and pull them to your Nod Jupyter session, just press "Restart without Saving" at the prompt when you restart.
- <img src="media/nod_exit.png" alt="markdown language" height="30" > Quits the current Nod kernel.

### JupyterHub Integration

JupyterHub users (and anyone else who doesn't want a new Jupyter window to spawn for every Nod session) can use `-e` or `-existing` in their `nod` call:
`nod -e python -m module`
and the session will appear in the left panel under "Sessions":

<img src="media/nod_existing.png" alt="markdown language" width="300" >

**Important**: JupyterLab can't open files located outside of its home directory or any subdirectories, so make sure you call `nod -e <cmd>` in a directory you can see in the JupyterLab file navigator.

### NodConfig

To configure module-level settings for Nod, call `nodConfig()` at the top of a file:

- **filter**: (default ['\<CWD\>/**'])
  list of paths (as strings) to include in the trace filter. Accepts \*, ?, and [] as wildcards

- **fmt**: (default 'light')
  notebook conversion format.
  Options: "light", "percent"

- **how_restart**: (default 'continue')
  how the python program should be restarted from the notebook.
  "continue" returns to let the program finish, and "exit" will stop the program.
  Options: 'continue', 'exit'

- **dangerously_bypass_readonly**: (default 'false')
  Once the code in associated with one stack frame in a Nod Session is edited, the others become read-only by default to prevent reaching a confusing state. Set to true to remove this safeguard, if you know what you're doing.

### How do I recover files if I forget to send my changes back to the source, or Jupyter crashes?

In the directory you call `nod <cmd>` in, a `./nod/` folder will be created to store the current notebooks (`/nod/connection/`) and previous ones (`/nod/archive/`), so you should be able to recover any notebooks in there (including notebook checkpoints), as long as they were saved (you pressed `CTRL+S` in Jupyterlab).
