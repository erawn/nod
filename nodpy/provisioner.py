from abc import ABC
import asyncio
import base64
import glob
import json
import logging
import os
import pathlib
import re
import shlex
import signal
import subprocess
import sys
import time
from math import isclose
from types import NoneType
from jupyter_client import kernelspec
from jupyter_client.manager import KernelManager
from typing import Any
import psutil  # type: ignore
from jupyter_client.provisioning.local_provisioner import LocalProvisioner
from jupyter_client.provisioning.provisioner_base import (
    KernelProvisionerBase,
    KernelProvisionerMeta,
)
from jupyter_client.launcher import launch_kernel
from traitlets.traitlets import Bool, Unicode
import jupyter_core

# from nod.datastore import StartingVariables
from jupyter_client import find_connection_file
from subprocess import PIPE, Popen

_log = logging.getLogger(__name__)
regex = re.compile(r".*kernel-(.{2,8})\.json")
_log.setLevel(logging.INFO)

# def get_latest_connection_file():

#     connection_dir = os.path.join(os.getcwd(), ".nod", "connection")
#     return find_connection_file(path=connection_dir)


# _log.info("Connection File")
# _log.info(connection_filenames)
# pid_filenames = list(filter(regex.match, connection_filenames))
# latest_connection_filename = connection_filenames[
#     0
# ]  # max(pid_filenames, key=os.path.getctime)
# return latest_connection_filename


# class Watcher(object):
#     running = True
#     refresh_delay_secs = 1

#     # Constructor
#     def __init__(self, dir_to_watch, call_func_on_change=None):
#         self.dir_to_watch: str = dir_to_watch
#         self.call_func_on_change = call_func_on_change
#         self.dir_list_cache: list[str] = [""]

#     # Look for changes
#     def look(self):
#         dirlist = set(os.listdir(self.dir_to_watch))
#         if len(dirlist.symmetric_difference(set(self.dir_list_cache))) > 0:
#             # File has changed, so do something...
#             _log.info("File changed")
#             if self.call_func_on_change is not None:
#                 self.call_func_on_change(dirlist)
#         self.dir_list_cache = list(dirlist)

#     # Keep watching in a loop
#     def watch(self):
#         while self.running:
#             try:
#                 # Look for changes
#                 time.sleep(self.refresh_delay_secs)
#                 self.look()
#             except KeyboardInterrupt:
#                 print("\nDone")
#                 break
#             except FileNotFoundError:
#                 # Action on file not found
#                 pass
#             except:
#                 print("Unhandled error: %s" % sys.exc_info()[0])


class NodProvisionerMeta(type(KernelProvisionerBase)):  # type: ignore[misc]
    pass


class Singleton(type):
    _instances = {}  # type: ignore

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
        return cls._instances[cls]


class NodPythonInfo(metaclass=Singleton):
    python_process: Popen[bytes] | None = None
    kernel_process: psutil.Process | None = None
    python_pgid: int
    python_pid: int
    kernel_pid: int
    kernel_pgid: int
    starting_lock = asyncio.Lock()
    file_info: dict[str, Any] = {}
    connection_file: str


class NodProvisioner(KernelProvisionerBase, metaclass=NodProvisionerMeta):
    # """
    # A Kernel Provisioner that re-uses an existing kernel.
    # The kernel connection file is fetched as the latest
    # modified connection file.
    # """
    cli_cmd = Unicode(
        "",
        help="User Command To Execute Python Program",
    ).tag(config=True)

    @property
    def has_process(self) -> bool:
        return self.nod_info.python_process is not None

    python_info: NodPythonInfo

    def __init__(self, **kwargs: Any):
        super().__init__(**kwargs)
        self.nod_info = NodPythonInfo()

    async def poll(self):
        # _log.info("PROVISIONER POLL")
        # # """Poll the provisioner."""
        # if self.restarting:
        #     _log.info("PROVISIONER POLL 0")
        #     return 0
        ret = 0
        if self.nod_info.kernel_process:
            if self.nod_info.kernel_process.is_running():
                # _log.info("PROVISIONER POLL NONE")
                return None
        _log.info("PROVISIONER POLL 0")
        return ret

    async def wait(self):
        _log.info("PROVISIONER WAIT")
        """Wait for the provisioner process."""
        ret = 0
        if self.nod_info.kernel_process and self.nod_info.python_process:
            # Use busy loop at 100ms intervals, polling until the process is
            # not alive.  If we find the process is no longer alive, complete
            # its cleanup via the blocking wait().  Callers are responsible for
            # issuing calls to wait() using a timeout (see kill()).
            while await self.poll() is None:  # type: ignore[unreachable]
                await asyncio.sleep(0.1)

            # Process is no longer alive, wait and clear
            ret = self.nod_info.python_process.wait()
            # Make sure all the fds get closed.
            for attr in ["stdout", "stderr", "stdin"]:
                fid = getattr(self.nod_info.kernel_process, attr)
                if fid:
                    fid.close()
            self.nod_info.kernel_process = None  # allow has_process to now return False
            self.nod_info.python_process = None
        return ret

    async def send_signal(self, signum: int):
        """Sends a signal to the process group of the kernel (this
        usually includes the kernel and any subprocesses spawned by
        the kernel).

        Note that since only SIGTERM is supported on Windows, we will
        check if the desired signal is for interrupt and apply the
        applicable code on Windows in that case.
        """
        _log.info("SEND SIGNAL " + signal.strsignal(signum))  # type: ignore
        signal_route = self.nod_info.python_process
        signal_pgid = self.nod_info.python_pgid
        if signum == signal.SIGINT and self.nod_info.kernel_process:
            signal_route = self.nod_info.kernel_process
            signal_pgid = self.nod_info.kernel_pgid

        if signal_route and signal_pgid:
            if signum == signal.SIGINT and sys.platform == "win32":  # type: ignore[unreachable]
                from jupyter_client.win_interrupt import send_interrupt  # type: ignore

                send_interrupt(self.nod_info.python_process.win32_interrupt_event)
                return

            # Prefer process-group over process
            if signal_pgid and hasattr(os, "killpg"):
                try:
                    os.killpg(signal_pgid, signum)
                    return
                except OSError:
                    pass  # We'll retry sending the signal to only the process below

            # If we're here, send the signal to the process and let caller handle exceptions
            signal_route.send_signal(signum)
            return

    async def kill(self, restart=False):
        """Kill the provisioner and optionally restart."""
        _log.info("PROVISIONER KILL" + str(restart))
        """Kill the provisioner and optionally restart."""
        if self.nod_info.python_process:
            if hasattr(signal, "SIGKILL"):  # type: ignore[unreachable]
                # If available, give preference to signalling the process-group over `kill()`.
                try:
                    await self.send_signal(signal.SIGKILL)
                    return
                except OSError:
                    pass
            try:
                self.nod_info.python_process.kill()
            except OSError as e:
                LocalProvisioner._tolerate_no_process(e)

    async def terminate(self, restart=False):
        """Terminate the provisioner and optionally restart."""
        _log.info("PROVISIONER TERM" + str(restart))
        if self.nod_info.python_process:
            if hasattr(signal, "SIGTERM"):  # type: ignore[unreachable]
                # If available, give preference to signalling the process group over `terminate()`.
                try:
                    await self.send_signal(signal.SIGTERM)
                    return
                except OSError:
                    pass
            try:
                self.nod_info.python_process.terminate()
            except OSError as e:
                LocalProvisioner._tolerate_no_process(e)

    async def pre_launch(self, **kwargs):
        _log.info("PROVISIONER PRELAUNCH")
        python_cmd = shlex.split(base64.b64decode(self.cli_cmd).decode("utf-8"))
        extra_arguments = kwargs.pop("extra_arguments", [])
        kwargs.pop("cmd", None)
        kernel_cmd = python_cmd + extra_arguments
        final_cmd = await super().pre_launch(cmd=kernel_cmd, **kwargs)
        return final_cmd

    def get_most_recent_connection_file(
        self, connection_dir: str
    ) -> tuple[str, int] | tuple[None, None]:
        # Find Connection File and Get Kernel Info
        _log.info("Connection Dir Path: %s", connection_dir)
        connection_filenames = os.listdir(connection_dir)
        pid_filenames = list(filter(regex.match, connection_filenames))
        _log.info("PID FILENAMES")
        _log.info(pid_filenames)
        if len(pid_filenames) > 1:
            _log.warning("Found Multiple Kernel Files in Nod Connection Folder")
        if len(pid_filenames) > 0:
            connection_file = os.path.join(connection_dir, pid_filenames[0])
            _log.info("Connection File Path: %s", connection_file)
            match = regex.match(os.path.basename(connection_file))
            if match is None:
                raise  # TODO

            pid = int(match.group(1))
            return connection_file, pid
        return None, None

    async def launch_kernel(self, cmd, **kwargs):
        _log.info("PROVISIONER LAUNCH KERNEL")
        _log.info(cmd)

        async with self.nod_info.starting_lock:
            _log.info("PROVISIONER AQUIRED LOCK")
            # return existing kernel if its still running
            connection_dir = os.path.join(os.getcwd(), ".nod", "connection")
            connection_file, pid = self.get_most_recent_connection_file(connection_dir)
            if connection_file is not None and pid is not None:
                _log.info("Found Existing Connection File")
                if psutil.pid_exists(pid):
                    kernel_process = psutil.Process(pid)
                    _log.info("EXISTING KERNEL IS_RUNNING")
                    _log.info(kernel_process.is_running())
                    _log.info("EXISTING KERNEL has_process")
                    _log.info(self.has_process)
                    if kernel_process.is_running() and self.has_process:
                        _log.info("Returning Existing Kernel Info")
                        return self.nod_info.file_info
            _log.info("Starting Python Program")
            # Launch Python Command
            scrubbed_kwargs = LocalProvisioner._scrub_kwargs(kwargs)
            launch_time = time.time()
            _log.info("Launching Kernel at Time")
            _log.info(launch_time)
            # _log.info("Full Cmd and Scrubbed_Kwargs")
            # _log.info(cmd)
            # _log.info(scrubbed_kwargs)
            self.nod_info.python_process = launch_kernel(cmd, **scrubbed_kwargs)
            python_pgid = None
            if hasattr(os, "getpgid"):
                try:
                    python_pgid = os.getpgid(self.nod_info.python_process.pid)
                    self.nod_info.python_pgid = python_pgid
                except OSError:
                    pass
            self.nod_info.python_pid = self.nod_info.python_process.pid
            self.cwd = kwargs.get("cwd", pathlib.Path.cwd())

            connection_file, pid = self.get_most_recent_connection_file(connection_dir)
            while (
                connection_file is None
                or pid is None
                or ((os.path.getmtime(connection_file) - launch_time) < -1)
                or not psutil.pid_exists(pid)
            ):
                try:
                    _log.info(launch_time)
                    _log.info(os.path.getmtime(connection_file))
                    _log.info(
                        os.path.getmtime(
                            ((os.path.getmtime(connection_file) - launch_time) < -1)
                        )
                    )
                    _log.info(psutil.pid_exists(pid))
                except:
                    pass
                await asyncio.sleep(0.5)
                connection_file, pid = self.get_most_recent_connection_file(
                    connection_dir
                )

                _log.info("...waiting for kernel to start")

            self.nod_info.kernel_process = psutil.Process(pid)
            self.nod_info.kernel_pid = pid
            self.nod_info.connection_file = connection_file
            with open(self.nod_info.connection_file) as f:
                file_info = json.load(f)

            file_info["key"] = file_info["key"].encode()
            file_info["kernel_name"] = "nod"
            self.nod_info.file_info = file_info
            _log.info("connection file_info: " + str(file_info))

            kernel_pgid = None
            if hasattr(os, "getpgid"):
                try:
                    kernel_pgid = os.getpgid(self.nod_info.kernel_pid)
                    self.nod_info.kernel_pgid = kernel_pgid
                except OSError:
                    pass
            self.kernel_spec.display_name = "nod"
            _log.info("KERNEL ID %s", self.kernel_id)
            return file_info

    async def post_launch(self, **kwargs):
        _log.info("PROVISIONER POST LAUNCH KERNEL")
        manager: KernelManager = self.parent

        # if not manager.ready.done():
        #     manager.ready.set_result(None)
        # if not manager._ready.done():
        #     manager._ready.set_result(None)
        # msg = self.session.msg("interrupt_request", content={})
        # self._connect_control_socket()
        # self.session.send(self._control_socket, msg)
        # manager.session.
        if manager.has_kernel:
            _log.info("HAS KERNEL")
        _log.info(manager.kernel_name)
        if manager.kernel_spec is not None:
            _log.info("display_name")
            _log.info(manager.kernel_spec.display_name)
        _log.info("OWNS KERNEL %s", str(manager.owns_kernel))
        return

    # async def shutdown_requested(self, restart: bool = False) -> None:
    #     """
    #     Allows the provisioner to determine if the kernel's shutdown has been requested.

    #     This method is called from `KernelManager.request_shutdown()` as part of
    #     its shutdown sequence.

    #     This method is optional and is primarily used in scenarios where the provisioner
    #     may need to perform other operations in preparation for a kernel's shutdown.
    #     """
    #     _log.info("PROVISIONER SHUTDOWN REQUEST" + str(restart))
    #     if restart:
    #         self.restarting = True
    #     pass

    def get_stable_start_time(self, recommended: float = 10.0) -> float:
        """
        Returns the expected upper bound for a kernel (re-)start to complete.
        This may vary by provisioner.

        The recommended value will typically be what is configured in the kernel restarter.
        """
        return recommended

    async def cleanup(self, restart=False):
        _log.info("PROVISIONER CLEANUP" + str(restart))
        # try:
        #     manager: KernelManager = self.parent
        #     if not manager.ready.done():
        #         manager.ready.set_result(1)
        #         manager.ready.
        #     if not manager._ready.done():
        #         manager._ready.set_result(1)
        #     return
        # except OSError:
        #     pass

    @staticmethod
    def _tolerate_no_process(os_error: OSError) -> None:
        # In Windows, we will get an Access Denied error if the process
        # has already terminated. Ignore it.
        if sys.platform == "win32":
            if os_error.winerror != 5:
                err_message = (
                    f"Invalid Error, expecting error number to be 5, got {os_error}"
                )
                raise ValueError(err_message)

        # On Unix, we may get an ESRCH error (or ProcessLookupError instance) if
        # the process has already terminated. Ignore it.
        else:
            from errno import ESRCH

            if not isinstance(os_error, ProcessLookupError) or os_error.errno != ESRCH:
                err_message = f"Invalid Error, expecting ProcessLookupError or ESRCH, got {os_error}"
                raise ValueError(err_message)

    def resolve_path(self, path_str: str) -> str | None:  # type: ignore
        """Resolve path to given file."""
        path = pathlib.Path(path_str).expanduser()
        if not path.is_absolute() and self.cwd:
            path = (pathlib.Path(self.cwd) / path).resolve()
        if path.exists():
            return path.as_posix()
        return None

    async def get_provisioner_info(self) -> dict[str, Any]:
        _log.info("PROVISIONER GET PROVISIONER INFO")
        """
        Captures the base information necessary for persistence relative to this instance.

        This enables applications that subclass `KernelManager` to persist a kernel provisioner's
        relevant information to accomplish functionality like disaster recovery or high availability
        by calling this method via the kernel manager's `provisioner` attribute.

        NOTE: The superclass method must always be called first to ensure proper serialization.
        """
        provisioner_info = await super().get_provisioner_info()
        provisioner_info.update(
            {
                "pid": self.nod_info.kernel_pid,
                "pgid": self.nod_info.kernel_pgid,
                "ip": self.ip,
            }
        )
        _log.info("GET PROVISIONER INFO")
        _log.info(provisioner_info)
        return provisioner_info

    async def load_provisioner_info(self, provisioner_info: dict) -> None:
        _log.info("PROVISIONER LOAD INFO")
        """
        Loads the base information necessary for persistence relative to this instance.

        The inverse of `get_provisioner_info()`, this enables applications that subclass
        `KernelManager` to re-establish communication with a provisioner that is managing
        a (presumably) remote kernel from an entirely different process that the original
        provisioner.

        NOTE: The superclass method must always be called first to ensure proper deserialization.
        """
        await super().load_provisioner_info(provisioner_info)
        self.kernel_id = provisioner_info["kernel_id"]
        self.connection_info = provisioner_info["connection_info"]
        self.ip = provisioner_info["ip"]
        _log.info("LOAD PROVISIONER INFO")
        _log.info(self.kernel_id)
