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