import logging
import os
import sys
from ipykernel.kernelapp import IPKernelApp

from nod.datastore import StartingVariables
from IPython.utils.frame import extract_module_locals
from ipykernel.ipkernel import IPythonKernel

_log = logging.getLogger(__name__)


class nodKernel(IPythonKernel):
    startVars = {}

    def __init__(self, **kwargs):
        """Initialize the kernel."""
        super().__init__(**kwargs)

    def do_shutdown(self, restart):
        _log.warning("CALL SHUTDOWN")
        self.shell.reset()
        self.shell.push(self.startVars)
        return super().do_shutdown(restart)


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
        app.kernel_class = nodKernel
        app.kernel_name = str(os.getpid())
        app.initialize([])
        # Undo unnecessary sys module mangling from init_sys_modules.
        # This would not be necessary if we could prevent it
        # in the first place by using a different InteractiveShell
        # subclass, as in the regular embed case.
        main = app.kernel.shell._orig_sys_modules_main_mod
        if main is not None:
            sys.modules[app.kernel.shell._orig_sys_modules_main_name] = main
    app.abs_connection_file
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
    _log.warning("EMBED KERNEL")
    return app
