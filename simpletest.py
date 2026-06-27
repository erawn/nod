import pathlib

from nodpy import notebook, nodLog

x = 0


def baller(a, b: int, c: int):
    nodLog(a, b)
    nodLog(a, b)
    nodLog(a, b)
    nodLog(a, b)
    nodLog(c)
    global x

    # %who_ls 

    x += 2
    if x > 4:
        notebook()


def caller():
    nodLog(b)
    baller({"test": 112, "tset": {"sdf": 10}}, 14, 18)
    baller(11, 15, 19)
    baller(12, 16, 20)
    baller(13, 17, 21) 
    baller(13, 17, 23)


global a
a = 10
b = 20


if __name__ == "__main__":
    caller()
