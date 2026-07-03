try:
    from nodpy._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings

    warnings.warn("Importing 'nodpy' outside a proper installation.")
    __version__ = "dev"
import atexit
import inspect
import shutil
import sys
import types
import orjson
import copy
import re

import os
import logging
from traitlets.config import Config
import uuid
from pathlib import Path
import libcst as cst
from varname.utils import ArgSourceType
from nodpy.ast_tools import FunctionFinder
from nodpy.exceptions import NodException
from nodpy.ip_plugin import returnTransformer
from nodpy.nodTypes import (
    FrameIdentifiers,
    NodConnectionInfo,
    NodInfo,
)
from nodpy.embed_kernel import embed_kernel
from nodpy.file_helpers import (
    PathManager,
    makeProgramInfo,
)
from nodpy.provisioner import NodProvisioner  # DON'T REMOVE THIS
from nodpy.serverExtension import Nod
from IPython.core.interactiveshell import InteractiveShell
import typing as t
from typing import Any, cast
from IPython.core.getipython import get_ipython


from IPython.terminal.interactiveshell import TerminalInteractiveShell
from varname import argname
import traceback


def _jupyter_server_extension_points():
    return [
        {
            "module": "nodpy",
            "app": Nod,
            "name": "nodpy",
        }
    ]


# def _jupyter_server_extension_paths() -> list[dict[str, str]]:
#     return [{"module": "notebook"}]


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "nod"}]


# def _jupyter_server_extension_points():
#     return [{
#         "module": "nodpy"
#     }]


# def _load_jupyter_server_extension(server_app):
#     """Registers the API handler to receive HTTP requests from the frontend extension.

#     Parameters
#     ----------
#     server_app: jupyterlab.labapp.LabApp
#         JupyterLab application instance
#     """
#     setup_route_handlers(server_app.web_app)
#     name = "nodpy"
#     server_app.log.info(f"Registered {name} server extension")


_log = logging.getLogger(__name__)
logging.basicConfig()
_log.setLevel(logging.WARN)
_log.addHandler(logging.FileHandler("log.txt"))

DRY_RUN = False

DEBUG: bool = False

if DEBUG:
    _log.setLevel(logging.DEBUG)

# class Signals(IntEnum):
#     SIGINT: int
#     SIGKILL: int
#     SIGTERM: int
_nod_log: dict[str, dict[str, t.Any]] = {}
_nod_log_id_to_func: dict[str, str] = {}


def nodLog(*args):
    try:
        name = get_ipython().__class__.__name__
        if name != "NoneType":
            return
        if "nodReturn" in globals():
            return
    except NameError:
        pass
    # currentFrame = inspect.currentframe()
    # _log.info(currentFrame.f_locals)
    # _log.info(currentFrame.f_globals)
    stack = inspect.stack()
    log_call = next((frame for frame in stack if find_func(frame, "nodLog(")), None)

    if log_call is None:
        raise NodException("Cannot find notebook() function call in callstack")
    with open(log_call.filename) as f:
        program_text = f.read()
    module = cst.parse_module(program_text)
    wrapper = cst.MetadataWrapper(module)
    finder = FunctionFinder(log_call.function)
    module = wrapper.visit(finder)
    # _log.info(f"log call {log_call.frame.f_locals}")

    # currentFrame = inspect.currentframe()
    if log_call.function == "<module>":
        start_line = 0
    else:
        start_line = finder.parent_pos.start.line
    frame_id = FrameIdentifiers(log_call.function, start_line, log_call.filename)
    # encoded_frame_id = base64.b64encode(frame_id.get_id().encode("utf-8")).decode(
    #     "utf-8"
    # )
    function_id = frame_id.get_id()
    argnames = t.cast(tuple[ArgSourceType], argname("args"))
    entry_id = "nl_" + uuid.uuid4().hex
    variables: dict[str, t.Any] = {}
    for name, val in zip(argnames, args):
        try:
            # _log.info(f"found var {name} with val {val}")
            # _log.info(_get_variable_description(val))
            deepCopy = copy.deepcopy(val)
            variables.update({str(name): deepCopy})
        except Exception as e:
            _log.error(f"Deep Copy Failed! on var {name} with val {val} error:  {e}")
    _nod_log.update({entry_id: variables})
    _nod_log_id_to_func.update({entry_id: function_id})
    _log.debug(f"added var to log: {entry_id}: {variables}")


_fmt: t.Literal["light", "percent"] = "light"
_filter: list[str] = [os.getcwd() + "/**"]
_how_restart: t.Union[t.Literal["continue"], int] = "continue"
_dangerously_bypass_readonly: bool = False


def nodConfig(
    fmt: t.Literal["light", "percent"] = "light",
    filter: list[str] = [],
    how_restart: t.Union[t.Literal["continue"], int] = "continue",
    dangerously_bypass_readonly: bool = False,
    notebook_on_exception=False,
):
    """Configure Nod Settings
    filter: (default ['<CWD>/**'])
        list of paths (as strings) to include in the trace filter. Accepts *, ?, and [] as wildcards

    fmt: (default 'light')
        notebook conversion format.
        Options: "light", "percent"

    how_restart: (default 'continue')
        how the python program should be restarted from the notebook.
        "continue" returns to let the program finish, and "exit" will stop the program.
        Options: 'continue', 'exit'

    dangerously_bypass_readonly: (default 'false')
        Once the code in associated with one stack frame in a Nod Session is edited, the others become read-only by default to prevent reaching a confusing state. Set to true to remove this safeguard, if you know what you're doing.
    """
    global _fmt
    _fmt = fmt
    global _filter
    _filter = filter
    global _how_restart
    _how_restart = how_restart
    global _dangerously_bypass_readonly
    _dangerously_bypass_readonly = dangerously_bypass_readonly

    if notebook_on_exception:

        def nb(type, value, tb):
            traceback.print_exception(type, value, tb)
            notebook()

        sys.excepthook = nb


def find_func(frame: inspect.FrameInfo, func: str):
    if frame.code_context is None:
        # raise RuntimeError
        return False

    for line in frame.code_context:
        if line.find(func) > -1:  # TODO replace with regex
            return True
    return False


def notebook(
    filter: list[str] = [],
    # indent: int = 1,
    # on_condition: bool = True,
    # deep_copy: bool = False,
):
    """Invoke a Jupyter Notebook at this location in the source code, with code in the same indent block being editable.
    filter:
        list of filter (as strings) to include in the trace. __main__ included by default.


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
        if "nodReturn" in globals():
            return
        # if "nodReturn" in locals():
        #     return
    except NameError:
        pass
    print("nod: reached notebook(), starting session...")

    # print("NB ENTER")
    runtime_dir = os.environ.get("NOD_RUNTIME_DIR", "")

    _log.info(f"NOD_RUNTIME_DIR: {runtime_dir}")
    nod_cli_args_64 = os.environ.get("NOD_CLI_ARGS", "")
    # _log.info(f"NOD_CLI_ARGS: {nod_cli_args_64}")
    stack = inspect.stack()
    # print(stack)

    notebook_call = next(
        (frame for frame in stack if find_func(frame, "notebook(")), None
    )

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
                    with open(stackFrame.filename) as f:
                        program_text = f.read()
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
    if filter == []:
        module_filters = _filter
    else:
        module_filters = filter

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
    from nodpy.ip_plugin import nodReturn

    startingVariables.update({"nodReturn": nodReturn})

    app = embed_kernel(
        local_ns=startingVariables,
        config=c,
        no_stdout=False,
        no_stderr=False,
        quiet=False,  # (not DEBUG)
        # transport="ipc",
    )

    def quitOnExit():
        print("Nod session exiting...", flush=True)
        try:
            shell: InteractiveShell = app.shell  # type: ignore
            shell.exit_now = True
            if _how_restart != "continue":
                os.kill(os.getpid(), _how_restart)
        except:
            pass

    atexit.register(quitOnExit)

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

    shell.showtraceback = types.MethodType(showtraceback, shell)  # type: ignore[method-assign]

    app.kernel.relevant_stack_frames = relevant_stack_frames
    app.kernel.nod_log = _nod_log
    app.kernel.nod_log_id_to_func = _nod_log_id_to_func

    ## COPY CONNECTION FILE, ADD KERNEL NAME
    connection_file = app.abs_connection_file
    _log.info("Connection File Path: " + str(app.abs_connection_file))
    nod_info_local_path = os.path.join(pm.connection_dir, "nodInfo.json")
    regex = re.compile(r".*kernel-(.{2,8})\.json")
    match = regex.match(connection_file)
    if match is None:
        _log.error("NO PID MATCH")
        return None
    kernel_pid = int(match.group(1))

    nod_info = NodInfo(
        stack_info,
        module_filters,
        _fmt,
        _how_restart,
        _dangerously_bypass_readonly,
        nod_info_local_path,
        nod_cli_args_64,
        python_pid=os.getpid(),
        kernel_pid=kernel_pid,
    )
    info = None
    with open(connection_file) as f:
        info_str = f.read()
        info = NodConnectionInfo.from_json(info_str)
        info.kernel_name = "nod"
        info.display_name = "nod"
        # info["language"] = "python"
        info.metadata = {
            "kernel_provisioner": {"provisioner_name": "nod-provisioner"},
            "nod_info": nod_info,
        }
        # info["metadata"] = {"kernel_provisioner": {"config": {}}}
        # _log.info("Connection File: " + str(info))
        nod_info.key = info.key
    with open(connection_file, "w") as f:
        f.write(orjson.dumps(info).decode("utf-8"))

    nod_connection_file = os.path.join(pm.connection_dir, Path(connection_file).name)
    shutil.copy(connection_file, nod_connection_file)

    jsonInfo = orjson.dumps(nod_info)
    # _log.info(jsonInfo)
    with open(nod_info_local_path, "x") as f:
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
