import pathlib

from nodpy import notebook, nodPrint


def baller(a: int, b: int, c: int):
    b = 20
    var = 3
    # nodPrint(b)
    c = 40
    c += 1
    notebook()


def caller():
    baller(a, 10, 20)


global a
a = 10
b = 20


if __name__ == "__main__":
    with open("directory.txt", "w") as f:
        f.write(str(pathlib.Path.cwd()))
    caller()
