from nod import notebook, log
import ipdb


def caller():
    a = 15

    def baller(a, b, c):
        b = 20

        c = 40

        for x in range(0, 10):
            c += 1
        # change
        l = []
        l.append(l)
        notebook()

    baller(a, 10, 20)


global a
a = 10
b = 20
print(b)
caller()
# nod()
