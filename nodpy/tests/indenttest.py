from nodpy import notebook, nodLog, nodConfig

nodConfig(filter=["**"])


def f(i):
    t = 5
    nodLog(i)
    if i > 5:
        notebook(zoom_out=0)


for i in range(10):
    f(i)
