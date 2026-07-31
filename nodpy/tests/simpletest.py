import functools
import os
import pathlib

from nodpy import notebook, nodLog, nodConfig

x = 0


def baller(a, b: int, c: int):
    global x
    global z

    x += 2
    if x > 4:
        print("reached notebook")
        notebook(zoom_out=0)


class d:
    @functools.cache
    def caller(self):
        pass


class f:
    @functools.cache
    def caller(self):
        for x in range(10):
            nodLog(x)
            if 1 > 0:
                notebook(zoom_out=0)

                print(113222)


class c:
    @functools.cache
    def caller(self):
        baller({"test": 112, "tset": {"sdf": 10}}, 14, 18)


def caller():
    f().caller()


global a
a = 10
b = 20


if __name__ == "__main__":

    caller()
