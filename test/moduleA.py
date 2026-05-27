from moduleB import functionB


def functionA():
    t = 9
    functionA2(t + 3)


def functionA2(x):
    k = 10 + x
    functionB(k + 3)


functionA()
