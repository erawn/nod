# self.ast_transformer = PagebreaksASTTransformer(ip)
# self.shell.ast_transformers.append(self.ast_transformer)
from typing import Any
import ast


class returnTransformer(ast.NodeTransformer):

    def visit_Return(self, node: ast.Return) -> Any:
        print(ast.dump(node))
        return self.generic_visit(node)
