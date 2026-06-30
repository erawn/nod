from nodpy import notebook


def f():
    x = 1
    print(x)
    notebook()
    print(x + 1)

    assert 1 == 2

    import time 
    time.sleep(10)




f()
