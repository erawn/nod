import ast
from typing import Optional, Sequence, Union
import libcst as cst
import libcst.matchers as m
from libcst.metadata import PositionProvider, ParentNodeProvider


class findIndent(cst.CSTVisitor):
    METADATA_DEPENDENCIES = (PositionProvider,)

    def __init__(self):
        super(__class__, self).__init__()
        self.block: cst.IndentedBlock = None

    def visit_IndentedBlock(self, node) -> Optional[bool]:
        self.block = node
        return False


class NodFinder(m.MatcherDecoratableTransformer):
    METADATA_DEPENDENCIES = (
        ParentNodeProvider,
        PositionProvider,
    )

    def __init__(self, lineno):
        super(__class__, self).__init__()
        self.lineno = lineno
        self.target_node: cst.FunctionDef = None
        self.target_pos: cst.metadata.CodePosition = None
        self.call_stack: cst.List[cst.FunctionDef] = []
        self.body_indent = None

    def visit_FunctionDef(self, node: cst.FunctionDef) -> None:
        if m.matches(node.name, m.Name()):
            self.call_stack.append(cst.ensure_type(node, cst.FunctionDef))

    def leave_FunctionDef(
        self, original_node: cst.FunctionDef, updated_node: cst.FunctionDef
    ) -> cst.FunctionDef:
        if m.matches(original_node.name, m.Name()):
            self.call_stack.pop()
        return original_node

    def visit_Call(self, node: cst.Call) -> None:
        if m.matches(node.func, m.Name("nod")):
            pos: cst.metadata.CodePosition = self.get_metadata(PositionProvider, node)

            if pos.start.line == self.lineno:
                target_node: cst.FunctionDef = self.call_stack[-1]
                self.target_node = target_node
                self.target_pos = self.get_metadata(PositionProvider, target_node)

                indentVisitor = findIndent()
                target_node.visit(indentVisitor)
                self.body_indent = self.get_metadata(
                    PositionProvider, indentVisitor.block
                )

    @m.leave(m.SimpleStatementLine(body=[m.Expr(value=m.Call(func=m.Name("nod")))]))
    def rem_nod(
        self, original_node, updated_node
    ) -> Union[cst.SimpleStatementLine, cst.RemovalSentinel]:
        print("FOUND")
        print(original_node)
        return cst.RemoveFromParent()

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


class NodRemove(m.MatcherDecoratableTransformer):
    METADATA_DEPENDENCIES = (PositionProvider,)

    def __init__(self, lineno):
        super(__class__, self).__init__()
        self.lineno = lineno

    @m.leave(m.SimpleStatementLine(body=[m.Expr(value=m.Call(func=m.Name("nod")))]))
    # @m.leave(m.Expr(value=m.Call(func=m.Name("nod"))))
    def rem_nod(
        self, original_node, updated_node: cst.SimpleStatementLine
    ) -> Union[cst.SimpleStatementLine, cst.RemovalSentinel]:
        print("FOUND")
        print(original_node)
        pos: cst.metadata.CodePosition = self.get_metadata(
            PositionProvider, original_node
        )
        if pos.start.line == self.lineno:
            # newnode = updated_node.with_changes(body=[cst.Newline()])
            return cst.SimpleStatementLine(body=[cst.Pass()])
