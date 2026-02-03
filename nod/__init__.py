try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings

    warnings.warn("Importing 'nod' outside a proper installation.")
    __version__ = "dev"
import shutil

import orjson
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
import traceback as tb
import json
import os
import subprocess
import glob
from traitlets.config import Config
import uuid
from pathlib import Path
import libcst as cst
import jupytext.cli
from libcst.display import dump
from .serverExtension import Nod
from libcst.metadata import CodePosition, CodeRange
from libcst.metadata import PositionProvider, ParentNodeProvider
from IPython.core.interactiveshell import InteractiveShell
from varname import nameof
import snoop
import executing
from dataclasses import dataclass
from typing import List
from IPython.core.getipython import get_ipython

from nod.embed_kernel import embed_kernel
from nod.ast_tools import NodFinder
from nod.serverExtension import setup_handlers
from .file_helpers import ProgramInfo, getProgramInfo
from .datastore import LogStore, StartingVariables

_log = logging.getLogger(__name__)

from nod.provisioner import nodProvisioner


def resetState():
    """Clear all internal namespaces, and attempt to release references to
    user objects.

    If new_session is True, a new history session will be opened.
    """
    shell = get_ipython()
    shell.run_line_magic("reset", "-f -s")
    if shell.user_ns.get("__STARTINGVARIABLES", False):
        shell.push(shell.user_ns["__STARTINGVARIABLES"])


def log(*args, **kwargs):
    logStore = LogStore()
    logStore.logs.append()

    logStore.logs.append(dict(val))
    vars = locals() + globals()

    [k for k, v in locals.items() if v in args][0]

    for key, val in kwargs.items():
        logStore.logs.append(dict(key=val))
        print(key, val)


def notebook(
    on_condition: bool = True,
):
    if not on_condition:
        return

    try:
        name = get_ipython().__class__.__name__
        if name != "NoneType":
            return
    except NameError:
        pass

    stack = inspect.stack()

    def find_in_notebook(frame: inspect.FrameInfo):
        for line in frame.code_context:
            if line.find("notebook()") > 0:
                return True
        return False

    notebook_call = next((frame for frame in stack if find_in_notebook(frame)), None)

    program_text = open(notebook_call.filename).read()
    wrapper = cst.MetadataWrapper(cst.parse_module(program_text))
    finder = NodFinder(notebook_call.lineno)
    ast_with_position = wrapper.visit(finder)

    if finder.body_indent is None:
        # TODO raise error
        return

    program_info = getProgramInfo(finder, ast_with_position)

    ## FILE ORGANIZATION
    hiddenDir = os.path.join(os.getcwd(), ".nod")
    os.makedirs(hiddenDir, exist_ok=True)
    archiveDir = os.path.join(hiddenDir, "archive")
    os.makedirs(archiveDir, exist_ok=True)

    connection_dir = os.path.join(hiddenDir, "connection")
    if os.path.exists(connection_dir):
        shutil.rmtree(connection_dir)
    os.makedirs(connection_dir, exist_ok=True)

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
    tempPythonFile = tempFileStem + ".py"
    with open(tempPythonFile, "x") as f:
        f.writelines(program_info.text_body)

    tempNotebook = tempFileStem + ".ipynb"
    args = shlex.split(
        "--to notebook "
        + tempPythonFile
        + " --from py:light "
        + "--output "
        + tempNotebook
    )
    jupytext.cli.jupytext(args)

    jsonInfo = orjson.dumps(program_info)

    ## STARTING STATE

    startingVariables = {}
    startingVariables.update(notebook_call.frame.f_globals)
    startingVariables.update(notebook_call.frame.f_locals)
    scope = {"__NODINFO": jsonInfo, "__STARTINGVARIABLES": startingVariables}

    c = Config()
    # so they get added to user namespace
    c.InteractiveShellApp.exec_lines = [
        "get_ipython().push(__STARTINGVARIABLES)",
    ]
    # c.InteractiveShellApp.hide_initial_ns = False
    app = embed_kernel(
        local_ns=scope, config=c, no_stdout=False, no_stderr=False, quiet=False
    )
    app.shell.push(startingVariables)
    # connection_file = app.abs_connection_file
    # shutil.copy(
    #     connection_file, os.path.join(connection_dir, Path(connection_file).name)
    # )
    # print("Connection File", app.abs_connection_file)
    # app.exec_lines = ["testVar = 2010"]
    _log.warning(jsonInfo)

    ## RUNNING NOTEBOOK
    args = shlex.split(
        "jupyter lab --KernelProvisionerFactory.default_provisioner_name=nod-provisioner"
        + " "
        + "--ContentsManager.allow_hidden=True"
        + " "
        + "--notebook-dir"
        + " "
        + os.path.dirname(notebook_call.filename)
        + " "
        + "--Nod.is_active=True"
        + " "
        + "--Nod.info="
        + str(jsonInfo)
        # + " "
        # + "--ServerApp.jpserver_extensions="
        + " "
        + tempNotebook
    )

    notebookProcess = subprocess.Popen(args)
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
    return [{"src": "labextension", "dest": "nod"}]


def _jupyter_server_extension_points():
    return [
        {
            "module": "nod",
            "app": Nod,  # <- Note this is not quoted.  This is the module
            # "name": "nod",
        }
    ]


def _load_jupyter_server_extension(server_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    server_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """
    setup_handlers(server_app.web_app)
    name = "nod"
    server_app.log.info(f"Registered {name} server extension")
