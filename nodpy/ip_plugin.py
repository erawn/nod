# self.ast_transformer = PagebreaksASTTransformer(ip)
# self.shell.ast_transformers.append(self.ast_transformer)
# https://stackoverflow.com/questions/24005221/ipython-notebook-early-exit-from-cell
from typing import Any
import ast

import sys
from io import StringIO
from IPython.core.getipython import get_ipython
from IPython.display import display


def nodReturn(return_arg=None):
    from IPython.display import display

    class NodStopExecution(Exception):
        def _render_traceback_(self):
            return []

    if return_arg is not None:
        display(return_arg)
    raise NodStopExecution


class returnTransformer(ast.NodeTransformer):

    def visit_Module(self, node: ast.Module) -> Any:
        # print(ast.dump(node, include_attributes=True))
        module = self.generic_visit(node)
        # print(ast.dump(module, include_attributes=True))
        return module

    def visit_FunctionDef(self, node: ast.FunctionDef) -> Any:
        return node

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> Any:
        return node

    def visit_Return(self, node: ast.Return) -> Any:
        # print(ast.dump(node))
        if node.value is not None:
            newNode = ast.Expr(
                value=ast.Call(func=ast.Name("nodReturn"), args=[node.value])
            )
        else:
            newNode = ast.Expr(value=ast.Call(func=ast.Name("nodReturn")))
        ast.copy_location(newNode, node)
        ast.fix_missing_locations(newNode)
        # print(ast.dump(newNode))
        return newNode
