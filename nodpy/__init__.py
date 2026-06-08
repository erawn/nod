try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings

    warnings.warn("Importing 'nodpy' outside a proper installation.")
    __version__ = "dev"
import atexit
import base64
import inspect
from pprint import pprint
import shutil
import types

import jupytext  # type: ignore
from nbformat import NotebookNode
import nbformat
import orjson
import shlex
import sys
import copy
import signal
import re
import tempfile
import typing
import ipykernel

# from jupyter_client import KernelProvisionerBase
import os
import logging
import json
import os
import subprocess
from traitlets.config import Config
import uuid
from pathlib import Path
import libcst as cst
from libcst.display import dump
from IPython.core.error import UsageError
from nodpy.ip_plugin import returnTransformer
from .serverExtension import Nod
from libcst.metadata import CodePosition, CodeRange
from libcst.metadata import PositionProvider, ParentNodeProvider
from IPython.core.interactiveshell import InteractiveShell
from dataclasses import dataclass
from typing import List, Literal, TYPE_CHECKING, IO, Any, cast
from IPython.core.getipython import get_ipython
from ipykernel.connect import get_connection_info
from .embed_kernel import embed_kernel
from .ast_tools import FunctionFinder, NodFinder
from .file_helpers import PathManager, ProgramInfo, makeProgramInfo
from .datastore import LogStore
from inspect import FrameInfo, Traceback
from types import FrameType, TracebackType
from jupytext.formats import long_form_one_format  # type: ignore
from IPython.terminal.interactiveshell import TerminalInteractiveShell
from .provisioner import NodProvisioner
from enum import Enum, IntEnum
from .ip_plugin import nodReturn
from IPython.core.interactiveshell import ExecutionResult
import traceback

if TYPE_CHECKING:
    # False at run time, only for type checker
    from _typeshed import SupportsWrite

_log = logging.getLogger(__name__)
logging.basicConfig()
_log.setLevel(logging.INFO)


DRY_RUN = False

DEBUG: bool = True


@dataclass
class FrameIdentifiers:
    function: str
    lineno: int
    filename: str

    def get_id(self) -> str:
        return self.function + str(self.lineno) + self.filename

    def __init__(self, frame_info: FrameInfo | Traceback):
        self.function = frame_info.function
        self.lineno = frame_info.lineno
        self.filename = frame_info.filename


def compare_identifiers(
    frame_id: FrameInfo | Traceback | FrameIdentifiers,
    frame_info: FrameInfo | Traceback | FrameIdentifiers,
) -> bool:
    return (
        frame_info.function == frame_id.function
        and frame_info.lineno == frame_id.lineno
        and frame_info.filename == frame_id.filename
    )


# def loadState(frame_identifier:FrameIdentifiers, state:dict[dict]):
#     frame_id = frame_identifier.get_id()
#     shell: InteractiveShell = get_ipython()
#     if frame_id in state.keys():
#         shell.push(state[frame_id])

# def saveState(frame_identifier:FrameIdentifiers, state:dict[dict]):
#     frame_id = frame_identifier.get_id()
#     shell: InteractiveShell = get_ipython()
#     if frame_id in state.keys():
#         shell.

# def clearState():


# def resetState():
#     """Clear all internal namespaces, and attempt to release references to
#     user objects.

#     If new_session is True, a new history session will be opened.
#     """
#     shell = get_ipython()
#     shell.run_line_magic("reset", "-f -s")
#     if shell.user_ns.get("__STARTINGVARIABLES", False):
#         shell.push(shell.user_ns["__STARTINGVARIABLES"])


# def log(*args, **kwargs):
#     logStore = LogStore()
#     logStore.logs.append()

#     logStore.logs.append(dict(val))
#     vars = locals() + globals()

#     [k for k, v in locals.items() if v in args][0]

#     for key, val in kwargs.items():
#         logStore.logs.append(dict(key=val))
#         print(key, val)
# def nodConfig():


def nodPrint(
    *values: object,
    sep: str | None = " ",
    end: str | None = "\n",
    file: SupportsWrite[str] | None = None,
    flush: Literal[False] = False,
):
    """Inside of an IPython Instance, prints the values to a stream, or to sys.stdout by default.

    sep
      string inserted between values, default a space.
    end
      string appended after the last value, default a newline.
    file
      a file-like object (stream); defaults to the current sys.stdout.
    flush
      whether to forcibly flush the stream.
    """
    # Prevent Nested Nod Instances
    try:
        name = get_ipython().__class__.__name__
        if name != "NoneType":
            print(
                *values,
                sep=sep,
                end=end,
                file=file,
                flush=flush,
            )
    except NameError:
        pass


# class Signals(IntEnum):
#     SIGINT: int
#     SIGKILL: int
#     SIGTERM: int


# _SIGNUM = typing.Union[int, Signals]
_fmt: typing.Literal["light", "percent"] = "light"
_modules: list[str] = [os.getcwd() + "/*"]
_how_restart: typing.Union[typing.Literal["continue"], int] = "continue"
_dangerously_bypass_readonly: bool = False

class NodException(Exception):
    """Exception raised for custom error in the application."""

    def __init__(self, message):
        super().__init__(message)
        self.message = message

    def __str__(self):
        return f"{self.message})"

def nodConfig(
    fmt: typing.Literal["light", "percent"] = "light",
    modules: list[str] = [],
    how_restart: typing.Union[typing.Literal["continue"], int] = "continue",
    dangerously_bypass_readonly: bool = False,
):
    """Configure Nod Settings
    modules:
        list of modules (as strings) to include in the trace. __main__ included by default, also accepts *, ?, and [] as wildcards

    fmt:
        notebook conversion format.

    how_restart
        how the python program should be restarted from the notebook.
        "continue" returns to let the program finish
        SIGINT, SIGKILL, or SIGTERM will send that signal to the program instead

    dangerously_bypass_readonly
        Once the code in associated with one stack frame in a Nod Session is edited, the others become read-only by default to prevent reaching a confusing state. Set to true to remove this safeguard, if you know what you're doing.
    """
    global _fmt
    _fmt = fmt
    global _modules
    _modules = modules
    global _how_restart
    _how_restart = how_restart
    global _dangerously_bypass_readonly
    _dangerously_bypass_readonly = dangerously_bypass_readonly


def notebook(
    modules: list[str] = [],
    # indent: int = 1,
    # on_condition: bool = True,
    # deep_copy: bool = False,
):
    """Invoke a Jupyter Notebook at this location in the source code, with code in the same indent block being editable.
    modules:
        list of modules (as strings) to include in the trace. __main__ included by default.


    """
    # on_condition
    #     if true, invoke the notebook, else no-op.

    # deep_copy
    #     if true, deep copy the variables to put into the notebook. By default, in-place modifications to existing variables are persisted through kernel restarts. Enabling can lead to performance issues with large variables in memory. Some variables cannot be deep-copied, and will throw a warning on execution.

    # indent
    # number of indent blocks to make editable
    # if not on_condition:
    #     return

    # Prevent Nested Nod Instances
    try:
        name = get_ipython().__class__.__name__
        if name != "NoneType":
            return
    except NameError:
        pass

    runtime_dir = os.environ.get("NOD_RUNTIME_DIR", "")
    _log.info(f"NOD_RUNTIME_DIR: {runtime_dir}")
    stack = inspect.stack()

    def find_notebook_func(frame: inspect.FrameInfo):
        if frame.code_context is None:
            # raise RuntimeError
            return False

        for line in frame.code_context:
            if line.find("notebook(") > 0:  # TODO replace with regex
                return True
        return False

    notebook_call = next((frame for frame in stack if find_notebook_func(frame)), None)

    if notebook_call is None:
        raise NodException("Cannot find notebook() function call in callstack")
    
    notebook_call_index = stack.index(notebook_call)
    if notebook_call_index + 1 > len(stack):
        raise IndexError
    notebook_parent_frame = stack[notebook_call_index + 1]
    frozenPattern = re.compile("<frozen .*>")
    relevant_stack_frames = [
        frame
        for frame in stack[notebook_call_index:]
        if frozenPattern.match(frame.filename) is None
    ]
    # _log.info(stack[notebook_call_index:])
    # _log.info(relevant_stack_frames)

    ## FILE ORGANIZATION
    pm = PathManager()

    module_sources: dict[str, cst.Module] = {}
    for stackFrame in relevant_stack_frames:
        if module_sources.get(stackFrame.filename) is None:
            try:
                if os.path.isfile(stackFrame.filename):
                    program_text = open(stackFrame.filename).read()
                    module_sources.update(
                        {stackFrame.filename: cst.parse_module(program_text)}
                    )
                else:
                    _log.info(stackFrame)
            except:
                _log.info(f"Couldn't find source for {stackFrame.filename}")
                pass

    stack_info = [
        makeProgramInfo(
            stackFrame,
            index,
            module_sources.get(stackFrame.filename, None),
            pm,
            _fmt,
        )
        for index, stackFrame in enumerate(relevant_stack_frames)
    ]
    if modules == []:
        module_filters = _modules
    else:
        module_filters = modules

    jsonInfo = orjson.dumps(
        {
            "stack_info": stack_info,
            "module_filters": module_filters,
            "fmt": _fmt,
            "how_restart": _how_restart,
            "dangerously_bypass_readonly": _dangerously_bypass_readonly,
        }
    )

    c = Config()
    # so they get added to user namespace
    # c.InteractiveShellApp.exec_lines = [
    #     "get_ipython().push(__STARTINGVARIABLES)",
    # ]
    # c.InteractiveShellApp.hide_initial_ns = False
    # c.HistoryManager.hist_file = ":memory:"

    startingVariables = {}
    startingVariables.update(notebook_call.frame.f_globals)
    startingVariables.update(notebook_call.frame.f_locals)
    startingVariables.update({"nodReturn": nodReturn})

    app = embed_kernel(
        local_ns=startingVariables,
        config=c,
        no_stdout=False,
        no_stderr=False,
        quiet=False,  # (not DEBUG)
    )

    shell = cast(TerminalInteractiveShell, app.shell)
    shell.ast_transformers.append(returnTransformer())
    old_traceback = shell.showtraceback

    # To handle returns gracefully, we need to intercept the tracebacks so users don't see the error
    def showtraceback(
        self,
        exc_tuple: tuple[type[BaseException], BaseException, Any] | None = None,
        filename: str | None = None,
        tb_offset: int | None = None,
        exception_only: bool = False,
        running_compiled_code: bool = False,
    ) -> None:
        """Display the exception that just occurred.

        If nothing is known about the exception, this is the method which
        should be used throughout the code for presenting user tracebacks,
        rather than directly invoking the InteractiveTB object.

        A specific showsyntaxerror() also exists, but this method can take
        care of calling it if needed, so unless you are explicitly catching a
        SyntaxError exception, don't try to analyze the stack manually and
        simply call this method."""

        try:
            etype, value, tb = self._get_exc_info(exc_tuple)
            if str(type(value).__name__) == "NodStopExecution":
                return
        except:
            pass

        old_traceback(
            exc_tuple, filename, tb_offset, exception_only, running_compiled_code
        )

    shell.showtraceback = types.MethodType(showtraceback, shell)

    app.kernel.relevant_stack_frames = relevant_stack_frames

    ## COPY CONNECTION FILE, ADD KERNEL NAME
    connection_file = app.abs_connection_file
    _log.info("Connection File Path: " + str(app.abs_connection_file))

    info = None
    with open(connection_file) as f:
        info_str = f.read()
        info = orjson.loads(info_str)
        info["kernel_name"] = "nod"
        info["display_name"] = "nod"
        # info["language"] = "python"
        # info["metadata"] = {
        #     "kernel_provisioner": {"provisioner_name": "nod-provisioner"}
        # }
        # info["metadata"] = {"kernel_provisioner": {"config": {}}}
        _log.info("Connection File: " + str(info))

    with open(connection_file, "w") as f:
        f.write(orjson.dumps(info).decode("utf-8"))

    nod_connection_file = os.path.join(pm.connection_dir, Path(connection_file).name)
    shutil.copy(connection_file, nod_connection_file)

    with open(os.path.join(pm.connection_dir, "nodInfo.json"), "x") as f:
        f.write(jsonInfo.decode("utf-8"))

    if not DRY_RUN:
        # atexit.register(close_notebook)
        app.start()
        app.reset_io()
        # if _how_restart == 'continue':
        #         newStackFrame = relevant_stack_frames[0]
        #         if app.shell is not None:
        #             reset(app.shell, True, True)
        #             app.shell.user_ns.update(newStackFrame.frame.f_locals)
        #             app.shell.user_global_ns.update(newStackFrame.frame.f_globals)
        #             app.shell.user_ns_hidden.update(newStackFrame.frame.f_builtins)
        # TODO nonlocal promote
        # switch back to first frame


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "nodjs"}]


def _jupyter_server_extension_points():
    return [
        {
            "module": "nodpy",
            "app": Nod,
        }
    ]
