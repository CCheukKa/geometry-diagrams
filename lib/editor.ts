import { Edge, Vertex } from "@lib/geometry.ts";
import { ConstraintType } from "@lib/constraints";

export type ScenePoint = {
    id: string;
    name: string;
    x: number;
    y: number;
    z: number;
    vertex: Vertex;
};

export type SceneLine = {
    id: string;
    name: string;
    pointAId: string;
    pointBId: string;
    edge: Edge;
};

export type ScenePlane = {
    id: string;
    name: string;
    pointIds: [string, string, string];
};

export type ScenePolygon = {
    id: string;
    name: string;
    pointIds: string[];
};

export type SceneConstraint = {
    id: string;
    type: ConstraintType;
    label: string;
    summary: string;
    payload: Record<string, string | number | null | string[]>;
};

export type AddConstraintInput =
    | {
        type: ConstraintType.Position;
        pointId: string;
        x: number | null;
        y: number | null;
        z: number | null;
    } | {
        type: ConstraintType.Length;
        lineId: string;
        length: number;
    } | {
        type: ConstraintType.AngleBetweenLines;
        point1Id: string;
        vertexId: string;
        point2Id: string;
        angleDegrees: number;
    } | {
        type: ConstraintType.AngleBetweenLineAndPlane;
        lineId: string;
        planeId: string;
        angleDegrees: number;
    } | {
        type: ConstraintType.AngleBetweenPlanes;
        planeId: string;
        planeId2: string;
        angleDegrees: number;
    } | {
        type: ConstraintType.PointOnLine | ConstraintType.PointOnLineSegment;
        pointId: string;
        lineId: string;
    } | {
        type: ConstraintType.PointOnPlane;
        pointId: string;
        planeId: string;
    } | {
        type: ConstraintType.PointOnPolygon;
        pointId: string;
        polygonId: string;
    } | {
        type: ConstraintType.Parallel | ConstraintType.Perpendicular;
        line1Id: string;
        line2Id: string;
    } | {
        type: ConstraintType.Collinear;
        pointIds: [string, string, string];
    } | {
        type: ConstraintType.Coplanar;
        pointIds: [string, string, string, string];
    };

type SceneOption = {
    id: string;
    label: string;
};

const POINT_NAMES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class SceneEditor {
    private pointCounter = 1;
    private lineCounter = 1;
    private planeCounter = 1;
    private polygonCounter = 1;
    private constraintCounter = 1;

    private points: ScenePoint[] = [];
    private lines: SceneLine[] = [];
    private planes: ScenePlane[] = [];
    private polygons: ScenePolygon[] = [];
    private constraints: SceneConstraint[] = [];

    addPoint(name: string, x: number, y: number, z: number): ScenePoint {
        const pointName = name.trim() || this.getDefaultPointName();
        const point: ScenePoint = {
            id: `point-${this.pointCounter++}`,
            name: pointName,
            x,
            y,
            z,
            vertex: new Vertex(x, y, z),
        };

        this.points.push(point);
        return point;
    }

    addLine(name: string, pointAId: string, pointBId: string): SceneLine {
        const pointA = this.getPointById(pointAId);
        const pointB = this.getPointById(pointBId);

        if (pointAId === pointBId) {
            throw new Error("A line needs two different points");
        }

        const lineName = name.trim() || `${pointA.name}${pointB.name}`;
        const line: SceneLine = {
            id: `line-${this.lineCounter++}`,
            name: lineName,
            pointAId,
            pointBId,
            edge: new Edge(pointA.vertex, pointB.vertex),
        };

        this.lines.push(line);
        return line;
    }

    addPlane(name: string, pointIds: [string, string, string]): ScenePlane {
        const pointA = this.getPointById(pointIds[0]);
        const pointB = this.getPointById(pointIds[1]);
        const pointC = this.getPointById(pointIds[2]);
        const planeName = name.trim() || `${pointA.name}${pointB.name}${pointC.name}`;

        const plane: ScenePlane = {
            id: `plane-${this.planeCounter++}`,
            name: planeName,
            pointIds,
        };

        this.planes.push(plane);
        return plane;
    }

    addPolygon(name: string, pointIds: string[]): ScenePolygon {
        if (pointIds.length < 3) {
            throw new Error("A polygon needs at least three points");
        }

        const points = pointIds.map(pointId => this.getPointById(pointId));
        const polygonName = name.trim() || points.map(point => point.name).join("");

        const polygon: ScenePolygon = {
            id: `polygon-${this.polygonCounter++}`,
            name: polygonName,
            pointIds,
        };

        this.polygons.push(polygon);
        return polygon;
    }

    addConstraint(input: AddConstraintInput): SceneConstraint {
        const constraint = this.buildConstraint(input);
        this.constraints.push(constraint);
        return constraint;
    }

    getPoints(): ScenePoint[] {
        return [...this.points];
    }

    getLines(): SceneLine[] {
        return [...this.lines];
    }

    getPlanes(): ScenePlane[] {
        return [...this.planes];
    }

    getPolygons(): ScenePolygon[] {
        return [...this.polygons];
    }

    getConstraints(): SceneConstraint[] {
        return [...this.constraints];
    }

    getPointOptions(): SceneOption[] {
        return this.points.map(point => ({ id: point.id, label: point.name }));
    }

    getLineOptions(): SceneOption[] {
        return this.lines.map(line => ({ id: line.id, label: line.name }));
    }

    getPlaneOptions(): SceneOption[] {
        return this.planes.map(plane => ({ id: plane.id, label: plane.name }));
    }

    getPolygonOptions(): SceneOption[] {
        return this.polygons.map(polygon => ({ id: polygon.id, label: polygon.name }));
    }

    getRenderableVertices(): Vertex[] {
        return this.points.map(point => point.vertex);
    }

    getRenderableEdges(): Edge[] {
        return this.lines.map(line => line.edge);
    }

    getRenderableAnnotations(): { text: string; position: Vertex; colour?: string }[] {
        return this.points.map(point => ({
            text: point.name,
            position: point.vertex,
        }));
    }

    private buildConstraint(input: AddConstraintInput): SceneConstraint {
        const id = `constraint-${this.constraintCounter++}`;

        switch (input.type) {
            case ConstraintType.Position: {
                const point = this.getPointById(input.pointId);
                return {
                    id,
                    type: input.type,
                    label: `${point.name} position`,
                    summary: `${point.name} at (${this.formatNullable(input.x)}, ${this.formatNullable(input.y)}, ${this.formatNullable(input.z)})`,
                    payload: {
                        pointId: input.pointId,
                        x: input.x,
                        y: input.y,
                        z: input.z,
                    },
                };
            }
            case ConstraintType.Length: {
                const line = this.getLineById(input.lineId);
                return {
                    id,
                    type: input.type,
                    label: `${line.name} length`,
                    summary: `${line.name} = ${this.formatNumber(input.length)}`,
                    payload: {
                        lineId: input.lineId,
                        length: input.length,
                    },
                };
            }
            case ConstraintType.AngleBetweenLines: {
                const point1 = this.getPointById(input.point1Id);
                const vertex = this.getPointById(input.vertexId);
                const point2 = this.getPointById(input.point2Id);
                return {
                    id,
                    type: input.type,
                    label: `${vertex.name} angle`,
                    summary: `${point1.name}-${vertex.name}-${point2.name} = ${this.formatNumber(input.angleDegrees)} deg`,
                    payload: {
                        point1Id: input.point1Id,
                        vertexId: input.vertexId,
                        point2Id: input.point2Id,
                        angleDegrees: input.angleDegrees,
                    },
                };
            }
            case ConstraintType.AngleBetweenLineAndPlane: {
                const line = this.getLineById(input.lineId);
                const plane = this.getPlaneById(input.planeId);
                return {
                    id,
                    type: input.type,
                    label: `${line.name} angle`,
                    summary: `${line.name} - ${plane.name} = ${this.formatNumber(input.angleDegrees)} deg`,
                    payload: {
                        lineId: input.lineId,
                        planeId: input.planeId,
                        angleDegrees: input.angleDegrees,
                    },
                };
            }
            case ConstraintType.AngleBetweenPlanes: {
                const plane1 = this.getPlaneById(input.planeId);
                const plane2 = this.getPlaneById(input.planeId2);
                return {
                    id,
                    type: input.type,
                    label: `Plane angle`,
                    summary: `${plane1.name} - ${plane2.name} = ${this.formatNumber(input.angleDegrees)} deg`,
                    payload: {
                        planeId: input.planeId,
                        planeId2: input.planeId2,
                        angleDegrees: input.angleDegrees,
                    },
                };
            }
            case ConstraintType.PointOnLine:
            case ConstraintType.PointOnLineSegment: {
                const point = this.getPointById(input.pointId);
                const line = this.getLineById(input.lineId);
                return {
                    id,
                    type: input.type,
                    label: `${point.name} on ${line.name}`,
                    summary: `${point.name} on ${line.name}`,
                    payload: {
                        pointId: input.pointId,
                        lineId: input.lineId,
                    },
                };
            }
            case ConstraintType.PointOnPlane: {
                const point = this.getPointById(input.pointId);
                const plane = this.getPlaneById(input.planeId);
                return {
                    id,
                    type: input.type,
                    label: `${point.name} on ${plane.name}`,
                    summary: `${point.name} on ${plane.name}`,
                    payload: {
                        pointId: input.pointId,
                        planeId: input.planeId,
                    },
                };
            }
            case ConstraintType.PointOnPolygon: {
                const point = this.getPointById(input.pointId);
                const polygon = this.getPolygonById(input.polygonId);
                return {
                    id,
                    type: input.type,
                    label: `${point.name} on ${polygon.name}`,
                    summary: `${point.name} on ${polygon.name}`,
                    payload: {
                        pointId: input.pointId,
                        polygonId: input.polygonId,
                    },
                };
            }
            case ConstraintType.Parallel:
            case ConstraintType.Perpendicular: {
                const line1 = this.getLineById(input.line1Id);
                const line2 = this.getLineById(input.line2Id);
                return {
                    id,
                    type: input.type,
                    label: `${line1.name} ${input.type}`,
                    summary: `${line1.name} ${input.type} ${line2.name}`,
                    payload: {
                        line1Id: input.line1Id,
                        line2Id: input.line2Id,
                    },
                };
            }
            case ConstraintType.Collinear: {
                const points = input.pointIds.map(pointId => this.getPointById(pointId));
                return {
                    id,
                    type: input.type,
                    label: `${points.map(point => point.name).join("-")} collinear`,
                    summary: `${points.map(point => point.name).join(", ")} are collinear`,
                    payload: {
                        pointIds: input.pointIds,
                    },
                };
            }
            case ConstraintType.Coplanar: {
                const points = input.pointIds.map(pointId => this.getPointById(pointId));
                return {
                    id,
                    type: input.type,
                    label: `${points.map(point => point.name).join("")} coplanar`,
                    summary: `${points.map(point => point.name).join(", ")} are coplanar`,
                    payload: {
                        pointIds: input.pointIds,
                    },
                };
            }
        }
    }

    private getPointById(pointId: string): ScenePoint {
        const point = this.points.find(candidate => candidate.id === pointId);
        if (point === undefined) {
            throw new Error(`Unknown point: ${pointId}`);
        }
        return point;
    }

    private getLineById(lineId: string): SceneLine {
        const line = this.lines.find(candidate => candidate.id === lineId);
        if (line === undefined) {
            throw new Error(`Unknown line: ${lineId}`);
        }
        return line;
    }

    private getPlaneById(planeId: string): ScenePlane {
        const plane = this.planes.find(candidate => candidate.id === planeId);
        if (plane === undefined) {
            throw new Error(`Unknown plane: ${planeId}`);
        }
        return plane;
    }

    private getPolygonById(polygonId: string): ScenePolygon {
        const polygon = this.polygons.find(candidate => candidate.id === polygonId);
        if (polygon === undefined) {
            throw new Error(`Unknown polygon: ${polygonId}`);
        }
        return polygon;
    }

    private formatNumber(value: number): string {
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
    }

    private formatNullable(value: number | null): string {
        return value === null ? "-" : this.formatNumber(value);
    }

    private getDefaultPointName(): string {
        const usedNames = new Set(this.points.map(point => point.name));

        for (const name of POINT_NAMES) {
            if (!usedNames.has(name)) {
                return name;
            }
        }

        return `Point ${this.pointCounter}`;
    }
}
