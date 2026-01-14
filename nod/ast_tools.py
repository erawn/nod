import ast 

class AnnotateParents(ast.NodeTransformer):
    parent = None

    def visit(self, node):
        node.parent = self.parent
        self.parent = node
        node = super().visit(node)
        if isinstance(node, ast.AST):
            self.parent = node.parent
        return node
    
class ExpressionFinder(ast.NodeTransformer):
    """Find the expression which contains the line number"""

    def __init__(self, lineno):
        super(__class__, self).__init__()
        self.lineno = lineno
        self.target_node = None # found expr

    def generic_visit(self, node):
        if not self.target_node and (getattr(node, 'lineno', -1) == self.lineno):
            self.target_node = node
        return super().generic_visit(node)
    
    def visit_Module(self, module):
        self.parent = module
        self.generic_visit(module)
        # print("node")
        # print(ast.dump(self.target_node))
        # print("parent")
        # print(ast.dump(self.target_node.parent))
        return self.target_node
      