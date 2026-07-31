import typing as t
from libcst.metadata import CodePosition, CodeRange
from dataclasses import dataclass, field
from typing import List, Optional, TypeVar
from dataclasses_json import DataClassJsonMixin
from inspect import FrameInfo, Traceback


@dataclass
class FrameIdentifiers:
    function: str
    lineno: int
    filename: str

    def get_id(self) -> str:
        return self.function + str(self.lineno) + self.filename


def compare_identifiers(
    frame_id: FrameInfo | Traceback | FrameIdentifiers,
    frame_info: FrameInfo | Traceback | FrameIdentifiers,
) -> bool:
    return (
        frame_info.function == frame_id.function
        and frame_info.lineno == frame_id.lineno
        and frame_info.filename == frame_id.filename
    )


@dataclass
class FileInfo(DataClassJsonMixin):
    function_body_position: CodeRange
    indent: int
    text_header: List[str]
    text_body: List[str]
    text_above: List[str]
    text_below: List[str]
    notebook_file: str = ""  # abs path of generated .ipynb file
    notebook_content: str = ""


@dataclass
class ProgramInfo(DataClassJsonMixin):
    index: int
    function_id: str
    source_file: str = ""  # abs path of original .py file
    relative_source_file: str = ""  # rel path of original .py file
    connection_dir: str = ""
    function_name: str = ""

    frame_xml: list[str] = field(default_factory=list)
    fmt: t.Literal["light", "percent"] = "light"
    file_info: Optional[FileInfo] = None


@dataclass
class NodInfo(DataClassJsonMixin):
    stack_info: list[ProgramInfo]
    module_filters: list[str]
    fmt: str
    how_restart: t.Union[t.Literal["continue"], int]
    dangerously_bypass_readonly: bool
    nod_info_local_path: str
    cli_args: str
    python_pid: int
    kernel_pid: Optional[int] = None
    # nod_log: NodLogJSON
    nod_info_rel_path: str = ""
    key: Optional[str] = ""
    connection_file_path: Optional[str] = ""


@dataclass
class NodConnectionInfo(DataClassJsonMixin):
    control_port: int
    hb_port: int
    iopub_port: int
    kernel_name: str
    ip: str
    key: str
    shell_port: int
    signature_scheme: str
    stdin_port: int
    transport: str
    display_name: Optional[str] = ""
    jupyter_session: Optional[str] = ""
    metadata: Optional[t.Dict[str, t.Any]] = field(default_factory=dict)


@dataclass
class writeRequest(DataClassJsonMixin):
    program_info: ProgramInfo
    notebookContent: str
    study_log: t.Literal["none", "full", "usage_only"] = "none"
    key: str = ""


# - notebook()
#   - NodInfo (but with code transformed)


# NodLog (but with code transformed) request
# - write request
#   - Program info before (but with code transformed)
#   - Program info after (but with code transformed)
# - execute cell
# - navigate stackframe
# - save notebook
# - restart
#   - whether we write or not
@dataclass
class nodStudyLogRequest(DataClassJsonMixin):
    kind: t.Literal[
        "notebook_start",
        "write_request",
        "execute_cell",
        "navigate_stackframe",
        "edit_notebook",
        "restart",
        "nod_log_inject_state",
    ]
    # navigatestackframe
    # notebook
    # restart
    nodInfo: t.Optional[NodInfo] = None

    # execute cell
    # navigatestackframe
    # inject state
    function_id: t.Optional[str] = None

    # notebook
    nodLog: t.Optional[dict[str, dict[str, t.Any]]] = None

    # write request
    writeRequest: t.Optional[writeRequest] = None

    # writerequest
    key: t.Optional[str] = None

    # editnotebook
    # cell
    cell: t.Optional[str] = None

    # editnotebook
    cellChangeArgs: t.Optional[str] = None

    # inject state
    varname: t.Optional[str] = None
    var_string: t.Optional[str] = None

    # restart
    restartSave: t.Optional[bool] = None
