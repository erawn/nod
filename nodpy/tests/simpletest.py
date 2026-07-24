import functools
import pathlib

from nodpy import notebook, nodLog

x = 0


def baller(a, b: int, c: int):
    # nodLog(a, b)
    # nodLog(a, b)
    # nodLog(a, b)
    # nodLog(a, b)
    # nodLog(c)
    global x

    x += 2
    if x > 4:
        print("reached notebook")
        notebook()


class d:
    @functools.cache
    def caller(self):
        pass


class f:
    @functools.cache
    def caller(self):
        for x in range(10):
            if 1 > 0:
                notebook(zoom_out=1)


class c:
    @functools.cache
    def caller(self):
        baller({"test": 112, "tset": {"sdf": 10}}, 14, 18)


def caller():
    # nodLog(b)
    f().caller()


global a
a = 10
b = 20


if __name__ == "__main__":
    caller()
