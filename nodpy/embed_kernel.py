import logging
import os
import sys
from ipykernel.kernelapp import IPKernelApp
from IPython.utils.frame import extract_module_locals
from ipykernel.ipkernel import IPythonKernel
from ipykernel.debugger import Debugger
from IPython.core.interactiveshell import InteractiveShell
from inspect import FrameInfo
from typing import List, cast
import typing as t
from ipykernel.debugger import _DummyPyDB
from ipykernel.compiler import get_file_name

_log = logging.getLogger(__name__)
try:
    # This import is required to have the next ones working...
    from debugpy.server import api  # noqa: F401

    from _pydevd_bundle import (  # type: ignore # pyright: ignore[reportMissingImports]
        pydevd_frame_utils,
    )  # isort: skip
    from _pydevd_bundle.pydevd_suspended_frames import (  # type: ignore # isort: skip # pyright: ignore[reportMissingImports]
        SuspendedFramesManager,
        _FramesTracker,
    )
    from _pydevd_bundle.pydevd_xml import (  # type: ignore
        ExceptionOnEvaluate,
    )
    from _pydevd_bundle.pydevd_vars import eval_in_context  # type: ignore

    _is_debugpy_available = True
    _is_debugpy_available = True

except ImportError:
    _is_debugpy_available = False
except Exception as e:
    # We cannot import the module where the DebuggerInitializationError
    # is defined
    if e.__class__.__name__ == "DebuggerInitializationError":
        _is_debugpy_available = False
    else:
        raise e


class _FakeCode:
    """Fake code class."""

    def __init__(self, co_filename, co_name):
        """Init."""
        self.co_filename = co_filename
        self.co_name = co_name


class _FakeFrame:
    """Fake frame class."""

    def __init__(self, f_code, f_globals, f_locals):
        """Init."""
        self.f_code = f_code
        self.f_globals = f_globals
        self.f_locals = f_locals
        self.f_back = None


class VariableExplorer:
    """A variable explorer."""

    func_id: str
    nod_log: dict[str, dict[str, t.Any]]
    nod_log_id_to_func: dict[str, str]

    def __init__(
        self,
        func_id: str,
        nod_log: dict[str, dict[str, t.Any]],
        nod_log_id_to_func: dict[str, str],
    ):
        """Initialize the explorer."""
        self.suspended_frame_manager = SuspendedFramesManager()  # type: ignore
        self.py_db = _DummyPyDB()
        self.tracker = _FramesTracker(self.suspended_frame_manager, self.py_db)  # type: ignore
        self.frame = None
        self.func_id = func_id
        self.nod_log = nod_log
        self.nod_log_id_to_func = nod_log_id_to_func

    def track(self):
        """Start tracking."""
        matches = {}

        for key in self.nod_log:
            if self.nod_log_id_to_func.get(key, "") == self.func_id:
                matches.update({key: self.nod_log[key]})
        # _log.info(f"matches : {matches}")
        # var = get_ipython().user_ns
        self.frame = _FakeFrame(
            _FakeCode("<module>", get_file_name("sys._getframe()")),
            matches,
            matches,
        )
        self.tracker.track(
            "thread1",
            pydevd_frame_utils.create_frames_list_from_frame(self.frame),  # type: ignore
        )

    def untrack_all(self):
        """Stop tracking."""
        self.tracker.untrack_all()

    def get_children_variables(self, variable_ref=None):
        """Get the child variables for a variable reference."""
        var_ref = variable_ref
        if not var_ref:
            var_ref = id(self.frame)
        variables = self.suspended_frame_manager.get_variable(var_ref)
        return [x.get_var_data() for x in variables.get_children_variables()]


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

        try:
            _log.info(f"debugger? {self.debugger}")
            _log.info(f"debugger started? {self.debugger.is_started}")
            # if not self.debugger.is_started:
            #     self.debugger.start()
        except:
            pass
        #         _nod_log: dict[str, dict[str, t.Any]] = {}
        # _nod_log_id_to_func: dict[str, str] = {}

        # _log.info("NODKERNEL INIT")

        # kernel_ask_exit = self.shell.ask_exit

        # def nod_exit():
        #     _log.info("NOD EXIT")
        #     self
        #     kernel_ask_exit()

        # self.shell.ask_exit = nod_exit

    nod_log: dict[str, dict[str, t.Any]] = {}
    nod_log_id_to_func: dict[str, str] = {}
    variable_explorer: VariableExplorer | None = None
    # def close(self):
    #     print("CLOSE")
    #     _log.info("CLOSE")
    #     super().close(self)
    #     print("CLOSE")
    #     _log.info("CLOSE")

    # def do_shutdown(self, restart):
    #     _log.info("NODKERNEL CALL SHUTDOWN")
    #     _log.info(restart)
    #     # reset(self.shell)
    #     return dict(status="ok", restart=False)

    # def _send_interrupt_children(self):
    #     _log.info("KERNEL INTERRUPT")
    #     if os.name == "nt":
    #         self.log.error("Interrupt message not supported on Windows")
    #     else:
    #         pid = os.getpid()
    #         pgid = os.getpgid(pid)
    #         # Prefer process-group over process
    #         # but only if the kernel is the leader of the process group
    #         if pgid and pgid == pid and hasattr(os, "killpg"):
    #             try:
    #                 _log.info("KERNEL KILLPG")
    #                 os.killpg(pgid, SIGINT)
    #             except OSError:
    #                 _log.info("KERNEL KILLP")
    #                 os.kill(pid, SIGINT)
    #                 raise
    #         else:
    #             os.kill(pid, SIGINT)

    async def interrupt_request(self, stream, ident, parent):

        _log.info("NODKERNEL_INTERRUPT")
        await super().interrupt_request(stream, ident, parent)
        # """Handle an interrupt request."""
        # if not self.session:
        #     return
        # content: dict[str, typing.Any] = {"status": "ok"}
        # try:
        #     self._send_interrupt_children()
        #     self.processes
        # except OSError as err:
        #     import traceback

        #     content = {
        #         "status": "error",
        #         "traceback": traceback.format_stack(),
        #         "ename": str(type(err).__name__),
        #         "evalue": str(err),
        #     }

        # self.session.send(stream, "interrupt_reply", content, parent, ident=ident)
        # return

    async def do_debug_request(self, msg):

        debugger = t.cast(Debugger, self.debugger)
        _log.info(f"debug request { msg}")
        _log.info(f"_is_debugpy_available { _is_debugpy_available}")
        _log.info(f"is debugger active { self.debugger.is_started}")

        match msg["command"]:
            case "nod_switch":
                if self.debugger.is_started is False:
                    return {
                        "type": "response",
                        "request_seq": msg["seq"],
                        "success": False,
                        "command": msg["command"],
                    }
                if hasattr(self, "relevant_stack_frames"):
                    self.relevant_stack_frames = cast(
                        List[FrameInfo], self.relevant_stack_frames  # type: ignore
                    )
                    stackIndex = cast(int, msg["arguments"]["stackIndex"])
                    newStackFrame = self.relevant_stack_frames[stackIndex]
                    if self.shell is not None:
                        reset(self.shell, True, True)
                        self.shell.user_ns.update(newStackFrame.frame.f_locals)
                        self.shell.user_global_ns.update(newStackFrame.frame.f_globals)
                        self.shell.user_ns_hidden.update(newStackFrame.frame.f_builtins)
                        _log.warning(f"nod_switch {stackIndex}, {newStackFrame}")
                    return {
                        "type": "response",
                        "request_seq": msg["seq"],
                        "success": True,
                        "command": msg["command"],
                    }
            case "nod_log_push":
                _log.info(f"Kernel: Nod Log Push: {msg}")
                if self.debugger.is_started is False:
                    return {
                        "type": "response",
                        "request_seq": msg["seq"],
                        "success": False,
                        "command": msg["command"],
                    }
                if (
                    self.variable_explorer is not None
                    and self.variable_explorer.frame is not None
                    and self.shell is not None
                    and _is_debugpy_available
                ):
                    variablesReference = t.cast(
                        str, msg["arguments"]["variablesReference"]
                    )
                    name = t.cast(str, msg["arguments"]["name"])
                    evaluateName = t.cast(str, msg["arguments"]["evaluateName"])
                    if variablesReference == 0:
                        frame = self.variable_explorer.frame
                        updated_globals = {}
                        updated_globals.update(frame.f_globals)
                        updated_globals.update(frame.f_locals)
                        if "globals" not in updated_globals:
                            # If the user explicitly uses 'globals()' then we provide the
                            # frame globals (unless he has shadowed it already).
                            updated_globals["globals"] = lambda: frame.f_globals
                        updated_locals = None
                        ret = eval_in_context(  # pyright: ignore[reportPossiblyUnboundVariable]
                            evaluateName,
                            updated_globals,
                            updated_locals,
                            self.variable_explorer.py_db,
                        )
                        try:
                            if (
                                ret.__class__
                                == ExceptionOnEvaluate  # pyright: ignore[reportPossiblyUnboundVariable]
                            ):
                                _log.error("Nod Log Error: Failed to Eval Variable")
                                _log.error(ret.result)
                                _log.error(ret.tb)
                                _log.error(ret.etype)
                        except:
                            pass
                        variable_name = "".join(c for c in name if c not in "'")
                        _log.info(f"eval expression: {variable_name} : {ret}")
                        self.shell.user_ns.update({variable_name: ret})

                    else:
                        top_variables_references = [
                            v.get("variablesReference")
                            for v in self.variable_explorer.get_children_variables()
                        ]
                        if variablesReference in top_variables_references:
                            variables = [
                                v
                                for v in self.variable_explorer.get_children_variables(
                                    variablesReference
                                )
                                if v.get("name")
                                not in [
                                    "special variables",
                                    "function variables",
                                    "len()",
                                ]
                            ]
                            _log.info(
                                f"Kernel: Nod Log Push Found Variables: {variables}"
                            )
                            variables_dict = {
                                "".join(
                                    c for c in v.get("name") if c not in "'"
                                ): v.get("value")
                                for v in variables
                            }
                            _log.info(f"Updating user_ns: {variables_dict}")
                            self.shell.user_ns.update(variables_dict)
                        else:
                            variable = self.variable_explorer.tracker.get_variable(
                                variablesReference
                            )
                            _log.info(
                                f"Kernel: Nod Log Push Found Variable: {variable}"
                            )
                            variable_name = "".join(
                                c for c in variable.name if c not in "'"
                            )
                            _log.info(
                                f"Updating user_ns: {variable_name}: {variable.value}"
                            )
                            self.shell.user_ns.update({variable_name: variable.value})
                return {
                    "type": "response",
                    "sequence_seq": msg["seq"],
                    "success": True,
                    "command": msg["command"],
                }
            case "nod_variables":
                """Handle a variables message."""
                if self.debugger.is_started is False:
                    return {
                        "type": "response",
                        "request_seq": msg["seq"],
                        "success": False,
                        "command": msg["command"],
                    }
                reply = {}
                # if not self.stopped_threads:
                if self.variable_explorer is not None:
                    variablesReference = msg["arguments"]["variablesReference"]
                    top_variables_references = [
                        v.get("variablesReference")
                        for v in self.variable_explorer.get_children_variables()
                    ]
                    variables = self.variable_explorer.get_children_variables(
                        variablesReference
                    )
                    if variablesReference in top_variables_references:
                        variables = [
                            v
                            for v in variables
                            if v.get("name")
                            not in ["special variables", "function variables", "len()"]
                        ]
                    return debugger._build_variables_response(msg, variables)
            case "nod_inspect_variables":
                _log.info(
                    "nod_inspect_variables",
                )
                if self.debugger.is_started is False:
                    self.debugger.start()
                #     return {
                #         "type": "response",
                #         "request_seq": msg["seq"],
                #         "success": False,
                #         "command": msg["command"],
                #     }
                """Handle an inspect variables message."""
                if self.variable_explorer is not None:
                    self.variable_explorer.untrack_all()
                # looks like the implementation of untrack_all in ptvsd
                # destroys objects we nee din track. We have no choice but
                # reinstantiate the object
                self.variable_explorer = VariableExplorer(
                    msg["arguments"]["function_id"],
                    self.nod_log,
                    self.nod_log_id_to_func,
                )
                self.variable_explorer.track()
                variables = self.variable_explorer.get_children_variables()
                _log.info(f"variables {variables}")
                formatted_variables = []
                for variable in variables:
                    var_ref = variable.get("variablesReference")
                    if var_ref is not None:
                        children = self.variable_explorer.get_children_variables(
                            var_ref
                        )
                        child_variables = [
                            c
                            for c in children
                            if c.get("name", None)
                            not in [
                                "special variables",
                                "function variables",
                                "len()",
                            ]
                        ]
                        if len(child_variables) == 1:
                            formatted_variables.append(child_variables[0])
                        else:
                            new_name = ", ".join(
                                [c.get("name") for c in child_variables]
                            )
                            new_name = "".join(c for c in new_name if c not in "'")
                            variable["name"] = new_name
                            formatted_variables.append(variable)
                _log.info(f"formatted variables: {formatted_variables}")
                response = debugger._build_variables_response(msg, formatted_variables)
                # _embed_log.info(response)
                return response

            case "nod_inspect_rich_variable":
                if self.debugger.is_started is False:
                    return {
                        "type": "response",
                        "request_seq": msg["seq"],
                        "success": False,
                        "command": msg["command"],
                    }
                """Handle a rich inspect variables message."""
                reply = {
                    "type": "response",
                    "sequence_seq": msg["seq"],
                    "success": False,
                    "command": msg["command"],
                }
                _log.info("nod inspect rich variable")
                variablesReference = t.cast(str, msg["arguments"]["variablesReference"])
                if self.shell is not None and self.variable_explorer is not None:
                    variable = self.variable_explorer.tracker.get_variable(
                        variablesReference
                    )
                    var_name = variable.get("name")
                    valid_name = str.isidentifier(var_name)
                    if not valid_name:
                        reply["body"] = {"data": {}, "metadata": {}}
                        if (
                            var_name == "special variables"
                            or var_name == "function variables"
                        ):
                            reply["success"] = True
                        return reply

                    repr_data = {}
                    repr_metadata = {}
                    # if not debugger.stopped_threads:
                    # The code did not hit a breakpoint, we use the interpreter
                    # to get the rich representation of the variable
                    # if (
                    #     self.shell is not None
                    #     and self.variable_explorer is not None
                    # ):
                    try:
                        value = self.shell._format_user_obj(variable)
                    except:
                        value = self.shell._user_obj_error()
                    # out[key] = value
                    _log.info(f"rich variable inspect {value}")
                    result = value[var_name]
                    if result.get("status", "error") == "ok":
                        repr_data = result.get("data", {})
                        repr_metadata = result.get("metadata", {})
                        body = {
                            "data": repr_data,
                            "metadata": {
                                k: v for k, v in repr_metadata.items() if k in repr_data
                            },
                        }

                        reply["body"] = body
                        reply["success"] = True
                return reply
        return await super().do_debug_request(msg)

    # async def shutdown_request(self, stream, ident, parent):
    #     _log.info("NODKERNEL_SHUTDOWN")
    #     """Handle a shutdown request."""
    #     if not self.session:
    #         return
    #     content = self.do_shutdown(parent["content"]["restart"])
    #     if inspect.isawaitable(content):
    #         content = await content
    #     # else:
    #     #     infos.warn(
    #     #         _AWAITABLE_MESSAGE.format(
    #     #             func_name="do_shutdown", target=self.do_shutdown
    #     #         ),
    #     #         PendingDeprecationinfo,
    #     #         stacklevel=1,
    #     #     )
    #     self.session.send(stream, "shutdown_reply", content, parent, ident=ident)
    #     # same content, but different msg_id for broadcasting on IOPub
    #     self._shutdown_message = self.session.msg("shutdown_reply", content, parent)

    #     # await self._at_shutdown()

    #     # self.log.debug("Stopping control ioloop")
    #     # if self.control_stream:
    #     #     control_io_loop = self.control_stream.io_loop
    #     #     control_io_loop.add_callback(control_io_loop.stop)

    #     # self.log.debug("Stopping shell ioloop")
    #     # self.io_loop.add_callback(self.io_loop.stop)
    #     # if self.shell_stream and self.shell_stream.io_loop != self.io_loop:
    #     #     shell_io_loop = self.shell_stream.io_loop
    #     #     shell_io_loop.add_callback(shell_io_loop.stop)


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
    _log.debug("Starting Kernel")
    # os.environ["NOD_IPYTHON_CONNECTION_FILE"] = "test2"
    # get the app if it exists, or set it up if it doesn't
    if IPKernelApp.initialized():
        _log.debug("Already Initialized")
        app = IPKernelApp.instance()
    else:
        _log.debug("Initializing")
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
    return app
