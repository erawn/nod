import asyncio
import base64
import json
import logging
import os
from pathlib import Path
import pathlib
import shlex
import subprocess
import sys
import atexit
from tempfile import TemporaryDirectory
from typing import List, Optional
import psutil
from typing_extensions import Annotated
import typer
from nodpy import DRY_RUN, DEBUG
from nodpy.file_helpers import PathManager
from jupyter_client.kernelspec import KernelSpecManager

app = typer.Typer(no_args_is_help=False)
_log = logging.getLogger(__name__)
logging.basicConfig(
    format="%(asctime)s,%(msecs)03d %(levelname)-8s [%(filename)s:%(lineno)d] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
_log.setLevel(logging.INFO)

if DEBUG:
    _log.setLevel(logging.DEBUG)

kernel_json = {
    "argv": [
        "python",
        "-m",
        "ipykernel_launcher",
        "-f",
        "{connection_file}",
    ],
    "display_name": "nod",
    "language": "python",
    "metadata": {
        "debugger": True,
        "kernel_provisioner": {"provisioner_name": "NodProvisioner"},
        "supported_encryption": "curve",
    },
    "kernel_protocol_version": "5.5",
}


def install_nod_kernel():
    # here = os.path.abspath(os.path.dirname(__file__))
    # sys.path.insert(0, here)
    # prefix = os.path.join(here, "data_kernelspec")
    with TemporaryDirectory() as td:
        os.chmod(td, 0o755)  # Starts off as 700, not user readable
        with open(os.path.join(td, "kernel.json"), "w") as f:
            json.dump(kernel_json, f, sort_keys=True)
        # print(f"Installing Nod kernel spec in {prefix}")
        KernelSpecManager().install_kernel_spec(td, "nod", user=True)


@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    install_kernel: Annotated[
        bool,
        typer.Option(
            help="Install the Nod Kernel to the local Jupyter directory. Will install in a virtual enviornment if it exists."
        ),
    ] = False,
    existing: bool = typer.Option(
        False,
        "--existing",
        "-e",
        help="Connect to an Existing Jupyter Server. JupyterHub users must use this option",
    ),
    cwd: Annotated[
        Path,
        typer.Option(
            resolve_path=True, help="Directory to create Nod Connection Folder"
        ),
    ] = pathlib.Path.cwd(),
    commands: Annotated[List[str], typer.Argument()] = [],
) -> None:
    """
    Run the command to execute a python file which will call notebook().

    """
    if install_kernel:
        install_nod_kernel()
        return
    LEVEL = "INFO"
    pm = PathManager(clear=True)
    cli_cmds_64 = base64.b64encode(" ".join(commands).encode("utf-8")).decode("utf-8")
    cmd = (
        "jupyter lab"
        # + " "
        # + "--KernelProvisionerFactory.default_provisioner_name=NodProvisioner"
        + " "
        + "--ContentsManager.allow_hidden=True"
        + " "
        + "--ServerApp.webbrowser_open_new=0"
        + " "
        # + "--LabApp.default_url=/lab?reset"
        # + " "
        # + "--ServerApp.base_url= "
        # + " "
        # + "--ServerApp.kernel_manager_class=nod.kernelmanager.NodMappingKernelManager"
        # + " "
        # + "--ServerApp.websocket_ping_interval=0"
        # + " "
        # + "--ServerApp.websocket_ping_timeout=0"
        # + " "
        # + "--ServerApp.external_connection_dir="
        # + os.path.join(hiddenDir, "kernel")
        # + " "
        # + "--AsyncMultiKernelManager.use_pending_kernels=True"
        # + " "
        + (
            (
                "--ServerApp.log_level="
                + LEVEL
                + " "
                + "--LabServerApp.log_level="
                + LEVEL
                + " "
                + "--LabApp.log_level="
                + LEVEL
                + " "
                + "--ExtensionApp.log_level="
                + LEVEL
                + " "
                + "--Application.log_level="
                + LEVEL
                + " "
                if DEBUG
                else ""
            )
        )
        # + "--KernelSpecManager.kernel_dirs=['"
        # + connection_dir
        # + "']"
        # + " "
        # + "--notebook-dir"
        # + " "
        # + os.path.dirname(notebook_call.filename)
        # + " "
        + "--Nod.active=True"
        + " "
        + "--Nod.connection_dir="
        + os.path.relpath(pm.connection_dir, cwd)
        + " "
        + "--NodProvisioner.nod_cwd="
        + str(cwd.absolute().resolve())
        + " "
        # + "--NodProvisioner.stdin="
        # + str(sys.stdin.fileno())
        # + " "
        # + "--Nod.info="
        # + base64.b64encode(jsonInfo).decode("utf-8")
        + " "
        # + "--ServerApp.jpserver_extensions=\"{'nod': True}\""
        # + " "
        # + program_info.notebook_file
        + "--NodProvisioner.cli_cmd="
        + cli_cmds_64
    )

    _log.debug(commands)
    args = shlex.split(cmd)
    _log.debug("Notebook Args: " + str(args))
    if DRY_RUN:
        return

    pythonProcess = None
    notebookProcess = None

    def cleanup():

        if pythonProcess is not None:
            _log.info("Cleanup")
            stdout = pythonProcess.stdout
            stderr = pythonProcess.stderr
            _log.info(
                f"pid {pythonProcess.pid} exists {psutil.pid_exists(pythonProcess.pid)}"
            )
            pythonProcess.communicate("exit")
            if stdout is not None and stderr is not None:
                _log.info("Fixing Pipes")
                stdout.flush()
                stderr.flush()
                os.set_blocking(stdout.fileno(), True)  # type: ignore
                os.set_blocking(stderr.fileno(), True)  # type: ignore

    atexit.register(cleanup)
    if existing:
        nb_env = os.environ.copy()
        nb_env["NOD_CLI_ARGS"] = cli_cmds_64
        nb_env["NOD_RUNTIME_DIR"] = pm.connection_dir
        pythonProcess = subprocess.Popen(
            commands,
            env=nb_env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        while pythonProcess.poll() is None:
            # if pythonProcess is not None:
            import time

            time.sleep(0.1)
            stdout = pythonProcess.stdout
            stderr = pythonProcess.stderr

            if stdout is not None and stderr is not None:
                os.set_blocking(stdout.fileno(), False)  # type: ignore
                os.set_blocking(stderr.fileno(), False)  # type: ignore
                stdout.flush()
                stderr.flush()
                out_lines = []
                for line in iter(stdout.readline, ""):
                    if len(line) == 0:
                        break
                    out_lines.append(line)
                if len(out_lines) > 0:
                    _log.error("".join(out_lines))
                    # _log.debug("".join(out_lines))
                error_lines = []
                for line in iter(stderr.readline, ""):
                    if len(line) == 0:
                        break
                    error_lines.append(line)
                if len(error_lines) > 0:
                    _log.error("".join(error_lines))
        pythonProcess.wait()

        # app.nod_notebook_process = notebookProcess  # type: ignore
    else:
        nb_env = os.environ.copy()
        nb_env["NOD_CLI_ARGS"] = cli_cmds_64
        nb_env["NOD_RUNTIME_DIR"] = pm.connection_dir
        notebookProcess = subprocess.Popen(
            args,
            env=nb_env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            # text=True,
            # bufsize=1,
        )
        notebookProcess.wait()


if __name__ == "__main__":
    app()
