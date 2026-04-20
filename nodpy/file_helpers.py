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
from dataclasses import dataclass
from typing import List, Optional
from libcst import Module
from jupytext.formats import long_form_one_format  # type: ignore
import libcst as cst


def writeNotebook(program_info: ProgramInfo) -> ProgramInfo:
    notebook: NotebookNode = jupytext.reads(
        "".join(program_info.text_body), fmt=long_form_one_format("py:light")
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
        "display_name": "Python 3 (ipykernel)",
        "language": "python",
        "name": "python3",
    }
    jupytext.write(notebook, program_info.notebook_file, fmt=".ipynb")
    content = jupytext.writes(
        notebook, version=nbformat.NO_CONVERT, fmt=long_form_one_format("ipynb")
    )
    if isinstance(content, bytes):
        content = content.decode("utf8")
    program_info.notebook_content = content
    return program_info


@dataclass
class ProgramInfo:
    function_body_position: CodeRange
    indent: int
    text_header: List[str]
    text_body: List[str]
    text_above: List[str]
    text_below: List[str]
    notebook_file: str = ""  # rel path of generated .ipynb file
    source_file: str = ""  # abs path of original .py file
    relative_source_file: str = ""  # rel path of original .py file
    connection_dir: str = ""
    notebook_content: str = ""


def makeProgramInfo(
    stackFrame: FrameInfo,
    module: Module,
    pm: PathManager,
) -> ProgramInfo:
    rel_source_file = os.path.relpath(stackFrame.filename, os.getcwd())
    tempFileStem = os.path.join(
        pm.hiddenDir,
        Path(rel_source_file if rel_source_file else "nod").stem + str(uuid.uuid1()),
    )
    tempNotebook = tempFileStem + ".ipynb"

    if stackFrame.function == "<module>":
        no_position_source_lines = module.code.splitlines(True)
        return writeNotebook(
            ProgramInfo(
                function_body_position=CodeRange(
                    CodePosition(0, 0),
                    CodePosition(len(no_position_source_lines) + 1, 0),
                ),
                indent=0,
                text_header=[],
                text_body=no_position_source_lines,
                text_above=[],
                text_below=[],
                source_file=stackFrame.filename,
                connection_dir=pm.connection_dir,
                notebook_file=tempNotebook,
                relative_source_file=rel_source_file,
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
        relative_source_file=rel_source_file,
        source_file=stackFrame.filename,
        connection_dir=pm.connection_dir,
        notebook_file=tempNotebook,
    )
    return writeNotebook(info)


class PathManager:
    hiddenDir: str
    archiveDir: str
    notebook_checkpoints: str
    archive_checkpoints: str
    connection_dir: str
    tempFileStem: str

    def __init__(self):
        self.hiddenDir = os.path.join(os.getcwd(), ".nod")
        os.makedirs(self.hiddenDir, exist_ok=True)

        self.archiveDir = os.path.join(self.hiddenDir, "archive")
        os.makedirs(self.archiveDir, exist_ok=True)

        self.notebook_checkpoints = os.path.join(self.hiddenDir, ".ipynb_checkpoints")
        os.makedirs(self.notebook_checkpoints, exist_ok=True)

        self.archive_checkpoints = os.path.join(self.archiveDir, ".ipynb_checkpoints")
        os.makedirs(self.archive_checkpoints, exist_ok=True)
        # TODO - check if file, if so, delete

        self.connection_dir = os.path.join(self.hiddenDir, "connection")
        if os.path.exists(self.connection_dir):
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

        file_names = os.listdir(self.hiddenDir)
        for file_name in file_names:
            if os.path.isfile(os.path.join(self.hiddenDir, file_name)):
                if os.path.exists(os.path.join(self.archiveDir, file_name)):
                    os.replace(
                        os.path.join(self.hiddenDir, file_name),
                        os.path.join(self.archiveDir, file_name),
                    )
                else:
                    shutil.move(
                        os.path.join(self.hiddenDir, file_name), self.archiveDir
                    )
