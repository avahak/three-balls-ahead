"""
Uniform cubic B-spline to exactly match a quadratic curve on a specific interval.
"""
import numpy as np
import matplotlib.pyplot as plt
from scipy.interpolate import BSpline
from scipy.spatial import ConvexHull

A = np.random.randn(2)
B = np.random.randn(2)
C = np.random.randn(2)

t0, t1 = sorted(np.random.randn(2))
h = t1 - t0

def q(t):
    t = np.asarray(t)
    return A/2 * t[:, None] ** 2 + B * t[:, None] + C

# Quadratic in normalized parameter u\in[0,1]
a = A/2 * h * h
b = (A * t0 + B) * h
c = A/2 * t0 * t0 + B * t0 + C

P = np.array([
    a * k**2 + b * k + c - a / 3.0
    for k in range(-1, 3)
])

n = len(P)
deg = 3
knots = np.linspace(-3, n + deg - 3, n + deg + 1)
spline = BSpline(knots, P, deg)

u = np.linspace(0.0, 1.0, 500)
t = t0 + h * u

curve_exact = q(t)
curve_spline = spline(u)

err = np.max(np.linalg.norm(curve_exact - curve_spline, axis=1))
print("max error:", err)

plt.plot(curve_exact[:, 0], curve_exact[:, 1], linewidth=5, label="parabola")
plt.plot(curve_spline[:, 0], curve_spline[:, 1], label="uniform cubic B-spline")
plt.scatter(P[:, 0], P[:, 1], c="red", zorder=3, label="control points")
for i, (x, y) in enumerate(P):
    plt.annotate(f'$P_{{{i}}}$', xy=(x, y), xytext=(-5, 7), textcoords='offset points')

hull = ConvexHull(P)
hull_pts = P[hull.vertices]
plt.fill(hull_pts[:,0], hull_pts[:,1], alpha=0.15)

plt.axis("equal")
plt.legend()
plt.show()