import base64
from inspect import FrameInfo
import logging
import os
from pathlib import Path
import shutil
import typing as t
import uuid
import jupytext  # type: ignore
from nbformat import NotebookNode
import nbformat
from nodpy.nodTypes import FrameIdentifiers
from nodpy.ast_tools import FunctionFinder, NodFinder
from libcst.metadata import CodePosition, CodeRange
from typing import List, Optional, TypeVar
from libcst import Module
from jupytext.formats import long_form_one_format  # type: ignore
import libcst as cst
from nodpy.nodTypes import FileInfo, ProgramInfo

_log = logging.getLogger(__name__)


class PathManager:
    hiddenDir: str
    archiveDir: str
    notebook_checkpoints: str
    archive_checkpoints: str
    connection_dir: str
    tempFileStem: str

    def __init__(self, clear=True):
        self.hiddenDir = os.path.join(os.getcwd(), "nod")
        os.makedirs(self.hiddenDir, exist_ok=True)

        self.archiveDir = os.path.join(self.hiddenDir, "archive")
        if not os.path.exists(self.archiveDir):
            os.makedirs(self.archiveDir, exist_ok=True)

        self.archive_checkpoints = os.path.join(self.archiveDir, ".ipynb_checkpoints")
        os.makedirs(self.archive_checkpoints, exist_ok=True)

        self.connection_dir = os.path.join(self.hiddenDir, "connection")

        self.notebook_checkpoints = os.path.join(
            self.connection_dir, ".ipynb_checkpoints"
        )

        if os.path.exists(self.connection_dir):
            file_names = os.listdir(self.notebook_checkpoints)
            for file_name in file_names:
                if os.path.isfile(os.path.join(self.notebook_checkpoints, file_name)):
                    if os.path.exists(
                        os.path.join(self.archive_checkpoints, file_name)
                    ):
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
            file_names = os.listdir(self.connection_dir)
            for file_name in file_names:
                hidden_file = os.path.join(self.connection_dir, file_name)
                archive_file = os.path.join(self.archiveDir, file_name)
                if os.path.isfile(hidden_file):
                    if os.path.exists(archive_file):
                        os.replace(
                            hidden_file,
                            archive_file,
                        )
                    else:
                        shutil.move(hidden_file, archive_file)

            if os.path.exists(self.connection_dir) and clear:
                os.rmdir(self.connection_dir)

        os.makedirs(self.connection_dir, exist_ok=True)
        os.makedirs(self.notebook_checkpoints, exist_ok=True)


def writeNotebook(
    program_info: ProgramInfo,
) -> ProgramInfo:
    if program_info.file_info is not None:

        notebook: NotebookNode = jupytext.reads(
            "".join(program_info.file_info.text_body),
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
            program_info.file_info.notebook_file,
            # os.path.join(
            #     program_info.connection_dir,
            #     os.path.relpath(
            #         , program_info.connection_dir
            #     ),
            # ),
            fmt=".ipynb",
        )
        content = jupytext.writes(
            notebook, version=nbformat.NO_CONVERT, fmt=long_form_one_format("ipynb")
        )
        if isinstance(content, bytes):
            content = content.decode("utf8")
        # program_info.file_info.notebook_content = content
        return program_info
    # We don't call this function unless we have FileInfo, so this should never be reached
    return None  # type: ignore


def makeProgramInfo(
    stackFrame: FrameInfo,
    index: int,
    module: Module | None,
    pm: PathManager,
    fmt: t.Literal["light", "percent"],
    zoom_out: int = -1,
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
            function_name=stackFrame.function,
            function_id=FrameIdentifiers(
                stackFrame.function, 0, stackFrame.filename
            ).get_id(),
            # base64.b64encode(
            #     FrameIdentifiers(stackFrame).get_id().encode("utf-8")
            # ).decode("utf-8"),
            frame_xml=list(stackFrame.frame.f_locals.keys()),
            fmt=fmt,
        )
        # print(sys.argv)
    source_lines = module.code.splitlines(True)
    wrapper = cst.MetadataWrapper(module)
    if stackFrame.function == "<module>":
        func_head_start = 0
        func_head_start_id = 0
        body_indent = CodeRange(
            CodePosition(0, 0),
            CodePosition(len(source_lines) + 1, 0),
        )
    else:
        finder = FunctionFinder(stackFrame.function, stackFrame.lineno)
        module = wrapper.visit(finder)
        _log.debug(module)
        body_indent = finder.body_indent
        func_head_start = finder.parent_pos.start.line
        func_head_start_id = finder.parent_pos.start.line
    if zoom_out > -1:
        nodFinder = NodFinder(stackFrame.lineno, zoom_out=zoom_out)
        wrapper.visit(nodFinder)
        if (
            nodFinder.indent_block is not None
            and nodFinder.indent_pos is not None
            and nodFinder.indent_pos.start.line >= body_indent.start.line
            and nodFinder.indent_pos.end.line <= body_indent.end.line
        ):
            body_indent = nodFinder.indent_pos
            func_head_start = nodFinder.indent_pos.start.line
    indent = body_indent.start.column
    func_body_start = body_indent.start.line
    func_end = body_indent.end.line

    return writeNotebook(
        ProgramInfo(
            index=index,
            source_file=stackFrame.filename,
            connection_dir=pm.connection_dir,
            relative_source_file=rel_source_file,
            function_name=stackFrame.function,
            function_id=FrameIdentifiers(
                stackFrame.function, func_head_start_id, stackFrame.filename
            ).get_id(),
            # base64.b64encode(
            #     FrameIdentifiers(stackFrame).get_id().encode("utf-8")
            # ).decode("utf-8"),
            frame_xml=list(stackFrame.frame.f_locals.keys()),
            fmt=fmt,
            file_info=FileInfo(
                function_body_position=body_indent,
                indent=indent,
                text_header=source_lines[
                    max(func_head_start - 1, 0) : max(func_body_start - 1, 0)
                ],
                text_body=[
                    line[indent:] if line[:indent] == """ """ * indent else line
                    for line in source_lines[max(func_body_start - 1, 0) : func_end]
                ],
                text_above=source_lines[0 : max(func_head_start - 1, 0)],
                text_below=source_lines[
                    min(func_end, len(source_lines)) : len(source_lines)
                ],
                notebook_file=os.path.join(os.getcwd(), tempNotebook),
            ),
        )
    )

    # _log.warning(f"{indent}, {func_head_start}, {func_body_start}, {func_end}")

    # info = ProgramInfo(
    #     index=index,
    #     relative_source_file=rel_source_file,
    #     source_file=stackFrame.filename,
    #     connection_dir=pm.connection_dir,
    #     function_name=stackFrame.function,
    #     function_id=FrameIdentifiers(
    #         stackFrame.function, parent_pos.start.line, stackFrame.filename
    #     ).get_id(),
    #     # base64.b64encode(
    #     #     FrameIdentifiers(stackFrame).get_id().encode("utf-8")
    #     # ).decode("utf-8"),
    #     frame_xml=list(stackFrame.frame.f_locals.keys()),
    #     fmt=fmt,
    #     file_info=FileInfo(
    #         function_body_position=body_indent,
    #         indent=body_indent.start.column,
    #         text_header=source_lines[func_head_start - 1 : func_body_start - 1],
    #         text_body=[
    #             line[indent:] if line[:indent] == """ """ * indent else line
    #             for line in source_lines[func_body_start - 1 : func_end]
    #         ],
    #         text_above=source_lines[0 : func_head_start - 1],
    #         text_below=source_lines[
    #             min(func_end, len(source_lines) - 1) : len(source_lines)
    #         ],
    #         notebook_file=os.path.join(os.getcwd(), tempNotebook),
    #     ),
    # )
    # return writeNotebook(info)
