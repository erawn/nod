# self.ast_transformer = PagebreaksASTTransformer(ip)
# self.shell.ast_transformers.append(self.ast_transformer)
# https://stackoverflow.com/questions/24005221/ipython-notebook-early-exit-from-cell
from typing import Any
import ast

import sys
from io import StringIO
from IPython.core.getipython import get_ipython
from IPython.display import display

# class IpyExit(SystemExit):
#     """Exit Exception for IPython.

#     Exception temporarily redirects stderr to buffer.
#     """

#     def _render_traceback_(self):
#         return []

#     def __init__(self):
#         # print("exiting")  # optionally print some message to stdout, too
#         # ... or do other stuff before exit
#         sys.stderr = StringIO()

#     def __del__(self):
#         sys.stderr.close()
#         sys.stderr = sys.__stderr__  # restore from backup


# def ipy_exit():
#     raise IpyExit


def nodReturn(return_arg=None):
    from IPython.display import display

    class NodStopExecution(Exception):
        def _render_traceback_(self):
            return []

    if return_arg is not None:
        display(return_arg)
    raise NodStopExecution


# if get_ipython():  # ...run with IPython
#     exit = ipy_exit  # rebind to custom exit
# else:
#     exit = exit  # just make exit importable


class returnTransformer(ast.NodeTransformer):

    def visit_Module(self, node: ast.Module) -> Any:
        # print(ast.dump(node, include_attributes=True))
        module = self.generic_visit(node)
        # print(ast.dump(module, include_attributes=True))
        return module

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
