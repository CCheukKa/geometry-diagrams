import type { Line, Point } from "@lib/geometry";
import { Matrix, Vector } from "ts-matrix";
import type { Matrix3x3, Matrix3x4, Vector2D, Vector3D } from "./mathExtra";

const PALETTE = {
    point: "#ff0000",
    line: "#0000ff",
};

function toVector(v: Vector3D): Vector {
    return new Vector([v.x, v.y, v.z]);
}

function toVector3D(v: Vector): Vector3D {
    return {
        x: v.at(0),
        y: v.at(1),
        z: v.at(2),
    };
}

export function draw2D(paper: HTMLElement & SVGElement, points: Point[], lines: Line[]): void {
    // Clear previous drawings
    paper.innerHTML = "";

    // Draw points
    for (const point of points) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", point.x.toString());
        circle.setAttribute("cy", point.y.toString());
        circle.setAttribute("r", "5");
        circle.setAttribute("fill", PALETTE.point);
        paper.appendChild(circle);
    }

    // Draw lines
    for (const line of lines) {
        const [point1, point2] = line.points;
        const lineElement = document.createElementNS("http://www.w3.org/2000/svg", "line");
        lineElement.setAttribute("x1", point1.x.toString());
        lineElement.setAttribute("y1", point1.y.toString());
        lineElement.setAttribute("x2", point2.x.toString());
        lineElement.setAttribute("y2", point2.y.toString());
        lineElement.setAttribute("stroke", PALETTE.line);
        lineElement.setAttribute("stroke-width", "2");
        paper.appendChild(lineElement);
    }
}

export enum ProjectionType {
    PERSPECTIVE = "perspective",
    ORTHOGRAPHIC = "orthographic",
}
export class Camera {
    public projectionType: ProjectionType;
    public projectionMatrix: Matrix;

    constructor(
        projectionType: ProjectionType,
        position: Vector3D,
        lookAtTarget: Vector3D,
        focalLengths: Vector2D,
        principalPoint: Vector2D = { x: 0, y: 0 },
        skewCoefficient: number = 0,
    ) {
        this.projectionType = projectionType;

        const intrinsicMatrix = Camera.computeCameraIntrinsicMatrix(focalLengths, principalPoint, skewCoefficient);
        const extrinsicMatrix = Camera.computeCameraExtrinsicMatrix(projectionType, position, lookAtTarget);
        this.projectionMatrix = Camera.computeCameraProjectionMatrix(intrinsicMatrix, extrinsicMatrix);
    }

    private static computeCameraIntrinsicMatrix(focalLengths: Vector2D, principalPoint: Vector2D, skewCoefficient: number): Matrix3x3 {
        const { x: fx, y: fy } = focalLengths;
        const { x: cx, y: cy } = principalPoint;
        return [
            [fx, skewCoefficient, cx],
            [0, fy, cy],
            [0, 0, 1],
        ];
    }

    private static computeCameraExtrinsicMatrix(projectionType: ProjectionType, position: Vector3D, lookAtTarget: Vector3D): Matrix3x4 {
        // Compute camera frame vectors
        // Forward: direction from camera to target
        const forward = toVector3D(toVector(lookAtTarget).subtract(toVector(position)).normalize());

        // Right: perpendicular to forward and up (world up is [0, 1, 0])
        const worldUp: Vector3D = { x: 0, y: 1, z: 0 };
        const right = toVector3D(toVector(forward).cross(toVector(worldUp)).normalize());

        // Up: perpendicular to forward and right  
        const up = toVector3D(toVector(right).cross(toVector(forward)).normalize());

        // Extrinsic matrix: [R | -R*t] where R = [right; up; -forward]
        // In camera space, z points backward (away from scene), so we negate forward
        const negForward: Vector3D = { x: -forward.x, y: -forward.y, z: -forward.z };

        // Compute translation in camera space: -R * position
        const t_cam_x = -(right.x * position.x + right.y * position.y + right.z * position.z);
        const t_cam_y = -(up.x * position.x + up.y * position.y + up.z * position.z);
        const t_cam_z = -(negForward.x * position.x + negForward.y * position.y + negForward.z * position.z);

        if (projectionType === ProjectionType.ORTHOGRAPHIC) {
            // For orthographic, adjust if needed
            // For now, just use the same
        }

        return [
            [right.x, right.y, right.z, t_cam_x],
            [up.x, up.y, up.z, t_cam_y],
            [negForward.x, negForward.y, negForward.z, t_cam_z],
        ];
    }

    private static computeCameraProjectionMatrix(intrinsicMatrix: Matrix3x3, extrinsicMatrix: Matrix3x4): Matrix {
        return new Matrix(3, 3, intrinsicMatrix).multiply(new Matrix(3, 4, extrinsicMatrix));
    }
};

export function draw3D(paper: HTMLElement & SVGElement, camera: Camera, points: Point[], lines: Line[]): void {
    // Clear previous drawings
    paper.innerHTML = "";

    // Project points using camera matrix
    const projectedPoints = points.map((point) => {
        const pointVector = new Vector([point.x, point.y, point.z, 1]);
        const projectedVector = camera.projectionMatrix.multiplyVector(pointVector);

        // Extract x, y, z from the 3D result
        const x_proj = projectedVector.at(0);
        const y_proj = projectedVector.at(1);
        const z_proj = projectedVector.at(2);

        // Perspective divide by z (depth)
        // Avoid division by zero
        const depth = z_proj !== 0 ? z_proj : 1;

        return {
            x: x_proj / depth,
            y: y_proj / depth,
        };
    });

    // Draw points
    for (const projectedPoint of projectedPoints) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", projectedPoint.x.toString());
        circle.setAttribute("cy", projectedPoint.y.toString());
        circle.setAttribute("r", "5");
        circle.setAttribute("fill", PALETTE.point);
        paper.appendChild(circle);
    }

    // Draw lines
    for (const line of lines) {
        const [point1, point2] = line.points;
        const projectedPoint1 = projectedPoints[points.indexOf(point1)];
        const projectedPoint2 = projectedPoints[points.indexOf(point2)];
        const lineElement = document.createElementNS("http://www.w3.org/2000/svg", "line");
        lineElement.setAttribute("x1", projectedPoint1!.x.toString());
        lineElement.setAttribute("y1", projectedPoint1!.y.toString());
        lineElement.setAttribute("x2", projectedPoint2!.x.toString());
        lineElement.setAttribute("y2", projectedPoint2!.y.toString());
        lineElement.setAttribute("stroke", PALETTE.line);
        lineElement.setAttribute("stroke-width", "2");
        paper.appendChild(lineElement);
    }
}
