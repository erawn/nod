try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings

    warnings.warn("Importing 'nod' outside a proper installation.")
    __version__ = "dev"
import time
import inspect
import shlex
import sys
import re
import tempfile
import typing
import ipykernel
from jupyter_client import KernelProvisionerBase
import os
import logging
import json
import os
import subprocess
import glob
from traitlets.config import Config
from ipykernel.kernelapp import IPKernelApp
from IPython.utils.frame import extract_module_locals
import ast
import uuid
from pathlib import Path
import libcst as cst
import jupytext.cli
from libcst.display import dump
from nod.ast_tools import NodFinder, NodRemove
from libcst.metadata import CodePosition, CodeRange
from libcst.metadata import PositionProvider, ParentNodeProvider

_log = logging.getLogger(__name__)


def nod():
    frameInfo = inspect.stack()[1]
    origSourceProgram = open(frameInfo.filename).read()
    wrapper = cst.MetadataWrapper(cst.parse_module(origSourceProgram))

    finder = NodFinder(frameInfo.lineno)
    metaAST = wrapper.visit(finder)
    newWrapper = cst.MetadataWrapper(metaAST)
    filteredAST = newWrapper.visit(NodRemove(frameInfo.lineno))
    target_node = finder.target_node
    func_body: CodeRange = finder.body_indent
    func_pos: CodeRange = finder.target_pos
    indent = func_body.start.column
    print("BODY POS", finder.body_indent)
    print("DEF POS", finder.target_pos)

    if func_pos is None:
        print("BAD POS")
        return
    # TODO -- return if not in a function?

    sourceLines = filteredAST.code.splitlines("\n")
    functionHeader = sourceLines[func_pos.start.line - 1 : func_body.start.line - 1]

    functionBody = [
        line[indent:] if line[:indent] == """ """ * indent else line
        for line in sourceLines[func_body.start.line - 1 : func_body.end.line]
    ]
    textAbove = sourceLines[max(func_pos.start.line - 11, 0) : func_pos.start.line - 1]
    textBelow = sourceLines[
        min(func_pos.end.line, len(sourceLines) - 1) : min(
            func_pos.end.line + 11, len(sourceLines) - 1
        )
    ]

    print("header,body", functionHeader, functionBody)
    print("pre/post text", textAbove, textBelow)

    hiddenDir = os.path.join(os.getcwd(), ".nod")
    os.makedirs(hiddenDir, exist_ok=True)
    tempFileStem = os.path.join(
        os.getcwd(), ".nod", Path(frameInfo.filename).stem + str(uuid.uuid1())
    )
    tempPythonFile = tempFileStem + ".py"
    with open(tempPythonFile, "x") as f:
        f.writelines(functionBody)

    tempNotebook = tempFileStem + ".ipynb"
    args = shlex.split(
        "--to notebook "
        + tempPythonFile
        + " --from py:light "
        + "--output "
        + tempNotebook
    )
    jupytext.cli.jupytext(args)

    caller_frame = frameInfo.frame
    info = {
        "sourceFile": os.path.relpath(frameInfo.filename),
        "line": frameInfo.lineno,
        "textAbove": textAbove,
        "textBelow": textBelow,
        "functionHeader": functionHeader,
        "funcBodyPosition": (func_body.start.column, func_body.end.line),
        "indent": indent,
    }
    scope = {"__NODINFO": json.dumps(info)}
    scope.update(caller_frame.f_globals)
    scope.update(caller_frame.f_locals)

    c = Config()
    # c.InteractiveShellApp.exec_file =
    c.InteractiveShellApp.exec_lines = [
        "from ipylab import JupyterFrontEnd",
        "app = JupyterFrontEnd()",
        "app.on_ready(app.commands.execute('apputils:change-theme', { 'theme': 'JupyterLab Dark' }))",
    ]
    print("PID", os.getpid())
    app = embed_kernel(local_ns=scope, config=c, no_stdout=False, no_stderr=False)
    print("Connection File", app.abs_connection_file)
    app.exec_lines = ["testVar = 2010"]
    args = shlex.split(
        "jupyter lab --KernelProvisionerFactory.default_provisioner_name=nod-provisioner "
        + "--ContentsManager.allow_hidden=True "
        + "--notebook-dir "
        + os.path.dirname(frameInfo.filename)
        + " "
        + tempNotebook
    )
    notebookProcess = subprocess.Popen(args)

    app.init_code()
    app.start()

    # notebookProcess.kill()

    # # Fork a child process
    # processid = os.fork()
    # print(processid)

    # # processid > 0 represents the parent process
    # if processid > 0:
    #     print("\nParent Process:")
    #     print("Process ID:", os.getpid())
    #     print("Child's process ID:", processid)

    # # processid = 0 represents the created child process
    # else:
    #     print("\nChild Process:")
    #     print("Process ID:", os.getpid())
    #     print("Parent's process ID:", os.getppid())


def embed_kernel(module=None, local_ns=None, **kwargs):
    """Embed and start an IPython kernel in a given scope.

    Parameters
    ----------
    module : ModuleType, optional
        The module to load into IPython globals (default: caller)
    local_ns : dict, optional
        The namespace to load into IPython user namespace (default: caller)
    kwargs : dict, optional
        Further keyword args are relayed to the IPKernelApp constructor,
        allowing configuration of the Kernel.  Will only have an effect
        on the first embed_kernel call for a given process.

    """
    print("Starting Kernel")
    # os.environ["NOD_IPYTHON_CONNECTION_FILE"] = "test2"
    # get the app if it exists, or set it up if it doesn't
    if IPKernelApp.initialized():
        print("Already Initialized")
        app = IPKernelApp.instance()
    else:
        print("Initializing")
        app = IPKernelApp.instance(**kwargs)

        app.abs_connection_file
        app.initialize([])
        # Undo unnecessary sys module mangling from init_sys_modules.
        # This would not be necessary if we could prevent it
        # in the first place by using a different InteractiveShell
        # subclass, as in the regular embed case.
        main = app.kernel.shell._orig_sys_modules_main_mod
        if main is not None:
            sys.modules[app.kernel.shell._orig_sys_modules_main_name] = main

    # load the calling scope if not given
    (caller_module, caller_locals) = extract_module_locals(1)
    if module is None:
        module = caller_module
    if local_ns is None:
        local_ns = dict(**caller_locals)

    app.kernel.user_module = module
    assert isinstance(local_ns, dict)
    app.kernel.user_ns = local_ns
    app.shell.set_completer_frame()  # type:ignore[union-attr]
    # print("Starting IPKernel with NS:")
    # print(local_ns)
    # os.environ["NOD_IPYTHON_CONNECTION_FILE"] = "test"
    # print("setting connection file:", app.connection_file)
    return app


# _log = logging.getLogger(__name__)


def get_latest_connection_file():

    def get_jupyter_runtime_dir():
        result = subprocess.run(
            ["jupyter", "--runtime-dir"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True,
        )
        return result.stdout.strip()

    jupyter_runtime_dir = get_jupyter_runtime_dir()
    connection_filenames = glob.glob(f"{jupyter_runtime_dir}/kernel-*.json")

    regex = re.compile(r".*kernel-.{2,8}\.json")
    pid_filenames = list(filter(regex.match, connection_filenames))
    latest_connection_filename = max(pid_filenames, key=os.path.getctime)
    print("FILENAME", latest_connection_filename)

    # connection_file = os.environ["NOD_IPYTHON_CONNECTION_FILE"]
    # print("connection file", connection_file)
    return latest_connection_filename


class nodProvisioner(KernelProvisionerBase):
    """
    A Kernel Provisioner that re-uses an existing kernel.
    The kernel connection file is fetched as the latest
    modified connection file.
    """

    async def launch_kernel(self, cmd, **kwargs):
        connection_file = get_latest_connection_file()

        with open(connection_file) as f:
            file_info = json.load(f)

        file_info["key"] = file_info["key"].encode()
        print(file_info)
        return file_info

    async def pre_launch(self, **kwargs):
        kwargs = await super().pre_launch(**kwargs)
        kwargs.setdefault("cmd", None)
        return kwargs

    def has_process(self) -> bool:
        return True

    async def poll(self):
        pass

    async def wait(self):
        pass

    async def send_signal(self, signum: int):
        pass

    async def kill(self, restart=False):
        if restart:
            _log.warning("Cannot restart kernel.")

    async def terminate(self, restart=False):
        if restart:
            _log.warning("Cannot restart kernel.")

    async def cleanup(self, restart):
        pass


def _jupyter_labextension_paths():
    return [{"src": "labextension", "dest": "nod"}]
