from nodpy import notebook, nodLog


def f(x):

    for i in range(10):
        nodLog(i)
    
# # execute notebook when $i = 8$
    
        if i == 8:
            notebook()


def g():
    f(10)


g()
