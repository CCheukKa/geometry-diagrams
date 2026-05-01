export class Vertex {
    public x: number;
    public y: number;
    public z: number;
    public colour?: string | undefined;

    constructor(x: number, y: number, z: number, colour?: string) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.colour = colour;
    }
}

export class Edge {
    public vertices: [Vertex, Vertex];
    public colour?: string | undefined;

    constructor(vertex1: Vertex, vertex2: Vertex, colour?: string) {
        this.vertices = [vertex1, vertex2];
        this.colour = colour;
    }
}

export class Triangle {
    public vertices: [Vertex, Vertex, Vertex];
    public colour?: string | undefined;

    constructor(vertex1: Vertex, vertex2: Vertex, vertex3: Vertex, colour?: string) {
        this.vertices = [vertex1, vertex2, vertex3];
        this.colour = colour;
    }
}