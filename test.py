from nod import nod
import inspect
def caller():
    print(inspect.stack()[0].filename)
    # print(inspect.getframeinfo(inspect.getfr))
    # print(__file__)
    # # print(__annotations__)
    # # print(__path__)
    # print(__package__)
    # print(__spec__)
    # print(__name__)
    # print(__doc__)
    # print(__frame__)


global a 
a = 10
b = 20
print(b)
nod()
caller()



