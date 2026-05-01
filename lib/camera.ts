import { Matrix } from "ts-matrix";
import { toVector, toVector3D, type Matrix3x3, type Matrix3x4, type Vector2D, type Vector3D, vectorLengthSquared } from "./mathExtra";

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
    private _principalVertex: Vector2D;
    private _skewCoefficient: number;

    private _intrinsicMatrix: Matrix3x3 = null as any;
    private _extrinsicMatrix: Matrix3x4 = null as any;
    public projectionMatrix: Matrix = null as any;

    constructor(
        projectionType: ProjectionType,
        position: Vector3D,
        lookAtTarget: Vector3D,
        focalLengths: Vector2D,
        principalVertex: Vector2D = { x: 0, y: 0 },
        skewCoefficient: number = 0,
    ) {
        this._position = position;
        this._lookAtTarget = lookAtTarget;
        this._upHint = { x: 0, y: 0, z: 1 };
        this._focalLengths = focalLengths;
        this._principalVertex = principalVertex;
        this._projectionType = projectionType;
        this._skewCoefficient = skewCoefficient;

        this.updateCameraMatrices();
    }

    set position(position: Vector3D) {
        this._position = position;
        this.updateCameraMatrices();
    }

    set lookAtTarget(lookAtTarget: Vector3D) {
        this._lookAtTarget = lookAtTarget;
        this.updateCameraMatrices();
    }

    get lookAtTarget(): Vector3D {
        return this._lookAtTarget;
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

    public getForwardDepth(vertex: Vector3D): number {
        const forward = toVector3D(toVector(this._lookAtTarget).subtract(toVector(this._position)).normalize());
        const delta = {
            x: vertex.x - this._position.x,
            y: vertex.y - this._position.y,
            z: vertex.z - this._position.z,
        };
        return forward.x * delta.x + forward.y * delta.y + forward.z * delta.z;
    }

    public toCameraSpace(vertex: Vector3D): Vector3D {
        const { right, up, negForward } = this.computeCameraFrame();
        const delta = {
            x: vertex.x - this._position.x,
            y: vertex.y - this._position.y,
            z: vertex.z - this._position.z,
        };

        return {
            x: right.x * delta.x + right.y * delta.y + right.z * delta.z,
            y: up.x * delta.x + up.y * delta.y + up.z * delta.z,
            z: negForward.x * delta.x + negForward.y * delta.y + negForward.z * delta.z,
        };
    }

    private updateCameraMatrices(): void {
        this._intrinsicMatrix = this.computeCameraIntrinsicMatrix();
        this._extrinsicMatrix = this.computeCameraExtrinsicMatrix();
        this.projectionMatrix = this.computeCameraProjectionMatrix();
    }

    private computeCameraFrame(): { forward: Vector3D; right: Vector3D; up: Vector3D; negForward: Vector3D } {
        const forward = toVector3D(toVector(this._lookAtTarget).subtract(toVector(this._position)).normalize());

        let upReference = toVector3D(toVector(this._upHint).normalize());
        let rightVector = toVector(upReference).cross(toVector(forward));

        if (vectorLengthSquared(toVector3D(rightVector)) < 1e-12) {
            const fallbackUp: Vector3D = { x: 1, y: 0, z: 0 };
            upReference = fallbackUp;
            rightVector = toVector(fallbackUp).cross(toVector(forward));
        }

        const right = toVector3D(rightVector.normalize());
        const up = toVector3D(toVector(forward).cross(toVector(right)).normalize());
        const negForward: Vector3D = { x: -forward.x, y: -forward.y, z: -forward.z };

        return { forward, right, up, negForward };
    }

    private computeCameraIntrinsicMatrix(): Matrix3x3 {
        const focalLengthScalar = this._projectionType === ProjectionType.ORTHOGRAPHIC ? 1 : 800;
        return [
            [this._focalLengths.x * focalLengthScalar, this._skewCoefficient, this._principalVertex.x],
            [0, this._focalLengths.y * focalLengthScalar, this._principalVertex.y],
            [0, 0, 1],
        ];
    }

    private computeCameraExtrinsicMatrix(): Matrix3x4 {
        const { right, up, negForward } = this.computeCameraFrame();

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
}
