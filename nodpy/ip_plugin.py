# self.ast_transformer = PagebreaksASTTransformer(ip)
# self.shell.ast_transformers.append(self.ast_transformer)
from typing import Any

from IPython.terminal.interactiveshell import TerminalInteractiveShell
import ast


class returnTransformer(ast.NodeTransformer):

    def visit_Return(self, node: ast.Return) -> Any:
        print(ast.dump(node))
        return super().visit_Return(node)


rTransformer = returnTransformer()


def load_ipython_extension(ip: TerminalInteractiveShell):
    ip.ast_transformers.append(rTransformer)


def unload_ipython_extension(ip: TerminalInteractiveShell):
    ip.ast_transformers.remove(rTransformer)
