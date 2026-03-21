import json
import logging
import os
from jupyter_server.serverapp import ServerApp
from jupyter_server.extension.application import ExtensionApp
import orjson
from traitlets.traitlets import Bool, Unicode
import base64
import asyncio

from nodpy.routes import setup_route_handlers

_log = logging.getLogger(__name__)

# import os
# import sys
# import time


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
#         self.dir_list_cache = dirlist

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
import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado


class HelloRouteHandler(APIHandler):
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


class Nod(ExtensionApp):
    name = "Nod"
    is_active = Bool(
        False,
        help="Whether to activate Nod front end. Should only be set from the nod library",
    ).tag(config=True)

    info = Unicode(
        "", help="JSON Payload passed to Nod Jupyter Extension. Do not pass manually"
    ).tag(config=True)

    # connection_dir = Unicode("", help="Directory for Nod Connection Files").tag(
    #     config=True
    # )

    # # Call this function each time a change happens
    # def dir_changed_callback(self, dir_list):
    #     _log.info("DIR CHANGED")
    #     _log.info(dir_list)
    def initialize_handlers(self):
        host_pattern = ".*$"
        base_url = self.serverapp.web_app.settings["base_url"]  # type: ignore
        hello_route_pattern = url_path_join(base_url, "nodpy", "hello")
        handlers = [(hello_route_pattern, HelloRouteHandler)]
        self.handlers.extend(handlers)

    def initialize_settings(self):
        super().initialize_settings()
        web_app = self.serverapp.web_app  # type: ignore
        settings = web_app.settings
        page_config = settings.setdefault("page_config_data", {})
        page_config["nod_active"] = self.is_active
        page_config["nod_info"] = self.info
        _log.info("Settings!")

    # def _load_jupyter_server_extension(self, serverapp):  # type: ignore
    #     """Registers the API handler to receive HTTP requests from the frontend extension.

    #     Parameters
    #     ----------
    #     server_app: jupyterlab.labapp.LabApp
    #         JupyterLab application instance
    #     """
    #     # super()._load
    #     setup_route_handlers(serverapp.web_app)
    #     name = "nodpy"
    #     serverapp.log.info(f"Registered {name} server extension")

    # async def _start_jupyter_server_extension(
    #     self,
    #     serverapp: ServerApp,
    # ):
    #     # watch_file = "my_file.txt"
    #     # info_decoded = base64.b64decode(self.info).decode("utf-8")
    #     # _log.info("infodecoded")
    #     # _log.info(info_decoded)
    #     # info_dict = orjson.loads(info_decoded)
    #     # info_dict.get("")
    #     # watcher = Watcher(watch_file)  # simple
    #     _log.info("serverext connection dir")
    #     _log.info(self.connection_dir)
    #     watcher = Watcher(self.connection_dir, self.dir_changed_callback)
    #     watcher.watch()  # start the watch going
