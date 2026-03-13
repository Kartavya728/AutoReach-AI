import math
from turtle import *

def flowerx(k):
    r = 15 * math.cos(6 * k)  # 6 petals
    return r * math.cos(k)

def flowery(k):
    r = 15 * math.cos(6 * k)  # 6 petals
    return r * math.sin(k)

speed(0)
bgcolor("black")

for i in range(6000):
    k = i  # same as heart — raw integer passed in, no scaling
    x = flowerx(k) * 20
    y = flowery(k) * 20
    goto(x, y)
    for j in range(1):
        color("yellow")
        dot()

goto(0, 0)
done()