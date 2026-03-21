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
import shutil

import jupytext  # type: ignore
from nbformat import NotebookNode
import nbformat
import orjson
import shlex
import sys
import copy
import re
import tempfile
import typing
import ipykernel

# from jupyter_client import KernelProvisionerBase
import os
import logging
import traceback as tb
import json
import os
import subprocess
from traitlets.config import Config
import uuid
from pathlib import Path
import libcst as cst
from libcst.display import dump
from .serverExtension import Nod
from libcst.metadata import CodePosition, CodeRange
from libcst.metadata import PositionProvider, ParentNodeProvider
from IPython.core.interactiveshell import InteractiveShell
from dataclasses import dataclass
from typing import List, Literal, TYPE_CHECKING, IO, Any
from IPython.core.getipython import get_ipython
from ipykernel.connect import get_connection_info
from .embed_kernel import embed_kernel
from .ast_tools import NodFinder
from .file_helpers import ProgramInfo, getProgramInfo
from .datastore import LogStore
from inspect import FrameInfo, Traceback
from types import FrameType, TracebackType
from jupytext.formats import long_form_one_format  # type: ignore
from .provisioner import nodProvisioner

if TYPE_CHECKING:
    # False at run time, only for type checker
    from _typeshed import SupportsWrite

_log = logging.getLogger(__name__)
logging.basicConfig()
_log.setLevel(logging.INFO)


DRY_RUN = False


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


# def loadFrame(frame_id: FrameIdentifiers, stack: list[FrameInfo]):
#     frame_info: FrameInfo = next((fr for fr in stack if compare_identifiers(frame_id,fr)), None)
#     shell: InteractiveShell = get_ipython()
#     if shell is None:
#         return
#     shell.push(frame_info.frame.locals)
#     shell.push(frame_info.frame.globals)

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


def notebook(
    modules: list[str] = [],
    # indent: int = 1,
    on_condition: bool = True,
    deep_copy: bool = False,
):
    """Invoke a Jupyter Notebook at this location in the source code, with code in the same indent block being editable.
    modules:
        list of modules (as strings) to include in the trace. __main__ included by default.

    on_condition
        if true, invoke the notebook, else no-op.

    deep_copy
        if true, deep copy the variables to put into the notebook. By default, in-place modifications are persisted through kernel restarts. Can lead to performance issues with large variables in memory.

    """
    # indent
    # number of indent blocks to make editable
    if not on_condition:
        return

    # Prevent Nested Nod Instances
    try:
        name = get_ipython().__class__.__name__
        if name != "NoneType":
            return
    except NameError:
        pass

    stack = inspect.stack()

    def find_notebook_func(frame: inspect.FrameInfo):
        if frame.code_context is None:
            raise RuntimeError

        for line in frame.code_context:
            if line.find("notebook()") > 0:
                return True
        return False

    notebook_call = next((frame for frame in stack if find_notebook_func(frame)), None)

    if notebook_call is None:
        # TODO: Throw Error
        return
    notebook_call_index = stack.index(notebook_call)
    if notebook_call_index + 1 > len(stack):
        raise IndexError
    notebook_parent_frame = stack[notebook_call_index + 1]

    relevant_stack_frames = [
        frame
        for frame in stack[notebook_call_index:]
        if frame.frame.f_globals.get("__name__") == "__main__"
        or frame.frame.f_globals.get("__name__") in modules
    ]
    print("relevant stack frames")
    print(relevant_stack_frames)

    modules.append("__main__")

    def tracing_function(frame: FrameType, event: str, arg: Any):
        if event == "call":  # only get function calls
            module_name = frame.f_globals.get("__name__")
            if module_name in modules:
                frame_info = inspect.getframeinfo(frame)
                if frame.f_back is None:
                    # TODO
                    parent_frame_info = None
                else:
                    parent_frame_info = inspect.getframeinfo(frame.f_back)

                if len(
                    [
                        fr
                        for fr in relevant_stack_frames
                        if compare_identifiers(fr, frame_info)
                    ]
                ) > 0 or (
                    parent_frame_info is not None
                    and compare_identifiers(notebook_parent_frame, parent_frame_info)
                ):  # only get calls in modules we're interested in
                    print("FOUND FRAME")
                    print(frame)
                    # print(arg)
                    return tracing_function
        return None

    sys.setprofile(tracing_function)  # type: ignore

    program_text = open(notebook_call.filename).read()
    wrapper = cst.MetadataWrapper(cst.parse_module(program_text))
    # _log.info(dump(cst.parse_module(program_text)))
    finder = NodFinder(notebook_call.lineno)
    ast_with_position = wrapper.visit(finder)
    # _log.info("CST with notebook call removed ")
    # _log.info(dump(cst.parse_module(program_text)))
    if finder.body_indent is None:
        # TODO raise error
        return

    program_info = getProgramInfo(finder, ast_with_position)

    ## FILE ORGANIZATION
    hiddenDir = os.path.join(os.getcwd(), ".nod")
    os.makedirs(hiddenDir, exist_ok=True)

    archiveDir = os.path.join(hiddenDir, "archive")
    os.makedirs(archiveDir, exist_ok=True)

    notebook_checkpoints = os.path.join(hiddenDir, ".ipynb_checkpoints")
    os.makedirs(notebook_checkpoints, exist_ok=True)

    archive_checkpoints = os.path.join(archiveDir, ".ipynb_checkpoints")
    os.makedirs(archive_checkpoints, exist_ok=True)
    # TODO - check if file, if so, delete

    connection_dir = os.path.join(hiddenDir, "connection")
    if os.path.exists(connection_dir):
        shutil.rmtree(connection_dir)
    os.makedirs(connection_dir, exist_ok=True)

    file_names = os.listdir(notebook_checkpoints)
    for file_name in file_names:
        if os.path.isfile(os.path.join(notebook_checkpoints, file_name)):
            if os.path.exists(os.path.join(archive_checkpoints, file_name)):
                os.replace(
                    os.path.join(notebook_checkpoints, file_name),
                    os.path.join(archive_checkpoints, file_name),
                )
            else:
                shutil.move(
                    os.path.join(notebook_checkpoints, file_name), archive_checkpoints
                )

    os.rmdir(notebook_checkpoints)

    file_names = os.listdir(hiddenDir)
    for file_name in file_names:
        if os.path.isfile(os.path.join(hiddenDir, file_name)):
            if os.path.exists(os.path.join(archiveDir, file_name)):
                os.replace(
                    os.path.join(hiddenDir, file_name),
                    os.path.join(archiveDir, file_name),
                )
            else:
                shutil.move(os.path.join(hiddenDir, file_name), archiveDir)

    tempFileStem = os.path.join(
        hiddenDir, Path(notebook_call.filename).stem + str(uuid.uuid1())
    )
    # tempPythonFile = tempFileStem + ".py"
    # with open(tempPythonFile, "x") as f:
    #     f.writelines(program_info.text_body)

    tempNotebook = tempFileStem + ".ipynb"
    # args = shlex.split(
    #     "--to notebook "
    #     + tempPythonFile
    #     + " --from py:light "
    #     + "--output "
    #     + tempNotebook
    # )
    # jupytext.cli.jupytext(args)
    notebook: NotebookNode = jupytext.reads(
        "".join(program_info.text_body), fmt=long_form_one_format("py:light")
    )
    notebook.metadata["language_info"] = {
        "name": "python",
        "version": "3.14.3",
        "mimetype": "text/x-python",
        "codemirror_mode": {"name": "ipython", "version": 3},
        "pygments_lexer": "ipython3",
        "nbconvert_exporter": "python",
        "file_extension": ".py",
    }
    notebook.metadata["kernelspec"] = {
        "display_name": "Python 3 (ipykernel)",
        "language": "python",
        "name": "python3",
    }

    jupytext.write(notebook, tempNotebook, fmt=".ipynb")

    def getNotebook(notebook):
        content = jupytext.writes(
            notebook, version=nbformat.NO_CONVERT, fmt=long_form_one_format("ipynb")
        )
        if isinstance(content, bytes):
            content = content.decode("utf8")
        return content

    program_info.file_name = os.path.relpath(tempNotebook, os.getcwd())
    program_info.export_file = os.path.relpath(notebook_call.filename, os.getcwd())
    program_info.connection_dir = os.path.relpath(connection_dir, os.getcwd())
    _log.info(program_info)
    jsonInfo = orjson.dumps(program_info)
    # _log.info("Program Info JSON: " + str(jsonInfo))

    c = Config()
    # so they get added to user namespace
    # c.InteractiveShellApp.exec_lines = [
    #     "get_ipython().push(__STARTINGVARIABLES)",
    # ]
    # c.InteractiveShellApp.hide_initial_ns = False

    ## STARTING STATE
    # startingVariables = {}
    # if deep_copy:
    #     startingVariables.update(copy.deepcopy(notebook_call.frame.f_globals))
    #     startingVariables.update(copy.deepcopy(notebook_call.frame.f_locals))
    # else:
    #     startingVariables.update(notebook_call.frame.f_globals)
    #     startingVariables.update(notebook_call.frame.f_locals)

    scope = {
        "__NODINFO": program_info,
        "__NODSTACK": stack[stack.index(notebook_call) :],
    }

    app = embed_kernel(
        local_ns=scope, config=c, no_stdout=False, no_stderr=False, quiet=False
    )
    # app.shell.push(startingVariables)
    # app.kernel.startingVariables = startingVariables  # set this value in order to reset variables on kernel restart

    ## COPY CONNECTION FILE, ADD KERNEL NAME
    connection_file = app.abs_connection_file
    _log.info("Connection File Path: " + str(app.abs_connection_file))

    info = None
    with open(connection_file) as f:
        info_str = f.read()
        info = orjson.loads(info_str)
        # info["kernel_name"] = "nod"
        # info["display_name"] = "nod_display"
        # info["language"] = "python"
        # info["metadata"] = {
        #     "kernel_provisioner": {"provisioner_name": "nod-provisioner"}
        # }
        # info["metadata"] = {"kernel_provisioner": {"config": {}}}
        _log.info("Connection File: " + str(info))

    with open(connection_file, "w") as f:
        f.write(orjson.dumps(info).decode("utf-8"))

    nod_connection_file = os.path.join(connection_dir, Path(connection_file).name)
    shutil.copy(connection_file, nod_connection_file)

    # _log.warning(jsonInfo)

    ## RUNNING NOTEBOOK
    cmd = (
        "jupyter lab"
        + " "
        + "--KernelProvisionerFactory.default_provisioner_name=nod-provisioner"
        + " "
        + "--ContentsManager.allow_hidden=True"
        + " "
        + "--ServerApp.allow_external_kernels=True"
        + " "
        # + "--ServerApp.kernel_manager_class=nod.kernelmanager.NodMappingKernelManager"
        # + " "
        + "--ServerApp.websocket_ping_interval=0"
        + " "
        + "--ServerApp.websocket_ping_timeout=0"
        + " "
        # + "--ServerApp.external_connection_dir="
        # + os.path.join(hiddenDir, "kernel")
        # + " "
        # + "--AsyncMultiKernelManager.use_pending_kernels=True"
        # + " "
        + "--LabServerApp.log_level=INFO"
        + " "
        + "--LabApp.log_level=INFO"
        + " "
        + "--ExtensionApp.log_level=INFO"
        + " "
        + "--Application.log_level=INFO"
        + " "
        # + "--KernelSpecManager.kernel_dirs=['"
        # + connection_dir
        # + "']"
        + " "
        + "--notebook-dir"
        + " "
        + os.path.dirname(notebook_call.filename)
        + " "
        + "--Nod.is_active=True"
        + " "
        # + "--Nod.connection_dir="
        # + connection_dir
        # + " "
        + "--Nod.info="
        + base64.b64encode(jsonInfo).decode("utf-8")
        + " "
        # + "--ServerApp.jpserver_extensions=\"{'nod': True}\""
        # + " "
        + tempNotebook
    )
    _log.info(cmd)
    args = shlex.split(cmd)
    _log.info("Notebook Args: " + str(args))
    if not DRY_RUN:
        nb_env = os.environ.copy()
        nb_env["JUPYTER_RUNTIME_DIR"] = connection_dir
        notebookProcess = subprocess.Popen(args, env=nb_env)
        app.nod_notebook_process = notebookProcess  # type: ignore

    def close_notebook():
        import os
        import signal

        notebookProcess.terminate()  # type: ignore
        pid = os.getpid()
        pgid = os.getpgid(pid)
        # Prefer process-group over process
        # but only if the kernel is the leader of the process group
        if pgid and pgid == pid and hasattr(os, "killpg"):
            try:
                _log.warning("KERNEL KILLPG")
                os.killpg(pgid, signal.SIGTERM)
            except OSError:
                _log.warning("KERNEL KILLP Error")
                os.kill(pid, signal.SIGTERM)
                raise
        else:
            _log.warning("KERNEL KILLP")
            os.kill(pid, signal.SIGTERM)

        _log.warning("KERNEL PROCESS KILL")

    if not DRY_RUN:
        atexit.register(close_notebook)
        app.start()

    # notebookProcess.kill()

    # # Fork a child process
    # _log.warning("forking")
    # processid = os.fork()
    # _log.warning(processid)

    # # processid > 0 represents the parent process
    # if processid > 0:
    #     _log.warning("\nParent Process:")
    #     _log.warning(os.getpid())
    #     _log.warning("Child's process ID: %d", processid)
    #
    #     sys.op

    # # processid = 0 represents the created child process
    # else:

    #     app.init_code()
    #     app.start()
    #     _log.warning("\nChild Process:")
    #     _log.warning("Process ID:%d", os.getpid())
    #     _log.warning("Parent's process ID:%d", os.getppid())


# _log = logging.getLogger(__name__)


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "nodjs"}]


def _jupyter_server_extension_points():
    return [
        {
            "module": "nodpy",
            "app": Nod,
        }
    ]
