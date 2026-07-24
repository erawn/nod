# myfile.py
from nodpy import notebook, nodLog


def f(a, b):
    if a == 4:
        notebook()
    else:
        nodLog(a, b)


f(2, [1, 2, 3])
f(3, {"s": 1})
f(4, 1)
