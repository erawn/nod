# NOD: Notebooks-On-Demand

### Put a Notebook Anywhere

Nod is a JupyterLab extension for inserting a notebook anywhere in a running Python program, allowing you to make edits while interacting with the real state of your program wherever you want. Nod is like a breakpoint with a notebook inside.

#### To Get Started:
1. `pip install jupyter` if you don't have Jupyter already installed.
2. `pip install nodpy && nod --install-kernel`
3. Call the `notebook()` function somewhere in your program. (See [Usage](#usage) for an example).
4. Run your python program with `nod <command to execute your python script>`

## Participate in Research!

Interested in using Nod? Try it out for 3-6 weeks and chat with me about it! Participants recieve a gift card of \$50-\$100 (depending on how much time we chat for). All the details are in the [Sign Up Form](https://forms.gle/mDhWRuZwCBkG9TdE8).

My name is Eric Rawn. I'm a PhD Student at UC Berkeley. To build the best system I can (and do some research along the way), I want to see how folks are using Nod in their own work, and I'd really love your insight! If you decide to participate, the extension will log some usage data locally on your machine, which you'll send to me manually at the end of the study. We'll have a few conversations about your experience with the extension and the kind of work you do.

If you have any questions at all, send me an email at erawn@berkeley.edu, and feel free to send this page to anyone you think might be interested! Thanks so much!

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

Notice above that we haven't executed `x = 1` yet, but `x` is in our kernel state. This is because `x` was in the current stack frame of the program when we called `notebook()`!

Nod will open everything in the _current function body_ to edit.

On the left side is a panel to navigate up and down your callstack---your notebook state will switch automatically to the variables at that place in the program. You'll notice three buttons at the top of the Nod Panel:

- <img src="media/nod_dl.png" alt="markdown language" height="30" > Sends any text changes made in the notebook back to your source files. By default, the notebook is converted to [light](https://jupytext.org/formats/scripts) format \(see [Config](#nodconfig) for more options.\)
- <img src="media/nod_restart.png" alt="markdown language" height="30" > Restarts your original python program by re-executing the `<command>` from your `nod <command>` command line invocation, and updates the Jupyter editor to match. If you want to make changes directly to your source file and pull them to your Nod Jupyter session, just press "Restart without Saving" at the prompt when you restart.
- <img src="media/nod_exit.png" alt="markdown language" height="30" > Quits the current Nod kernel. By default, your python program will continue to run from `notebook()` until it exits itself. If you would like to signal the program instead, see [how_exit](#nodconfig).

### NodLog

To save values to put into the Notebook state later, call `nodLog(var,var,...)`:

```python
from nodpy import notebook, nodLog
def f():
    for i in range(10):
        nodLog(i)
    notebook()
f()
```

and you'll see a list in your Nod Session appear on the `Nod Log` panel on the right:

<img src="media/nod_log.png" width="200px"/>

Click the <img src="media/nod_log_button.png" alt="markdown language" height="30" > button to put that value into the notebook state.

_Variables passed to NodLog must be able to [deepcopy](https://docs.python.org/3/library/copy.html#copy.deepcopy)_

### JupyterHub Integration

JupyterHub users (and anyone else who doesn't want a new Jupyter window to spawn for every Nod session) can use `-e` or `-existing` in their `nod` call:
`nod -e python -m module`
and the session will appear in the left panel under "Sessions":

<img src="media/nod_existing.png" alt="markdown language" width="300" >

Press "Connect" to open the session in Jupyterlab. JupyterHub users might have trouble installing the server extension portion of Nod. This is still a work in progress. Please make an issue if you are trying to get Nod working in a JupyterHub enviornment and I'll do my best to help.

**Important**: JupyterLab can't open files located outside of its home directory or any subdirectories, so make sure you call `nod -e <cmd>` in a directory you can see in the JupyterLab file navigator.

### NodConfig

To configure module-level settings for Nod, call `nodConfig()` at the entry point for your Python program. Options are:

- **filter**: (default ['\<CWD\>/**'])
  list of paths (as strings) to include in the trace filter. Accepts \*, ?, and [] as wildcards

- **fmt**: (default 'light')
  notebook conversion format.
  Options: "light", "percent"

- **how_exit**: (default 'continue')
  how the Nod session should be exited from the notebook.
  "continue" returns to let the program finish, and "exit" will stop the program.
  Options: 'continue', 'exit'

- **dangerously_bypass_readonly**: (default 'false')
  Once the code in associated with one stack frame in a Nod Session is edited, the others become read-only by default to prevent reaching a confusing state. Set to true to remove this safeguard, if you know what you're doing.

### How do I recover files if I forget to send my changes back to the source, or Jupyter crashes?

In the directory you call `nod <cmd>` in, a `./nod/` folder will be created to store the current notebooks (`/nod/connection/`) and previous ones (`/nod/archive/`), so you should be able to recover any notebooks in there (including notebook checkpoints), as long as they were saved (you pressed `CTRL+S` in Jupyterlab).
