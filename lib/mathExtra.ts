import { Quat, Vector } from "ts-matrix";

export type Vector2D = { x: number; y: number };
export type Vector3D = { x: number; y: number; z: number };
export type Matrix3x3 = [
    [number, number, number],
    [number, number, number],
    [number, number, number],
];
export type Matrix3x4 = [
    [number, number, number, number],
    [number, number, number, number],
    [number, number, number, number],
];

export function vectorLengthSquared(v: Vector3D): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function subtract2D(vertex1: Vector2D, vertex2: Vector2D): Vector2D {
    return { x: vertex1.x - vertex2.x, y: vertex1.y - vertex2.y };
}

export function cross2D(vertex1: Vector2D, vertex2: Vector2D): number {
    return vertex1.x * vertex2.y - vertex1.y * vertex2.x;
}

export function orient2D(vertex1: Vector2D, vertex2: Vector2D, vertex3: Vector2D): number {
    return cross2D(subtract2D(vertex2, vertex1), subtract2D(vertex3, vertex1));
}

export function barycentricCoordinates2D(vertex: Vector2D, triangle: [Vector2D, Vector2D, Vector2D]): [number, number, number] | null {
    const denominator = orient2D(triangle[0], triangle[1], triangle[2]);
    if (Math.abs(denominator) < 1e-7) {
        return null;
    }

    const weight1 = orient2D(vertex, triangle[1], triangle[2]) / denominator;
    const weight2 = orient2D(vertex, triangle[2], triangle[0]) / denominator;
    const weight3 = 1 - weight1 - weight2;
    return [weight1, weight2, weight3];
}

export function dot3(vertex1: Vector3D, vertex2: Vector3D): number {
    return vertex1.x * vertex2.x + vertex1.y * vertex2.y + vertex1.z * vertex2.z;
}

export function triangleNormal(vertex1: Vector3D, vertex2: Vector3D, vertex3: Vector3D): Vector3D {
    const edge1 = {
        x: vertex2.x - vertex1.x,
        y: vertex2.y - vertex1.y,
        z: vertex2.z - vertex1.z,
    };
    const edge2 = {
        x: vertex3.x - vertex1.x,
        y: vertex3.y - vertex1.y,
        z: vertex3.z - vertex1.z,
    };

    return {
        x: edge1.y * edge2.z - edge1.z * edge2.y,
        y: edge1.z * edge2.x - edge1.x * edge2.z,
        z: edge1.x * edge2.y - edge1.y * edge2.x,
    };
}

export function normaliseVector(v: Vector3D): Vector3D {
    const length = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / length, y: v.y / length, z: v.z / length };
}

export function axisAngleToQuaternion(axis: Vector3D, angleRadians: number): Quat {
    const normalizedAxis = normaliseVector(axis);
    return Quat.fromAxisAngle(new Vector([normalizedAxis.x, normalizedAxis.y, normalizedAxis.z]), angleRadians);
}

export function rotateVector(v: Vector3D, q: Quat): Vector3D {
    const vectorQuat = new Quat([v.x, v.y, v.z, 0]);
    const rotatedQuat = Quat.product(Quat.product(q, vectorQuat), q.copy().conjugate());
    return {
        x: rotatedQuat.x,
        y: rotatedQuat.y,
        z: rotatedQuat.z,
    };
}

export function toVector(v: Vector3D): Vector {
    return new Vector([v.x, v.y, v.z]);
}

export function toVector3D(v: Vector): Vector3D {
    return {
        x: v.at(0),
        y: v.at(1),
        z: v.at(2),
    };
}