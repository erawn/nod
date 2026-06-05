import base64
import inspect
import logging
import os
from signal import SIGINT
import sys
import typing
from ipykernel.kernelapp import IPKernelApp
from IPython.utils.frame import extract_module_locals
from ipykernel.ipkernel import IPythonKernel
from IPython.core.interactiveshell import InteractiveShell
import orjson
from IPython.core.extensions import ExtensionManager
from IPython.core.getipython import get_ipython
from inspect import FrameInfo
from typing import List, cast
from ipykernel.zmqshell import ZMQInteractiveShell

_log = logging.getLogger(__name__)


# def loadFrame(frame_id: FrameIdentifiers, stack: list[inspect.FrameInfo]):
#     frame_info: inspect.FrameInfo = next(
#         (fr for fr in stack if compare_identifiers(frame_id, fr)), None
#     )
#     shell: InteractiveShell = get_ipython()
#     if shell is None:
#         return
#     shell.push(frame_info.frame.locals)
#     shell.push(frame_info.frame.globals)


def reset(shell: InteractiveShell, new_session=True, aggressive=False):
    """Clear all internal namespaces, and attempt to release references to
    user objects.

    If new_session is True, a new history session will be opened.
    """
    # Clear histories
    if shell.history_manager is not None:
        shell.history_manager.reset(new_session)
    # Reset counter used to index all histories
    if new_session:
        shell.execution_count = 1

    # Reset last execution result
    shell.last_execution_succeeded = True
    shell.last_execution_result = None

    # Flush cached output items
    if shell.displayhook.do_full_cache:
        shell.displayhook.flush()

    # The main execution namespaces must be cleared very carefully,
    # skipping the deletion of the builtin-related keys, because doing so
    # would cause errors in many object's __del__ methods.
    if shell.user_ns is not shell.user_global_ns:
        # shell.user_ns.clear()
        ## Filter for our special variables
        user_ns = shell.user_ns
        for key in set(user_ns.keys()):
            if key == "nodReturn":
                continue
            else:
                del user_ns[key]

    ns = shell.user_global_ns
    drop_keys = set(ns.keys())
    drop_keys.discard("__builtin__")
    drop_keys.discard("__builtins__")
    drop_keys.discard("__name__")
    for k in drop_keys:
        del ns[k]

    shell.user_ns_hidden.clear()

    # Restore the user namespaces to minimal usability
    shell.init_user_ns()  ## DOES NOT RESET
    if aggressive and not hasattr(shell, "_sys_modules_keys"):
        print("Cannot restore sys.module, no snapshot")
    elif aggressive:
        # print("culling sys module...")
        current_keys = set(sys.modules.keys())
        for k in current_keys - shell._sys_modules_keys:
            if k.startswith("multiprocessing"):
                continue
            del sys.modules[k]

    # Restore the default and user aliases
    shell.alias_manager.clear_aliases()  # type: ignore
    shell.alias_manager.init_aliases()  # type: ignore

    # Now define aliases that only make sense on the terminal, because they
    # need direct access to the console in a way that we can't emulate in
    # GUI or web frontend
    if os.name == "posix":
        for cmd in ("clear", "more", "less", "man"):
            if cmd not in shell.magics_manager.magics["line"]:
                shell.alias_manager.soft_define_alias(cmd, cmd)  # type: ignore

    # Flush the private list of module references kept for script
    # execution protection
    shell.clear_main_mod_cache()


class nodKernel(IPythonKernel):

    def __init__(self, **kwargs):
        """Initialize the kernel."""
        super().__init__(**kwargs)

        # _log.info("NODKERNEL INIT")

        # kernel_ask_exit = self.shell.ask_exit

        # def nod_exit():
        #     _log.info("NOD EXIT")
        #     self
        #     kernel_ask_exit()

        # self.shell.ask_exit = nod_exit

    def close(self):
        print("CLOSE")
        _log.info("CLOSE")
        super().close(self)
        print("CLOSE")
        _log.info("CLOSE")

    def do_shutdown(self, restart):
        _log.info("NODKERNEL CALL SHUTDOWN")
        _log.info(restart)
        reset(self.shell)
        return dict(status="ok", restart=False)

    def _send_interrupt_children(self):
        _log.info("KERNEL INTERRUPT")
        if os.name == "nt":
            self.log.error("Interrupt message not supported on Windows")
        else:
            pid = os.getpid()
            pgid = os.getpgid(pid)
            # Prefer process-group over process
            # but only if the kernel is the leader of the process group
            if pgid and pgid == pid and hasattr(os, "killpg"):
                try:
                    _log.info("KERNEL KILLPG")
                    os.killpg(pgid, SIGINT)
                except OSError:
                    _log.info("KERNEL KILLP")
                    os.kill(pid, SIGINT)
                    raise
            else:
                os.kill(pid, SIGINT)

    async def interrupt_request(self, stream, ident, parent):

        _log.info("NODKERNEL_INTERRUPT")
        """Handle an interrupt request."""
        if not self.session:
            return
        content: dict[str, typing.Any] = {"status": "ok"}
        try:
            self._send_interrupt_children()
            self.processes
        except OSError as err:
            import traceback

            content = {
                "status": "error",
                "traceback": traceback.format_stack(),
                "ename": str(type(err).__name__),
                "evalue": str(err),
            }

        self.session.send(stream, "interrupt_reply", content, parent, ident=ident)
        return

    async def do_debug_request(self, msg):
        if msg["command"] == "nod_info":
            _log.info("NOD DEBUG REQUEST")
            # extension_manager: ExtensionManager = self.shell.extension_manager
            # extension_manager.loaded.
            nod_info = self.shell.user_ns.get("__NODINFO")
            json_dump = orjson.dumps(nod_info)
            encoded = base64.b64encode(json_dump).decode("utf-8")
            return {
                "type": "response",
                "request_seq": msg["seq"],
                "success": True,
                "command": msg["command"],
                "body": encoded,
            }
        match msg["command"]:
            case "nod_switch":
                # _log.info("Kernel: Switching Frame to")
                # _log.info(msg)
                if hasattr(self, "relevant_stack_frames"):
                    self.relevant_stack_frames = cast(
                        List[FrameInfo], self.relevant_stack_frames  # type: ignore
                    )
                    stackIndex = cast(int, msg["arguments"]["stackIndex"])
                    # _log.info(stackIndex)
                    newStackFrame = self.relevant_stack_frames[stackIndex]
                    if self.shell is not None:
                        reset(self.shell, True, True)
                        self.shell.user_ns.update(newStackFrame.frame.f_locals)
                        self.shell.user_global_ns.update(newStackFrame.frame.f_globals)
                        self.shell.user_ns_hidden.update(newStackFrame.frame.f_builtins)
                        # _log.info("locals")
                        # _log.info(newStackFrame.frame.f_locals.keys())
                        # _log.info("globals")
                        # _log.info(newStackFrame.frame.f_globals.keys())
                        # _log.info("builtins")
                        # _log.info(newStackFrame.frame.f_builtins.keys())
                    return {
                        "type": "response",
                        "request_seq": msg["seq"],
                        "success": True,
                        "command": msg["command"],
                    }

        return await super().do_debug_request(msg)

    async def shutdown_request(self, stream, ident, parent):
        _log.info("NODKERNEL_SHUTDOWN")
        """Handle a shutdown request."""
        if not self.session:
            return
        content = self.do_shutdown(parent["content"]["restart"])
        if inspect.isawaitable(content):
            content = await content
        # else:
        #     infos.warn(
        #         _AWAITABLE_MESSAGE.format(
        #             func_name="do_shutdown", target=self.do_shutdown
        #         ),
        #         PendingDeprecationinfo,
        #         stacklevel=1,
        #     )
        self.session.send(stream, "shutdown_reply", content, parent, ident=ident)
        # same content, but different msg_id for broadcasting on IOPub
        self._shutdown_message = self.session.msg("shutdown_reply", content, parent)

        # await self._at_shutdown()

        # self.log.debug("Stopping control ioloop")
        # if self.control_stream:
        #     control_io_loop = self.control_stream.io_loop
        #     control_io_loop.add_callback(control_io_loop.stop)

        # self.log.debug("Stopping shell ioloop")
        # self.io_loop.add_callback(self.io_loop.stop)
        # if self.shell_stream and self.shell_stream.io_loop != self.io_loop:
        #     shell_io_loop = self.shell_stream.io_loop
        #     shell_io_loop.add_callback(shell_io_loop.stop)


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
    caller_module, caller_locals = extract_module_locals(1)
    if module is None:
        module = caller_module
    if local_ns is None:
        local_ns = dict(**caller_locals)

    app.kernel.user_module = module
    assert isinstance(local_ns, dict)
    app.kernel.user_ns = local_ns
    app.shell.set_completer_frame()  # type: ignore[union-attr]
    # print("Starting IPKernel with NS:")
    # print(local_ns)
    # os.environ["NOD_IPYTHON_CONNECTION_FILE"] = "test"
    # print("setting connection file:", app.connection_file)
    # _log.info("EMBED KERNEL")
    return app
