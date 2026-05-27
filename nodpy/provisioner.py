from abc import ABC
import asyncio
import glob
import json
import logging
import os
import pathlib
import re
import signal
import subprocess
import sys
import time
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
from traitlets.traitlets import Bool, Unicode
import jupyter_core

# from nod.datastore import StartingVariables
from jupyter_client import find_connection_file
from subprocess import PIPE, Popen

_log = logging.getLogger(__name__)
regex = re.compile(r".*kernel-(.{2,8})\.json")


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


class Watcher(object):
    running = True
    refresh_delay_secs = 1

    # Constructor
    def __init__(self, dir_to_watch, call_func_on_change=None):
        self.dir_to_watch: str = dir_to_watch
        self.call_func_on_change = call_func_on_change
        self.dir_list_cache: list[str] = [""]

    # Look for changes
    def look(self):
        dirlist = set(os.listdir(self.dir_to_watch))
        if len(dirlist.symmetric_difference(set(self.dir_list_cache))) > 0:
            # File has changed, so do something...
            _log.info("File changed")
            if self.call_func_on_change is not None:
                self.call_func_on_change(dirlist)
        self.dir_list_cache = list(dirlist)

    # Keep watching in a loop
    def watch(self):
        while self.running:
            try:
                # Look for changes
                time.sleep(self.refresh_delay_secs)
                self.look()
            except KeyboardInterrupt:
                print("\nDone")
                break
            except FileNotFoundError:
                # Action on file not found
                pass
            except:
                print("Unhandled error: %s" % sys.exc_info()[0])


class NodProvisionerMeta(type(KernelProvisionerBase)):  # type: ignore[misc]
    pass


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
    restarting = False

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
        provisioner_info.update({"pid": self.pid, "pgid": self.pgid, "ip": self.ip})
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
        #     manager.kernel_spec.display_name = "Nod"
        # manager.kernel_name = "Nod"
        _log.info("OWNS KERNEL %s", str(manager.owns_kernel))
        return

    async def launch_kernel(self, cmd, **kwargs):
        _log.info("PROVISIONER LAUNCH KERNEL")
        # _log.info("LAUNCH KERNEL")
        _log.info("launch info")
        _log.info(cmd)
        # _log.info(kwargs)
        # self.process = Popen(
        #     [sys.executable, "-c", cmd, "--existing", self.connection_file],
        #     stdout=PIPE,
        #     stderr=PIPE,
        #     close_fds=(sys.platform != "win32"),
        #     **kwargs,
        # )
        _log.warning("Provisioner:CLICMD")
        _log.warning(self.cli_cmd)
        connection_dir = os.path.join(os.getcwd(), ".nod", "connection")
        _log.info("Connection Dir Path: %s", connection_dir)
        connection_filenames = os.listdir(connection_dir)
        pid_filenames = list(filter(regex.match, connection_filenames))
        if len(pid_filenames) > 1:
            _log.warning("Found Multiple Kernel Files in Nod Connection Folder")
        if len(pid_filenames) == 0:
            raise  # TODO
        self.connection_file = os.path.join(connection_dir, pid_filenames[0])
        _log.info("Connection File Path: %s", self.connection_file)

        # self.watcher = Watcher(connection_dir, )

        match = regex.match(os.path.basename(self.connection_file))
        if match is None:
            raise
        pid = int(match.group(1))

        if psutil.pid_exists(pid):
            self.process = psutil.Process(pid)
            self.pid = pid
        else:
            # TODO Raise error
            # return
            raise RuntimeError("No Nod Kernel Available")
        with open(self.connection_file) as f:
            file_info = json.load(f)

        file_info["key"] = file_info["key"].encode()
        file_info["kernel_name"] = "Nod"
        _log.info("connection file: " + str(file_info))
        self.restarting = False
        pgid = None
        if hasattr(os, "getpgid"):
            try:
                pgid = os.getpgid(self.pid)
            except OSError:
                pass
        self.pgid = pgid
        self.kernel_spec.display_name = "Nod"
        self.cwd = kwargs.get("cwd", pathlib.Path.cwd())
        _log.info("KERNEL ID %s", self.kernel_id)
        return file_info

    async def pre_launch(self, **kwargs):
        _log.info("PROVISIONER PRELAUNCH")
        # self.parent._owns_kernel = False
        # kwargs = await KernelProvisionerBase.pre_launch(self, **kwargs)

        # km: KernelManager = self.parent
        # if km:
        #     km.shell_port = file_info["shell_port"]
        #     km.iopub_port = file_info["iopub_port"]
        #     km.stdin_port = file_info["stdin_port"]
        #     km.hb_port = file_info["hb_port"]
        #     km.control_port = file_info["control_port"]
        # else:
        #     _log.info("NO KERNEL MANAGER")

        # self.connection_info = km.get_connection_info()
        kwargs = await super().pre_launch(**kwargs)
        kwargs.setdefault("cmd", None)
        return kwargs
        # KERNELPROVISIONERBASE
        # env = kwargs.pop("env", os.environ).copy()
        # env.update(self.__apply_env_substitutions(env))
        # self._finalize_env(env)
        # kwargs["env"] = env
        # kwargs.setdefault("cmd", None)
        # return kwargs

    @property
    def has_process(self) -> bool:
        return True

    async def shutdown_requested(self, restart: bool = False) -> None:
        """
        Allows the provisioner to determine if the kernel's shutdown has been requested.

        This method is called from `KernelManager.request_shutdown()` as part of
        its shutdown sequence.

        This method is optional and is primarily used in scenarios where the provisioner
        may need to perform other operations in preparation for a kernel's shutdown.
        """
        _log.info("PROVISIONER SHUTDOWN REQUEST" + str(restart))
        if restart:
            self.restarting = True
        pass

    async def poll(self):
        # _log.info("PROVISIONER POLL")
        # # """Poll the provisioner."""
        # if self.restarting:
        #     _log.info("PROVISIONER POLL 0")
        #     return 0

        ret = 0
        if self.process:
            if self.process.is_running():
                # _log.info("PROVISIONER POLL NONE")
                return None
        _log.info("PROVISIONER POLL 0")
        return ret

    async def wait(self):
        _log.info("PROVISIONER WAIT")
        pass
        # """Wait for the provisioner process."""
        # ret = 0
        # if self.process:
        #     # Use busy loop at 100ms intervals, polling until the process is
        #     # not alive.  If we find the process is no longer alive, complete
        #     # its cleanup via the blocking wait().  Callers are responsible for
        #     # issuing calls to wait() using a timeout (see kill()).
        #     while await self.poll() is None:  # type:ignore[unreachable]
        #         await asyncio.sleep(0.1)

        #     # Process is no longer alive, wait and clear
        #     ret = self.process.wait()
        #     # Make sure all the fds get closed.
        #     # for attr in ["stdout", "stderr", "stdin"]:
        #     #     fid = getattr(self.process, attr)
        #     #     if fid:
        #     #         fid.close()
        #     # self.process = None  # allow has_process to now return False
        # return ret

    async def send_signal(self, signum: int):
        """Sends a signal to the process group of the kernel (this
        usually includes the kernel and any subprocesses spawned by
        the kernel).

        Note that since only SIGTERM is supported on Windows, we will
        check if the desired signal is for interrupt and apply the
        applicable code on Windows in that case.
        """
        _log.info("SEND SIGNAL " + signal.strsignal(signum))  # type: ignore

        # if self.process and (signum == signal.SIGINT):

        manager: KernelManager = self.parent  # type: ignore
        # if not manager.ready.done():
        #     manager.ready.set_result(None)
        # if not manager._ready.done():
        #     manager._ready.set_result(None)
        if (
            signum == signal.SIGINT and sys.platform == "win32"
        ):  # type: ignore[unreachable]
            from jupyter_client.win_interrupt import send_interrupt

            send_interrupt(self.process.win32_interrupt_event)  # type: ignore
            return
        try:
            os.kill(self.pid, signum)  # type: ignore
        except OSError:
            _log.error(OSError)
            pass
        return
        # Prefer process-group over process
        if self.pgid and hasattr(os, "killpg"):
            try:

                os.killpg(self.pgid, signum)
                return
            except OSError:
                pass  # We'll retry sending the signal to only the process below

        # If we're here, send the signal to the process and let caller handle exceptions
        self.process.send_signal(signum)
        return

    async def kill(self, restart=False):
        """Kill the provisioner and optionally restart."""
        _log.info("PROVISIONER KILL" + str(restart))
        if self.process:
            if hasattr(signal, "SIGKILL"):  # type: ignore[unreachable]
                # If available, give preference to signalling the process-group over `kill()`.
                try:
                    self.restarting = True
                    # await self.send_signal(signal.SIGKILL)
                    if restart:
                        # TODO--SEND reset state here
                        pass
                    return
                except OSError:
                    pass
            # try:
            #     self.process.kill()
            # except OSError as e:
            #     nodProvisioner._tolerate_no_process(e)

    async def terminate(self, restart=False):
        """Terminate the provisioner and optionally restart."""
        _log.info("PROVISIONER TERM" + str(restart))
        if self.process:
            if hasattr(signal, "SIGTERM"):  # type: ignore[unreachable]
                # If available, give preference to signalling the process group over `terminate()`.
                try:
                    manager: KernelManager = self.parent

                    if not manager.ready.done():
                        manager.ready.set_result(1)
                    if manager._ready:
                        if not manager._ready.done():
                            manager._ready.set_result(1)
                    return
                except OSError:
                    pass
            # try:
            #     self.process.terminate()
            # except OSError as e:
            #     nodProvisioner._tolerate_no_process(e)

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
