from dataclasses import dataclass
import json
import logging
import os
import subprocess
import textwrap
from jupyter_server.extension.application import ExtensionApp
import jupytext
import orjson
from traitlets.traitlets import Bool, Unicode
import base64
from dacite import from_dict
from nodpy.file_helpers import ProgramInfo
from tornado import web

_log = logging.getLogger(__name__)

# import os
# import sys
# import time


import json
from jupytext.formats import long_form_one_format  # type: ignore
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
from typing import cast


class NodServerRouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(
            json.dumps(
                {
                    "data": (
                        "Hello, world!"
                        " This is the '/nodpy/hello' endpoint."
                        " Try visiting me in your browser!"
                    ),
                }
            )
        )


@dataclass
class writeRequest:
    program_info: ProgramInfo
    notebookContent: str


class WriteFileRouteHandler(APIHandler):

    # @tornado.web.authenticated
    # def get(self):
    #     _log.info("Nod Server: Restart Program")
    #     _log.info(self.settings.get("Nod"))
    #     nodServer = self.settings.get("Nod")
    #     if nodServer is not None and hasattr(nodServer, "user_program_process"):
    #         nodProcess = nodServer.user_program_process
    #         nodServer = cast(Nod, nodServer)
    #         if nodProcess is not None:
    #             nodProcess = cast(subprocess.Popen[bytes], nodProcess)
    #             # nodProcess.terminate()
    #         nodServer.runUserProgram(nodServer.cli_cmd)
    #     self.finish(
    #         json.dumps(
    #             {
    #                 "data": (
    #                     "Hello, world!"
    #                     " This is the '/nodpy/hello' endpoint."
    #                     " Try visiting me in your browser!"
    #                 ),
    #             }
    #         )
    #     )

    @tornado.web.authenticated
    def post(self):
        # input_data is a dictionary with a key "name"
        # Do we need to call body.decode('utf-8') here?
        body = self.request.body.strip().decode("utf-8")
        try:
            _log.info("RECEIVED WRITE REQUEST")
            json_load = json.loads(body)
            _log.info(json_load)
            request = from_dict(writeRequest, json_load)
            #  notebook: NotebookNode = jupytext.reads(
            #         "".join(program_info.fileInfo.text_body),
            #         fmt=long_form_one_format(f"py:{program_info.fmt}"),
            #     )
            # nb = jupytext.reads(py, "py")
            #     py2 = jupytext.writes(nb, "py")
            #             _log.info(request)
            _log.info("REQUEST")
            _log.info(request)
            decoded_content = base64.b64decode(request.notebookContent).decode("utf-8")
            _log.info(decoded_content)
            nb = jupytext.reads(decoded_content, "ipynb")
            _log.info("NB")
            _log.info(nb)
            nb_content_to_write = jupytext.writes(
                nb, fmt=long_form_one_format(f"py:{request.program_info.fmt}")
            )
            _log.info(nb_content_to_write)
            fileInfo = request.program_info.fileInfo
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

        # data = {"greetings": "Hello {}, enjoy JupyterLab!".format(input_data["name"])}
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

    # connection_dir = Unicode("", help="Directory for Nod Connection Files").tag(
    #     config=True
    # )

    def initialize_handlers(self):
        host_pattern = ".*$"
        base_url = self.serverapp.web_app.settings["base_url"]  # type: ignore
        nod_route_pattern = url_path_join(base_url, "nodpy", "hello")
        write_file_route_pattern = url_path_join(base_url, "nodpy", "write_file")
        handlers = [
            (nod_route_pattern, NodServerRouteHandler),
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
        info_decoded = base64.b64decode(self.cli_cmd).decode("utf-8")
        self.cli_cmd = info_decoded
        page_config["cli_cmd"] = self.cli_cmd
        _log.warning(self.cli_cmd)
        # self.runUserProgram(self.cli_cmd)

    # def _load_jupyter_server_extension(self, serverapp):  # type: ignore
    #     """Registers the API handler to receive HTTP requests from the frontend extension.

    #     Parameters
    #     ----------
    #     server_app: jupyterlab.labapp.LabApp
    #         JupyterLab application instance
    #     """
    #     super()._load
    #     # setup_route_handlers(serverapp.web_app)
    #     name = "nodpy"
    #     serverapp.log.info(f"Registered {name} server extension")

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
