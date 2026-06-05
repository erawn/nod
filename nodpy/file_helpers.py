from inspect import FrameInfo
import os
from pathlib import Path
import shutil
import typing
import ast
import uuid
import jupytext  # type: ignore
from nbformat import NotebookNode
import nbformat
from nodpy.ast_tools import FunctionFinder, NodFinder
from libcst.metadata import CodePosition, CodeRange
from dataclasses import dataclass, field
from typing import List, Optional
from libcst import Module
from jupytext.formats import long_form_one_format  # type: ignore
import libcst as cst
import sys

# from _pydevd_bundle.pydevd_xml import frame_vars_to_xml
from IPython.core.getipython import get_ipython


def writeNotebook(
    program_info: ProgramInfo,
) -> ProgramInfo:
    if program_info.fileInfo is not None:

        notebook: NotebookNode = jupytext.reads(
            "".join(program_info.fileInfo.text_body),
            fmt=long_form_one_format(f"py:{program_info.fmt}"),
        )
        notebook.metadata["language_info"] = {
            "name": "python",
            "version": "3.14.3",
            "mimetype": "text/x-python",
            "codemirror_mode": {"name": "ipython", "version": 3},
            "pygments_lexer": "ipython3",
            "nbconvert_exporter": "python",
            "file_extension": ".py",
        }
        notebook.metadata["kernelspec"] = {
            "display_name": "nod",
            "language": "python",
            "name": "nod",
        }
        jupytext.write(
            notebook,
            os.path.join(
                program_info.connection_dir,
                os.path.relpath(
                    program_info.fileInfo.notebook_file, program_info.connection_dir
                ),
            ),
            fmt=".ipynb",
        )
        content = jupytext.writes(
            notebook, version=nbformat.NO_CONVERT, fmt=long_form_one_format("ipynb")
        )
        if isinstance(content, bytes):
            content = content.decode("utf8")
        program_info.fileInfo.notebook_content = content
        return program_info
    # We don't call this function unless we have FileInfo, so this should never be reached
    return None  # type: ignore


@dataclass
class FileInfo:
    function_body_position: CodeRange
    indent: int
    text_header: List[str]
    text_body: List[str]
    text_above: List[str]
    text_below: List[str]
    notebook_file: str = ""  # rel path of generated .ipynb file
    notebook_content: str = ""


@dataclass
class ProgramInfo:
    index: int
    source_file: str = ""  # abs path of original .py file
    relative_source_file: str = ""  # rel path of original .py file
    connection_dir: str = ""
    cli_arguments: str = ""
    function_name: str = ""
    frame_xml: list[str] = field(default_factory=list)
    fmt: typing.Literal["light", "percent"] = "light"
    fileInfo: Optional[FileInfo] = None


def makeProgramInfo(
    stackFrame: FrameInfo,
    index: int,
    module: Module | None,
    pm: PathManager,
    fmt: typing.Literal["light", "percent"],
) -> ProgramInfo:

    rel_source_file = os.path.relpath(stackFrame.filename, os.getcwd())
    tempFileStem = os.path.join(
        pm.connection_dir,
        Path(rel_source_file if rel_source_file else "nod").stem + str(uuid.uuid1()),
    )
    tempNotebook = tempFileStem + ".ipynb"
    if module is None:
        return ProgramInfo(
            index=index,
            source_file=stackFrame.filename,
            connection_dir=pm.connection_dir,
            relative_source_file=rel_source_file,
            cli_arguments=" ".join(sys.argv),
            function_name=stackFrame.function,
            frame_xml=list(stackFrame.frame.f_locals.keys()),
            fmt=fmt,
        )
    # print(sys.argv)
    if stackFrame.function == "<module>":
        no_position_source_lines = module.code.splitlines(True)

        return writeNotebook(
            ProgramInfo(
                index=index,
                source_file=stackFrame.filename,
                connection_dir=pm.connection_dir,
                relative_source_file=rel_source_file,
                cli_arguments=" ".join(sys.argv),
                function_name="<module>",
                frame_xml=list(stackFrame.frame.f_locals.keys()),
                fmt=fmt,
                fileInfo=FileInfo(
                    function_body_position=CodeRange(
                        CodePosition(0, 0),
                        CodePosition(len(no_position_source_lines) + 1, 0),
                    ),
                    indent=0,
                    text_header=[],
                    text_body=no_position_source_lines,
                    text_above=[],
                    text_below=[],
                    notebook_file=os.path.relpath(tempNotebook, os.getcwd()),
                ),
            )
        )

    wrapper = cst.MetadataWrapper(module)
    finder = FunctionFinder(stackFrame.function)
    module = wrapper.visit(finder)
    source_lines = module.code.splitlines(True)

    indent = finder.body_indent.start.column
    func_head_start = finder.parent_pos.start.line
    func_body_start = finder.body_indent.start.line
    func_end = finder.body_indent.end.line

    info = ProgramInfo(
        index=index,
        relative_source_file=rel_source_file,
        source_file=stackFrame.filename,
        connection_dir=pm.connection_dir,
        cli_arguments=" ".join(sys.argv),
        function_name=stackFrame.function,
        frame_xml=list(stackFrame.frame.f_locals.keys()),
        fmt=fmt,
        fileInfo=FileInfo(
            function_body_position=finder.body_indent,
            indent=finder.body_indent.start.column,
            text_header=source_lines[func_head_start - 1 : func_body_start - 1],
            text_body=[
                line[indent:] if line[:indent] == """ """ * indent else line
                for line in source_lines[func_body_start - 1 : func_end]
            ],
            text_above=source_lines[max(func_head_start - 11, 0) : func_head_start - 1],
            text_below=source_lines[
                min(func_end, len(source_lines) - 1) : min(
                    func_end + 11, len(source_lines) - 1
                )
            ],
            notebook_file=os.path.relpath(tempNotebook, os.getcwd()),
        ),
    )
    return writeNotebook(info)


class PathManager:
    hiddenDir: str
    archiveDir: str
    notebook_checkpoints: str
    archive_checkpoints: str
    connection_dir: str
    tempFileStem: str

    def __init__(self, clear=True):
        self.hiddenDir = os.path.join(os.getcwd(), ".nod")
        os.makedirs(self.hiddenDir, exist_ok=True)

        self.archiveDir = os.path.join(self.hiddenDir, "archive")
        if not os.path.exists(self.archiveDir):
            os.makedirs(self.archiveDir, exist_ok=True)

        self.notebook_checkpoints = os.path.join(self.hiddenDir, ".ipynb_checkpoints")
        os.makedirs(self.notebook_checkpoints, exist_ok=True)

        self.archive_checkpoints = os.path.join(self.archiveDir, ".ipynb_checkpoints")
        os.makedirs(self.archive_checkpoints, exist_ok=True)
        # TODO - check if file, if so, delete

        self.connection_dir = os.path.join(self.hiddenDir, "connection")
        if os.path.exists(self.connection_dir) and clear:
            shutil.rmtree(self.connection_dir)
        os.makedirs(self.connection_dir, exist_ok=True)

        file_names = os.listdir(self.notebook_checkpoints)
        for file_name in file_names:
            if os.path.isfile(os.path.join(self.notebook_checkpoints, file_name)):
                if os.path.exists(os.path.join(self.archive_checkpoints, file_name)):
                    os.replace(
                        os.path.join(self.notebook_checkpoints, file_name),
                        os.path.join(self.archive_checkpoints, file_name),
                    )
                else:
                    shutil.move(
                        os.path.join(self.notebook_checkpoints, file_name),
                        self.archive_checkpoints,
                    )

        os.rmdir(self.notebook_checkpoints)
        # TODO -- files aren't getting archived
        file_names = os.listdir(self.hiddenDir)
        for file_name in file_names:
            hidden_file = os.path.join(self.hiddenDir, file_name)
            archive_file = os.path.join(self.archiveDir, file_name)
            if os.path.isfile(hidden_file):
                if os.path.exists(archive_file):
                    os.replace(
                        hidden_file,
                        archive_file,
                    )
                else:
                    shutil.move(hidden_file, archive_file)
