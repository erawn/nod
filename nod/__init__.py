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
import sys
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

_log = logging.getLogger(__name__)
    # connection_file = os.path.abspath(app.abs_connection_file)
    #  env["PYXLL_IPYTHON_CONNECTION_FILE"] = connection_file

def nod():
    print(__file__)

    frameInfo = inspect.stack()[1]
    print(frameInfo)

    ##open the original code file and get text

    ##parse code and find the block we want to display to the user 

    ## Fork " jupyter lab --KernelProvisionerFactory.default_provisioner_name=nod-provisioner --LabApp.settings="

    caller_frame = frameInfo.frame
    scope = {}
    scope.update(caller_frame.f_globals)
    scope.update(caller_frame.f_locals)
    embed_kernel(local_ns = scope)



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
    print("Starting IPKernel with NS:")
    print(local_ns)
    app.start()
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
