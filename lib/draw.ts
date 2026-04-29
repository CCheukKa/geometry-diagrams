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
    private _position: Vector3D;
    private _lookAtTarget: Vector3D;
    private _focalLengths: Vector2D;
    private _principalPoint: Vector2D
    private _skewCoefficient: number;

    private _intrinsicMatrix: Matrix3x3 = null as any;
    private _extrinsicMatrix: Matrix3x4 = null as any;
    public projectionMatrix: Matrix = null as any;

    constructor(
        projectionType: ProjectionType,
        position: Vector3D,
        lookAtTarget: Vector3D,
        focalLengths: Vector2D,
        principalPoint: Vector2D = { x: 0, y: 0 },
        skewCoefficient: number = 0,
    ) {
        this._position = position;
        this._lookAtTarget = lookAtTarget;
        this._focalLengths = focalLengths;
        this._principalPoint = principalPoint;
        this.projectionType = projectionType;
        this._skewCoefficient = skewCoefficient;

        this.updateCameraMatrices();
    }

    set position(position: Vector3D) {
        this._position = position;
        this.updateCameraMatrices();
    }

    private updateCameraMatrices(): void {
        this._intrinsicMatrix = this.computeCameraIntrinsicMatrix();
        this._extrinsicMatrix = this.computeCameraExtrinsicMatrix();
        this.projectionMatrix = this.computeCameraProjectionMatrix();
    }

    private computeCameraIntrinsicMatrix(): Matrix3x3 {
        const focalLengthScalar = this.projectionType === ProjectionType.ORTHOGRAPHIC ? 1 : 800;
        return [
            [this._focalLengths.x * focalLengthScalar, this._skewCoefficient, this._principalPoint.x],
            [0, this._focalLengths.y * focalLengthScalar, this._principalPoint.y],
            [0, 0, 1],
        ];
    }

    private computeCameraExtrinsicMatrix(): Matrix3x4 {
        // Compute camera frame vectors
        // Forward: direction from camera to target
        const forward = toVector3D(toVector(this._lookAtTarget).subtract(toVector(this._position)).normalize());

        // Right: perpendicular to forward and up (world up is [0, 1, 0])
        const worldUp: Vector3D = { x: 0, y: 1, z: 0 };
        const right = toVector3D(toVector(forward).cross(toVector(worldUp)).normalize());

        // Up: perpendicular to forward and right  
        const up = toVector3D(toVector(right).cross(toVector(forward)).normalize());

        // Extrinsic matrix: [R | -R*t] where R = [right; up; -forward]
        // In camera space, z points backward (away from scene), so we negate forward
        const negForward: Vector3D = { x: -forward.x, y: -forward.y, z: -forward.z };

        // Compute translation in camera space: -R * position
        const t_cam_x = -(right.x * this._position.x + right.y * this._position.y + right.z * this._position.z);
        const t_cam_y = -(up.x * this._position.x + up.y * this._position.y + up.z * this._position.z);
        const t_cam_z = -(negForward.x * this._position.x + negForward.y * this._position.y + negForward.z * this._position.z);

        return [
            [right.x, right.y, right.z, t_cam_x],
            [up.x, up.y, up.z, t_cam_y],
            this.projectionType === ProjectionType.ORTHOGRAPHIC
                ? [0, 0, 0, 1]
                : [negForward.x, negForward.y, negForward.z, t_cam_z],
        ];
    }

    private computeCameraProjectionMatrix(): Matrix {
        return new Matrix(3, 3, this._intrinsicMatrix).multiply(new Matrix(3, 4, this._extrinsicMatrix));
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

        // Perspective: divide by depth (z)
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
