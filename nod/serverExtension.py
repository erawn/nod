from jupyter_server.extension.application import ExtensionApp
from traitlets import Bool, Unicode
import os
import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
from tornado.web import StaticFileHandler


# class RouteHandler(APIHandler):
#     # The following decorator should be present on all verb methods (head, get, post,
#     # patch, put, delete, options) to ensure only authorized user can request the
#     # Jupyter server
#     @tornado.web.authenticated
#     def get(self):
#         self.finish(json.dumps({"data": "This is /nod/info endpoint!"}))

#     @tornado.web.authenticated
#     def post(self):
#         # input_data is a dictionary with a key "name"
#         input_data = self.get_json_body()
#         data = {"greetings": "Hello {}, enjoy JupyterLab!".format(input_data["name"])}
#         self.finish(json.dumps(data))


# def setup_handlers(web_app):
#     host_pattern = ".*$"

#     base_url = web_app.settings["base_url"]
#     # Prepend the base_url so that it works in a JupyterHub setting
#     route_pattern = url_path_join(base_url, "nod", "info")
#     handlers = [(route_pattern, RouteHandler)]
#     web_app.add_handlers(host_pattern, handlers)

# Prepend the base_url so that it works in a JupyterHub setting
# doc_url = url_path_join(base_url, "nod", "public")
# doc_dir = os.getenv(
#     "JLAB_SERVER_EXAMPLE_STATIC_DIR",
#     os.path.join(os.path.dirname(__file__), "public"),
# )
# handlers = [("{}/(.*)".format(doc_url), StaticFileHandler, {"path": doc_dir})]
# web_app.add_handlers(host_pattern, handlers)


class Nod(ExtensionApp):
    name = "Nod"
    is_active = Bool(
        False,
        help="Whether to activate Nod front end. Should only be set from the nod library",
    ).tag(config=True)

    info = Unicode(
        "", help="JSON Payload passed to Nod Jupyter Extension. Do not pass manually"
    ).tag(config=True)

    def initialize_settings(self):
        super().initialize_settings()
        web_app = self.serverapp.web_app
        settings = web_app.settings
        page_config = settings.setdefault("page_config_data", {})
        page_config["nod_active"] = self.is_active
        page_config["info"] = self.info
