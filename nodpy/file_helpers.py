import typing
import ast
from nodpy.ast_tools import NodFinder
from libcst.metadata import CodeRange
from dataclasses import dataclass
from typing import List, Optional
from libcst import Module


@dataclass
class ProgramInfo:
    function_body_position: CodeRange
    indent: int
    text_header: List[str]
    text_body: List[str]
    text_above: List[str]
    text_below: List[str]
    file_name: Optional[str] = ""
    export_file: Optional[str] = ""
    connection_dir: Optional[str] = ""


def getProgramInfo(finder: NodFinder, ast: Module):
    sourceLines = ast.code.splitlines(True)
    indent = finder.body_indent.start.column
    func_head_start = finder.parent_pos.start.line
    func_body_start = finder.body_indent.start.line
    func_end = finder.body_indent.end.line

    return ProgramInfo(
        function_body_position=finder.body_indent,
        indent=finder.body_indent.start.column,
        text_header=sourceLines[func_head_start - 1 : func_body_start - 1],
        text_body=[
            line[indent:] if line[:indent] == """ """ * indent else line
            for line in sourceLines[func_body_start - 1 : func_end]
        ],
        text_above=sourceLines[max(func_head_start - 11, 0) : func_head_start - 1],
        text_below=sourceLines[
            min(func_end, len(sourceLines) - 1) : min(
                func_end + 11, len(sourceLines) - 1
            )
        ],
    )
