from dataclasses import dataclass
import json
import logging
import os
import subprocess
import textwrap
from jupyter_server.extension.application import ExtensionApp
import jupytext  # type: ignore[import-untyped]
import orjson
import psutil  # type: ignore[import-untyped]
from traitlets.traitlets import Bool, Unicode
import base64
from nodpy.nodTypes import (
    NodConnectionInfo,
    NodInfo,
    ProgramInfo,
    writeRequest,
)
from tornado import web
import jupyter_core.paths as paths
from pathlib import Path
import typing as t
import traceback

# paths.jupyter_data_dir()
# paths.prefer_environment_over_user()
_log = logging.getLogger(__name__)

# import os
# import sys
# import time


import json
from jupytext.formats import long_form_one_format  # type: ignore
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
from typing import List, cast


class NodServerFileRouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def post(self):

        path = self.request.body.strip().decode("utf-8")

        full_path = os.path.abspath(path)
        _log.info(f"nod file route handler get nod info {full_path}")
        # file_list = findNodRuntimeFile(
        #     paths.jupyter_runtime_dir(), paths.get_home_dir(), ignore_run=True
        # )
        # if len(file_list) > 0:
        #     nodInfo = file_list.pop().to_dict(True)
        #     out = base64.b64encode(
        #         orjson.dumps(
        #             nodInfo,
        #         )
        #     ).decode("utf-8")

        with open(full_path, "r") as f:
            info_str = f.read()
            nod_info = NodInfo.from_json(info_str)
            out = base64.b64encode(
                orjson.dumps(
                    nod_info,
                )
            ).decode("utf-8")

            self.finish(out)
            return
        self.finish()


def findNodRuntimeFile(
    runtime_dir: str, server_dir: str, key: str | None = None, ignore_run: bool = False
) -> List[NodInfo]:
    metadata_fields: List[NodInfo] = []
    if not os.path.exists(runtime_dir):
        return metadata_fields
    connection_files = os.listdir(runtime_dir)
    for file_name in connection_files:
        file_path = os.path.join(runtime_dir, file_name)
        # _log.info(file_path)
        if not (
            os.path.isfile(file_path)
            and Path(file_path).suffix == ".json"
            and Path(file_name).stem.startswith("kernel")
        ):
            continue
        # _log.info(file_name)
        try:
            with open(file_path, "r") as f:
                connection_info_str = f.read()
                errors = NodConnectionInfo.schema().validate(
                    json.loads(connection_info_str)
                )
                # _log.warning(connection_info_str)
                # _log.info(errors)
                if errors != {}:
                    _log.info("failed")
                    continue

                # _log.info("validated")
                connection_info = NodConnectionInfo.from_json(connection_info_str)
                if connection_info is None:
                    continue
                # _log.info(connection_info)
                metadata = connection_info.metadata
                if metadata is None:
                    continue

                nod_info = metadata.get("nod_info")
                if nod_info is None:
                    continue

                nod_info = NodInfo.from_dict(nod_info)
                if not os.path.isfile(nod_info.nod_info_local_path):
                    continue

                with open(nod_info.nod_info_local_path, "r") as l:
                    local_info_string = l.read()
                    local_nod_info = NodInfo.from_json(local_info_string)
                    # _log.warning(nod_info)
                    if local_nod_info.key == nod_info.key and (
                        ignore_run or psutil.pid_exists(local_nod_info.python_pid)
                    ):
                        nod_info.nod_info_rel_path = os.path.relpath(
                            nod_info.nod_info_local_path, os.getcwd()
                        )
                        # _log.info(nod_info.nod_info_rel_path)
                        nod_info.connection_file_path = file_path
                        if (
                            len(
                                [
                                    info
                                    for info in metadata_fields
                                    if info.key == nod_info.key
                                ]
                            )
                            == 0
                        ):

                            if key is not None:
                                if nod_info.key == key:
                                    metadata_fields.append(nod_info)
                            else:
                                metadata_fields.append(nod_info)
                        # now check if kernel is alive
                        # _log.info(nod_info)

            # self.log.warning(info.get("metadata"))

        except Exception as e:
            _log.error(traceback.format_exc())
            pass
    return metadata_fields


class ExistingKernelsRouteHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        # _log.info(f"nod existing kernels get kernels")
        # paths.jupyter_runtime_dir
        # _log.info(paths.jupyter_runtime_dir())
        # _log.info(paths.get_home_dir())
        # _log.info(paths.jupyter_path())
        # _log.info(os.getcwd())
        metadata_fields = findNodRuntimeFile(
            paths.jupyter_runtime_dir(), paths.get_home_dir()
        )
        # _log.info(metadata_fields)
        metadata_fields = [info.to_dict(True) for info in metadata_fields]
        out = base64.b64encode(
            orjson.dumps(
                metadata_fields,
            )
        ).decode("utf-8")
        # _log.info(out)
        self.finish(out)

    @tornado.web.authenticated
    def post(self):
        _log.info(f"nod existing kernels set kernel key")
        # input_data is a dictionary with a key "name"
        # Do we need to call body.decode('utf-8') here?
        body = self.request.body.strip().decode("utf-8")
        serverapp = self.serverapp
        if serverapp is not None:
            if "nod_key" not in serverapp.kernel_manager.trait_names():
                serverapp.kernel_manager.add_traits(nod_key=Unicode())
            # _log.info(serverapp.kernel_manager)
            # _log.info(serverapp.kernel_manager.trait_names())
            _log.info(f"Setting new Key: {body}")
            serverapp.kernel_manager.nod_key = body  # type: ignore
            self.finish(
                json.dumps(
                    {"success": serverapp.kernel_manager.nod_key},  # type: ignore
                )
            )
            return

        self.finish(
            """{"failed":"test"}""",
        )





class WriteFileRouteHandler(APIHandler):

    @tornado.web.authenticated
    def post(self):
        # input_data is a dictionary with a key "name"
        # Do we need to call body.decode('utf-8') here?
        body = self.request.body.strip().decode("utf-8")
        try:
            _log.info("RECEIVED WRITE REQUEST")
            json_load = json.loads(body)
            # _log.info(json_load)
            request = writeRequest.from_dict(json_load)
            _log.info("REQUEST")
            _log.debug(request)
            decoded_content = base64.b64decode(request.notebookContent).decode("utf-8")
            _log.debug(decoded_content)
            nb = jupytext.reads(decoded_content, "ipynb")
            _log.debug("NB")
            _log.info(nb)
            nb_content_to_write = jupytext.writes(
                nb, fmt=long_form_one_format(f"py:{request.program_info.fmt}")
            )
            _log.info(nb_content_to_write)
            fileInfo = request.program_info.file_info
            if fileInfo is not None:
                file_content = (
                    fileInfo.text_above
                    + fileInfo.text_header
                    + textwrap.indent(
                        nb_content_to_write,
                        " " * fileInfo.indent,
                    ).splitlines(True)
                    + fileInfo.text_below
                )
                _log.info(file_content)
                with open(request.program_info.source_file, "w") as f:
                    f.writelines(file_content)

        except Exception as e:
            self.log.debug("Bad JSON: %r", body)
            self.log.error("Couldn't parse JSON", exc_info=True)
            raise web.HTTPError(400, "Invalid JSON in body of request") from e
        self.finish()


class Nod(ExtensionApp):
    name = "Nod"
    active = Bool(
        False,
        help="Whether to activate Nod front end. Should only be set from the nod library",
    ).tag(config=True)
    cli_cmd = Unicode(
        "",
        help="User Command To Execute Python Program",
    ).tag(config=True)

    connection_dir = Unicode("", help="Nod Connection Directory").tag(config=True)

    def initialize_handlers(self):
        host_pattern = ".*$"
        base_url = self.serverapp.web_app.settings["base_url"]  # type: ignore
        nod_route_pattern = url_path_join(base_url, "nodpy", "kernels")
        write_file_route_pattern = url_path_join(base_url, "nodpy", "write_file")
        get_file_route_pattern = url_path_join(base_url, "nodpy", "file")
        path_regex = r"(?P<path>\w+)"

        # default_handlers = [
        #     ,
        handlers = [
            # (rf"/{base_url}/nodpy/file/%s" % path_regex, NodServerFileRouteHandler),
            (get_file_route_pattern, NodServerFileRouteHandler),
            (nod_route_pattern, ExistingKernelsRouteHandler),
            (write_file_route_pattern, WriteFileRouteHandler),
        ]
        self.handlers.extend(handlers)

    def initialize_settings(self):
        super().initialize_settings()
        web_app = self.serverapp.web_app  # type: ignore
        settings = web_app.settings
        page_config = settings.setdefault("page_config_data", {})
        page_config["nod_active"] = self.active
        page_config["nod_connection_dir"] = self.connection_dir
        page_config["nod_CWD"] = os.getcwd()
        info_decoded = base64.b64decode(self.cli_cmd).decode("utf-8")
        self.cli_cmd = info_decoded
        page_config["cli_cmd"] = self.cli_cmd
        serverapp = self.serverapp
        if serverapp is not None:
            serverapp.kernel_manager.add_traits(nod_key=Unicode())
        # _log.info(self.cli_cmd)
        # self.runUserProgram(self.cli_cmd)

    # async def _start_jupyter_server_extension(
    #     self,
    #     serverapp: ServerApp,
    # ):
    #     watch_file = "my_file.txt"
    #     # info_decoded = base64.b64decode(self.info).decode("utf-8")
    #     # _log.info("infodecoded")
    #     # _log.info(info_decoded)
    #     # info_dict = orjson.loads(info_decoded)
    #     # info_dict.get("")
    #     watcher = Watcher(watch_file)
    #     _log.info("serverext connection dir")
    #     _log.info(self.connection_dir)
    #     watcher = Watcher(self.connection_dir, self.dir_changed_callback)
    #     watcher.watch()  # start the watch going
