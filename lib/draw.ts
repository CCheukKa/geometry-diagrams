import type { Tri, Line, Point } from "@lib/geometry";
import { Matrix, Vector } from "ts-matrix";
import { toVector, toVector3D, vectorLengthSquared, type Matrix3x3, type Matrix3x4, type Vector2D, type Vector3D } from "./mathExtra";

const PALETTE = {
    point: "#ff0000",
    line: "#0000ff",
};

export enum ProjectionType {
    PERSPECTIVE = "perspective",
    ORTHOGRAPHIC = "orthographic",
}
export class Camera {
    private _projectionType: ProjectionType;
    private _position: Vector3D;
    private _lookAtTarget: Vector3D;
    private _upHint: Vector3D;
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
        this._upHint = { x: 0, y: 0, z: 1 };
        this._focalLengths = focalLengths;
        this._principalPoint = principalPoint;
        this._projectionType = projectionType;
        this._skewCoefficient = skewCoefficient;

        this.updateCameraMatrices();
    }

    set position(position: Vector3D) {
        this._position = position;
        this.updateCameraMatrices();
    }

    set upHint(upHint: Vector3D) {
        this._upHint = upHint;
        this.updateCameraMatrices();
    }

    get projectionType(): ProjectionType {
        return this._projectionType;
    }

    set projectionType(projectionType: ProjectionType) {
        this._projectionType = projectionType;
        this.updateCameraMatrices();
    }

    public getForwardDepth(point: Vector3D): number {
        const forward = toVector3D(toVector(this._lookAtTarget).subtract(toVector(this._position)).normalize());
        const delta = {
            x: point.x - this._position.x,
            y: point.y - this._position.y,
            z: point.z - this._position.z,
        };
        return forward.x * delta.x + forward.y * delta.y + forward.z * delta.z;
    }

    private updateCameraMatrices(): void {
        this._intrinsicMatrix = this.computeCameraIntrinsicMatrix();
        this._extrinsicMatrix = this.computeCameraExtrinsicMatrix();
        this.projectionMatrix = this.computeCameraProjectionMatrix();
    }

    private computeCameraIntrinsicMatrix(): Matrix3x3 {
        const focalLengthScalar = this._projectionType === ProjectionType.ORTHOGRAPHIC ? 1 : 800;
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

        // Right: perpendicular to up hint and forward.
        let upReference = toVector3D(toVector(this._upHint).normalize());
        let rightVector = toVector(upReference).cross(toVector(forward));

        // Fallback when forward is parallel to the provided up reference.
        if (vectorLengthSquared(toVector3D(rightVector)) < 1e-12) {
            const fallbackUp: Vector3D = { x: 1, y: 0, z: 0 };
            upReference = fallbackUp;
            rightVector = toVector(fallbackUp).cross(toVector(forward));
        }

        const right = toVector3D(rightVector.normalize());

        // Up: perpendicular to forward and right.
        const up = toVector3D(toVector(forward).cross(toVector(right)).normalize());

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
            this._projectionType === ProjectionType.ORTHOGRAPHIC
                ? [0, 0, 0, 1]
                : [negForward.x, negForward.y, negForward.z, t_cam_z],
        ];
    }

    private computeCameraProjectionMatrix(): Matrix {
        return new Matrix(3, 3, this._intrinsicMatrix).multiply(new Matrix(3, 4, this._extrinsicMatrix));
    }
};

export type Annotation = {
    text: string;
    position: Point;
    colour?: string;
}

export type DrawOptions = {
    renderPoints?: boolean;
    renderAnnotations?: boolean;
    triOpacity?: number;
    annotationsAlwaysOnTop?: boolean;
    lineThickness?: number;
}

enum DrawableType {
    POINT = "point",
    LINE = "line",
    TRI = "tri",
    ANNOTATION = "annotation",
}

export function draw3D(
    paper: HTMLElement & SVGElement,
    camera: Camera,
    points: Point[],
    lines: Line[],
    tris: Tri[],
    annotations: Annotation[],
    options: DrawOptions = {},
): void {
    const renderPoints = options.renderPoints ?? true;
    const renderAnnotations = options.renderAnnotations ?? true;
    const annotationsAlwaysOnTop = options.annotationsAlwaysOnTop ?? true;

    type ProjectedPoint = {
        x: number;
        y: number;
        depth: number;
        withinRenderFrustrum: boolean;
        colour: string | undefined;
    };

    type Drawable = {
        depth: number;
        colour?: string | undefined;
    } & (
            | { type: DrawableType.POINT; data: Point }
            | { type: DrawableType.LINE; data: Line }
            | { type: DrawableType.TRI; data: [ProjectedPoint, ProjectedPoint, ProjectedPoint] }
            | { type: DrawableType.ANNOTATION; data: Annotation }
        );

    paper.innerHTML = "";
    drawGeometry();

    function project(point: Point): ProjectedPoint {
        const pointVector = new Vector([point.x, point.y, point.z ?? 0, 1]);
        const projectedVector = camera.projectionMatrix.multiplyVector(pointVector);
        const depth = camera.getForwardDepth({ x: point.x, y: point.y, z: point.z ?? 0 });

        // Extract x, y, z from the 3D result
        const x_proj = projectedVector.at(0);
        const y_proj = projectedVector.at(1);

        if (camera.projectionType === ProjectionType.ORTHOGRAPHIC) {
            return {
                x: x_proj,
                y: y_proj,
                depth,
                withinRenderFrustrum: true,
                colour: point.colour,
            };
        }

        if (depth <= 1e-6) {
            return {
                x: x_proj,
                y: y_proj,
                depth,
                withinRenderFrustrum: false,
                colour: point.colour,
            };
        }

        // Perspective divide uses forward depth along the camera view direction.
        return {
            x: x_proj / depth,
            y: y_proj / depth,
            depth,
            withinRenderFrustrum: true,
            colour: point.colour,
        };
    }

    function drawGeometry() {
        const drawables: Drawable[] = [];

        for (const tri of tris) {
            const [point1, point2, point3] = tri.points;
            const projectedPoint1 = project(point1);
            const projectedPoint2 = project(point2);
            const projectedPoint3 = project(point3);
            const averageDepth = (projectedPoint1.depth + projectedPoint2.depth + projectedPoint3.depth) / 3;
            if (camera.projectionType === ProjectionType.PERSPECTIVE && (!projectedPoint1.withinRenderFrustrum || !projectedPoint2.withinRenderFrustrum || !projectedPoint3.withinRenderFrustrum)) { continue; }
            drawables.push({
                type: DrawableType.TRI,
                colour: tri.colour,
                data: [projectedPoint1, projectedPoint2, projectedPoint3],
                depth: averageDepth,
            });
        }

        for (const line of lines) {
            const [point1, point2] = line.points;
            const projectedPoint1 = project(point1);
            const projectedPoint2 = project(point2);
            if (camera.projectionType === ProjectionType.PERSPECTIVE && (!projectedPoint1.withinRenderFrustrum || !projectedPoint2.withinRenderFrustrum)) { continue; }
            drawables.push({
                type: DrawableType.LINE,
                colour: line.colour,
                data: line,
                depth: (projectedPoint1.depth + projectedPoint2.depth) / 2,
            });
        }

        if (renderPoints) {
            for (const point of points) {
                const projectedPoint = project(point);
                if (camera.projectionType === ProjectionType.PERSPECTIVE && !projectedPoint.withinRenderFrustrum) { continue; }
                drawables.push({
                    type: DrawableType.POINT,
                    depth: projectedPoint.depth,
                    colour: projectedPoint.colour,
                    data: point,
                });
            }
        }

        if (renderAnnotations) {
            for (const annotation of annotations) {
                const projectedPosition = project(annotation.position);
                if (camera.projectionType === ProjectionType.PERSPECTIVE && !projectedPosition.withinRenderFrustrum) { continue; }
                drawables.push({
                    type: DrawableType.ANNOTATION,
                    depth: annotationsAlwaysOnTop ? -Infinity : projectedPosition.depth,
                    data: annotation,
                });
            }
        }

        drawables.sort((a, b) => b.depth - a.depth);
        for (const drawable of drawables) {
            switch (drawable.type) {
                case DrawableType.POINT: {
                    const projectedPoint = project(drawable.data);
                    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    circle.setAttribute("cx", projectedPoint.x.toString());
                    circle.setAttribute("cy", projectedPoint.y.toString());
                    circle.setAttribute("r", "5");
                    circle.setAttribute("fill", projectedPoint.colour ?? PALETTE.point);
                    paper.appendChild(circle);
                    break;
                }
                case DrawableType.LINE: {
                    const line = drawable.data;
                    const [point1, point2] = line.points;
                    const projectedPoint1 = project(point1);
                    const projectedPoint2 = project(point2);
                    const lineElement = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    lineElement.setAttribute("x1", projectedPoint1.x.toString());
                    lineElement.setAttribute("y1", projectedPoint1.y.toString());
                    lineElement.setAttribute("x2", projectedPoint2.x.toString());
                    lineElement.setAttribute("y2", projectedPoint2.y.toString());
                    lineElement.setAttribute("stroke", line.colour ?? PALETTE.line);
                    lineElement.setAttribute("stroke-width", (options.lineThickness ?? 2).toString());
                    lineElement.setAttribute("stroke-linecap", "round");
                    lineElement.setAttribute("stroke-linejoin", "round");
                    lineElement.setAttribute("shape-rendering", "geometricPrecision");
                    paper.appendChild(lineElement);
                    break;
                }
                case DrawableType.TRI: {
                    const [projectedPoint1, projectedPoint2, projectedPoint3] = drawable.data;
                    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                    polygon.setAttribute("points", `${projectedPoint1.x},${projectedPoint1.y} ${projectedPoint2.x},${projectedPoint2.y} ${projectedPoint3.x},${projectedPoint3.y}`);
                    polygon.setAttribute("fill", drawable.colour ?? "#cccccc");
                    polygon.setAttribute("fill-opacity", options.triOpacity?.toString() ?? "0.1");
                    polygon.setAttribute("stroke-linejoin", "round");
                    polygon.setAttribute("shape-rendering", "geometricPrecision");
                    paper.appendChild(polygon);
                    break;
                }
                case DrawableType.ANNOTATION: {
                    const annotation = drawable.data;
                    const projectedPosition = project(annotation.position);
                    const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    textElement.setAttribute("x", projectedPosition.x.toString());
                    textElement.setAttribute("y", projectedPosition.y.toString());
                    textElement.setAttribute("fill", annotation.colour ?? "#000000");
                    textElement.setAttribute("dominant-baseline", "middle");
                    textElement.setAttribute("text-anchor", "middle");
                    textElement.textContent = annotation.text;
                    paper.appendChild(textElement);
                    break;
                }
            }
        }
    }
}
