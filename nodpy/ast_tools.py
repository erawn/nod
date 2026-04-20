import ast
from inspect import FrameInfo
import logging
from typing import List, Optional, Sequence, Union
import libcst as cst
from libcst.display import dump
import libcst.matchers as m
from libcst.metadata import PositionProvider, ParentNodeProvider
from libcst.metadata import CodePosition, CodeRange


# def getCSTInfo(sourceProgram: str, frameInfo: FrameInfo):
#     wrapper = cst.MetadataWrapper(cst.parse_module(sourceProgram))

#     finder = NodFinder(frameInfo.lineno)
#     metaAST = wrapper.visit(finder)
#     func_body: CodeRange = finder.body_indent
#     func_pos: CodeRange = finder.target_pos
#     newWrapper = cst.MetadataWrapper(metaAST)
#     filteredAST = newWrapper.visit(NodRemove(frameInfo.lineno))
#     # todo None check
#     indent = func_body.start.column

#     return filteredAST, func_body, func_pos, indent
_log = logging.getLogger(__name__)
_log.setLevel(logging.INFO)

# class findIndent(cst.CSTVisitor):
#     METADATA_DEPENDENCIES = (PositionProvider,)

#     def __init__(self):
#         super(__class__, self).__init__()
#         self.block: cst.IndentedBlock = None


#     def visit_IndentedBlock(self, node) -> Optional[bool]:
#         self.block = node
#         return False
class FunctionFinder(m.MatcherDecoratableTransformer):
    METADATA_DEPENDENCIES = (
        ParentNodeProvider,
        PositionProvider,
    )
    parent_node: cst.CSTNode
    parent_pos: CodeRange
    body_indent: CodeRange
    target_function: str

    def __init__(self, target_function: str):
        super(__class__, self).__init__()  # type: ignore
        self.target_function: str = target_function

    @m.visit(m.FunctionDef())
    def visit_function(self, node: cst.FunctionDef):
        if m.matches(node, m.FunctionDef(m.Name(self.target_function))):
            self.parent_node = node
            parent_pos = self.get_metadata(PositionProvider, node)
            if isinstance(parent_pos, CodeRange):
                self.parent_pos = parent_pos
            body_indent = self.get_metadata(PositionProvider, node.body)
            if isinstance(body_indent, CodeRange):
                self.body_indent = body_indent


class NodFinder(m.MatcherDecoratableTransformer):
    METADATA_DEPENDENCIES = (
        ParentNodeProvider,
        PositionProvider,
    )
    parent_node: cst.CSTNode
    parent_pos: CodeRange
    body_indent: CodeRange

    def __init__(self, lineno: int):
        super(__class__, self).__init__()  # type: ignore
        self.lineno = lineno
        self.indent_stack: List[cst.IndentedBlock] = []

    @m.visit(m.Call())
    def visit_notebook_call(self, node: cst.Call):
        if m.matches(node, m.Call(func=m.Name("notebook"))):
            pos = self.get_metadata(PositionProvider, node)
            if isinstance(pos, CodeRange):
                if pos.start.line == self.lineno and len(self.indent_stack) > 0:
                    indent_block = self.indent_stack[-1]
                    parent_node = self.get_metadata(ParentNodeProvider, indent_block)
                    if isinstance(parent_node, cst.CSTNode):
                        self.parent_node = parent_node
                        parent_pos = self.get_metadata(PositionProvider, parent_node)
                        if isinstance(parent_pos, CodeRange):
                            self.parent_pos = parent_pos
                        body_indent = self.get_metadata(PositionProvider, indent_block)
                        if isinstance(body_indent, CodeRange):
                            self.body_indent = body_indent

    def visit_IndentedBlock(self, node):
        self.indent_stack.append(cst.ensure_type(node, cst.IndentedBlock))

    def leave_IndentedBlock(self, original_node, updated_node):
        self.indent_stack.pop()
        return original_node

    # @m.leave(m.SimpleStatementLine(body=[m.Expr(value=m.Call(func=m.Name("nod")))]))
    # def rem_nod(
    #     self, original_node, updated_node
    # ) -> Union[cst.SimpleStatementLine, cst.RemovalSentinel]:
    #     pos: cst.metadata.CodePosition = self.get_metadata(
    #         PositionProvider, original_node
    #     )
    #     if pos.start.line == self.lineno:
    #         # newnode = updated_node.with_changes(body=[cst.Newline()])
    #         return cst.SimpleStatementLine(body=[cst.Pass()])

    # @m.visit(
    #     m.IndentedBlock(
    #         body=[
    #             m.ZeroOrMore(m.DoNotCare()),
    #             m.SimpleStatementLine(
    #                 body=[m.Expr(value=m.Call(func=m.Name(value="notebook")))]
    #             ),
    #             m.ZeroOrMore(m.DoNotCare()),
    #         ]
    #     )
    # )
    # def find_notebook_indent(self, node):
    #     _log.debug("Found notebook()")
    #     _log.debug(cst.dump(node))
    # notebook_pos: cst.metadata.CodePosition = self.get_metadata(
    #     PositionProvider, node
    # )

    # if pos.start.line == self.lineno:
    #     if len(self.call_stack) > 0:
    #         parent_node: cst.FunctionDef = self.call_stack[-1]
    #         self.parent_node = parent_node
    #         self.parent_pos = self.get_metadata(PositionProvider, parent_node)

    #     indentVisitor = findIndent()
    #     parent_node.visit(indentVisitor)
    #     self.body_indent = self.get_metadata(PositionProvider, indentVisitor.block)

    # def leave_Call(
    #     self, original_node: cst.Call, updated_node: cst.Call
    # ) -> Union[cst.Call, cst.RemovalSentinel]:
    #     if m.matches(original_node.func, m.Name("nod")):
    #         pos: cst.metadata.CodePosition = self.get_metadata(
    #             PositionProvider, original_node
    #         )
    #         if pos.start.line == self.lineno:
    #             print("removing")
    #             parent = self.get_metadata(ParentNodeProvider, original_node)
    #             return cst.RemoveFromParent()
    #     return original_node


# class NodRemove(m.MatcherDecoratableTransformer):
#     METADATA_DEPENDENCIES = (PositionProvider,)

#     def __init__(self, lineno):
#         super(__class__, self).__init__()
#         self.lineno = lineno

#     @m.leave(
#         m.SimpleStatementLine(body=[m.Expr(value=m.Call(func=m.Name("notebook")))])
#     )
#     # @m.leave(m.Expr(value=m.Call(func=m.Name("nod"))))
#     def rem_nod(
#         self, original_node, updated_node: cst.SimpleStatementLine
#     ) -> Union[cst.SimpleStatementLine, cst.RemovalSentinel]:
#         print("FOUND")
#         print(original_node)
#         pos: cst.metadata.CodePosition = self.get_metadata(
#             PositionProvider, original_node
#         )
#         if pos.start.line == self.lineno:
#             # newnode = updated_node.with_changes(body=[cst.Newline()])
#             return cst.SimpleStatementLine(body=[cst.Pass()])
