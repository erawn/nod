try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings
    warnings.warn("Importing 'nod' outside a proper installation.")
    __version__ = "dev"

import inspect
import shlex
import sys
import tempfile
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

import jupytext.cli

from nod.ast_tools import AnnotateParents, ExpressionFinder

_line_pattern = None
def _splitlines_no_ff(source, maxlines=None):
    """Split a string into lines ignoring form feed and other chars.

    This mimics how the Python parser splits source code.
    """
    global _line_pattern
    if _line_pattern is None:
        # lazily computed to speedup import time of `ast`
        import re
        _line_pattern = re.compile(r"(.*?(?:\r\n|\n|\r|$))")

    lines = []
    for lineno, match in enumerate(_line_pattern.finditer(source), 1):
        if maxlines is not None and lineno > maxlines:
            break
        lines.append(match[0])
    return lines

_log = logging.getLogger(__name__)
    # connection_file = os.path.abspath(app.abs_connection_file)
    #  env["PYXLL_IPYTHON_CONNECTION_FILE"] = connection_file

def nod():
    frameInfo = inspect.stack()[1]
    # print(frameInfo)
    sourceProgram = open(frameInfo.filename).read()
    # print(sourceProgram)
    programAST = AnnotateParents().visit(ast.parse(sourceProgram))
    nodCall:ast.AST = ExpressionFinder(frameInfo.lineno).visit(programAST)
    currentFunction = nodCall.parent
    if not isinstance(currentFunction, ast.Module):
        print("lineinfo")
        print(currentFunction.lineno)
        print(currentFunction.end_lineno)
    print("nodeParent")
    print("function", frameInfo.function)
    print(ast.dump(currentFunction,include_attributes=True,indent=4))
    # sourceSegment = ast.get_source_segment(sourceProgram, currentFunction)

    functionDefStart = currentFunction.lineno - 1
    functionEnd = currentFunction.end_lineno
    functionBodyStart = currentFunction.body.pop(0).lineno - 1 if len(currentFunction.body) > 0 else functionEnd
    col_offset = currentFunction.body.pop(0).col_offset if len(currentFunction.body) > 0 else functionEnd

    print("functionLines",functionDefStart, functionEnd,functionBodyStart)


    # os.getcwd()

    # tempCode = tempfile.TemporaryFile()
    # tempPath = os.path.abspath(tempCode)
    # print(tempPath)
  
    

    #copied from Lib/ast.py
    sourceLines = _splitlines_no_ff(sourceProgram)

    functionHeader =  sourceLines[functionDefStart : functionBodyStart]
    functionBody = [line[col_offset:] for line in sourceLines[functionBodyStart : functionEnd] \
                     if line[:col_offset] == " " * col_offset]
    textAbove = sourceLines[max(functionDefStart - 11,0): functionDefStart]
    textBelow = sourceLines[min(functionEnd, len(sourceLines) - 1): min(functionEnd + 11,len(sourceLines) - 1)]

    print("header,body",functionHeader,functionBody)
    print("pre/post text", textAbove, textBelow)

    hiddenDir = os.path.join(os.getcwd(),".nod")
    os.makedirs(hiddenDir, exist_ok=True)
    tempFileStem = os.path.join(os.getcwd(),".nod", Path(frameInfo.filename).stem + str(uuid.uuid1()))
    tempPythonFile = tempFileStem + ".py"
    with open( tempPythonFile, "x") as f:
        f.writelines(functionBody)

    tempNotebook = tempFileStem + ".ipynb"
    args = shlex.split("--to notebook " + tempPythonFile + " --from py:light " + "--output " + tempNotebook)
    jupytext.cli.jupytext(args)
    ## Fork " jupyter lab --KernelProvisionerFactory.default_provisioner_name=nod-provisioner --LabApp.settings="

    caller_frame = frameInfo.frame
    scope = {"__NODINFO" : {"sourceFile": frameInfo.filename, "line": frameInfo.lineno, "textAbove": textAbove, "textBelow": textBelow, "functionHeader":functionHeader}  }
    scope.update(caller_frame.f_globals)
    scope.update(caller_frame.f_locals)

    app = embed_kernel(local_ns = scope)
    args = shlex.split("jupyter lab --KernelProvisionerFactory.default_provisioner_name=nod-provisioner " + tempNotebook)
    subprocess.Popen(args)
    app.start()
        




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
        app = IPKernelApp.instance()
    else:
        app = IPKernelApp.instance(**kwargs)
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
c = Config()


# _log = logging.getLogger(__name__)


def get_latest_connection_file():


    def get_jupyter_runtime_dir():
        result = subprocess.run(
            ['jupyter', '--runtime-dir'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        return result.stdout.strip()

    jupyter_runtime_dir = get_jupyter_runtime_dir()
    connection_filenames = glob.glob(f'{jupyter_runtime_dir}/kernel-*.json')
    latest_connection_filename = max(connection_filenames, key=os.path.getctime)
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
        kwargs.setdefault('cmd', None)
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
    return [{
        "src": "labextension",
        "dest": "nod"
    }]
