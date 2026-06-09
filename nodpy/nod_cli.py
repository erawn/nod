import base64
import json
import logging
import os
from pathlib import Path
import pathlib
import shlex
import subprocess
import sys
from tempfile import TemporaryDirectory
from typing import List, Optional
import orjson
import nbformat
from typing_extensions import Annotated

import typer

from nodpy import DRY_RUN
from nodpy.file_helpers import PathManager
from jupyter_client.kernelspec import KernelSpecManager

app = typer.Typer(no_args_is_help=False)
_log = logging.getLogger(__name__)
logging.basicConfig()
_log.setLevel(logging.INFO)
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
    },
}


def install_nod_kernel():
    here = os.path.abspath(os.path.dirname(__file__))
    sys.path.insert(0, here)
    prefix = os.path.join(here, "data_kernelspec")
    with TemporaryDirectory() as td:
        os.chmod(td, 0o755)  # Starts off as 700, not user readable
        with open(os.path.join(td, "kernel.json"), "w") as f:
            json.dump(kernel_json, f, sort_keys=True)
        print(f"Installing Nod kernel spec in {sys.prefix}")

        # # Requires logo files in kernel root directory
        # cur_path = os.path.dirname(os.path.realpath(__file__))
        # for logo in ["logo-32x32.png", "logo-64x64.png"]:
        #     try:
        #         shutil.copy(os.path.join(cur_path, logo), td)
        #     except FileNotFoundError:
        #         print("Custom logo files not found. Default logos will be used.")

        KernelSpecManager().install_kernel_spec(td, "nod", prefix=sys.prefix)


# @app.callback()
# def callback():
#     """
#     Nod
#     """

# @app.command()
# def install_kernel():
#     """
#     Install the Nod Kernel to the local Jupyter directory.
#     Will install in a virtual enviornment if it exists.
#     """


@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    install_kernel: Annotated[
        bool,
        typer.Option(
            help="Install the Nod Kernel to the local Jupyter directory. Will install in a virtual enviornment if it exists."
        ),
    ] = False,
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

    pm = PathManager(clear=True)
    cmd = (
        "jupyter lab"
        + " "
        + "--KernelProvisionerFactory.default_provisioner_name=NodProvisioner"
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
        + "--ServerApp.log_level=INFO"
        + " "
        # + "--LabServerApp.log_level=INFO"
        # + " "
        # + "--LabApp.log_level=INFO"
        # + " "
        # + "--ExtensionApp.log_level=INFO"
        # + " "
        # + "--Application.log_level=INFO"
        + " "
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
        + "--NodProvisioner.stdin="
        + str(sys.stdin.fileno())
        + " "
        # + "--Nod.info="
        # + base64.b64encode(jsonInfo).decode("utf-8")
        + " "
        # + "--ServerApp.jpserver_extensions=\"{'nod': True}\""
        # + " "
        # + program_info.notebook_file
        + "--NodProvisioner.cli_cmd="
        + base64.b64encode(" ".join(commands).encode("utf-8")).decode("utf-8")
    )

    _log.debug(commands)
    args = shlex.split(cmd)
    _log.debug("Notebook Args: " + str(args))
    if not DRY_RUN:
        nb_env = os.environ.copy()
        nb_env["NOD_RUNTIME_DIR"] = pm.connection_dir
        notebookProcess = subprocess.Popen(
            args,
            env=nb_env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            # text=True,
            # bufsize=1,
        )

        # while notebookProcess.poll() is None:
        #     if notebookProcess is not None:
        #         stdout = notebookProcess.stdout
        #         stderr = notebookProcess.stderr

        #         if stdout is not None and stderr is not None:
        #             os.set_blocking(stdout.fileno(), False)  # type: ignore
        #             os.set_blocking(stderr.fileno(), False)  # type: ignore
        #             out_lines = []
        #             for line in iter(stdout.readline, ""):
        #                 if len(line) == 0:
        #                     break
        #                 out_lines.append(line)
        #             if len(out_lines) > 0:
        #                 _log.error("".join(out_lines))
        #                 # _log.debug("".join(out_lines))
        #             error_lines = []
        #             for line in iter(stderr.readline, ""):
        #                 if len(line) == 0:
        #                     break
        #                 error_lines.append(line)
        #             if len(error_lines) > 0:
        #                 _log.error("".join(error_lines))
        notebookProcess.wait()
        # app.nod_notebook_process = notebookProcess  # type: ignore


if __name__ == "__main__":
    app()
