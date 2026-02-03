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
import psutil
from jupyter_client import KernelProvisionerBase

from nod.datastore import StartingVariables

_log = logging.getLogger(__name__)
regex = re.compile(r".*kernel-(.{2,8})\.json")


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

        pgid = None
        if hasattr(os, "getpgid"):
            try:
                pgid = os.getpgid(self.pid)
            except OSError:
                pass
        self.pgid = pgid
        self.cwd = kwargs.get("cwd", pathlib.Path.cwd())

        return self.connection_info

    async def pre_launch(self, **kwargs):
        connection_file = get_latest_connection_file()

        _log.warning("PID MATCH")
        match = regex.match(connection_file)
        pid = int(match.group(1))
        if psutil.pid_exists(pid):
            self.process = psutil.Process(pid)
            self.pid = pid
        else:
            # TODO Raise error
            return
        with open(connection_file) as f:
            file_info = json.load(f)

        file_info["key"] = file_info["key"].encode()
        self.connection_info = file_info
        _log.warning("STARTING TERMINAL")
        _log.warning(file_info)
        _log.warning(StartingVariables().variables)
        kwargs = await super().pre_launch(**kwargs)
        kwargs.setdefault("cmd", None)
        return kwargs

    def has_process(self) -> bool:
        return True

    async def poll(self):
        pass
        # # """Poll the provisioner."""
        # ret = 0
        # if self.process:
        #     if self.process.is_running():
        #         return None
        # return ret

    async def wait(self):
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
        if self.process:
            if (
                signum == signal.SIGINT and sys.platform == "win32"
            ):  # type:ignore[unreachable]
                from jupyter_client.win_interrupt import send_interrupt

                send_interrupt(self.process.win32_interrupt_event)
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
        if self.process:
            if hasattr(signal, "SIGKILL"):  # type:ignore[unreachable]
                # If available, give preference to signalling the process-group over `kill()`.
                try:
                    await self.send_signal(signal.SIGKILL)
                    return
                except OSError:
                    pass
            try:
                self.process.kill()
            except OSError as e:
                nodProvisioner._tolerate_no_process(e)

    async def terminate(self, restart=False):
        """Terminate the provisioner and optionally restart."""
        if self.process:
            if hasattr(signal, "SIGTERM"):  # type:ignore[unreachable]
                # If available, give preference to signalling the process group over `terminate()`.
                try:
                    await self.send_signal(signal.SIGTERM)
                    return
                except OSError:
                    pass
            try:
                self.process.terminate()
            except OSError as e:
                nodProvisioner._tolerate_no_process(e)

    async def cleanup(self, restart):
        pass

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
