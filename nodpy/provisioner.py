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
import jupyter_core.paths as paths
from math import isclose
from types import NoneType
import typing
from jupyter_client import kernelspec
from jupyter_client.manager import KernelManager
from jupyter_client.multikernelmanager import MultiKernelManager
from typing import Any
import typing as t
import psutil  # type: ignore
from jupyter_client.provisioning.local_provisioner import LocalProvisioner
from jupyter_client.provisioning.provisioner_base import (
    KernelProvisionerBase,
    KernelProvisionerMeta,
)
from jupyter_client.launcher import launch_kernel
from traitlets.traitlets import Bool, Unicode, Integer
import jupyter_core

# from nod.datastore import StartingVariables
from jupyter_client import find_connection_file
from subprocess import PIPE, Popen

from nodpy.exceptions import NodException
from nodpy.nodTypes import NodInfo
from nodpy.serverExtension import findNodRuntimeFile

_log = logging.getLogger(__name__)
regex = re.compile(r".*kernel-(.{2,8})\.json")
_log.setLevel(logging.WARN)


class NodProvisionerMeta(type(KernelProvisionerBase)):  # type: ignore[misc]
    pass


# class Singleton(type):
#     _instances = {}  # type: ignore

#     def __call__(cls, *args, **kwargs):
#         if cls not in cls._instances:
#             cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
#         return cls._instances[cls]


# class NodPythonInfo(metaclass=Singleton):
#     python_process: Popen[bytes] | None = None
#     kernel_process: psutil.Process | None = None
#     python_pgid: int
#     kernel_pid: int
#     kernel_pgid: int
#     starting_lock = asyncio.Lock()
#     file_info: dict[str, Any] = {}
#     connection_file: str


class NodProvisioner(KernelProvisionerBase, metaclass=NodProvisionerMeta):
    # """
    # A Kernel Provisioner that re-uses an existing kernel.
    # The kernel connection file is fetched as the latest
    # modified connection file.
    # """
    nod_cwd = Unicode(os.getcwd()).tag(config=True)
    mode = Unicode("").tag(config=True)
    cli_cmd = Unicode(
        "",
        help="User Command To Execute Python Program",
    ).tag(config=True)

    @property
    def has_process(self) -> bool:
        return self.python_process is not None or self.kernel_process is not None

    python_process: Popen[bytes] | None = None
    kernel_process: psutil.Process | None = None

    def __init__(self, **kwargs: Any):
        super().__init__(**kwargs)
        # self.log = typing.cast(logging.Logger, self.log)
        # self.log.setLevel(logging.INFO)

    async def poll(self):
        ret = 0
        if self.python_process is not None:
            ret = self.python_process.poll()
            _log.debug(f"python process poll{ret}")
        elif self.kernel_process is not None:
            try:
                ret = None if self.kernel_process.is_running() else 0
                _log.debug(
                    f"kernel process poll{ret}, status: {self.kernel_process.status()}"
                )
            except psutil.NoSuchProcess as e:
                _log.info(f"no such process error :{e}")

            # ret = self.nod_info.python_process.poll()
        else:
            _log.info(f"{self.kernel_id} Neither Process Poll Ret : {ret}")
        _log.debug(f"poll returning : {ret}")
        return ret

    async def wait(self):
        _log.info("PROVISIONER WAIT")
        """Wait for the provisioner process."""
        ret = 0
        if self.has_process:
            _log.info(f"wait has process: {self.has_process}")
            # Use busy loop at 100ms intervals, polling until the process is
            # not alive.  If we find the process is no longer alive, complete
            # its cleanup via the blocking wait().  Callers are responsible for
            # issuing calls to wait() using a timeout (see kill()).

            while await self.poll() is None:  # type: ignore[unreachable]
                await asyncio.sleep(0.1)

            if self.python_process is not None:
                _log.info(f"wait python_process: {self.python_process}")
                ret = self.python_process.wait()
                # Make sure all the fds get closed.
                for attr in ["stdout", "stderr", "stdin"]:
                    fid = getattr(self.python_process, attr, None)
                    if fid:
                        fid.close()
            elif self.kernel_process is not None:
                _log.info(f"wait kernel_process: {self.kernel_process.pid}")
                _log.info(
                    f"wait pid exists: {psutil.pid_exists(self.kernel_process.pid)}"
                )
                if psutil.pid_exists(self.kernel_process.pid):
                    try:
                        exitcode = self.kernel_process.wait()
                        _log.info(f"kernel process exit code {exitcode}")
                        ret = 0
                    except psutil.NoSuchProcess:
                        ret = 0
            else:
                ret = 0

            # Process is no longer alive, wait and clear

            self.kernel_process = None
            self.python_process = None
        _log.info(f"return from wait {ret}")
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
        signal_route: None | Popen[bytes] | psutil.Process = None
        if self.python_process is not None:
            signal_route = self.python_process
        if self.kernel_process is not None:
            signal_route = self.kernel_process

        if signum == signal.SIGINT and sys.platform == "win32":  # type: ignore[unreachable]
            from jupyter_client.win_interrupt import send_interrupt  # type: ignore

            send_interrupt(self.python_process.win32_interrupt_event)  # type: ignore
            return
        # We can't use the process group because the existing kernel cannot handle a SIGINT to the process-group
        # Prefer process-group over process
        if self.python_process is not None:
            try:
                signal_pgid = os.getpgid(self.python_process.pid)
                if signal_pgid and hasattr(os, "killpg") and signum != signal.SIGINT:
                    try:
                        _log.info(f"Sending {signum} to pgid {signal_pgid}")
                        os.killpg(signal_pgid, signum)
                        return
                    except OSError:
                        pass  # We'll retry sending the signal to only the process below
            except ProcessLookupError:
                pass

        # If we're here, send the signal to the process and let caller handle exceptions
        elif signal_route is not None and psutil.pid_exists(signal_route.pid):
            _log.info(f"Sending {signum} to signal_route {signal_route.pid}")
            signal_route.send_signal(signum)
        return

    async def kill(self, restart=False):
        """Kill the provisioner and optionally restart."""
        _log.info("PROVISIONER KILL" + str(restart))
        """Kill the provisioner and optionally restart."""
        if self.has_process:
            if hasattr(signal, "SIGKILL"):  # type: ignore[unreachable]
                # If available, give preference to signalling the process-group over `kill()`.
                try:

                    await self.send_signal(signal.SIGKILL)
                    return
                except OSError:
                    pass
            try:
                if self.python_process is not None:
                    _log.info(
                        f"sending kill to python process {self.python_process.pid}"
                    )
                    self.python_process.kill()
                if self.kernel_process is not None:
                    self.kernel_process.kill()
                    _log.info(
                        f"sending kill to kernel process {self.kernel_process.pid}"
                    )
            except OSError as e:
                LocalProvisioner._tolerate_no_process(e)

    async def terminate(self, restart=False):
        """Terminate the provisioner and optionally restart."""
        _log.info("PROVISIONER TERM, restart: " + str(restart))
        if self.has_process:
            if hasattr(signal, "SIGTERM"):  # type: ignore[unreachable]
                # If available, give preference to signalling the process group over `terminate()`.
                try:
                    await self.send_signal(signal.SIGTERM)
                    return
                except OSError:
                    pass
            try:
                if self.python_process is not None:
                    _log.info(
                        f"sending terminate to python process {self.python_process.pid}"
                    )
                    self.python_process.terminate()
                if self.kernel_process is not None:
                    self.kernel_process.terminate()
                    _log.info(
                        f"sending terminate to kernel process {self.kernel_process.pid}"
                    )
            except OSError as e:
                LocalProvisioner._tolerate_no_process(e)

    async def pre_launch(self, **kwargs):
        _log.info("PROVISIONER PRELAUNCH")
        existing_info = None
        km: KernelManager = self.parent  # type: ignore
        mkm: MultiKernelManager = km.parent  # type: ignore
        _log.info(mkm)
        _log.info(mkm.trait_names())
        if "nod_key" in mkm.trait_names():
            key = typing.cast(str, getattr(mkm, "nod_key", None))
            _log.info(f"Key:{key}")
            file_list = findNodRuntimeFile(
                paths.jupyter_runtime_dir(),
                paths.get_home_dir(),
                key=key,
                ignore_run=True,
            )
            _log.info(f"file_list: {file_list}")
            if len(file_list) > 0:
                existing_info = file_list.pop()
                self.cli_cmd = existing_info.cli_args
        _log.info(f"Existing Info : {existing_info}")
        python_cmd = shlex.split(base64.b64decode(self.cli_cmd).decode("utf-8"))
        _log.info(f"Python Command: {python_cmd}")
        if python_cmd == []:
            raise NodException(
                "Cannot Start Nod Kernel Without Calling Nod from the Command Line"
            )
        extra_arguments = kwargs.pop("extra_arguments", [])
        kwargs.pop("cmd", None)
        kernel_cmd = python_cmd + extra_arguments
        final_cmd = await super().pre_launch(
            cmd=kernel_cmd,
            existing_info=(
                {"info": existing_info} if existing_info is not None else None
            ),
            **kwargs,
        )
        return final_cmd

    def get_most_recent_connection_file(
        self, connection_dir: str
    ) -> tuple[str, int] | tuple[None, None]:
        # Find Connection File and Get Kernel Info
        # _log.info("...looking for ")
        # _log.info("Connection Dir Path: %s", connection_dir)
        connection_filenames = os.listdir(connection_dir)
        pid_filenames = list(filter(regex.match, connection_filenames))
        # _log.info("PID FILENAMES")
        # _log.info(pid_filenames)
        if len(pid_filenames) > 1:
            _log.warning("Found Multiple Kernel Files in Nod Connection Folder")
        if len(pid_filenames) > 0:
            connection_file = os.path.join(connection_dir, pid_filenames[0])
            # _log.info("Connection File Path: %s", connection_file)
            match = regex.match(os.path.basename(connection_file))
            if match is None:
                return None, None

            pid = int(match.group(1))
            return connection_file, pid
        return None, None

    def log_kernel(self):
        if self.python_process is not None:
            stdout = self.python_process.stdout
            stderr = self.python_process.stderr
            if stdout is not None and stderr is not None:
                stdout.flush()
                stderr.flush()
                out_lines = []
                for line in iter(stdout.readline, ""):
                    if len(line) == 0:
                        break
                    out_lines.append(line)
                if len(out_lines) > 0:
                    self.log.info("".join(out_lines))
                    # _log.info("".join(out_lines))
                error_lines = []
                for line in iter(stderr.readline, ""):
                    if len(line) == 0:
                        break
                    error_lines.append(line)
                if len(error_lines) > 0:
                    self.log.error("".join(error_lines))
                    # _log.error("".join(out_lines))

    # async def kernel_watcher(self):
    #     while True:
    #         await asyncio.sleep(0.2)
    #         self.log_kernel()
    async def launch_nod_kernel(self, cmd, kwargs):
        launch_time = time.time()
        _log.info(f"{self.kernel_id} Launching Kernel at Time")
        _log.info(launch_time)
        _log.info(f"{self.nod_cwd} CWD")
        scrubbed_kwargs = LocalProvisioner._scrub_kwargs(kwargs)
        scrubbed_kwargs.pop("cwd", None)
        self.python_process = launch_kernel(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=1,
            text=True,
            **scrubbed_kwargs,
            cwd=self.nod_cwd,
        )
        os.set_blocking(self.python_process.stdout.fileno(), False)  # type: ignore
        os.set_blocking(self.python_process.stderr.fileno(), False)  # type: ignore
        connection_dir = os.path.join(self.nod_cwd, "nod", "connection")
        connection_file, pid = self.get_most_recent_connection_file(connection_dir)
        _log.info("LAUNCH KERNEL DONE")
        _log.info("looking for Nod Session...")
        self.log_kernel()
        while (
            connection_file is None
            or not os.path.exists(connection_file)
            or pid is None
            or ((os.path.getmtime(connection_file) - launch_time) < -1)
            or not psutil.pid_exists(pid)
        ):
            self.log_kernel()
            connection_file, pid = self.get_most_recent_connection_file(connection_dir)
            await asyncio.sleep(0.1)
        self.connection_file = connection_file

    async def launch_kernel(self, cmd, **kwargs):  # type: ignore
        _log.info(f"{self.kernel_id} PROVISIONER LAUNCH KERNEL {cmd}")
        existing_info = kwargs.pop("existing_info", None)
        _log.debug(f"existing info: {existing_info}")

        if existing_info is not None:
            _log.info("existing info found")
            _log.info(existing_info)
            info = t.cast(NodInfo, existing_info["info"])
            connection_file_path = info.connection_file_path
            _log.info(f"connection file path: {connection_file_path}")
            if connection_file_path is not None and os.path.exists(
                connection_file_path
            ):
                self.connection_file = connection_file_path
            if psutil.pid_exists(info.kernel_pid):
                self.kernel_process = psutil.Process(info.kernel_pid)
                self.python_process = None
                km: KernelManager = self.parent  # type: ignore
                _log.info(f"Mode : {self.mode}")
                if km and self.mode != "non_existing":
                    km.autorestart = False

        if self.kernel_process is not None and self.kernel_process.is_running():
            _log.info("Returning Existing Kernel Info")
        else:
            await self.launch_nod_kernel(cmd, kwargs)

        with open(self.connection_file) as f:
            file_info = json.load(f)

        file_info["key"] = file_info["key"].encode()
        file_info["kernel_name"] = "nod"
        self.file_info = file_info
        km: KernelManager = self.parent  # type: ignore
        if km:
            km.shell_port = file_info["shell_port"]
            km.iopub_port = file_info["iopub_port"]
            km.stdin_port = file_info["stdin_port"]
            km.hb_port = file_info["hb_port"]
            km.control_port = file_info["control_port"]
            km.session.key = file_info["key"]
            km.session.signature_scheme = file_info["signature_scheme"]
            km.kernel_name = file_info["kernel_name"]
            km.ip = file_info["ip"]
            km.transport = file_info["transport"]

            self._connection_file_written = False
            km.write_connection_file(metadata=file_info["metadata"])
            _log.info(f" KM CONNECTION INFO {km.get_connection_info()}")
        else:
            _log.info("NO KERNEL MANAGER")
        self.kernel_spec.display_name = "nod"
        _log.info(f"LAUNCHED KERNEL {self.kernel_id}")
        _log.debug("connection file_info: " + str(file_info))
        return file_info

    async def post_launch(self, **kwargs):
        _log.info("PROVISIONER POST LAUNCH KERNEL")
        return

    async def shutdown_requested(self, restart: bool = False) -> None:
        """
        Allows the provisioner to determine if the kernel's shutdown has been requested.

        This method is called from `KernelManager.request_shutdown()` as part of
        its shutdown sequence.

        This method is optional and is primarily used in scenarios where the provisioner
        may need to perform other operations in preparation for a kernel's shutdown.
        """
        _log.info("PROVISIONER SHUTDOWN REQUEST" + str(restart))
        # if restart:
        #     self.restarting = True
        pass

    def get_stable_start_time(self, recommended: float = 10.0) -> float:
        """
        Returns the expected upper bound for a kernel (re-)start to complete.
        This may vary by provisioner.

        The recommended value will typically be what is configured in the kernel restarter.
        """
        return recommended

    async def cleanup(self, restart=False):
        _log.info("PROVISIONER CLEANUP" + str(restart))
        if not restart:
            km: KernelManager = self.parent  # type: ignore
            km.stop_restarter()

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
        if not path.is_absolute():
            path = (pathlib.Path(os.getcwd()) / path).resolve()
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
                # "pid": self.nod_info.kernel_pid,
                # "pgid": self.nod_info.kernel_pgid,
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
        # self.kernel_id = provisioner_info["kernel_id"]
        # self.connection_info = provisioner_info["connection_info"]
        self.ip = provisioner_info["ip"]
        _log.info("LOAD PROVISIONER INFO")
        _log.info(self.kernel_id)
